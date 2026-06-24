import "server-only";

import type { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import type { SessionUser } from "@/lib/access";
import { prisma } from "@/lib/db";

export type ActivityResult = "Éxito" | "Advertencia" | "Fallo";

type ActivityActor = {
  id?: string | null;
  nombre: string;
  correo: string;
  perfil: string;
};

type ActivityInput = {
  actor: ActivityActor;
  accion: string;
  modulo: string;
  resultado: ActivityResult;
  detalle?: string | null;
  request?: Request;
};

export function activityActorFromUser(user: SessionUser): ActivityActor {
  return {
    id: user.id,
    nombre: user.nombreCompleto,
    correo: user.correo,
    perfil: user.activeRole,
  };
}

export async function buildActivityData(input: ActivityInput): Promise<Prisma.LogActividadUncheckedCreateInput> {
  const metadata = await getRequestMetadata(input.request);

  return {
    usuarioId: input.actor.id ?? null,
    usuarioNombre: truncate(input.actor.nombre || "Usuario no identificado", 160),
    usuarioCorreo: truncate(input.actor.correo || "No informado", 200),
    perfil: truncate(input.actor.perfil || "Sin perfil", 80),
    accion: truncate(input.accion, 160),
    modulo: truncate(input.modulo, 120),
    resultado: input.resultado,
    detalle: input.detalle ? truncate(input.detalle, 1000) : null,
    ip: metadata.ip,
    dispositivo: metadata.dispositivo,
  };
}

export async function recordActivity(input: ActivityInput) {
  const data = await buildActivityData(input);
  return prisma.logActividad.create({ data });
}

export async function recordActivitySafely(input: ActivityInput) {
  try {
    await recordActivity(input);
  } catch {
    console.error("No fue posible registrar el log de actividad.");
  }
}

async function getRequestMetadata(request?: Request) {
  const requestHeaders = request ? request.headers : await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip")?.trim() || null;
  const dispositivo = requestHeaders.get("user-agent")?.trim() || null;

  return {
    ip: ip ? truncate(ip, 64) : null,
    dispositivo: dispositivo ? truncate(dispositivo, 300) : null,
  };
}

function truncate(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength);
}
