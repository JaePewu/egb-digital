import { NextResponse } from "next/server";
import { canAccessModule } from "@/lib/access";
import { buildActivityLogWhere, normalizeActivityLogFilters } from "@/lib/activity-log-query";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!canAccessModule(user, "logs")) return NextResponse.redirect(new URL("/sin-acceso", request.url));

  const searchParams = Object.fromEntries(new URL(request.url).searchParams.entries());
  const filters = normalizeActivityLogFilters(searchParams);
  const logs = await prisma.logActividad.findMany({
    where: buildActivityLogWhere(filters),
    orderBy: { fechaHora: "desc" },
  });

  const rows = [
    ["Fecha y hora", "Usuario", "Correo", "Perfil", "Acción", "Módulo", "Resultado", "IP", "Dispositivo", "Detalle"],
    ...logs.map((log) => [
      log.fechaHora.toISOString(),
      log.usuarioNombre,
      log.usuarioCorreo,
      log.perfil,
      log.accion,
      log.modulo,
      log.resultado,
      log.ip ?? "",
      log.dispositivo ?? "",
      log.detalle ?? "",
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="logs-actividades-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

function csvCell(value: string) {
  const protectedValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}
