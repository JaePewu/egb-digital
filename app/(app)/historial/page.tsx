import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { canAccessModule } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getInspectionTypeLabel } from "@/lib/display-labels";
import { getInspectionScopeText, getInspectionWhere } from "@/lib/inspection-access";
import { InspectionsTable } from "../_components/inspections-table";
import { SearchFeedback } from "../_components/search-feedback";

export const dynamic = "force-dynamic";

type HistorialPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type FilterOption = {
  value: string;
  label: string;
};

export default async function HistorialPage({ searchParams }: HistorialPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessModule(user, "historial")) redirect("/sin-acceso");

  const params = await searchParams;
  const filters = normalizeFilters(params);
  const scopeWhere = getInspectionWhere(user);
  const where = buildWhere(scopeWhere, filters);

  const [inspecciones, opcionesBase] = await Promise.all([
    prisma.inspeccion.findMany({
      where,
      orderBy: { fechaHora: "desc" },
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
        tipoInspeccion: true,
        criticidadMasGrave: true,
        cantidadDefectos: true,
        estado: true,
        inspectorId: true,
        inspectorNombre: true,
        bus: {
          select: {
            operadorId: true,
          },
        },
      },
    }),
  ]);

  const options = buildFilterOptions(opcionesBase);

  return (
    <main className="module-shell">
      <section className="module-header">
        <h1>Historial de inspecciones</h1>
        <p className="lead">{getInspectionScopeText(user)}</p>
      </section>

      <form className="filters-panel" method="get">
        <label>
          PPU
          <input name="ppu" defaultValue={filters.ppu} placeholder="Ej: LJXR" />
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
          Tipo de inspección
          <select name="tipo" defaultValue={filters.tipo}>
            <option value="">Todos</option>
            {options.tipos.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Criticidad
          <select name="criticidad" defaultValue={filters.criticidad}>
            <option value="">Todas</option>
            {options.criticidades.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Inspector
          <select name="inspector" defaultValue={filters.inspector}>
            <option value="">Todos</option>
            {options.inspectores.map((option) => (
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
            {options.estados.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="filter-actions">
          <button type="submit">Filtrar</button>
          <Link href="/historial">Limpiar</Link>
        </div>
      </form>

      {hasHistorySearch(filters) ? (
        <SearchFeedback
          message={
            inspecciones.length > 0
              ? `${inspecciones.length} inspección(es) encontrada(s).`
              : "No se encontraron inspecciones para la búsqueda."
          }
          status={inspecciones.length > 0 ? "success" : "empty"}
        />
      ) : null}

      <section className="recent-section">
        <div className="section-heading">
          <h2>Resultados</h2>
          <p>{inspecciones.length} inspeccion(es)</p>
        </div>
        <InspectionsTable
          emptyMessage="No se encontraron inspecciones para los filtros seleccionados."
          inspections={inspecciones}
        />
      </section>
    </main>
  );
}

function hasHistorySearch(filters: ReturnType<typeof normalizeFilters>) {
  return Object.values(filters).some(Boolean);
}

function normalizeFilters(params?: Record<string, string | string[] | undefined>) {
  return {
    ppu: getParam(params, "ppu").toUpperCase(),
    operador: getParam(params, "operador"),
    inspector: getParam(params, "inspector"),
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

  if (filters.ppu) and.push({ ppu: { contains: filters.ppu } });
  if (filters.operador) and.push({ bus: { operadorId: filters.operador } });
  if (filters.inspector) and.push({ inspectorId: filters.inspector });
  if (filters.tipo) and.push({ tipoInspeccion: filters.tipo });
  if (filters.criticidad) and.push({ criticidadMasGrave: filters.criticidad, cantidadDefectos: { gt: 0 } });
  if (filters.estado) and.push({ estado: filters.estado });

  return { AND: and };
}

function buildFilterOptions(
  rows: Array<{
    operadorNombre: string;
    tipoInspeccion: string;
    criticidadMasGrave: string;
    cantidadDefectos: number;
    estado: string;
    inspectorId: string;
    inspectorNombre: string | null;
    bus: {
      operadorId: string;
    };
  }>,
) {
  return {
    operadores: uniqueOptions(rows.map((row) => ({ value: row.bus.operadorId, label: row.operadorNombre }))),
    inspectores: uniqueOptions(
      rows.map((row) => ({
        value: row.inspectorId,
        label: row.inspectorNombre ?? row.inspectorId,
      })),
    ),
    tipos: uniqueOptions(rows.map((row) => ({ value: row.tipoInspeccion, label: getInspectionTypeLabel(row.tipoInspeccion) }))),
    criticidades: uniqueOptions(
      rows
        .filter((row) => row.cantidadDefectos > 0)
        .map((row) => ({ value: row.criticidadMasGrave, label: row.criticidadMasGrave })),
    ),
    estados: uniqueOptions(rows.map((row) => ({ value: row.estado, label: row.estado }))),
  };
}

function uniqueOptions(options: FilterOption[]) {
  return Array.from(new Map(options.map((option) => [option.value, option])).values()).sort((a, b) =>
    a.label.localeCompare(b.label, "es"),
  );
}
