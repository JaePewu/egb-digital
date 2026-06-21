import { redirect } from "next/navigation";
import { getPrimaryRole } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getInspectionScopeText, getInspectionWhere } from "@/lib/inspection-access";

export const dynamic = "force-dynamic";

export default async function InicioPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const inspectionWhere = getInspectionWhere(user);
  const [
    usuarios,
    usuariosActivos,
    operadores,
    buses,
    pauta,
    pautaPorBus,
    inspecciones,
    defectos,
    defectosPendientes,
    resultadosPauta,
    notificaciones,
    recientes,
  ] = await Promise.all([
    prisma.usuario.count(),
    prisma.usuario.count({ where: { estado: "Activo" } }),
    prisma.operador.count(),
    prisma.bus.count(),
    prisma.pautaInspeccion.count(),
    prisma.pautaPorBus.count(),
    prisma.inspeccion.count({ where: inspectionWhere }),
    prisma.defectoDetectado.count({
      where: {
        inspeccion: inspectionWhere,
      },
    }),
    prisma.defectoDetectado.count({
      where: {
        defectoReparado: false,
        inspeccion: inspectionWhere,
      },
    }),
    prisma.resultadoPauta.count({
      where: {
        inspeccion: inspectionWhere,
      },
    }),
    prisma.notificacion.count(),
    prisma.inspeccion.findMany({
      where: inspectionWhere,
      orderBy: { fechaHora: "desc" },
      take: 4,
      include: {
        bus: {
          select: {
            operadorNombre: true,
          },
        },
      },
    }),
  ]);

  const cards = [
    { label: "Usuarios", value: usuarios, detail: `${usuariosActivos} activos` },
    { label: "Operadores", value: operadores, detail: "maestros cargados" },
    { label: "Buses", value: buses, detail: "flota semilla" },
    { label: "Items pauta", value: pauta, detail: `${pautaPorBus} aplicabilidades` },
    { label: "Inspecciones", value: inspecciones, detail: "segun alcance del usuario" },
    { label: "Defectos", value: defectos, detail: `${defectosPendientes} pendientes` },
    { label: "Resultados pauta", value: resultadosPauta, detail: "cumple/no cumple" },
    { label: "Notificaciones", value: notificaciones, detail: "internas y correo simulado" },
  ];

  return (
    <main className="module-shell">
      <section className="status-band">
        <div>
          <p className="eyebrow">Inicio {getPrimaryRole(user)}</p>
          <h1>EGB Digital</h1>
          <p className="lead">
            Sesion local activa. La app lee permisos desde SQLite y ajusta navegacion por rol.
          </p>
        </div>
        <div className="db-pill">SQLite: prisma/dev.db</div>
      </section>

      <section className="metrics-grid" aria-label="Resumen de datos semilla">
        {cards.map((card) => (
          <article className="metric-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.detail}</small>
          </article>
        ))}
      </section>

      <section className="recent-section">
        <div className="section-heading">
          <h2>Ultimas inspecciones visibles</h2>
          <p>{getInspectionScopeText(user)}</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>PPU</th>
                <th>Operador</th>
                <th>Tipo</th>
                <th>Criticidad</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {recientes.map((inspeccion) => (
                <tr key={inspeccion.id}>
                  <td>{inspeccion.id}</td>
                  <td>{inspeccion.ppu}</td>
                  <td>{inspeccion.bus.operadorNombre}</td>
                  <td>{inspeccion.tipoInspeccion}</td>
                  <td>
                    <span className={`severity ${inspeccion.criticidadMasGrave.toLowerCase()}`}>
                      {inspeccion.criticidadMasGrave}
                    </span>
                  </td>
                  <td>{inspeccion.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
