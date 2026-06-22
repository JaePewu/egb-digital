"use server";

import { redirect } from "next/navigation";
import { canAccessModule, hasActiveRole } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function markNotificationReviewed(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessModule(user, "notificaciones")) redirect("/sin-acceso");

  const notificationId = String(formData.get("notificationId") ?? "");
  const returnTo = sanitizeReturnTo(String(formData.get("returnTo") ?? "/notificaciones"));
  if (!notificationId) redirect(returnTo);

  const notificacion = await prisma.notificacion.findFirst({
    where: {
      AND: [{ id: notificationId }, buildScopeWhere(user)],
    },
    select: {
      id: true,
    },
  });

  if (!notificacion) redirect("/sin-acceso");

  await prisma.notificacion.update({
    where: { id: notificationId },
    data: {
      estado: "Revisada",
    },
  });

  redirect(returnTo);
}

function buildScopeWhere(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  if (hasActiveRole(user, "Autoridad")) return {};
  if (hasActiveRole(user, "Operador")) {
    const operadorIds = user.operadores.map((operador) => operador.id);
    if (operadorIds.length > 0) return { bus: { operadorId: { in: operadorIds } } };
  }
  return { id: "__sin_alcance_notificaciones__" };
}

function sanitizeReturnTo(value: string) {
  if (!value.startsWith("/notificaciones")) return "/notificaciones";
  return value;
}
