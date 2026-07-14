const path = require("node:path");
const fs = require("node:fs/promises");
const JSZip = require("jszip");
const { XMLParser } = require("fast-xml-parser");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const rawDir = path.join(process.cwd(), "data", "raw");
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: false,
  removeNSPrefix: true,
  trimValues: false,
});

async function readSheet(fileName, sheetName) {
  const filePath = path.join(rawDir, fileName);
  const zip = await JSZip.loadAsync(await fs.readFile(filePath));
  const workbook = await readXml(zip, "xl/workbook.xml");
  const workbookRels = await readXml(zip, "xl/_rels/workbook.xml.rels");
  const workbookSheets = asArray(workbook?.workbook?.sheets?.sheet);
  const sheetMeta = workbookSheets.find((sheet) => sheet.name === sheetName);

  if (!sheetMeta) {
    throw new Error(`No se encontro la hoja ${sheetName} en ${fileName}`);
  }

  const relationshipId = sheetMeta["r:id"] ?? sheetMeta.id;
  const relationships = asArray(workbookRels?.Relationships?.Relationship);
  const relationship = relationships.find((item) => item.Id === relationshipId);
  if (!relationship) {
    throw new Error(`No se encontro la relacion de hoja ${sheetName} en ${fileName}`);
  }

  const sharedStrings = await readSharedStrings(zip);
  const sheetPath = normalizeXlPath(relationship.Target);
  const sheetXml = await readXml(zip, sheetPath);
  const rawRows = asArray(sheetXml?.worksheet?.sheetData?.row);
  const sheetRows = rowsFromSheetXml(rawRows, sharedStrings);
  if (sheetRows.length === 0) return [];

  const headers = sheetRows[0].map((value) => cellToText(value).trim());

  const rows = [];
  for (const row of sheetRows.slice(1)) {
    const item = {};
    let hasValue = false;

    for (let colNumber = 0; colNumber < headers.length; colNumber += 1) {
      const key = headers[colNumber];
      if (!key) continue;

      const value = cellToText(row[colNumber]).trim();
      item[key] = value;
      if (value) hasValue = true;
    }

    if (hasValue) rows.push(item);
  }

  return rows;
}

async function readXml(zip, filePath) {
  const file = zip.file(filePath);
  if (!file) {
    throw new Error(`Archivo XLSX interno no encontrado: ${filePath}`);
  }

  return xmlParser.parse(await file.async("text"));
}

async function readSharedStrings(zip) {
  const file = zip.file("xl/sharedStrings.xml");
  if (!file) return [];

  const parsed = xmlParser.parse(await file.async("text"));
  return asArray(parsed?.sst?.si).map(readRichText);
}

function rowsFromSheetXml(rawRows, sharedStrings) {
  const matrix = [];

  for (const rawRow of rawRows) {
    const rowIndex = Number.parseInt(rawRow.r, 10) - 1;
    const row = [];

    for (const cell of asArray(rawRow.c)) {
      const columnIndex = columnNameToIndex(String(cell.r ?? "").replace(/\d/g, ""));
      row[columnIndex] = readCellValue(cell, sharedStrings);
    }

    matrix[rowIndex] = row;
  }

  return matrix.filter(Boolean);
}

function readCellValue(cell, sharedStrings) {
  if (cell.t === "s") {
    const index = Number.parseInt(cellToText(cell.v), 10);
    return sharedStrings[index] ?? "";
  }

  if (cell.t === "inlineStr") {
    return readRichText(cell.is);
  }

  if (cell.v == null) return "";
  return cellToText(cell.v);
}

function readRichText(node) {
  if (!node) return "";
  if (node.t != null) return cellToText(node.t);
  return asArray(node.r)
    .map((run) => cellToText(run.t))
    .join("");
}

function normalizeXlPath(target) {
  const cleanTarget = String(target).replace(/\\/g, "/");
  if (cleanTarget.startsWith("/")) return cleanTarget.replace(/^\/+/, "");
  return `xl/${cleanTarget}`.replace(/^xl\/xl\//, "xl/");
}

function columnNameToIndex(columnName) {
  let index = 0;
  for (const char of columnName.toUpperCase()) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return Math.max(index - 1, 0);
}

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function cellToText(value) {
  if (value == null) return "";
  if (value instanceof Date) return formatDate(value);

  if (typeof value === "object") {
    if ("#text" in value && value["#text"] != null) return String(value["#text"]);
    if ("text" in value && value.text != null) return String(value.text);
    if ("result" in value && value.result != null) return String(value.result);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text ?? "").join("");
    }
  }

  return String(value);
}

function formatDate(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hour = String(value.getHours()).padStart(2, "0");
  const minute = String(value.getMinutes()).padStart(2, "0");

  if (hour === "00" && minute === "00") {
    return `${year}-${month}-${day}`;
  }

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function text(value) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function requiredText(value, label) {
  const normalized = text(value);
  if (!normalized) {
    throw new Error(`Valor requerido ausente: ${label}`);
  }
  return normalized;
}

function yesNo(value) {
  return String(value ?? "").trim().toLowerCase() === "si";
}

function integer(value) {
  const normalized = text(value);
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function decimal(value) {
  const normalized = text(value);
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized.replace(",", "."));
  return Number.isNaN(parsed) ? null : parsed;
}

function dateTime(value) {
  const normalized = text(value);
  if (!normalized) return null;

  const isoLike = normalized.includes("T")
    ? normalized
    : normalized.length === 10
      ? `${normalized}T00:00:00`
      : normalized.replace(" ", "T");

  const parsed = new Date(isoLike);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Fecha invalida en seed: ${normalized}`);
  }

  return parsed;
}

function splitOperators(value) {
  const normalized = text(value);
  if (!normalized) return [];
  return normalized
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

const SEED_USERS = [
  {
    id_usuario: "USR-001",
    nombre_completo: "Ana Martinez",
    correo: "ana.martinez@dtpm.cl",
    contrasena: "pass123",
    estado: "Activo",
    rol_administrador: "Si",
    rol_inspector: "No",
    rol_autoridad: "No",
    rol_operador: "No",
    inspector_defecto_puntual: "No",
    inspector_revision_pauta: "No",
    operador_operadores_asignados: "",
    operador_puede_resolver: "No",
    observaciones: "Administradora del sistema",
  },
  {
    id_usuario: "USR-002",
    nombre_completo: "Juan Rojas",
    correo: "juan.rojas@dtpm.cl",
    contrasena: "pass123",
    estado: "Activo",
    rol_administrador: "No",
    rol_inspector: "Si",
    rol_autoridad: "No",
    rol_operador: "No",
    inspector_defecto_puntual: "Si",
    inspector_revision_pauta: "Si",
    operador_operadores_asignados: "",
    operador_puede_resolver: "No",
    observaciones: "Inspector con ambas modalidades habilitadas",
  },
  {
    id_usuario: "USR-004",
    nombre_completo: "Maria Gonzalez",
    correo: "maria.gonzalez@stp.cl",
    contrasena: "pass123",
    estado: "Activo",
    rol_administrador: "No",
    rol_inspector: "No",
    rol_autoridad: "No",
    rol_operador: "Si",
    inspector_defecto_puntual: "No",
    inspector_revision_pauta: "No",
    operador_operadores_asignados: "STP Santiago S.A.; Metbus S.A.",
    operador_puede_resolver: "Si",
    observaciones: "Gestora con pocos operadores y permiso de resolucion",
  },
  {
    id_usuario: "USR-005",
    nombre_completo: "Carolina Perez",
    correo: "carolina.perez@dtpm.cl",
    contrasena: "pass123",
    estado: "Activo",
    rol_administrador: "No",
    rol_inspector: "No",
    rol_autoridad: "Si",
    rol_operador: "No",
    inspector_defecto_puntual: "No",
    inspector_revision_pauta: "No",
    operador_operadores_asignados: "Todos los operadores",
    operador_puede_resolver: "No",
    observaciones: "Gestora con alcance general, sin permiso de resolucion",
  },
  {
    id_usuario: "USR-007",
    nombre_completo: "Felipe Munoz",
    correo: "felipe.munoz@subuschile.cl",
    contrasena: "pass123",
    estado: "Inactivo",
    rol_administrador: "No",
    rol_inspector: "No",
    rol_autoridad: "No",
    rol_operador: "Si",
    inspector_defecto_puntual: "No",
    inspector_revision_pauta: "No",
    operador_operadores_asignados: "Subus Chile S.A.",
    operador_puede_resolver: "No",
    observaciones: "Usuario inactivo de consulta",
  },
  {
    id_usuario: "USR-008",
    nombre_completo: "Sofia Torres",
    correo: "sofia.torres@dtpm.cl",
    contrasena: "pass123",
    estado: "Activo",
    rol_administrador: "Si",
    rol_inspector: "Si",
    rol_autoridad: "Si",
    rol_operador: "Si",
    inspector_defecto_puntual: "Si",
    inspector_revision_pauta: "Si",
    operador_operadores_asignados: "STP Santiago S.A.; Metbus S.A.",
    operador_puede_resolver: "Si",
    observaciones: "Usuario multiperfil para probar selector de perfil activo.",
  },
];

function normalizeInspectionsForSeedUsers(inspecciones) {
  for (const inspeccion of inspecciones) {
    inspeccion.id_inspector = "USR-002";
    inspeccion.inspector_nombre = "Juan Rojas";
    inspeccion.inspector_correo = "juan.rojas@dtpm.cl";

    if (text(inspeccion.id_operador_resolutor) === "USR-004") {
      inspeccion.operador_resolutor_nombre = "Maria Gonzalez";
    }
  }
}

async function main() {
  if (process.argv.includes("--if-empty")) {
    const existingUsers = await prisma.usuario.count();
    if (existingUsers > 0) {
      console.log(`Seed omitido: la base ya contiene ${existingUsers} usuario(s).`);
      return;
    }
  }

  const usuarios = [...SEED_USERS];

  const operadores = await readSheet("01_usuarios_permisos_mvp.xlsx", "Operadores");
  const buses = await readSheet("02_buses_pauta_aplicable_mvp.xlsx", "Listado_Buses");
  const pautaPorBus = await readSheet("02_buses_pauta_aplicable_mvp.xlsx", "Pauta_por_Bus");
  const pauta = await readSheet("03_pauta_regb_mvp.xlsx", "Pauta_Inspeccion");
  const inspecciones = await readSheet("04_inspecciones_defectos_mvp.xlsx", "Inspecciones");
  const defectos = await readSheet("04_inspecciones_defectos_mvp.xlsx", "Defectos_Detectados");
  const resultados = await readSheet("04_inspecciones_defectos_mvp.xlsx", "Resultados_Pauta");
  const notificaciones = await readSheet("05_notificaciones_mvp.xlsx", "Notificaciones");

  normalizeInspectionsForSeedUsers(inspecciones);

  await prisma.$transaction([
    prisma.notificacion.deleteMany(),
    prisma.resultadoPauta.deleteMany(),
    prisma.defectoDetectado.deleteMany(),
    prisma.inspeccion.deleteMany(),
    prisma.pautaPorBus.deleteMany(),
    prisma.bus.deleteMany(),
    prisma.usuarioOperador.deleteMany(),
    prisma.usuario.deleteMany(),
    prisma.operador.deleteMany(),
    prisma.pautaInspeccion.deleteMany(),
  ]);

  await prisma.operador.createMany({
    data: operadores.map((row) => ({
      id: requiredText(row.id_operador, "operadores.id_operador"),
      nombre: requiredText(row.nombre_operador, "operadores.nombre_operador"),
      rut: text(row.rut_operador),
      estado: requiredText(row.estado, "operadores.estado"),
    })),
  });

  await prisma.usuario.createMany({
    data: usuarios.map((row) => ({
      id: requiredText(row.id_usuario, "usuarios.id_usuario"),
      nombreCompleto: requiredText(row.nombre_completo, "usuarios.nombre_completo"),
      correo: requiredText(row.correo, "usuarios.correo"),
      contrasena: requiredText(row.contrasena, "usuarios.contrasena"),
      estado: requiredText(row.estado, "usuarios.estado"),
      rolAdministrador: yesNo(row.rol_administrador),
      rolInspector: yesNo(row.rol_inspector),
      rolAutoridad: yesNo(row.rol_autoridad),
      rolOperador: yesNo(row.rol_operador),
      inspectorDefectoPuntual: yesNo(row.inspector_defecto_puntual),
      inspectorRevisionPauta: yesNo(row.inspector_revision_pauta),
      operadorPuedeResolver: yesNo(row.operador_puede_resolver),
      observaciones: text(row.observaciones),
    })),
  });

  const operadoresDb = await prisma.operador.findMany();
  const operadoresPorNombre = new Map(
    operadoresDb.map((operador) => [operador.nombre.toLowerCase(), operador.id]),
  );

  const usuarioOperador = [];
  for (const usuario of usuarios) {
    const asignacion = text(usuario.operador_operadores_asignados);
    if (!asignacion) continue;

    const operadorIds =
      asignacion.toLowerCase() === "todos los operadores"
        ? operadoresDb.map((operador) => operador.id)
        : splitOperators(asignacion).map((nombre) => {
            const operadorId = operadoresPorNombre.get(nombre.toLowerCase());
            if (!operadorId) {
              throw new Error(`Operador asignado no encontrado: ${nombre}`);
            }
            return operadorId;
          });

    for (const operadorId of operadorIds) {
      usuarioOperador.push({
        usuarioId: requiredText(usuario.id_usuario, "usuario_operador.id_usuario"),
        operadorId,
      });
    }
  }

  if (usuarioOperador.length > 0) {
    await prisma.usuarioOperador.createMany({ data: usuarioOperador });
  }

  await prisma.bus.createMany({
    data: buses.map((row) => ({
      ppu: requiredText(row.ppu, "buses.ppu"),
      operadorId: requiredText(row.id_operador, "buses.id_operador"),
      operadorNombre: requiredText(row.operador, "buses.operador"),
      rutOperador: text(row.rut_operador),
      chasisMarca: text(row.chasis_marca),
      chasisModelo: text(row.chasis_modelo),
      carroceriaMarca: text(row.carroceria_marca),
      carroceriaModelo: text(row.carroceria_modelo),
      tecnologia: text(row.tecnologia),
      tipoBus: text(row.tipo_bus),
      anio: integer(row.anio),
      fechaInicioOperacion: dateTime(row.fecha_inicio_operacion),
      estadoBus: requiredText(row.estado_bus, "buses.estado_bus"),
      certificador: text(row.certificador),
      correoOperadorSimulado: text(row.correo_operador_simulado),
      correoCertificadorSimulado: text(row.correo_certificador_simulado),
      correoAutoridadSimulado: text(row.correo_autoridad_simulado),
    })),
  });

  await prisma.pautaInspeccion.createMany({
    data: pauta.map((row) => ({
      id: requiredText(row.id_item_pauta, "pauta.id_item_pauta"),
      idOriginal: text(row.id_original),
      elemento: requiredText(row.elemento, "pauta.elemento"),
      item: requiredText(row.item, "pauta.item"),
      atributo: requiredText(row.atributo, "pauta.atributo"),
      criterioEspecifico: requiredText(row.criterio_especifico, "pauta.criterio_especifico"),
      criticidad: requiredText(row.criticidad, "pauta.criticidad"),
      coberturaInteraccion: text(row.cobertura_interaccion),
    })),
  });

  await prisma.pautaPorBus.createMany({
    data: pautaPorBus.map((row) => ({
      ppu: requiredText(row.ppu, "pauta_por_bus.ppu"),
      itemPautaId: requiredText(row.id_item_pauta, "pauta_por_bus.id_item_pauta"),
      aplica: yesNo(row.aplica),
    })),
  });

  await prisma.inspeccion.createMany({
    data: inspecciones.map((row) => ({
      id: requiredText(row.id_inspeccion, "inspecciones.id_inspeccion"),
      fecha: requiredText(row.fecha, "inspecciones.fecha"),
      hora: requiredText(row.hora, "inspecciones.hora"),
      fechaHora: dateTime(row.fecha_hora),
      ppu: requiredText(row.ppu, "inspecciones.ppu"),
      operadorNombre: requiredText(row.operador, "inspecciones.operador"),
      chasis: text(row.chasis),
      carroceria: text(row.carroceria),
      tecnologia: text(row.tecnologia),
      tipoBus: text(row.tipo_bus),
      anio: integer(row.anio),
      tipoInspeccion: requiredText(row.tipo_inspeccion, "inspecciones.tipo_inspeccion"),
      estado: requiredText(row.estado, "inspecciones.estado"),
      inspectorId: requiredText(row.id_inspector, "inspecciones.id_inspector"),
      inspectorNombre: text(row.inspector_nombre),
      inspectorCorreo: text(row.inspector_correo),
      latitud: decimal(row.latitud),
      longitud: decimal(row.longitud),
      ubicacionSimulada: text(row.ubicacion_simulada),
      criticidadMasGrave: requiredText(row.criticidad_mas_grave, "inspecciones.criticidad_mas_grave"),
      cantidadDefectos: integer(row.cantidad_defectos) ?? 0,
      efectoInspeccion: text(row.efecto_inspeccion),
      fechaLimiteReparacion: dateTime(row.fecha_limite_reparacion),
      ultimaActualizacion: dateTime(row.ultima_actualizacion),
      operadorResolutorId: text(row.id_operador_resolutor),
      operadorResolutorNombre: text(row.operador_resolutor_nombre),
      todosDefectosReparados: yesNo(row.todos_defectos_reparados),
      observacionGeneralInspector: text(row.observacion_general_inspector),
      observacionGeneralOperador: text(row.observacion_general_operador),
    })),
  });

  await prisma.defectoDetectado.createMany({
    data: defectos.map((row) => ({
      id: requiredText(row.id_detalle, "defectos.id_detalle"),
      inspeccionId: requiredText(row.id_inspeccion, "defectos.id_inspeccion"),
      ppu: requiredText(row.ppu, "defectos.ppu"),
      itemPautaId: requiredText(row.id_item_pauta, "defectos.id_item_pauta"),
      elemento: requiredText(row.elemento, "defectos.elemento"),
      item: requiredText(row.item, "defectos.item"),
      atributo: requiredText(row.atributo, "defectos.atributo"),
      criterioEspecifico: requiredText(row.criterio_especifico, "defectos.criterio_especifico"),
      criticidad: requiredText(row.criticidad, "defectos.criticidad"),
      observacionInspector: text(row.observacion_inspector),
      cantidadAdjuntosInspector: integer(row.cantidad_adjuntos_inspector) ?? 0,
      urlFotoInspector: text(row.url_foto_inspector),
      urlVideoInspector: text(row.url_video_inspector),
      defectoReparado: yesNo(row.defecto_reparado),
      observacionOperador: text(row.observacion_operador),
      fechaMarcadoReparado: dateTime(row.fecha_marcado_reparado),
      estadoDefecto: requiredText(row.estado_defecto, "defectos.estado_defecto"),
    })),
  });

  await prisma.resultadoPauta.createMany({
    data: resultados.map((row) => ({
      inspeccionId: requiredText(row.id_inspeccion, "resultados.id_inspeccion"),
      ppu: requiredText(row.ppu, "resultados.ppu"),
      itemPautaId: requiredText(row.id_item_pauta, "resultados.id_item_pauta"),
      elemento: requiredText(row.elemento, "resultados.elemento"),
      item: requiredText(row.item, "resultados.item"),
      atributo: requiredText(row.atributo, "resultados.atributo"),
      criterioEspecifico: requiredText(row.criterio_especifico, "resultados.criterio_especifico"),
      criticidad: requiredText(row.criticidad, "resultados.criticidad"),
      resultado: requiredText(row.resultado, "resultados.resultado"),
      observacion: text(row.observacion),
      urlEvidencia: text(row.url_evidencia),
    })),
  });

  await prisma.notificacion.createMany({
    data: notificaciones.map((row) => ({
      id: requiredText(row.id_notificacion, "notificaciones.id_notificacion"),
      fechaHora: dateTime(row.fecha_hora),
      tipoNotificacion: requiredText(row.tipo_notificacion, "notificaciones.tipo_notificacion"),
      canal: requiredText(row.canal, "notificaciones.canal"),
      tipoInspeccion: requiredText(row.tipo_inspeccion, "notificaciones.tipo_inspeccion"),
      ppu: requiredText(row.ppu, "notificaciones.ppu"),
      inspeccionId: requiredText(row.id_inspeccion, "notificaciones.id_inspeccion"),
      operador: requiredText(row.operador, "notificaciones.operador"),
      responsable: text(row.responsable),
      certificador: text(row.certificador),
      correoOperadorSimulado: text(row.correo_operador_simulado),
      correoCertificadorSimulado: text(row.correo_certificador_simulado),
      correoAutoridadSimulado: text(row.correo_autoridad_simulado),
      asuntoCorreoSimulado: text(row.asunto_correo_simulado),
      cuerpoCorreoSimulado: text(row.cuerpo_correo_simulado),
      correoSimuladoEnviado: requiredText(row.canal, "notificaciones.canal").toLowerCase().includes("correo simulado"),
      fechaCorreoSimulado: requiredText(row.canal, "notificaciones.canal").toLowerCase().includes("correo simulado")
        ? dateTime(row.fecha_hora)
        : null,
      estado: requiredText(row.estado, "notificaciones.estado"),
    })),
  });

  const resumen = {
    usuarios: await prisma.usuario.count(),
    operadores: await prisma.operador.count(),
    buses: await prisma.bus.count(),
    pauta_inspeccion: await prisma.pautaInspeccion.count(),
    pauta_por_bus: await prisma.pautaPorBus.count(),
    inspecciones: await prisma.inspeccion.count(),
    defectos_detectados: await prisma.defectoDetectado.count(),
    resultados_pauta: await prisma.resultadoPauta.count(),
    notificaciones: await prisma.notificacion.count(),
  };

  console.table(resumen);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
