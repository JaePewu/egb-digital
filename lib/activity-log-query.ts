import type { Prisma } from "@prisma/client";

export type ActivityLogFilters = {
  desde: string;
  hasta: string;
  usuario: string;
  perfil: string;
  accion: string;
  modulo: string;
  resultado: string;
  pagina: number;
};

export function normalizeActivityLogFilters(
  params?: Record<string, string | string[] | undefined>,
): ActivityLogFilters {
  return {
    desde: getParam(params, "desde"),
    hasta: getParam(params, "hasta"),
    usuario: getParam(params, "usuario"),
    perfil: getParam(params, "perfil"),
    accion: getParam(params, "accion"),
    modulo: getParam(params, "modulo"),
    resultado: getParam(params, "resultado"),
    pagina: normalizePage(getParam(params, "pagina")),
  };
}

export function buildActivityLogWhere(filters: ActivityLogFilters): Prisma.LogActividadWhereInput {
  const and: Prisma.LogActividadWhereInput[] = [];

  if (filters.desde) and.push({ fechaHora: { gte: new Date(`${filters.desde}T00:00:00`) } });
  if (filters.hasta) and.push({ fechaHora: { lte: new Date(`${filters.hasta}T23:59:59.999`) } });
  if (filters.usuario) {
    and.push({
      OR: [
        { usuarioNombre: { contains: filters.usuario, mode: "insensitive" } },
        { usuarioCorreo: { contains: filters.usuario, mode: "insensitive" } },
      ],
    });
  }
  if (filters.perfil) and.push({ perfil: filters.perfil });
  if (filters.accion) and.push({ accion: filters.accion });
  if (filters.modulo) and.push({ modulo: filters.modulo });
  if (filters.resultado) and.push({ resultado: filters.resultado });

  return and.length > 0 ? { AND: and } : {};
}

export function buildActivityLogHref(filters: ActivityLogFilters, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, pagina: page })) {
    if (value) params.set(key, String(value));
  }
  return `/logs?${params.toString()}`;
}

export function buildActivityLogExportHref(filters: ActivityLogFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (key !== "pagina" && value) params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `/logs/export?${query}` : "/logs/export";
}

function getParam(params: Record<string, string | string[] | undefined> | undefined, key: string) {
  const value = params?.[key];
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

function normalizePage(value: string) {
  const page = Number.parseInt(value, 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}
