import Link from "next/link";
import { CircleCheck, CircleX, Download, TriangleAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { canAccessModule } from "@/lib/access";
import {
  buildActivityLogExportHref,
  buildActivityLogHref,
  buildActivityLogWhere,
  normalizeActivityLogFilters,
} from "@/lib/activity-log-query";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SearchFeedback } from "../_components/search-feedback";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type LogsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LogsPage({ searchParams }: LogsPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessModule(user, "logs")) redirect("/sin-acceso");

  const params = await searchParams;
  const filters = normalizeActivityLogFilters(params);
  const where = buildActivityLogWhere(filters);

  const [total, perfiles, acciones, modulos] = await Promise.all([
    prisma.logActividad.count({ where }),
    getDistinctValues("perfil"),
    getDistinctValues("accion"),
    getDistinctValues("modulo"),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(filters.pagina, totalPages);
  const logs = await prisma.logActividad.findMany({
    where,
    orderBy: { fechaHora: "desc" },
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return (
    <main className="module-shell logs-page">
      <section className="module-header">
        <h1>Logs de actividades</h1>
        <p className="lead">
          Consulta los registros de auditoría de acciones relevantes para proteger la integridad de la información.
        </p>
      </section>

      <form className="logs-filters" method="get">
        <label>
          Fecha desde
          <input name="desde" type="date" defaultValue={filters.desde} />
        </label>
        <label>
          Fecha hasta
          <input name="hasta" type="date" defaultValue={filters.hasta} />
        </label>
        <label>
          Usuario
          <input name="usuario" defaultValue={filters.usuario} placeholder="Nombre o correo" />
        </label>
        <label>
          Perfil
          <select name="perfil" defaultValue={filters.perfil}>
            <option value="">Todos</option>
            {perfiles.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Acción
          <select name="accion" defaultValue={filters.accion}>
            <option value="">Todas</option>
            {acciones.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Módulo
          <select name="modulo" defaultValue={filters.modulo}>
            <option value="">Todos</option>
            {modulos.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Resultado
          <select name="resultado" defaultValue={filters.resultado}>
            <option value="">Todos</option>
            <option value="Éxito">Éxito</option>
            <option value="Advertencia">Advertencia</option>
            <option value="Fallo">Fallo</option>
          </select>
        </label>
        <div className="logs-filter-actions">
          <button type="submit">Buscar</button>
          <Link href="/logs">Limpiar</Link>
          <a className="logs-export" href={buildActivityLogExportHref(filters)}>
            <Download aria-hidden="true" size={20} strokeWidth={2} />
            Exportar CSV
          </a>
        </div>
      </form>

      {hasLogSearch(filters) ? (
        <SearchFeedback
          message={total > 0 ? `${total} actividad(es) encontrada(s).` : "No se encontraron actividades para la búsqueda."}
          status={total > 0 ? "success" : "empty"}
        />
      ) : null}

      <section className="logs-panel">
        <div className="section-heading">
          <h2>Registro de auditoría</h2>
          <p>{total} registro(s)</p>
        </div>

        {logs.length === 0 ? (
          <div className="empty-state">No hay logs para los filtros seleccionados.</div>
        ) : (
          <div className="table-wrap logs-table-wrap">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Usuario</th>
                  <th>Perfil</th>
                  <th>Acción</th>
                  <th>Módulo</th>
                  <th>Resultado</th>
                  <th>IP / dispositivo</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.fechaHora)}</td>
                    <td>
                      <strong>{log.usuarioNombre}</strong>
                      <small>{log.usuarioCorreo}</small>
                    </td>
                    <td>{log.perfil}</td>
                    <td>{log.accion}</td>
                    <td>{log.modulo}</td>
                    <td>
                      <span className={`log-result ${resultClass(log.resultado)}`}>
                        <ResultIcon result={log.resultado} />
                        <span>{log.resultado}</span>
                      </span>
                    </td>
                    <td>
                      <span>{log.ip ?? "Sin IP"}</span>
                      <small title={log.dispositivo ?? undefined}>
                        {log.dispositivo ? truncate(log.dispositivo, 54) : "Sin dispositivo"}
                      </small>
                    </td>
                    <td className="log-detail">{log.detalle ?? "Sin detalle"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <nav className="notifications-pagination" aria-label="Paginación de logs">
            <Link
              aria-disabled={currentPage <= 1}
              href={currentPage > 1 ? buildActivityLogHref(filters, currentPage - 1) : buildActivityLogHref(filters, 1)}
            >
              Anterior
            </Link>
            <div>
              <span>Página</span>
              <strong>{currentPage}</strong>
              <span>de {totalPages}</span>
            </div>
            <Link
              aria-disabled={currentPage >= totalPages}
              href={
                currentPage < totalPages
                  ? buildActivityLogHref(filters, currentPage + 1)
                  : buildActivityLogHref(filters, totalPages)
              }
            >
              Siguiente
            </Link>
          </nav>
        ) : null}
      </section>
    </main>
  );
}

async function getDistinctValues(field: "perfil" | "accion" | "modulo") {
  const rows = await prisma.logActividad.findMany({
    distinct: [field],
    orderBy: { [field]: "asc" },
    select: { [field]: true },
  });
  return rows.map((row) => row[field]).filter(Boolean);
}

function hasLogSearch(filters: ReturnType<typeof normalizeActivityLogFilters>) {
  return Boolean(
    filters.desde ||
      filters.hasta ||
      filters.usuario ||
      filters.perfil ||
      filters.accion ||
      filters.modulo ||
      filters.resultado,
  );
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "medium",
    hour12: false,
  }).format(date);
}

function resultClass(result: string) {
  if (result === "Éxito") return "success";
  if (result === "Advertencia") return "warning";
  return "failure";
}

function ResultIcon({ result }: { result: string }) {
  if (result === "Éxito") {
    return <CircleCheck aria-hidden="true" size={16} strokeWidth={2} />;
  }
  if (result === "Advertencia") {
    return <TriangleAlert aria-hidden="true" size={16} strokeWidth={2} />;
  }
  return <CircleX aria-hidden="true" size={16} strokeWidth={2} />;
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}
