import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { BusFront, CircleCheck, ClipboardList, TrendingUp, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { canAccessModule, hasActiveRole } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getInspectionTypeLabel } from "@/lib/display-labels";
import { getInspectionWhere } from "@/lib/inspection-access";

export const dynamic = "force-dynamic";

type ReportesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type FilterOption = {
  value: string;
  label: string;
};

type InspectionRow = Prisma.InspeccionGetPayload<{
  include: {
    bus: {
      select: {
        operadorId: true;
        operadorNombre: true;
      };
    };
    inspector: {
      select: {
        nombreCompleto: true;
      };
    };
    defectos: {
      select: {
        id: true;
        criticidad: true;
        elemento: true;
        item: true;
        defectoReparado: true;
        estadoDefecto: true;
      };
    };
  };
}>;

export default async function ReportesPage({ searchParams }: ReportesPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessModule(user, "reportes")) redirect("/sin-acceso");

  const params = await searchParams;
  const filters = normalizeFilters(params);
  const scopeWhere = getInspectionWhere(user);
  const where = buildWhere(scopeWhere, filters);

  const [inspecciones, opcionesBase] = await Promise.all([
    prisma.inspeccion.findMany({
      where,
      orderBy: { fechaHora: "asc" },
      include: {
        bus: {
          select: {
            operadorId: true,
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
            id: true,
            criticidad: true,
            elemento: true,
            item: true,
            defectoReparado: true,
            estadoDefecto: true,
          },
        },
      },
    }),
    prisma.inspeccion.findMany({
      where: scopeWhere,
      orderBy: { fechaHora: "desc" },
      select: {
        operadorNombre: true,
        bus: {
          select: {
            operadorId: true,
          },
        },
      },
    }),
  ]);

  const options = buildFilterOptions(opcionesBase);
  const report = buildReport(inspecciones);
  const isOperator = hasActiveRole(user, "Operador");

  return (
    <main className="module-shell report-page">
      <section className="module-header defect-header">
        <h1>Reportes</h1>
        <p className="lead">
          {isOperator
            ? "Reporte consolidado de inspecciones y defectos de los operadores asignados."
            : "Reporte consolidado de inspecciones y defectos de todos los operadores."}
        </p>
      </section>

      <form className="report-filters" method="get">
        <label>
          Fecha desde
          <input name="desde" type="date" defaultValue={filters.desde} />
        </label>
        <label>
          Fecha hasta
          <input name="hasta" type="date" defaultValue={filters.hasta} />
        </label>
        <label>
          Operador
          <select name="operador" defaultValue={filters.operador}>
            <option value="">Todos los operadores</option>
            {options.operadores.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo de inspección
          <select name="tipo" defaultValue={filters.tipo}>
            <option value="">Todos</option>
            <option value="Defecto puntual">{getInspectionTypeLabel("Defecto puntual")}</option>
            <option value="Revision de pauta">{getInspectionTypeLabel("Revision de pauta")}</option>
          </select>
        </label>
        <label>
          Criticidad más grave
          <select name="criticidad" defaultValue={filters.criticidad}>
            <option value="">Todas</option>
            <option value="Baja">Baja</option>
            <option value="Media">Media</option>
            <option value="Alta">Alta</option>
          </select>
        </label>
        <label>
          Estado
          <select name="estado" defaultValue={filters.estado}>
            <option value="">Todos</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Resuelta">Resuelta</option>
          </select>
        </label>
        <div className="report-filter-actions">
          <Link href="/reportes">Limpiar filtros</Link>
          <button type="submit">Actualizar reporte</button>
        </div>
      </form>

      {inspecciones.length === 0 ? (
        <div className="empty-state report-empty">No hay datos para los filtros seleccionados.</div>
      ) : null}

      <section className="report-kpis">
        <MetricCard icon="clipboard" label="Inspecciones pendientes" value={formatInteger(report.pendingInspections)} />
        <MetricCard icon="check" label="Inspecciones resueltas" value={formatInteger(report.resolvedInspections)} />
        <MetricCard icon="warning" label="Defectos totales pendientes" value={formatInteger(report.pendingDefects)} />
        <MetricCard
          accent="danger"
          icon="alert"
          label="Defectos criticidad alta"
          value={formatInteger(report.highDefects)}
        />
        <MetricCard icon="trend" label="Tasa de resolución" value={formatPercent(report.resolvedInspections, report.totalInspections)} />
        <MetricCard icon="bus" label="Buses con defectos" value={formatInteger(report.busesWithPendingDefects)} />
      </section>

      <section className="report-grid">
        <ReportPanel title="1. Defectos por criticidad">
          <div className="severity-bars">
            {report.defectsBySeverity.map((item) => (
              <VerticalBar key={item.label} item={item} total={report.totalDefects} />
            ))}
          </div>
          <p className="report-total">Total: {report.totalDefects} defecto(s)</p>
        </ReportPanel>

        <ReportPanel title="2. Estado de inspecciones">
          <DonutDistribution items={report.inspectionStatusDistribution} total={report.totalInspections} />
          <p className="report-total">Total: {report.totalInspections} inspección(es)</p>
        </ReportPanel>

        <ReportPanel title="3. Defectos pendientes vs reparados">
          <RepairComparison items={report.defectRepairDistribution} total={report.totalDefects} />
        </ReportPanel>

        <ReportPanel title="4. Top operadores por defectos Alta">
          <HorizontalRanking items={report.highDefectsByOperator} total={report.highDefects} numbered />
          <p className="report-axis-label">Defectos de criticidad alta</p>
        </ReportPanel>

        <ReportPanel title="5. Ranking de elementos con más defectos" wide>
          <ElementDefectRanking items={report.defectsByElementSeverity} total={report.totalDefects} />
        </ReportPanel>

        <ReportPanel title="6. Tendencia de defectos Alta por fecha" wide>
          {report.highDefectsByDate.length === 0 ? (
            <div className="empty-state">Sin defectos de criticidad Alta para los filtros seleccionados.</div>
          ) : (
            <TrendLineChart items={report.highDefectsByDate} />
          )}
          <p className="report-total">
            Periodo seleccionado: {filters.desde || "inicio"} - {filters.hasta || "actual"}
          </p>
        </ReportPanel>
      </section>

      <footer className="report-footer">
        <span>Los datos presentados corresponden al periodo y filtros seleccionados.</span>
        <span>Última actualización: {formatDateTime(report.lastUpdated)}</span>
      </footer>
    </main>
  );
}

type MetricIconType = "clipboard" | "check" | "warning" | "alert" | "trend" | "bus";

function MetricCard({
  accent,
  icon,
  label,
  value,
}: {
  accent?: "danger";
  icon: MetricIconType;
  label: string;
  value: string;
}) {
  return (
    <article className={`report-kpi-card ${accent === "danger" ? "is-danger" : ""}`}>
      <span className="report-kpi-icon" aria-hidden="true">
        <ReportIcon type={icon} />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function ReportIcon({ type }: { type: MetricIconType }) {
  if (type === "check") {
    return <CircleCheck aria-hidden="true" size={20} strokeWidth={2} />;
  }

  if (type === "warning" || type === "alert") {
    return <TriangleAlert aria-hidden="true" size={20} strokeWidth={2} />;
  }

  if (type === "trend") {
    return <TrendingUp aria-hidden="true" size={20} strokeWidth={2} />;
  }

  if (type === "bus") {
    return <BusFront aria-hidden="true" size={20} strokeWidth={2} />;
  }

  return <ClipboardList aria-hidden="true" size={20} strokeWidth={2} />;
}

function ReportPanel({ children, title, wide = false }: { children: ReactNode; title: string; wide?: boolean }) {
  return (
    <section className={`report-panel ${wide ? "wide" : ""}`}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function VerticalBar({ item, total }: { item: ReportItem; total: number }) {
  return (
    <div className="severity-bar-item">
      <div className="severity-bar-track">
        <span className={item.key} style={{ height: `${item.percent}%` }} />
      </div>
      <strong>{item.value}</strong>
      <small>{formatPercent(item.value, total)}</small>
      <em>{item.label}</em>
    </div>
  );
}

function HorizontalRanking({ items, total, numbered = false }: { items: ReportItem[]; total: number; numbered?: boolean }) {
  if (items.length === 0) return <div className="empty-state">Sin datos para mostrar.</div>;

  return (
    <div className="horizontal-ranking">
      {items.map((item, index) => (
        <div className="horizontal-ranking-row" key={item.label}>
          <span>{numbered ? `${index + 1}. ${item.label}` : item.label}</span>
          <div>
            <i style={{ width: `${item.percent}%` }} />
          </div>
          <strong>
            {item.value} ({formatPercent(item.value, total)})
          </strong>
        </div>
      ))}
    </div>
  );
}

function StackedDistribution({ items, total }: { items: ReportItem[]; total: number }) {
  return (
    <div className="type-distribution">
      <div className="type-stack">
        {items.map((item) => (
          <span className={item.key} key={item.label} style={{ width: `${item.percent}%` }} />
        ))}
      </div>
      <div className="type-legend">
        {items.map((item) => (
          <div key={item.label}>
            <span className={item.key} />
            <strong>{item.label}</strong>
            <em>
              {item.value} ({formatPercent(item.value, total)})
            </em>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutDistribution({ items, total }: { items: ReportItem[]; total: number }) {
  const secondPercent = items[1]?.percent ?? 0;
  const gradient =
    total > 0
      ? `conic-gradient(var(--report-green) 0 ${secondPercent}%, var(--report-red) ${secondPercent}% 100%)`
      : "conic-gradient(#e5e7eb 0 100%)";

  return (
    <div className="donut-distribution">
      <div className="donut-chart" style={{ background: gradient }}>
        <div>
          <strong>{formatInteger(total)}</strong>
          <span>Total</span>
        </div>
      </div>
      <div className="type-legend">
        {items.map((item) => (
          <div key={item.label}>
            <span className={item.key} />
            <strong>{item.label}</strong>
            <em>
              {item.value} ({formatPercent(item.value, total)})
            </em>
          </div>
        ))}
      </div>
    </div>
  );
}

function RepairComparison({ items, total }: { items: ReportItem[]; total: number }) {
  if (items.length === 0) return <div className="empty-state">Sin datos para mostrar.</div>;

  return (
    <div className="repair-comparison">
      {items.map((item) => (
        <div className="repair-comparison-row" key={item.label}>
          <span>{item.label}</span>
          <div>
            <i className={item.key} style={{ width: `${item.percent}%` }} />
          </div>
          <strong>
            {item.value} ({formatPercent(item.value, total)})
          </strong>
        </div>
      ))}
      <p className="report-total">Total: {total} defecto(s)</p>
    </div>
  );
}

function ElementDefectRanking({ items, total }: { items: ElementSeverityItem[]; total: number }) {
  if (items.length === 0) return <div className="empty-state">Sin defectos para mostrar.</div>;

  return (
    <div className="element-ranking">
      <div className="element-ranking-legend">
        <span>Elemento</span>
        <span>Criticidad</span>
        <span>Defectos</span>
        <span>Total</span>
      </div>
      {items.map((item, index) => (
        <div className="element-ranking-row" key={item.label}>
          <div className="element-ranking-label">
            <span>{index + 1}. {item.label}</span>
          </div>
          <span className="element-ranking-severity">
            <i className={item.criticidadKey} />
            {getSeverityDisplayLabel(item.criticidad)}
          </span>
          <div className="element-ranking-bar">
            <i style={{ width: `${item.percent}%` }} />
          </div>
          <strong>
            {item.total} ({formatPercent(item.total, total)})
          </strong>
        </div>
      ))}
    </div>
  );
}

function TrendLineChart({ items }: { items: ReportItem[] }) {
  const width = 640;
  const height = 236;
  const padding = { top: 20, right: 18, bottom: 44, left: 34 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...items.map((item) => item.value), 1);
  const points = items.map((item, index) => {
    const x = padding.left + (items.length === 1 ? chartWidth / 2 : (index / (items.length - 1)) * chartWidth);
    const y = padding.top + chartHeight - (item.value / maxValue) * chartHeight;
    return { ...item, x, y };
  });
  const averagePoints = points.map((point, index) => {
    const from = Math.max(0, index - 2);
    const window = items.slice(from, index + 1);
    const avg = window.reduce((sum, item) => sum + item.value, 0) / window.length;
    return {
      x: point.x,
      y: padding.top + chartHeight - (avg / maxValue) * chartHeight,
    };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const averageLine = averagePoints.map((point) => `${point.x},${point.y}`).join(" ");
  const labelEvery = Math.max(1, Math.ceil(items.length / 6));
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="trend-chart">
      <div className="trend-legend">
        <span><i />Defectos criticidad alta</span>
        <span><i className="average" />Promedio móvil</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Tendencia de defectos de criticidad alta">
        {gridLines.map((ratio) => {
          const y = padding.top + chartHeight - ratio * chartHeight;
          const value = Math.round(ratio * maxValue);
          return (
            <g key={ratio}>
              <line className="trend-grid" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
              <text className="trend-axis" x={padding.left - 10} y={y + 4} textAnchor="end">
                {value}
              </text>
            </g>
          );
        })}
        <polyline className="trend-average-line" points={averageLine} />
        <polyline className="trend-main-line" points={line} />
        {points.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle className="trend-point" cx={point.x} cy={point.y} r="3.5" />
            <text className="trend-value" x={point.x} y={point.y - 8} textAnchor="middle">
              {point.value}
            </text>
            {index % labelEvery === 0 || index === points.length - 1 ? (
              <text className="trend-date" x={point.x} y={height - 10} textAnchor="middle">
                {point.shortLabel}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}

function normalizeFilters(params?: Record<string, string | string[] | undefined>) {
  return {
    desde: getParam(params, "desde"),
    hasta: getParam(params, "hasta"),
    operador: getParam(params, "operador"),
    tipo: getParam(params, "tipo"),
    criticidad: getParam(params, "criticidad"),
    estado: getParam(params, "estado"),
  };
}

function getParam(params: Record<string, string | string[] | undefined> | undefined, key: string) {
  const value = params?.[key];
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

function buildWhere(
  scopeWhere: Prisma.InspeccionWhereInput,
  filters: ReturnType<typeof normalizeFilters>,
): Prisma.InspeccionWhereInput {
  const and: Prisma.InspeccionWhereInput[] = [scopeWhere];

  if (filters.desde) and.push({ fechaHora: { gte: new Date(`${filters.desde}T00:00:00`) } });
  if (filters.hasta) and.push({ fechaHora: { lte: new Date(`${filters.hasta}T23:59:59`) } });
  if (filters.operador) and.push({ bus: { operadorId: filters.operador } });
  if (filters.tipo) and.push({ tipoInspeccion: filters.tipo });
  if (filters.criticidad) and.push({ criticidadMasGrave: filters.criticidad, cantidadDefectos: { gt: 0 } });
  if (filters.estado === "Resuelta") {
    and.push({ OR: [{ estado: "Resuelta" }, { todosDefectosReparados: true }] });
  }
  if (filters.estado === "Pendiente") {
    and.push({ NOT: [{ estado: "Resuelta" }, { todosDefectosReparados: true }] });
  }

  return { AND: and };
}

function buildFilterOptions(
  rows: Array<{
    operadorNombre: string;
    bus: {
      operadorId: string;
    };
  }>,
) {
  return {
    operadores: uniqueOptions(rows.map((row) => ({ value: row.bus.operadorId, label: row.operadorNombre }))),
  };
}

function uniqueOptions(options: FilterOption[]) {
  return Array.from(new Map(options.map((option) => [option.value, option])).values()).sort((a, b) =>
    a.label.localeCompare(b.label, "es"),
  );
}

type ReportItem = {
  key: string;
  label: string;
  value: number;
  percent: number;
  shortLabel?: string;
};

type ElementSeverityItem = {
  label: string;
  total: number;
  criticidad: string;
  criticidadKey: string;
  percent: number;
};

function buildReport(inspections: InspectionRow[]) {
  const defects = inspections.flatMap((inspection) =>
    inspection.defectos.map((defect) => ({
      ...defect,
      fechaHora: inspection.fechaHora,
      operadorNombre: inspection.operadorNombre,
      ppu: inspection.ppu,
    })),
  );
  const resolvedInspections = inspections.filter(isResolvedInspection).length;
  const pendingInspections = inspections.length - resolvedInspections;
  const pendingDefects = defects.filter(isPendingDefect);
  const repairedDefects = defects.length - pendingDefects.length;
  const highDefects = defects.filter((defect) => defect.criticidad === "Alta");
  const lastUpdated =
    inspections.reduce<Date | null>((latest, inspection) => {
      const candidate = inspection.ultimaActualizacion ?? inspection.fechaHora;
      if (!latest || candidate > latest) return candidate;
      return latest;
    }, null) ?? new Date();

  return {
    totalInspections: inspections.length,
    totalDefects: defects.length,
    pendingInspections,
    resolvedInspections,
    pendingDefects: pendingDefects.length,
    highDefects: highDefects.length,
    busesWithPendingDefects: new Set(pendingDefects.map((defect) => defect.ppu)).size,
    defectsBySeverity: buildSeverityItems(defects),
    inspectionStatusDistribution: buildInspectionStatusItems(pendingInspections, resolvedInspections),
    defectRepairDistribution: buildDefectRepairItems(pendingDefects.length, repairedDefects),
    highDefectsByOperator: buildRanking(
      highDefects.map((defect) => defect.operadorNombre),
      highDefects.length,
      8,
    ),
    defectsByElementSeverity: buildElementSeverityItems(defects),
    highDefectsByDate: buildHighDefectsDateItems(highDefects),
    lastUpdated,
  };
}

function buildSeverityItems(defects: Array<{ criticidad: string }>) {
  const total = defects.length;
  const order = [
    { key: "baja", label: "Baja", sourceValue: "Baja" },
    { key: "media", label: "Mediana", sourceValue: "Media" },
    { key: "alta", label: "Alta", sourceValue: "Alta" },
  ];
  return order.map((item) => {
    const value = defects.filter((defect) => defect.criticidad === item.sourceValue).length;
    return { key: item.key, label: item.label, value, percent: toPercent(value, total) };
  });
}

function getSeverityDisplayLabel(value: string) {
  return value === "Media" ? "Mediana" : value;
}

function buildInspectionStatusItems(pending: number, resolved: number) {
  const total = pending + resolved;
  return [
    { key: "pendiente", label: "Pendiente", value: pending, percent: toPercent(pending, total) },
    { key: "resuelta", label: "Resuelta", value: resolved, percent: toPercent(resolved, total) },
  ];
}

function buildDefectRepairItems(pending: number, repaired: number) {
  const total = pending + repaired;
  return [
    { key: "pendiente", label: "Pendientes", value: pending, percent: toPercent(pending, total) },
    { key: "reparado", label: "Reparados", value: repaired, percent: toPercent(repaired, total) },
  ];
}

function buildHighDefectsDateItems(defects: Array<{ fechaHora: Date }>) {
  const counts = countBy(defects.map((defect) => formatDateKey(defect.fechaHora)));
  const max = Math.max(...counts.map((item) => item.value), 1);
  return counts.map((item) => ({
    ...item,
    key: item.label,
    shortLabel: item.label.slice(0, 5),
    percent: Math.max(8, Math.round((item.value / max) * 100)),
  }));
}

function buildElementSeverityItems(defects: Array<{ elemento: string; item: string; criticidad: string }>): ElementSeverityItem[] {
  const groups = new Map<string, { criticidad: string; total: number }>();
  const totalDefects = defects.length;
  for (const defect of defects) {
    const label = defect.elemento || defect.item || "Sin dato";
    const current = groups.get(label) ?? { criticidad: defect.criticidad || "Baja", total: 0 };
    if (severityRank(defect.criticidad) > severityRank(current.criticidad)) current.criticidad = defect.criticidad;
    current.total += 1;
    groups.set(label, current);
  }

  return Array.from(groups.entries())
    .map(([label, value]) => ({
      label,
      total: value.total,
      criticidad: value.criticidad,
      criticidadKey: value.criticidad.toLowerCase(),
      percent: toPercent(value.total, totalDefects),
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es"))
    .slice(0, 5);
}

function severityRank(value: string) {
  if (value === "Alta") return 3;
  if (value === "Media") return 2;
  return 1;
}

function buildRanking(values: string[], total: number, limit = 10): ReportItem[] {
  return countBy(values)
    .slice(0, limit)
    .map((item) => ({ ...item, key: item.label, percent: toPercent(item.value, total) }));
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value || "Sin dato";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "es"));
}

function toPercent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function isResolvedInspection(inspection: InspectionRow) {
  return inspection.todosDefectosReparados || inspection.estado === "Resuelta";
}

function isPendingDefect(defect: { defectoReparado: boolean; estadoDefecto: string }) {
  return !defect.defectoReparado && defect.estadoDefecto !== "Reparado";
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("es-CL").format(value);
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number, total: number) {
  if (!total) return "0%";
  return `${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format((value / total) * 100)}%`;
}

function formatDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}-${get("month")}`;
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
