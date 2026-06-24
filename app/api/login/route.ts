import { NextResponse } from "next/server";
import { authenticateUser, setSessionCookie } from "@/lib/auth";
import { getDefaultPathForUser } from "@/lib/access";
import { activityActorFromUser, recordActivitySafely } from "@/lib/activity-log";

export async function POST(request: Request) {
  const formData = await request.formData();
  const correo = String(formData.get("correo") ?? "");
  const contrasena = String(formData.get("contrasena") ?? "");
  const result = await authenticateUser(correo, contrasena);

  if (!result.ok) {
    await recordActivitySafely({
      actor: {
        nombre: "Usuario no identificado",
        correo: correo.trim().toLowerCase() || "No informado",
        perfil: "Sin perfil",
      },
      accion: "Inicio de sesión",
      modulo: "Autenticación",
      resultado: "Fallo",
      detalle: "Intento de inicio de sesión rechazado.",
      request,
    });
    const url = new URL("/login", request.url);
    url.searchParams.set("error", result.error);
    return NextResponse.redirect(url, { status: 303 });
  }

  const response = NextResponse.redirect(new URL(getDefaultPathForUser(result.user), request.url), {
    status: 303,
  });
  setSessionCookie(response, result.user.id, result.user.activeRole);
  await recordActivitySafely({
    actor: activityActorFromUser(result.user),
    accion: "Inicio de sesión",
    modulo: "Autenticación",
    resultado: "Éxito",
    detalle: "Inicio de sesión exitoso.",
    request,
  });
  return response;
}
