import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Eye } from "lucide-react";
import { redirect } from "next/navigation";
import { canAccessModule, hasActiveRole } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getInspectionTypeLabel } from "@/lib/display-labels";
import { markNotificationReviewed } from "./actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

type NotificacionesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type FilterOption = {
  value: string;
  label: string;
};

type NotificationWithRelations = Prisma.NotificacionGetPayload<{
  include: {
    inspeccion: {
      select: {
        criticidadMasGrave: true;
        fechaHora: true;
        estado: true;
      };
    };
    bus: {
      select: {
        operadorId: true;
      };
    };
  };
}>;

export default async function NotificacionesPage({ searchParams }: NotificacionesPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessModule(user, "notificaciones")) redirect("/sin-acceso");

  const params = await searchParams;
  const filters = normalizeFilters(params);
  const scopeWhere = buildScopeWhere(user);
  const where = buildWhere(scopeWhere, filters);
  const currentPage = Math.max(1, Number(filters.page) || 1);

  const [notificaciones, total, opcionesBase, selectedNotification] = await Promise.all([
    prisma.notificacion.findMany({
      where,
      orderBy: { fechaHora: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        inspeccion: {
          select: {
            criticidadMasGrave: true,
            fechaHora: true,
            estado: true,
          },
        },
        bus: {
          select: {
            operadorId: true,
          },
        },
      },
    }),
    prisma.notificacion.count({ where }),
    prisma.notificacion.findMany({
      where: scopeWhere,
      orderBy: { fechaHora: "desc" },
      select: {
        operador: true,
        responsable: true,
        certificador: true,
        estado: true,
        bus: {
          select: {
            operadorId: true,
          },
        },
      },
    }),
    filters.notificacion
      ? prisma.notificacion.findFirst({
          where: {
            AND: [{ id: filters.notificacion }, scopeWhere],
          },
          include: {
            inspeccion: {
              select: {
                criticidadMasGrave: true,
                fechaHora: true,
                estado: true,
              },
            },
            bus: {
              select: {
                operadorId: true,
              },
            },
          },
        })
      : null,
  ]);

  const options = buildFilterOptions(opcionesBase);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, total);

  return (
    <main className="module-shell notifications-page">
      <section className="module-header defect-header">
        <h1>Notificaciones</h1>
        <p className="lead">
          Listado de notificaciones generadas por inspecciones y reparaciones reportadas en la plataforma.
        </p>
      </section>

      <form className="notifications-filters" method="get">
        <label>
          Fecha desde
          <input name="desde" type="date" defaultValue={filters.desde} />
        </label>
        <label>
          Fecha hasta
          <input name="hasta" type="date" defaultValue={filters.hasta} />
        </label>
        <label>
          Tipo de notificación
          <select name="tipoNotificacion" defaultValue={filters.tipoNotificacion}>
            <option value="">Todos</option>
            <option value="registro">Registro inspección</option>
            <option value="reparacion">Reparación completada</option>
          </select>
        </label>
        <label>
          Tipo de inspección
          <select name="tipoInspeccion" defaultValue={filters.tipoInspeccion}>
            <option value="">Todos</option>
            <option value="Defecto puntual">{getInspectionTypeLabel("Defecto puntual")}</option>
            <option value="Revision de pauta">{getInspectionTypeLabel("Revision de pauta")}</option>
          </select>
        </label>
        <label>
          PPU
          <input name="ppu" defaultValue={filters.ppu} placeholder="Buscar por PPU..." />
        </label>
        <label>
          Operador
          <select name="operador" defaultValue={filters.operador}>
            <option value="">Todos</option>
            {options.operadores.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Responsable
          <input name="responsable" defaultValue={filters.responsable} placeholder="Buscar responsable..." />
        </label>
        <label>
          Certificador
          <select name="certificador" defaultValue={filters.certificador}>
            <option value="">Todos</option>
            {options.certificadores.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estado
          <select name="estado" defaultValue={filters.estado}>
            <option value="">Todos</option>
            <option value="Nueva">Nueva</option>
            <option value="Revisada">Revisada</option>
          </select>
        </label>
        <div className="notifications-filter-actions">
          <Link href="/notificaciones">Limpiar filtros</Link>
          <button type="submit">Buscar</button>
        </div>
      </form>

      <section className="notifications-table-card">
        <div className="table-wrap">
          <table className="notifications-table">
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Tipo de notificación</th>
                <th>Tipo de inspección</th>
                <th>PPU</th>
                <th>Operador</th>
                <th>Responsable</th>
                <th>Certificador</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {notificaciones.length === 0 ? (
                <tr>
                  <td colSpan={9}>No se encontraron notificaciones para los filtros seleccionados.</td>
                </tr>
              ) : (
                notificaciones.map((notificacion) => (
                  <tr key={notificacion.id}>
                    <td>{formatDateTime(notificacion.fechaHora)}</td>
                    <td>{getNotificationTypeLabel(notificacion.tipoNotificacion)}</td>
                    <td>{getInspectionTypeLabel(notificacion.tipoInspeccion)}</td>
                    <td>{notificacion.ppu}</td>
                    <td>{notificacion.operador}</td>
                    <td>{notificacion.responsable ?? "Sin responsable"}</td>
                    <td>{notificacion.certificador ?? "Sin certificador"}</td>
                    <td>
                      <NotificationStatus estado={notificacion.estado} />
                    </td>
                    <td>
                      <Link className="text-link notification-detail-link" href={buildHref(filters, { notificacion: notificacion.id })}>
                        <Eye aria-hidden="true" size={16} strokeWidth={2} />
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="notifications-pagination">
          <span>
            Mostrando {from} a {to} de {total} notificación(es)
          </span>
          <div>
            <Link aria-disabled={currentPage <= 1} href={buildHref(filters, { page: String(Math.max(1, currentPage - 1)) })}>
              Anterior
            </Link>
            <strong>{currentPage}</strong>
            <Link
              aria-disabled={currentPage >= totalPages}
              href={buildHref(filters, { page: String(Math.min(totalPages, currentPage + 1)) })}
            >
              Siguiente
            </Link>
          </div>
        </div>
      </section>

      {selectedNotification ? (
        <NotificationModal
          closeHref={buildHref(filters, { notificacion: "" })}
          notification={selectedNotification}
          returnTo={buildHref(filters, { notificacion: selectedNotification.id })}
        />
      ) : null}
    </main>
  );
}

function NotificationModal({
  closeHref,
  notification,
  returnTo,
}: {
  closeHref: string;
  notification: NotificationWithRelations;
  returnTo: string;
}) {
  const hasSimulatedEmail = notification.inspeccion.criticidadMasGrave === "Alta";
  const subject =
    notification.tipoNotificacion === "Reparacion completada"
      ? `Notificación de reparación completada - PPU ${notification.ppu}`
      : `Notificación de inspección registrada - PPU ${notification.ppu}`;
  const body = buildMailBody(notification, hasSimulatedEmail);

  return (
    <div className="notification-modal-backdrop">
      <section className="notification-modal" role="dialog" aria-modal="true" aria-labelledby="notification-title">
        <header>
          <h2 id="notification-title">
            Detalle de notificación
            <Eye aria-hidden="true" size={20} strokeWidth={2} />
          </h2>
          <Link href={closeHref} aria-label="Cerrar detalle">
            ×
          </Link>
        </header>

        <div className="notification-modal-section">
          <h3>Resumen</h3>
          <dl className="notification-summary-grid">
            <div>
              <dt>Fecha y hora</dt>
              <dd>{formatDateTime(notification.fechaHora)}</dd>
            </div>
            <div>
              <dt>Tipo de notificación</dt>
              <dd>{getNotificationTypeLabel(notification.tipoNotificacion)}</dd>
            </div>
            <div>
              <dt>Tipo de inspección</dt>
              <dd>{getInspectionTypeLabel(notification.tipoInspeccion)}</dd>
            </div>
            <div>
              <dt>PPU</dt>
              <dd>{notification.ppu}</dd>
            </div>
            <div>
              <dt>Operador</dt>
              <dd>{notification.operador}</dd>
            </div>
            <div>
              <dt>Responsable</dt>
              <dd>{notification.responsable ?? "Sin responsable"}</dd>
            </div>
            <div>
              <dt>Certificador</dt>
              <dd>{notification.certificador ?? "Sin certificador"}</dd>
            </div>
            <div>
              <dt>Criticidad más grave</dt>
              <dd>{notification.inspeccion.criticidadMasGrave}</dd>
            </div>
          </dl>
        </div>

        <div className="notification-modal-section">
          <h3>Destinatarios del correo</h3>
          {hasSimulatedEmail ? (
            <div className="notification-recipients">
              <Recipient label="Operador" value={notification.correoOperadorSimulado} />
              <Recipient label="Certificador" value={notification.correoCertificadorSimulado} />
              <Recipient label="Autoridad" value={notification.correoAutoridadSimulado} />
            </div>
          ) : (
            <p className="notification-mail-note">
              No se generó correo simulado porque la criticidad máxima de la inspección no es Alta.
            </p>
          )}
        </div>

        <div className="notification-modal-section">
          <h3>Asunto del correo</h3>
          <div className="notification-mail-box">{hasSimulatedEmail ? subject : "Sin correo simulado"}</div>
        </div>

        <div className="notification-modal-section">
          <h3>Cuerpo del mail</h3>
          <div className="notification-mail-body">{body}</div>
        </div>

        <div className="notification-modal-section">
          <h3>Archivos o referencia</h3>
          <div className="notification-reference">
            <span>ID de notificación: {notification.id}</span>
            <Link href={`/historial/${notification.inspeccionId}`}>Ver inspección</Link>
          </div>
        </div>

        <footer>
          <Link className="secondary-action" href={closeHref}>
            Cerrar
          </Link>
          {notification.estado === "Nueva" ? (
            <form action={markNotificationReviewed}>
              <input name="notificationId" type="hidden" value={notification.id} />
              <input name="returnTo" type="hidden" value={returnTo} />
              <button className="primary-action" type="submit">
                Marcar como revisada
              </button>
            </form>
          ) : null}
        </footer>
      </section>
    </div>
  );
}

function Recipient({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <strong>{label}</strong>
      <span>{value ?? "Sin correo simulado"}</span>
    </div>
  );
}

function NotificationStatus({ estado }: { estado: string }) {
  if (estado === "Nueva") return <span className="notification-status new">Nueva</span>;
  return <span className="notification-status reviewed">{estado || "Revisada"}</span>;
}

function normalizeFilters(params?: Record<string, string | string[] | undefined>) {
  return {
    desde: getParam(params, "desde"),
    hasta: getParam(params, "hasta"),
    tipoNotificacion: getParam(params, "tipoNotificacion"),
    tipoInspeccion: getParam(params, "tipoInspeccion"),
    ppu: getParam(params, "ppu").toUpperCase(),
    operador: getParam(params, "operador"),
    responsable: getParam(params, "responsable"),
    certificador: getParam(params, "certificador"),
    estado: getParam(params, "estado"),
    page: getParam(params, "page"),
    notificacion: getParam(params, "notificacion"),
  };
}

function getParam(params: Record<string, string | string[] | undefined> | undefined, key: string) {
  const value = params?.[key];
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

function buildScopeWhere(user: Awaited<ReturnType<typeof getCurrentUser>>): Prisma.NotificacionWhereInput {
  if (!user) return { id: "__sin_usuario__" };
  if (hasActiveRole(user, "Autoridad")) return {};
  if (hasActiveRole(user, "Operador")) {
    const operadorIds = user.operadores.map((operador) => operador.id);
    if (operadorIds.length > 0) return { bus: { operadorId: { in: operadorIds } } };
  }
  return { id: "__sin_alcance_notificaciones__" };
}

function buildWhere(
  scopeWhere: Prisma.NotificacionWhereInput,
  filters: ReturnType<typeof normalizeFilters>,
): Prisma.NotificacionWhereInput {
  const and: Prisma.NotificacionWhereInput[] = [scopeWhere];

  if (filters.desde) and.push({ fechaHora: { gte: new Date(`${filters.desde}T00:00:00`) } });
  if (filters.hasta) and.push({ fechaHora: { lte: new Date(`${filters.hasta}T23:59:59`) } });
  if (filters.tipoNotificacion === "registro") {
    and.push({ tipoNotificacion: { in: ["Registro", "Alerta criticidad alta"] } });
  }
  if (filters.tipoNotificacion === "reparacion") {
    and.push({ tipoNotificacion: "Reparacion completada" });
  }
  if (filters.tipoInspeccion) and.push({ tipoInspeccion: filters.tipoInspeccion });
  if (filters.ppu) and.push({ ppu: { contains: filters.ppu } });
  if (filters.operador) and.push({ bus: { operadorId: filters.operador } });
  if (filters.responsable) and.push({ responsable: { contains: filters.responsable } });
  if (filters.certificador) and.push({ certificador: filters.certificador });
  if (filters.estado) and.push({ estado: filters.estado });

  return { AND: and };
}

function buildFilterOptions(
  rows: Array<{
    operador: string;
    responsable: string | null;
    certificador: string | null;
    estado: string;
    bus: {
      operadorId: string;
    };
  }>,
) {
  return {
    operadores: uniqueOptions(rows.map((row) => ({ value: row.bus.operadorId, label: row.operador }))),
    responsables: uniqueOptions(rows.map((row) => ({ value: row.responsable ?? "", label: row.responsable ?? "" }))),
    certificadores: uniqueOptions(rows.map((row) => ({ value: row.certificador ?? "", label: row.certificador ?? "" }))),
    estados: uniqueOptions(rows.map((row) => ({ value: row.estado, label: row.estado }))),
  };
}

function uniqueOptions(options: FilterOption[]) {
  return Array.from(new Map(options.filter((option) => option.value).map((option) => [option.value, option])).values()).sort(
    (a, b) => a.label.localeCompare(b.label, "es"),
  );
}

function buildHref(filters: ReturnType<typeof normalizeFilters>, overrides: Partial<Record<keyof ReturnType<typeof normalizeFilters>, string>>) {
  const params = new URLSearchParams();
  const next = { ...filters, ...overrides, page: overrides.page ?? filters.page };
  for (const [key, value] of Object.entries(next)) {
    if (key === "page" && (!value || value === "1")) continue;
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/notificaciones?${query}` : "/notificaciones";
}

function getNotificationTypeLabel(value: string) {
  if (value === "Reparacion completada") return "Reparación completada";
  if (value === "Resolucion actualizada") return "Resolución actualizada";
  return "Registro inspección";
}

function formatDateTime(date: Date) {
  const parts = new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")} ${get("hour")}:${get("minute")}`;
}

function buildMailBody(
  notification: NotificationWithRelations,
  hasSimulatedEmail: boolean,
) {
  if (!hasSimulatedEmail) {
    return "No se generó cuerpo de correo simulado. La notificación quedó disponible internamente en la plataforma.";
  }

  const action =
    notification.tipoNotificacion === "Reparacion completada"
      ? "Se informa que la reparación fue reportada como completada."
      : "Se solicita revisar el detalle de la inspección y gestionar las acciones correspondientes.";

  return `Junto con saludar, se informa que con fecha ${formatDateTime(notification.fechaHora)} se registró un evento para el bus PPU ${notification.ppu}, asociado al operador ${notification.operador}. Tipo de inspección: ${getInspectionTypeLabel(notification.tipoInspeccion)}. Responsable: ${notification.responsable ?? "Sin responsable"}. Criticidad más grave: ${notification.inspeccion.criticidadMasGrave}. ${action}`;
}
