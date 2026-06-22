import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAccessModule, hasActiveRole } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getInspectionWhere } from "@/lib/inspection-access";
import { saveInspectionResolution } from "./actions";

export const dynamic = "force-dynamic";

type DetalleInspeccionPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    sinCambios?: string;
  }>;
};

export default async function DetalleInspeccionPage({ params, searchParams }: DetalleInspeccionPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessModule(user, "historial")) redirect("/sin-acceso");

  const { id } = await params;
  const query = await searchParams;
  const inspeccion = await prisma.inspeccion.findFirst({
    where: {
      AND: [{ id }, getInspectionWhere(user)],
    },
    include: {
      bus: true,
      inspector: {
        select: {
          nombreCompleto: true,
          correo: true,
        },
      },
      defectos: {
        orderBy: {
          id: "asc",
        },
      },
      resultadosPauta: {
        where: {
          resultado: "No cumple",
        },
        orderBy: {
          itemPautaId: "asc",
        },
      },
    },
  });

  if (!inspeccion) notFound();

  const canResolve = hasActiveRole(user, "Operador") && user.permisos.operadorPuedeResolver && inspeccion.defectos.length > 0;
  const isResolutionTitle = canResolve;
  const defectIds = inspeccion.defectos.map((defecto) => defecto.id).join(",");

  return (
    <main className="module-shell inspection-detail-page">
      <section className="module-header defect-header">
        <p className="detail-breadcrumb">
          Historial de inspecciones &gt; {isResolutionTitle ? "Resolver inspección" : "Detalle de inspección"}
        </p>
        <h1>{isResolutionTitle ? "Resolver inspección" : "Detalle de inspección"}</h1>
        <p className="lead">
          {isResolutionTitle
            ? "Revisa los defectos detectados, consulta la evidencia del inspector y marca los defectos reparados."
            : "Revisa la información registrada durante la inspección."}
        </p>
      </section>

      {query?.sinCambios === "1" ? (
        <p className="defect-info">No se detectaron cambios en la resolución de defectos.</p>
      ) : null}

      <section className="defect-card bus-summary-card">
        <h2>Información del bus</h2>
        <dl className="bus-summary-grid">
          <div>
            <dt>PPU</dt>
            <dd>{inspeccion.bus.ppu}</dd>
          </div>
          <div>
            <dt>Operador</dt>
            <dd>{inspeccion.bus.operadorNombre}</dd>
          </div>
          <div>
            <dt>Chasis</dt>
            <dd>{joinParts(inspeccion.bus.chasisMarca, inspeccion.bus.chasisModelo)}</dd>
          </div>
          <div>
            <dt>Carrocería</dt>
            <dd>{joinParts(inspeccion.bus.carroceriaMarca, inspeccion.bus.carroceriaModelo)}</dd>
          </div>
          <div>
            <dt>Tecnología</dt>
            <dd>{inspeccion.bus.tecnologia ?? "Sin dato"}</dd>
          </div>
          <div>
            <dt>Tipo Bus</dt>
            <dd>{inspeccion.bus.tipoBus ?? "Sin dato"}</dd>
          </div>
          <div>
            <dt>Año</dt>
            <dd>{inspeccion.bus.anio ?? "Sin dato"}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-grid">
        <article className="detail-panel inspection-summary-panel">
          <h2>Datos de inspección</h2>
          <dl>
            <div>
              <dt>Fecha</dt>
              <dd>{formatDate(inspeccion.fechaHora)}</dd>
            </div>
            <div>
              <dt>Hora</dt>
              <dd>{formatTime(inspeccion.fechaHora)}</dd>
            </div>
            <div>
              <dt>Ubicación</dt>
              <dd>{inspeccion.ubicacionSimulada ?? "Sin ubicación registrada."}</dd>
            </div>
            <div>
              <dt>Inspector</dt>
              <dd>{inspeccion.inspector.nombreCompleto}</dd>
            </div>
            <div>
              <dt>Tipo</dt>
              <dd>{inspeccion.tipoInspeccion}</dd>
            </div>
            <div>
              <dt>Criticidad</dt>
              <dd>
                {inspeccion.cantidadDefectos > 0 ? (
                  <span className={`severity ${inspeccion.criticidadMasGrave.toLowerCase()}`}>
                    {inspeccion.criticidadMasGrave}
                  </span>
                ) : (
                  <span className="severity-empty">Sin defectos</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Defectos</dt>
              <dd>{inspeccion.cantidadDefectos}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>
                <span className={`status-badge ${inspeccion.todosDefectosReparados ? "resolved" : "pending"}`}>
                  {inspeccion.todosDefectosReparados ? "Resuelta" : "Pendiente"}
                </span>
              </dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="detail-panel full-panel">
        <h2>Observaciones generales</h2>
        <div className="note-grid">
          <p>
            <strong>Inspector:</strong>{" "}
            {inspeccion.observacionGeneralInspector ?? "Sin observacion registrada."}
          </p>
          <p>
            <strong>Operador:</strong>{" "}
            {inspeccion.observacionGeneralOperador ?? "Sin observacion registrada."}
          </p>
        </div>
      </section>

      <form action={saveInspectionResolution}>
        <input name="inspectionId" type="hidden" value={inspeccion.id} />
        <input name="defectIds" type="hidden" value={defectIds} />

        <section className="detail-panel full-panel">
          <div className="section-heading">
            <h2>Defectos detectados</h2>
            <p>{inspeccion.defectos.length} registro(s)</p>
          </div>
          {inspeccion.defectos.length === 0 ? (
            <div className="empty-state">Esta inspección no tiene defectos detectados.</div>
          ) : (
            <div className="inspection-defect-list">
              {inspeccion.defectos.map((defecto, index) => {
                const evidenceCount = Number(Boolean(defecto.urlFotoInspector)) + Number(Boolean(defecto.urlVideoInspector));

                return (
                  <article className="inspection-defect-card" key={defecto.id}>
                    <header>
                      <div className="inspection-defect-title">
                        <span>{index + 1}</span>
                        <div>
                          <h3>{defecto.item}</h3>
                          <p>{defecto.elemento} · {defecto.atributo}</p>
                        </div>
                      </div>
                      <span className={`severity ${defecto.criticidad.toLowerCase()}`}>{defecto.criticidad}</span>
                    </header>

                    <div className="inspection-defect-body">
                      <div>
                        <dt>Criterio específico</dt>
                        <dd>{defecto.criterioEspecifico}</dd>
                      </div>
                      <div>
                        <dt>Observación inspector</dt>
                        <dd>{defecto.observacionInspector ?? "Sin observación registrada."}</dd>
                      </div>
                      <div>
                        <dt>Evidencia inspector</dt>
                        <dd>
                          <div className="evidence-links">
                            {defecto.urlFotoInspector ? (
                              <a href={defecto.urlFotoInspector} target="_blank" rel="noreferrer">
                                Foto simulada
                              </a>
                            ) : null}
                            {defecto.urlVideoInspector ? (
                              <a href={defecto.urlVideoInspector} target="_blank" rel="noreferrer">
                                Video simulado
                              </a>
                            ) : null}
                            {evidenceCount > 0 ? <span>{evidenceCount} archivo(s)</span> : <span>Sin evidencia adjunta.</span>}
                          </div>
                        </dd>
                      </div>
                    </div>

                    {canResolve ? (
                      <section className="operator-resolution-panel">
                        <div>
                          <h4>Resolución del operador</h4>
                          <label className="repair-check">
                            <input
                              defaultChecked={defecto.defectoReparado}
                              name={`reparado:${defecto.id}`}
                              type="checkbox"
                            />
                            <span>Defecto reparado</span>
                          </label>
                        </div>
                        <label className="operator-note">
                          Observación del operador
                          <textarea
                            defaultValue={defecto.observacionOperador ?? ""}
                            maxLength={400}
                            name={`observacion:${defecto.id}`}
                            placeholder="Agregue una observación opcional..."
                          />
                        </label>
                      </section>
                    ) : (
                      <section className="operator-resolution-readonly">
                        <h4>Resolución del operador</h4>
                        <dl>
                          <div>
                            <dt>Estado reparación</dt>
                            <dd>
                              <span className={`status-badge ${defecto.defectoReparado ? "resolved" : "pending"}`}>
                                {defecto.defectoReparado ? "Reparado" : "Pendiente"}
                              </span>
                            </dd>
                          </div>
                          <div>
                            <dt>Observación operador</dt>
                            <dd>{defecto.observacionOperador ?? "Sin observación registrada."}</dd>
                          </div>
                          <div>
                            <dt>Fecha resolución</dt>
                            <dd>{defecto.fechaMarcadoReparado ? formatDateTime(defecto.fechaMarcadoReparado) : "Sin fecha registrada."}</dd>
                          </div>
                        </dl>
                      </section>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div className="detail-bottom-actions">
          <Link className="secondary-action" href="/historial">
            Volver al listado
          </Link>
          {canResolve ? (
            <button className="primary-action" type="submit">
              Guardar y notificar
            </button>
          ) : null}
        </div>
      </form>
    </main>
  );
}

function joinParts(...parts: Array<string | null>) {
  return parts.filter(Boolean).join(" ") || "Sin dato";
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
