"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { canAccessModule } from "@/lib/access";
import { activityActorFromUser, buildActivityData } from "@/lib/activity-log";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type UserInput = {
  nombreCompleto: string;
  correo: string;
  contrasena: string;
  estado: string;
  rolAdministrador: boolean;
  rolInspector: boolean;
  rolAutoridad: boolean;
  rolOperador: boolean;
  inspectorDefectoPuntual: boolean;
  inspectorRevisionPauta: boolean;
  operadorPuedeResolver: boolean;
  operadores: string[];
};

export async function createUserAdministration(formData: FormData) {
  const currentUser = await requireAdministrator();
  const input = readUserInput(formData, true);
  const validation = await validateUserInput(input, null, true);
  if (validation) redirectWithAdminMessage("error", validation, "nuevo");

  const auditData = await buildActivityData({
    actor: activityActorFromUser(currentUser),
    accion: "Creación de usuario",
    modulo: "Administración",
    resultado: "Éxito",
    detalle: `Usuario creado: ${input.nombreCompleto} (${input.correo}).`,
  });

  const usuarioId = `USR-${randomUUID()}`;
  await prisma.$transaction(async (tx) => {
    await tx.usuario.create({
      data: {
        id: usuarioId,
        nombreCompleto: input.nombreCompleto,
        correo: input.correo,
        contrasena: input.contrasena,
        estado: input.estado,
        rolAdministrador: input.rolAdministrador,
        rolInspector: input.rolInspector,
        rolAutoridad: input.rolAutoridad,
        rolOperador: input.rolOperador,
        inspectorDefectoPuntual: input.rolInspector && input.inspectorDefectoPuntual,
        inspectorRevisionPauta: input.rolInspector && input.inspectorRevisionPauta,
        operadorPuedeResolver: input.rolOperador && input.operadorPuedeResolver,
      },
    });

    if (input.rolOperador && input.operadores.length > 0) {
      await tx.usuarioOperador.createMany({
        data: input.operadores.map((operadorId) => ({ usuarioId, operadorId })),
        skipDuplicates: true,
      });
    }

    await tx.logActividad.create({ data: auditData });
  });

  redirect(`/administracion?usuario=${encodeURIComponent(usuarioId)}&creado=1`);
}

export async function saveUserAdministration(formData: FormData) {
  const currentUser = await requireAdministrator();
  const usuarioId = String(formData.get("usuarioId") ?? "").trim();
  if (!usuarioId) redirectWithAdminMessage("error", "No se identificó el usuario a actualizar.");

  const targetUser = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { nombreCompleto: true, correo: true, contrasena: true },
  });
  if (!targetUser) redirectWithAdminMessage("error", "El usuario seleccionado ya no existe.");

  const input = readUserInput(formData, false);
  if (!input.contrasena) input.contrasena = targetUser.contrasena;
  const validation = await validateUserInput(input, usuarioId, false);
  if (validation) redirectWithAdminMessage("error", validation, "", usuarioId);

  const auditData = await buildActivityData({
    actor: activityActorFromUser(currentUser),
    accion: "Modificación de usuario, permisos y asignaciones",
    modulo: "Administración",
    resultado: "Éxito",
    detalle: `Usuario actualizado: ${input.nombreCompleto} (${input.correo}). Operadores asignados: ${input.rolOperador ? input.operadores.length : 0}.`,
  });

  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: usuarioId },
      data: {
        nombreCompleto: input.nombreCompleto,
        correo: input.correo,
        contrasena: input.contrasena,
        estado: input.estado,
        rolAdministrador: input.rolAdministrador,
        rolInspector: input.rolInspector,
        rolAutoridad: input.rolAutoridad,
        rolOperador: input.rolOperador,
        inspectorDefectoPuntual: input.rolInspector && input.inspectorDefectoPuntual,
        inspectorRevisionPauta: input.rolInspector && input.inspectorRevisionPauta,
        operadorPuedeResolver: input.rolOperador && input.operadorPuedeResolver,
      },
    });

    await tx.usuarioOperador.deleteMany({ where: { usuarioId } });
    if (input.rolOperador && input.operadores.length > 0) {
      await tx.usuarioOperador.createMany({
        data: input.operadores.map((operadorId) => ({ usuarioId, operadorId })),
        skipDuplicates: true,
      });
    }

    await tx.logActividad.create({ data: auditData });
  });

  redirect(`/administracion?usuario=${encodeURIComponent(usuarioId)}&guardado=1`);
}

async function requireAdministrator() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (!canAccessModule(currentUser, "administracion")) redirect("/sin-acceso");
  return currentUser;
}

function readUserInput(formData: FormData, passwordRequired: boolean): UserInput {
  const rolInspector = formData.get("rolInspector") === "on";
  const rolOperador = formData.get("rolOperador") === "on";
  return {
    nombreCompleto: String(formData.get("nombreCompleto") ?? "").trim(),
    correo: String(formData.get("correo") ?? "").trim().toLowerCase(),
    contrasena: String(formData.get("contrasena") ?? "").trim(),
    estado: String(formData.get("estado") ?? "Activo").trim(),
    rolAdministrador: formData.get("rolAdministrador") === "on",
    rolInspector,
    rolAutoridad: formData.get("rolAutoridad") === "on",
    rolOperador,
    inspectorDefectoPuntual: rolInspector && formData.get("inspectorDefectoPuntual") === "on",
    inspectorRevisionPauta: rolInspector && formData.get("inspectorRevisionPauta") === "on",
    operadorPuedeResolver: rolOperador && formData.get("operadorPuedeResolver") === "on",
    operadores: rolOperador
      ? Array.from(new Set(formData.getAll("operadores").map(String).map((value) => value.trim()).filter(Boolean)))
      : [],
  };
}

async function validateUserInput(input: UserInput, usuarioId: string | null, passwordRequired: boolean) {
  if (!input.nombreCompleto || !input.correo || (passwordRequired && !input.contrasena)) {
    return "Nombre, correo y contraseña son obligatorios para crear un usuario.";
  }
  if (!/^\S+@\S+\.\S+$/.test(input.correo)) return "Ingrese un correo válido.";
  if (input.contrasena && input.contrasena.length < 6) return "La contraseña debe tener al menos 6 caracteres.";
  if (!['Activo', 'Inactivo'].includes(input.estado)) return "El estado seleccionado no es válido.";
  if (!input.rolAdministrador && !input.rolInspector && !input.rolAutoridad && !input.rolOperador) {
    return "Debe asignar al menos un perfil al usuario.";
  }
  if (input.rolInspector && !input.inspectorDefectoPuntual && !input.inspectorRevisionPauta) {
    return "Un Inspector debe tener habilitada al menos una función de registro.";
  }
  if (input.rolOperador && input.operadores.length === 0) {
    return "Un usuario Operador debe tener al menos un operador de buses asignado.";
  }

  const duplicated = await prisma.usuario.findFirst({
    where: {
      correo: input.correo,
      ...(usuarioId ? { NOT: { id: usuarioId } } : {}),
    },
    select: { id: true },
  });
  if (duplicated) return "Ya existe un usuario registrado con ese correo.";

  if (input.operadores.length > 0) {
    const validOperators = await prisma.operador.count({ where: { id: { in: input.operadores } } });
    if (validOperators !== input.operadores.length) return "Una o más asignaciones de operador no son válidas.";
  }
  return null;
}

function redirectWithAdminMessage(type: "error", message: string, mode = "", usuarioId = ""): never {
  const params = new URLSearchParams();
  params.set(type, message);
  if (mode) params.set("modo", mode);
  if (usuarioId) params.set("usuario", usuarioId);
  redirect(`/administracion?${params.toString()}`);
}
