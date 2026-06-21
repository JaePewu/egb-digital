import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Role, SessionUser } from "@/lib/access";

const SESSION_COOKIE = "egb_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

type SessionPayload = {
  userId: string;
  issuedAt: number;
};

export async function authenticateUser(correo: string, contrasena: string) {
  const usuario = await prisma.usuario.findUnique({
    where: { correo: correo.trim().toLowerCase() },
    include: {
      operadores: {
        include: {
          operador: true,
        },
      },
    },
  });

  if (!usuario || usuario.contrasena !== contrasena) {
    return { ok: false as const, error: "Correo o contrasena incorrectos." };
  }

  if (usuario.estado !== "Activo") {
    return { ok: false as const, error: "Usuario inactivo. Contacta al administrador." };
  }

  return { ok: true as const, user: toSessionUser(usuario) };
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(SESSION_COOKIE)?.value;
  const payload = rawCookie ? verifySessionCookie(rawCookie) : null;

  if (!payload) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { id: payload.userId },
    include: {
      operadores: {
        include: {
          operador: true,
        },
      },
    },
  });

  if (!usuario || usuario.estado !== "Activo") return null;

  return toSessionUser(usuario);
}

export function setSessionCookie(response: NextResponse, userId: string) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: createSessionCookie({ userId, issuedAt: Date.now() }),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

function toSessionUser(usuario: Awaited<ReturnType<typeof getUsuarioShape>>) {
  const roles: Role[] = [];
  if (usuario.rolAdministrador) roles.push("Administrador");
  if (usuario.rolInspector) roles.push("Inspector");
  if (usuario.rolAutoridad) roles.push("Autoridad");
  if (usuario.rolOperador) roles.push("Operador");

  return {
    id: usuario.id,
    nombreCompleto: usuario.nombreCompleto,
    correo: usuario.correo,
    estado: usuario.estado,
    roles,
    permisos: {
      inspectorDefectoPuntual: usuario.inspectorDefectoPuntual,
      inspectorRevisionPauta: usuario.inspectorRevisionPauta,
      operadorPuedeResolver: usuario.operadorPuedeResolver,
    },
    operadores: usuario.operadores.map(({ operador }) => ({
      id: operador.id,
      nombre: operador.nombre,
    })),
  };
}

async function getUsuarioShape() {
  return prisma.usuario.findFirstOrThrow({
    include: {
      operadores: {
        include: {
          operador: true,
        },
      },
    },
  });
}

function createSessionCookie(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(body);
  return `${body}.${signature}`;
}

function verifySessionCookie(value: string) {
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;
  if (!timingSafeEqual(signature, sign(body))) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    const ageSeconds = (Date.now() - payload.issuedAt) / 1000;
    if (!payload.userId || ageSeconds > SESSION_MAX_AGE_SECONDS) return null;
    return payload;
  } catch {
    return null;
  }
}

function sign(value: string) {
  const secret = process.env.SESSION_SECRET ?? "egb-digital-mvp-local-session";
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
