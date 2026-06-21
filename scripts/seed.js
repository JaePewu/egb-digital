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

const QA_USERS = [
  {
    id_usuario: "USR-QA-ADM",
    nombre_completo: "Admin Prueba",
    correo: "admin.prueba@egb.local",
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
    observaciones: "QA: solo Administrador.",
  },
  {
    id_usuario: "USR-QA-AUT",
    nombre_completo: "Autoridad Prueba",
    correo: "autoridad.prueba@egb.local",
    contrasena: "pass123",
    estado: "Activo",
    rol_administrador: "No",
    rol_inspector: "No",
    rol_autoridad: "Si",
    rol_operador: "No",
    inspector_defecto_puntual: "No",
    inspector_revision_pauta: "No",
    operador_operadores_asignados: "",
    operador_puede_resolver: "No",
    observaciones: "QA: solo Autoridad.",
  },
  {
    id_usuario: "USR-QA-INS-AMB",
    nombre_completo: "Inspector Ambos",
    correo: "inspector.ambos@egb.local",
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
    observaciones: "QA: Inspector con defecto puntual y revision de pauta.",
  },
  {
    id_usuario: "USR-QA-INS-PUN",
    nombre_completo: "Inspector Puntual",
    correo: "inspector.puntual@egb.local",
    contrasena: "pass123",
    estado: "Activo",
    rol_administrador: "No",
    rol_inspector: "Si",
    rol_autoridad: "No",
    rol_operador: "No",
    inspector_defecto_puntual: "Si",
    inspector_revision_pauta: "No",
    operador_operadores_asignados: "",
    operador_puede_resolver: "No",
    observaciones: "QA: Inspector solo defecto puntual.",
  },
  {
    id_usuario: "USR-QA-INS-PAU",
    nombre_completo: "Inspector Pauta",
    correo: "inspector.pauta@egb.local",
    contrasena: "pass123",
    estado: "Activo",
    rol_administrador: "No",
    rol_inspector: "Si",
    rol_autoridad: "No",
    rol_operador: "No",
    inspector_defecto_puntual: "No",
    inspector_revision_pauta: "Si",
    operador_operadores_asignados: "",
    operador_puede_resolver: "No",
    observaciones: "QA: Inspector solo revision de pauta.",
  },
  {
    id_usuario: "USR-QA-OPE-RES",
    nombre_completo: "Operador Resuelve",
    correo: "operador.resuelve@egb.local",
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
    observaciones: "QA: Operador asignado a STP y Metbus con permiso de resolver.",
  },
  {
    id_usuario: "USR-QA-OPE-CON",
    nombre_completo: "Operador Consulta",
    correo: "operador.consulta@egb.local",
    contrasena: "pass123",
    estado: "Activo",
    rol_administrador: "No",
    rol_inspector: "No",
    rol_autoridad: "No",
    rol_operador: "Si",
    inspector_defecto_puntual: "No",
    inspector_revision_pauta: "No",
    operador_operadores_asignados: "Subus Chile S.A.",
    operador_puede_resolver: "No",
    observaciones: "QA: Operador asignado a Subus sin permiso de resolver.",
  },
  {
    id_usuario: "USR-QA-MULTI",
    nombre_completo: "Multiperfil Prueba",
    correo: "multiperfil.prueba@egb.local",
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
    observaciones: "QA: Administrador, Autoridad, Operador e Inspector.",
  },
];

const QA_INSPECTIONS = [
  {
    id: "INS-QA-AMB-PUNTUAL",
    fecha: "2024-06-10",
    hora: "09:00",
    ppu: "LJXR-34",
    tipoInspeccion: "Defecto puntual",
    estado: "Pendiente",
    inspectorCorreo: "inspector.ambos@egb.local",
    latitud: "-33.4489",
    longitud: "-70.6693",
    ubicacion: "Terminal STP Los Libertadores",
    failedItemIds: ["RES-009"],
    fechaLimite: "2024-06-17 18:00",
    observacion: "QA: puerta de servicio no completa cierre.",
  },
  {
    id: "INS-QA-AMB-PAUTA",
    fecha: "2024-06-10",
    hora: "11:30",
    ppu: "BJFF-23",
    tipoInspeccion: "Revision de pauta",
    estado: "Resuelta",
    inspectorCorreo: "inspector.ambos@egb.local",
    latitud: "-33.4511",
    longitud: "-70.6601",
    ubicacion: "Patio STP El Salto",
    failedItemIds: ["RES-002", "RES-011"],
    fechaLimite: "2024-06-14 18:00",
    operadorResolutorId: "USR-QA-OPE-RES",
    operadorResolutorNombre: "Operador Resuelve",
    todosDefectosReparados: "Si",
    observacion: "QA: revision completa con reparacion cerrada.",
    observacionOperador: "QA: reparacion verificada por operador.",
    fechaReparacion: "2024-06-11 16:30",
  },
  {
    id: "INS-QA-PUNTUAL",
    fecha: "2024-06-11",
    hora: "10:15",
    ppu: "CJRX-71",
    tipoInspeccion: "Defecto puntual",
    estado: "En revision",
    inspectorCorreo: "inspector.puntual@egb.local",
    latitud: "-33.5012",
    longitud: "-70.6124",
    ubicacion: "Terminal Metbus Los Libertadores",
    failedItemIds: ["RES-017"],
    fechaLimite: "2024-06-18 18:00",
    observacion: "QA: validador presenta intermitencia.",
  },
  {
    id: "INS-QA-PAUTA",
    fecha: "2024-06-11",
    hora: "14:45",
    ppu: "LPZT90",
    tipoInspeccion: "Revision de pauta",
    estado: "Pendiente",
    inspectorCorreo: "inspector.pauta@egb.local",
    latitud: "-33.5201",
    longitud: "-70.7062",
    ubicacion: "Terminal Subus La Pintana",
    failedItemIds: ["RES-005", "RES-020"],
    fechaLimite: "2024-06-15 18:00",
    observacion: "QA: revision de pauta con defectos criticos pendientes.",
  },
];

const CRITICIDAD_RANK = {
  Baja: 1,
  Media: 2,
  Alta: 3,
};

function mergeRowsByKey(rows, additions, getKey) {
  for (const addition of additions) {
    const additionKey = getKey(addition);
    const index = rows.findIndex((row) => getKey(row) === additionKey);
    if (index >= 0) {
      rows[index] = { ...rows[index], ...addition };
    } else {
      rows.push(addition);
    }
  }
}

function addOrUpdateQaUsers(usuarios) {
  mergeRowsByKey(usuarios, QA_USERS, (row) => requiredText(row.correo, "qa.usuario.correo").toLowerCase());
}

function addQaSeedData({ usuarios, buses, pautaPorBus, pauta, inspecciones, defectos, resultados, notificaciones }) {
  const busByPpu = new Map(buses.map((bus) => [requiredText(bus.ppu, "qa.bus.ppu"), bus]));
  const itemById = new Map(pauta.map((item) => [requiredText(item.id_item_pauta, "qa.pauta.id"), item]));
  const userByEmail = new Map(
    usuarios.map((usuario) => [requiredText(usuario.correo, "qa.usuario.correo").toLowerCase(), usuario]),
  );

  const qaInspecciones = [];
  const qaDefectos = [];
  const qaResultados = [];
  const qaNotificaciones = [];

  for (const definition of QA_INSPECTIONS) {
    const bus = busByPpu.get(definition.ppu);
    if (!bus) throw new Error(`Bus QA no encontrado: ${definition.ppu}`);

    const inspector = userByEmail.get(definition.inspectorCorreo.toLowerCase());
    if (!inspector) throw new Error(`Inspector QA no encontrado: ${definition.inspectorCorreo}`);

    const failedItems = definition.failedItemIds.map((itemId) => getPautaItem(itemById, itemId));
    const criticidadMaxima = getMaxCriticidad(failedItems);
    const fechaHora = `${definition.fecha} ${definition.hora}`;
    const isResolved = definition.estado === "Resuelta";

    qaInspecciones.push({
      id_inspeccion: definition.id,
      fecha: definition.fecha,
      hora: definition.hora,
      fecha_hora: fechaHora,
      ppu: definition.ppu,
      operador: requiredText(bus.operador, `qa.bus.operador.${definition.ppu}`),
      chasis: joinBusParts(bus.chasis_marca, bus.chasis_modelo),
      carroceria: joinBusParts(bus.carroceria_marca, bus.carroceria_modelo),
      tecnologia: text(bus.tecnologia) ?? "",
      tipo_bus: text(bus.tipo_bus) ?? "",
      anio: text(bus.anio) ?? "",
      tipo_inspeccion: definition.tipoInspeccion,
      estado: definition.estado,
      id_inspector: requiredText(inspector.id_usuario, "qa.inspector.id"),
      inspector_nombre: requiredText(inspector.nombre_completo, "qa.inspector.nombre"),
      inspector_correo: requiredText(inspector.correo, "qa.inspector.correo"),
      latitud: definition.latitud,
      longitud: definition.longitud,
      ubicacion_simulada: definition.ubicacion,
      criticidad_mas_grave: criticidadMaxima,
      cantidad_defectos: String(failedItems.length),
      efecto_inspeccion: getEfectoInspeccion(criticidadMaxima),
      fecha_limite_reparacion: definition.fechaLimite,
      ultima_actualizacion: isResolved ? definition.fechaReparacion : fechaHora,
      id_operador_resolutor: definition.operadorResolutorId ?? "",
      operador_resolutor_nombre: definition.operadorResolutorNombre ?? "",
      todos_defectos_reparados: definition.todosDefectosReparados ?? "No",
      observacion_general_inspector: definition.observacion,
      observacion_general_operador: definition.observacionOperador ?? "",
    });

    failedItems.forEach((item, index) => {
      qaDefectos.push({
        id_detalle: `${definition.id}-DET-${String(index + 1).padStart(2, "0")}`,
        id_inspeccion: definition.id,
        ppu: definition.ppu,
        id_item_pauta: item.id_item_pauta,
        elemento: item.elemento,
        item: item.item,
        atributo: item.atributo,
        criterio_especifico: item.criterio_especifico,
        criticidad: item.criticidad,
        observacion_inspector: getDefectObservation(item, definition),
        cantidad_adjuntos_inspector: "1",
        url_foto_inspector: `https://evidencias.egb.local/qa/${definition.id}/${item.id_item_pauta}.jpg`,
        url_video_inspector: "",
        defecto_reparado: isResolved ? "Si" : "No",
        observacion_operador: isResolved ? definition.observacionOperador : "",
        fecha_marcado_reparado: isResolved ? definition.fechaReparacion : "",
        estado_defecto: isResolved ? "Reparado" : "Pendiente",
      });
    });

    if (definition.tipoInspeccion === "Revision de pauta") {
      const failedIds = new Set(definition.failedItemIds);
      for (const itemId of getApplicableItemIds(pautaPorBus, definition.ppu)) {
        const item = getPautaItem(itemById, itemId);
        const failed = failedIds.has(itemId);
        qaResultados.push({
          id_inspeccion: definition.id,
          ppu: definition.ppu,
          id_item_pauta: item.id_item_pauta,
          elemento: item.elemento,
          item: item.item,
          atributo: item.atributo,
          criterio_especifico: item.criterio_especifico,
          criticidad: item.criticidad,
          resultado: failed ? "No cumple" : "Cumple",
          observacion: failed ? getDefectObservation(item, definition) : "QA: item sin hallazgos.",
          url_evidencia: failed ? `https://evidencias.egb.local/qa/${definition.id}/${item.id_item_pauta}.jpg` : "",
        });
      }
    }

    qaNotificaciones.push(
      buildNotification({
        id: `${definition.id}-NOT-REG`,
        definition,
        bus,
        fechaHora,
        tipoNotificacion: "Registro",
        canal: "Interna y correo simulado",
        asunto: `QA registro inspeccion ${definition.id}`,
        cuerpo: `Se registro inspeccion QA ${definition.tipoInspeccion} para ${definition.ppu}.`,
        estado: "Nueva",
      }),
    );

    if (criticidadMaxima === "Alta") {
      qaNotificaciones.push(
        buildNotification({
          id: `${definition.id}-NOT-ALTA`,
          definition,
          bus,
          fechaHora,
          tipoNotificacion: "Alerta criticidad alta",
          canal: "Pop up y correo simulado",
          asunto: `QA alerta alta ${definition.ppu}`,
          cuerpo: `Inspeccion QA ${definition.id} registra criticidad alta.`,
          estado: "Nueva",
        }),
      );
    }

    if (isResolved) {
      qaNotificaciones.push(
        buildNotification({
          id: `${definition.id}-NOT-REP`,
          definition,
          bus,
          fechaHora: definition.fechaReparacion,
          tipoNotificacion: "Reparacion completada",
          canal: "Interna y correo simulado",
          asunto: `QA reparacion completada ${definition.ppu}`,
          cuerpo: `El operador marco reparados los defectos QA de ${definition.id}.`,
          estado: "Revisada",
        }),
      );
    }
  }

  mergeRowsByKey(inspecciones, qaInspecciones, (row) => requiredText(row.id_inspeccion, "qa.inspeccion.id"));
  mergeRowsByKey(defectos, qaDefectos, (row) => requiredText(row.id_detalle, "qa.defecto.id"));
  mergeRowsByKey(
    resultados,
    qaResultados,
    (row) => `${requiredText(row.id_inspeccion, "qa.resultado.inspeccion")}:${requiredText(row.id_item_pauta, "qa.resultado.item")}`,
  );
  mergeRowsByKey(notificaciones, qaNotificaciones, (row) => requiredText(row.id_notificacion, "qa.notificacion.id"));
}

function joinBusParts(...parts) {
  return parts.map((part) => text(part)).filter(Boolean).join(" ");
}

function getPautaItem(itemById, itemId) {
  const item = itemById.get(itemId);
  if (!item) throw new Error(`Item de pauta QA no encontrado: ${itemId}`);
  return item;
}

function getApplicableItemIds(pautaPorBus, ppu) {
  const itemIds = pautaPorBus
    .filter((row) => requiredText(row.ppu, "qa.pauta_por_bus.ppu") === ppu && yesNo(row.aplica))
    .map((row) => requiredText(row.id_item_pauta, "qa.pauta_por_bus.item"));

  if (itemIds.length === 0) {
    throw new Error(`No hay pauta aplicable QA para ${ppu}`);
  }

  return itemIds;
}

function getMaxCriticidad(items) {
  return items.reduce((current, item) => {
    const currentRank = CRITICIDAD_RANK[current] ?? 0;
    const itemRank = CRITICIDAD_RANK[item.criticidad] ?? 0;
    return itemRank > currentRank ? item.criticidad : current;
  }, "Baja");
}

function getEfectoInspeccion(criticidad) {
  if (criticidad === "Alta") return "Debe generar seguimiento prioritario.";
  if (criticidad === "Media") return "Debe generar seguimiento programado.";
  return "Debe quedar disponible para consulta y seguimiento.";
}

function getDefectObservation(item, definition) {
  return `${definition.observacion} Item ${item.id_item_pauta}: ${item.elemento} - ${item.item}.`;
}

function buildNotification({ id, definition, bus, fechaHora, tipoNotificacion, canal, asunto, cuerpo, estado }) {
  return {
    id_notificacion: id,
    fecha_hora: fechaHora,
    tipo_notificacion: tipoNotificacion,
    canal,
    tipo_inspeccion: definition.tipoInspeccion,
    ppu: definition.ppu,
    id_inspeccion: definition.id,
    operador: requiredText(bus.operador, `qa.notificacion.operador.${definition.ppu}`),
    responsable: requiredText(bus.operador, `qa.notificacion.responsable.${definition.ppu}`),
    certificador: text(bus.certificador) ?? "",
    correo_operador_simulado: text(bus.correo_operador_simulado) ?? "",
    correo_certificador_simulado: text(bus.correo_certificador_simulado) ?? "",
    correo_autoridad_simulado: text(bus.correo_autoridad_simulado) ?? "",
    asunto_correo_simulado: asunto,
    cuerpo_correo_simulado: cuerpo,
    estado,
  };
}

async function main() {
  const usuarios = [
    ...(await readSheet("01_usuarios_permisos_mvp.xlsx", "Usuarios_Permisos")),
    {
      id_usuario: "USR-008",
      nombre_completo: "Sofia Torres",
      correo: "sofia.multi@egb.local",
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
  addOrUpdateQaUsers(usuarios);

  const operadores = await readSheet("01_usuarios_permisos_mvp.xlsx", "Operadores");
  const buses = await readSheet("02_buses_pauta_aplicable_mvp.xlsx", "Listado_Buses");
  const pautaPorBus = await readSheet("02_buses_pauta_aplicable_mvp.xlsx", "Pauta_por_Bus");
  const pauta = await readSheet("03_pauta_regb_mvp.xlsx", "Pauta_Inspeccion");
  const inspecciones = await readSheet("04_inspecciones_defectos_mvp.xlsx", "Inspecciones");
  const defectos = await readSheet("04_inspecciones_defectos_mvp.xlsx", "Defectos_Detectados");
  const resultados = await readSheet("04_inspecciones_defectos_mvp.xlsx", "Resultados_Pauta");
  const notificaciones = await readSheet("05_notificaciones_mvp.xlsx", "Notificaciones");

  addQaSeedData({ usuarios, buses, pautaPorBus, pauta, inspecciones, defectos, resultados, notificaciones });

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
