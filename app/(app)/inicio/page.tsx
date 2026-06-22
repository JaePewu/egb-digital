import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { hasActiveRole, type SessionUser } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getInspectionWhere } from "@/lib/inspection-access";
import { InspectionsTable } from "../_components/inspections-table";

export const dynamic = "force-dynamic";

type QuickAccessItem = {
  href: string;
  title: string;
  description: string;
  icon: "admin" | "data" | "plus" | "checklist";
};

const unresolvedStates = ["Resuelta", "Cerrada", "Cerrado"];

export default async function InicioPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (hasActiveRole(user, "Administrador")) {
    return <AdminHome user={user} />;
  }

  if (hasActiveRole(user, "Inspector")) {
    return <InspectorHome user={user} />;
  }

  return <OperationalHome user={user} />;
}

async function AdminHome({ user }: { user: SessionUser }) {
  const [usuariosActivos, administradores, autoridades, inspectores, operadores] = await Promise.all([
    prisma.usuario.count({ where: { estado: "Activo" } }),
    prisma.usuario.count({ where: { estado: "Activo", rolAdministrador: true } }),
    prisma.usuario.count({ where: { estado: "Activo", rolAutoridad: true } }),
    prisma.usuario.count({ where: { estado: "Activo", rolInspector: true } }),
    prisma.usuario.count({ where: { estado: "Activo", rolOperador: true } }),
  ]);

  return (
    <main className="home-shell">
      <HomeHero user={user} description="Gestiona usuarios, permisos y datos maestros del MVP local." />

      <section className="home-metrics-grid" aria-label="Indicadores administracion">
        <MetricCard label="Usuarios activos" value={usuariosActivos} />
        <MetricCard label="Administradores" value={administradores} />
        <MetricCard label="Autoridades" value={autoridades} />
        <MetricCard label="Inspectores" value={inspectores} />
        <MetricCard label="Operadores" value={operadores} />
      </section>

      <section className="home-section">
        <SectionHeading title="Accesos rápidos" />
        <div className="quick-grid two">
          <QuickAccessCard
            href="/administracion"
            title="Administración"
            description="Usuarios, perfiles y permisos del sistema."
            icon="admin"
          />
          <QuickAccessCard
            href="/datos-maestros"
            title="Datos maestros"
            description="Buses, operadores y pauta de inspección."
            icon="data"
          />
        </div>
      </section>
    </main>
  );
}

async function InspectorHome({ user }: { user: SessionUser }) {
  const recientes = await getRecentInspections(user);
  const quickAccess: QuickAccessItem[] = [];

  if (user.permisos.inspectorDefectoPuntual) {
    quickAccess.push({
      href: "/inspecciones/defecto-puntual",
      title: "Defectos puntuales",
      description: "Registra defectos detectados en buses de la flota.",
      icon: "plus",
    });
  }

  if (user.permisos.inspectorRevisionPauta) {
    quickAccess.push({
      href: "/inspecciones/revision-pauta",
      title: "Revisión de pauta",
      description: "Ejecuta una pauta de inspección según el plan asignado.",
      icon: "checklist",
    });
  }

  return (
    <main className="home-shell">
      <HomeHero user={user} description="Aquí tienes tus accesos habilitados y tus inspecciones recientes." />

      <section className="home-section">
        <SectionHeading title="Accesos rápidos" />
        {quickAccess.length > 0 ? (
          <div className="quick-grid">
            {quickAccess.map((item) => (
              <QuickAccessCard
                description={item.description}
                href={item.href}
                icon={item.icon}
                key={item.href}
                title={item.title}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">No tienes funciones de registro habilitadas para este perfil.</div>
        )}
      </section>

      <RecentInspectionsTable inspections={recientes} />
    </main>
  );
}

async function OperationalHome({ user }: { user: SessionUser }) {
  const scopeWhere = getInspectionWhere(user);
  const pendingDefectWhere = getPendingDefectWhere(scopeWhere);

  const [inspeccionesPendientes, altasPendientes, defectosPendientes, busesConPendientes, recientes] =
    await Promise.all([
      prisma.inspeccion.count({
        where: {
          AND: [scopeWhere, { estado: { notIn: unresolvedStates } }],
        },
      }),
      prisma.defectoDetectado.count({
        where: {
          ...pendingDefectWhere,
          criticidad: "Alta",
        },
      }),
      prisma.defectoDetectado.count({ where: pendingDefectWhere }),
      prisma.defectoDetectado.findMany({
        where: pendingDefectWhere,
        distinct: ["ppu"],
        select: { ppu: true },
      }),
      getRecentInspections(user),
    ]);

  return (
    <main className="home-shell">
      <HomeHero
        user={user}
        description={
          hasActiveRole(user, "Autoridad")
            ? "Resumen general de inspecciones y defectos de la flota."
            : "Resumen de inspecciones y defectos de tus operadores asignados."
        }
      />

      <section className="home-metrics-grid" aria-label="Indicadores operativos">
        <MetricCard label="Inspecciones pendientes" value={inspeccionesPendientes} />
        <MetricCard label="Defectos totales pendientes" value={defectosPendientes} />
        <MetricCard label="Defectos alta pendientes" value={altasPendientes} />
        <MetricCard label="Buses con defectos" value={busesConPendientes.length} />
      </section>

      <RecentInspectionsTable inspections={recientes} />
    </main>
  );
}

function HomeHero({ user, description }: { user: SessionUser; description: string }) {
  return (
    <section className="home-hero">
      <p className="eyebrow">Inicio {user.activeRole}</p>
      <h1>Hola, {user.nombreCompleto}</h1>
      <p>{description}</p>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="metric-card home-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="section-heading compact">
      <h2>{title}</h2>
    </div>
  );
}

function QuickAccessCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: "admin" | "data" | "plus" | "checklist";
}) {
  return (
    <Link className="quick-card" href={href}>
      <span className="quick-icon" aria-hidden="true">
        <QuickIcon type={icon} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <span className="quick-arrow" aria-hidden="true">
        →
      </span>
    </Link>
  );
}

function RecentInspectionsTable({
  inspections,
}: {
  inspections: Awaited<ReturnType<typeof getRecentInspections>>;
}) {
  return (
    <section className="recent-section home-table-section">
      <div className="section-heading">
        <div>
          <h2>Últimas inspecciones</h2>
        </div>
        <Link className="text-link" href="/historial">
          Ver todo
        </Link>
      </div>
      <InspectionsTable emptyMessage="No hay inspecciones visibles para este perfil." inspections={inspections} />
    </section>
  );
}

function QuickIcon({ type }: { type: "admin" | "data" | "plus" | "checklist" }) {
  switch (type) {
    case "admin":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M16 21v-2a4 4 0 0 0-8 0v2" />
          <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
          <path d="M19 8v4" />
          <path d="M21 10h-4" />
        </svg>
      );
    case "data":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M4 6c0-1.1 3.6-2 8-2s8 .9 8 2-3.6 2-8 2-8-.9-8-2Z" />
          <path d="M4 6v6c0 1.1 3.6 2 8 2s8-.9 8-2V6" />
          <path d="M4 12v6c0 1.1 3.6 2 8 2s8-.9 8-2v-6" />
        </svg>
      );
    case "plus":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
    case "checklist":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M8 4h8l1 2h3v15H4V6h3l1-2Z" />
          <path d="m8 13 2 2 5-5" />
          <path d="M8 18h8" />
        </svg>
      );
  }
}

async function getRecentInspections(user: SessionUser) {
  return prisma.inspeccion.findMany({
    where: getInspectionWhere(user),
    orderBy: { fechaHora: "desc" },
    take: 4,
    include: {
      bus: {
        select: {
          operadorNombre: true,
        },
      },
      inspector: {
        select: {
          nombreCompleto: true,
        },
      },
      defectos: {
        select: {
          defectoReparado: true,
          estadoDefecto: true,
        },
      },
    },
  });
}

function getPendingDefectWhere(scopeWhere: Prisma.InspeccionWhereInput): Prisma.DefectoDetectadoWhereInput {
  return {
    defectoReparado: false,
    estadoDefecto: { not: "Reparado" },
    inspeccion: scopeWhere,
  };
}
