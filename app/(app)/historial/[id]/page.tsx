import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAccessModule, hasRole } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getInspectionWhere } from "@/lib/inspection-access";

export const dynamic = "force-dynamic";

type DetalleInspeccionPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function DetalleInspeccionPage({ params }: DetalleInspeccionPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessModule(user, "historial")) redirect("/sin-acceso");

  const { id } = await params;
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

  const puedeResolverLuego = hasRole(user, "Operador") && user.permisos.operadorPuedeResolver;

  return (
    <main className="module-shell">
      <section className="module-header">
        <p className="eyebrow">Detalle de inspeccion</p>
        <h1>{inspeccion.id}</h1>
        <p className="lead">
          {inspeccion.ppu} · {inspeccion.operadorNombre} · {inspeccion.tipoInspeccion}
        </p>
      </section>

      <div className="detail-actions">
        <Link className="text-link" href="/historial">
          Volver al historial
        </Link>
        {puedeResolverLuego ? (
          <button className="disabled-action" type="button" disabled>
            La resolucion se implementara en un paso posterior
          </button>
        ) : null}
      </div>

      <section className="detail-grid">
        <article className="detail-panel">
          <h2>Datos del bus</h2>
          <dl>
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
              <dt>Carroceria</dt>
              <dd>{joinParts(inspeccion.bus.carroceriaMarca, inspeccion.bus.carroceriaModelo)}</dd>
            </div>
            <div>
              <dt>Tecnologia</dt>
              <dd>{inspeccion.bus.tecnologia}</dd>
            </div>
            <div>
              <dt>Tipo bus</dt>
              <dd>{inspeccion.bus.tipoBus}</dd>
            </div>
            <div>
              <dt>Anio</dt>
              <dd>{inspeccion.bus.anio}</dd>
            </div>
            <div>
              <dt>Estado bus</dt>
              <dd>{inspeccion.bus.estadoBus}</dd>
            </div>
          </dl>
        </article>

        <article className="detail-panel">
          <h2>Datos de inspeccion</h2>
          <dl>
            <div>
              <dt>Fecha/hora</dt>
              <dd>{formatDateTime(inspeccion.fechaHora)}</dd>
            </div>
            <div>
              <dt>Inspector</dt>
              <dd>{inspeccion.inspector.nombreCompleto}</dd>
            </div>
            <div>
              <dt>Correo inspector</dt>
              <dd>{inspeccion.inspector.correo}</dd>
            </div>
            <div>
              <dt>Tipo</dt>
              <dd>{inspeccion.tipoInspeccion}</dd>
            </div>
            <div>
              <dt>Criticidad</dt>
              <dd>
                <span className={`severity ${inspeccion.criticidadMasGrave.toLowerCase()}`}>
                  {inspeccion.criticidadMasGrave}
                </span>
              </dd>
            </div>
            <div>
              <dt>Defectos</dt>
              <dd>{inspeccion.cantidadDefectos}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{inspeccion.estado}</dd>
            </div>
            <div>
              <dt>Ubicacion</dt>
              <dd>{inspeccion.ubicacionSimulada}</dd>
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

      <section className="detail-panel full-panel">
        <div className="section-heading">
          <h2>Defectos detectados</h2>
          <p>{inspeccion.defectos.length} registro(s)</p>
        </div>
        {inspeccion.defectos.length === 0 ? (
          <div className="empty-state">Esta inspeccion no tiene defectos detectados.</div>
        ) : (
          <div className="defect-list">
            {inspeccion.defectos.map((defecto) => (
              <article className="defect-item" key={defecto.id}>
                <header>
                  <div>
                    <h3>{defecto.item}</h3>
                    <p>
                      {defecto.elemento} · {defecto.atributo}
                    </p>
                  </div>
                  <span className={`severity ${defecto.criticidad.toLowerCase()}`}>
                    {defecto.criticidad}
                  </span>
                </header>
                <p>{defecto.criterioEspecifico}</p>
                <dl>
                  <div>
                    <dt>Observacion inspector</dt>
                    <dd>{defecto.observacionInspector ?? "Sin observacion."}</dd>
                  </div>
                  <div>
                    <dt>Estado defecto</dt>
                    <dd>{defecto.estadoDefecto}</dd>
                  </div>
                  <div>
                    <dt>Observacion operador</dt>
                    <dd>{defecto.observacionOperador ?? "Sin observacion."}</dd>
                  </div>
                </dl>
                <div className="evidence-links">
                  {defecto.urlFotoInspector ? (
                    <a href={defecto.urlFotoInspector} target="_blank" rel="noreferrer">
                      Foto evidencia
                    </a>
                  ) : null}
                  {defecto.urlVideoInspector ? (
                    <a href={defecto.urlVideoInspector} target="_blank" rel="noreferrer">
                      Video evidencia
                    </a>
                  ) : null}
                  {!defecto.urlFotoInspector && !defecto.urlVideoInspector ? (
                    <span>Sin evidencia adjunta.</span>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {inspeccion.resultadosPauta.length > 0 ? (
        <section className="detail-panel full-panel">
          <div className="section-heading">
            <h2>Items de pauta no cumplidos</h2>
            <p>{inspeccion.resultadosPauta.length} item(s)</p>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item pauta</th>
                  <th>Elemento</th>
                  <th>Atributo</th>
                  <th>Criticidad</th>
                  <th>Observacion</th>
                  <th>Evidencia</th>
                </tr>
              </thead>
              <tbody>
                {inspeccion.resultadosPauta.map((resultado) => (
                  <tr key={resultado.id}>
                    <td>{resultado.itemPautaId}</td>
                    <td>{resultado.item}</td>
                    <td>{resultado.atributo}</td>
                    <td>{resultado.criticidad}</td>
                    <td>{resultado.observacion ?? "Sin observacion."}</td>
                    <td>
                      {resultado.urlEvidencia ? (
                        <a className="text-link" href={resultado.urlEvidencia} target="_blank" rel="noreferrer">
                          Ver evidencia
                        </a>
                      ) : (
                        "Sin evidencia"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
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
