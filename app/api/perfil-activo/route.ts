import { NextResponse } from "next/server";
import { getDefaultPathForUser, rolePriority, type Role } from "@/lib/access";
import { activityActorFromUser, recordActivitySafely } from "@/lib/activity-log";
import { getCurrentUser, setSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url), { status: 303 });

  const formData = await request.formData();
  const requestedRole = String(formData.get("perfil") ?? "") as Role;
  const activeRole = user.roles.includes(requestedRole)
    ? requestedRole
    : rolePriority.find((role) => user.roles.includes(role));

  if (!activeRole) {
    return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  }

  const response = NextResponse.redirect(new URL(getDefaultPathForUser({ ...user, activeRole }), request.url), {
    status: 303,
  });
  setSessionCookie(response, user.id, activeRole);
  await recordActivitySafely({
    actor: activityActorFromUser({ ...user, activeRole }),
    accion: "Cambio de perfil activo",
    modulo: "Perfiles",
    resultado: "Éxito",
    detalle: `Perfil activo cambiado de ${user.activeRole} a ${activeRole}.`,
    request,
  });
  return response;
}
