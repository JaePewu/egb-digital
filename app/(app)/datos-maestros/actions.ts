"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { canAccessModule } from "@/lib/access";
import { activityActorFromUser, buildActivityData } from "@/lib/activity-log";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function saveBusMaster(formData: FormData) {
  const user = await requireAdministrator();
  const originalPpu = text(formData, "originalPpu").toUpperCase();
  const ppu = text(formData, "ppu").toUpperCase();
  const operadorId = text(formData, "operadorId");
  const estadoBus = text(formData, "estadoBus") || "Operativo";
  const anioRaw = text(formData, "anio");
  const anio = anioRaw ? Number(anioRaw) : null;

  if (!ppu || !operadorId || !estadoBus) return redirectMaster("buses", "error", "PPU, operador y estado son obligatorios.", originalPpu || ppu);
  if (!/^[A-Z0-9-]{4,10}$/.test(ppu)) return redirectMaster("buses", "error", "La PPU contiene caracteres o longitud no válidos.", originalPpu || ppu);
  if (originalPpu && originalPpu !== ppu) return redirectMaster("buses", "error", "La PPU no puede cambiarse en una edición; cree un nuevo bus si corresponde.", originalPpu);
  if (anio !== null && (!Number.isInteger(anio) || anio < 1990 || anio > new Date().getFullYear() + 1)) {
    return redirectMaster("buses", "error", "El año del bus no es válido.", originalPpu || ppu);
  }

  const emails = [text(formData, "correoOperadorSimulado"), text(formData, "correoCertificadorSimulado"), text(formData, "correoAutoridadSimulado")];
  if (emails.some((email) => email && !isEmail(email))) return redirectMaster("buses", "error", "Uno de los correos relacionados no es válido.", originalPpu || ppu);

  const operador = await prisma.operador.findUnique({ where: { id: operadorId } });
  if (!operador) return redirectMaster("buses", "error", "El operador seleccionado no existe.", originalPpu || ppu);
  if (!originalPpu && await prisma.bus.findUnique({ where: { ppu } })) return redirectMaster("buses", "error", "Ya existe un bus registrado con esa PPU.", ppu);

  const data = {
    operadorId,
    operadorNombre: operador.nombre,
    rutOperador: operador.rut,
    chasisMarca: nullable(formData, "chasisMarca"),
    chasisModelo: nullable(formData, "chasisModelo"),
    carroceriaMarca: nullable(formData, "carroceriaMarca"),
    carroceriaModelo: nullable(formData, "carroceriaModelo"),
    tecnologia: nullable(formData, "tecnologia"),
    tipoBus: nullable(formData, "tipoBus"),
    anio,
    estadoBus,
    certificador: nullable(formData, "certificador"),
    correoOperadorSimulado: nullable(formData, "correoOperadorSimulado", true),
    correoCertificadorSimulado: nullable(formData, "correoCertificadorSimulado", true),
    correoAutoridadSimulado: nullable(formData, "correoAutoridadSimulado", true),
  };

  const audit = await buildActivityData({
    actor: activityActorFromUser(user), accion: originalPpu ? "Actualización de bus" : "Creación de bus",
    modulo: "Datos Maestros", resultado: "Éxito", detalle: `Bus ${ppu}, operador ${operador.nombre}, estado ${estadoBus}.`,
  });

  await prisma.$transaction(async (tx) => {
    if (originalPpu) await tx.bus.update({ where: { ppu: originalPpu }, data });
    else await tx.bus.create({ data: { ppu, ...data } });
    await tx.logActividad.create({ data: audit });
  });
  redirect(`/datos-maestros?tab=buses&editarBus=${encodeURIComponent(ppu)}&guardado=1`);
}

export async function saveOperatorMaster(formData: FormData) {
  const user = await requireAdministrator();
  const operadorId = text(formData, "operadorId");
  const nombre = text(formData, "nombre");
  const rut = nullable(formData, "rut");
  const estado = text(formData, "estado") || "Activo";
  if (!nombre || !estado) return redirectMaster("operadores", "error", "Nombre y estado del operador son obligatorios.", operadorId);
  if (!['Activo', 'Inactivo'].includes(estado)) return redirectMaster("operadores", "error", "El estado seleccionado no es válido.", operadorId);

  const duplicated = await prisma.operador.findFirst({
    where: { nombre: { equals: nombre, mode: "insensitive" }, ...(operadorId ? { NOT: { id: operadorId } } : {}) },
    select: { id: true },
  });
  if (duplicated) return redirectMaster("operadores", "error", "Ya existe un operador con ese nombre.", operadorId);

  const id = operadorId || `OP-${randomUUID()}`;
  const audit = await buildActivityData({
    actor: activityActorFromUser(user), accion: operadorId ? "Actualización de operador" : "Creación de operador",
    modulo: "Datos Maestros", resultado: "Éxito", detalle: `Operador ${nombre}, estado ${estado}.`,
  });

  await prisma.$transaction(async (tx) => {
    if (operadorId) {
      await tx.operador.update({ where: { id: operadorId }, data: { nombre, rut, estado } });
      await tx.bus.updateMany({ where: { operadorId }, data: { operadorNombre: nombre, rutOperador: rut } });
    } else {
      await tx.operador.create({ data: { id, nombre, rut, estado } });
    }
    await tx.logActividad.create({ data: audit });
  });
  redirect(`/datos-maestros?tab=operadores&editarOperador=${encodeURIComponent(id)}&guardado=1`);
}

export async function savePautaMaster(formData: FormData) {
  const user = await requireAdministrator();
  const originalId = text(formData, "originalId");
  const id = text(formData, "id").toUpperCase();
  const elemento = text(formData, "elemento");
  const item = text(formData, "item");
  const atributo = text(formData, "atributo");
  const criterioEspecifico = text(formData, "criterioEspecifico");
  const criticidad = text(formData, "criticidad");
  if (!id || !elemento || !item || !atributo || !criterioEspecifico || !criticidad) {
    return redirectMaster("pauta", "error", "Todos los campos principales del ítem son obligatorios.", originalId || id);
  }
  if (originalId && originalId !== id) return redirectMaster("pauta", "error", "El ID del ítem no puede cambiarse durante la edición.", originalId);
  if (!['Baja', 'Media', 'Alta'].includes(criticidad)) return redirectMaster("pauta", "error", "La criticidad seleccionada no es válida.", originalId || id);
  if (!originalId && await prisma.pautaInspeccion.findUnique({ where: { id } })) return redirectMaster("pauta", "error", "Ya existe un ítem de pauta con ese ID.", id);

  const data = { elemento, item, atributo, criterioEspecifico, criticidad, coberturaInteraccion: nullable(formData, "coberturaInteraccion") };
  const audit = await buildActivityData({
    actor: activityActorFromUser(user), accion: originalId ? "Actualización de ítem de pauta" : "Creación de ítem de pauta",
    modulo: "Datos Maestros", resultado: "Éxito", detalle: `Ítem ${id}, elemento ${elemento}, criticidad ${criticidad}.`,
  });
  await prisma.$transaction(async (tx) => {
    if (originalId) await tx.pautaInspeccion.update({ where: { id: originalId }, data });
    else await tx.pautaInspeccion.create({ data: { id, idOriginal: id, ...data } });
    await tx.logActividad.create({ data: audit });
  });
  redirect(`/datos-maestros?tab=pauta&editarPauta=${encodeURIComponent(id)}&guardado=1`);
}

export async function saveApplicabilityMaster(formData: FormData) {
  const user = await requireAdministrator();
  const ppu = text(formData, "ppu").toUpperCase();
  const itemPautaId = text(formData, "itemPautaId").toUpperCase();
  const aplica = text(formData, "aplica") === "true";
  if (!ppu || !itemPautaId) return redirectMaster("pauta-aplicable", "error", "Debe seleccionar una PPU y un ítem de pauta.");

  const [bus, pauta] = await Promise.all([
    prisma.bus.findUnique({ where: { ppu }, select: { ppu: true } }),
    prisma.pautaInspeccion.findUnique({ where: { id: itemPautaId }, select: { id: true } }),
  ]);
  if (!bus || !pauta) return redirectMaster("pauta-aplicable", "error", "La PPU o el ítem seleccionado no existe.");

  const audit = await buildActivityData({
    actor: activityActorFromUser(user), accion: "Actualización de pauta aplicable",
    modulo: "Datos Maestros", resultado: "Éxito", detalle: `PPU ${ppu}, ítem ${itemPautaId}, aplica: ${aplica ? "Sí" : "No"}.`,
  });
  await prisma.$transaction(async (tx) => {
    await tx.pautaPorBus.upsert({
      where: { ppu_itemPautaId: { ppu, itemPautaId } },
      update: { aplica },
      create: { ppu, itemPautaId, aplica },
    });
    await tx.logActividad.create({ data: audit });
  });
  redirect(`/datos-maestros?tab=pauta-aplicable&editarAplicabilidad=${encodeURIComponent(`${ppu}|${itemPautaId}`)}&guardado=1`);
}

async function requireAdministrator() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessModule(user, "datos-maestros")) redirect("/sin-acceso");
  return user;
}
function text(formData: FormData, key: string) { return String(formData.get(key) ?? "").trim(); }
function nullable(formData: FormData, key: string, lowercase = false) {
  const value = text(formData, key);
  return value ? (lowercase ? value.toLowerCase() : value) : null;
}
function isEmail(value: string) { return /^\S+@\S+\.\S+$/.test(value); }
function redirectMaster(tab: string, type: "error", message: string, editId = ""): never {
  const params = new URLSearchParams({ tab, [type]: message });
  if (editId) {
    if (tab === "buses") params.set("editarBus", editId);
    if (tab === "operadores") params.set("editarOperador", editId);
    if (tab === "pauta") params.set("editarPauta", editId);
  }
  redirect(`/datos-maestros?${params.toString()}`);
}
