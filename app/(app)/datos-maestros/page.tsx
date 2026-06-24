import Link from "next/link";
import type { Prisma } from "@prisma/client";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { canAccessModule } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SeverityBadge } from "../_components/severity-badge";

export const dynamic = "force-dynamic";

type DatosMaestrosPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type MasterTab = "buses" | "operadores" | "pauta" | "pauta-aplicable";

const tabs: Array<{ key: MasterTab; label: string }> = [
  { key: "buses", label: "Buses" },
  { key: "operadores", label: "Operadores" },
  { key: "pauta", label: "Ítems de pauta" },
  { key: "pauta-aplicable", label: "Pauta aplicable" },
];

export default async function DatosMaestrosPage({ searchParams }: DatosMaestrosPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessModule(user, "datos-maestros")) redirect("/sin-acceso");

  const params = await searchParams;
  const filters = normalizeFilters(params);
  const tab = normalizeTab(filters.tab);

  const operadores = await prisma.operador.findMany({
    orderBy: { nombre: "asc" },
    include: {
      buses: {
        select: {
          certificador: true,
          correoOperadorSimulado: true,
          correoCertificadorSimulado: true,
        },
        take: 5,
      },
    },
  });
  const [tecnologias, tiposBus, elementos] = await Promise.all([
    getTecnologias(),
    getTiposBus(),
    getElementos(),
  ]);
  const buses = tab === "buses" ? await getBuses(filters) : [];
  const pauta = tab === "pauta" ? await getPauta(filters) : [];
  const pautaAplicable = tab === "pauta-aplicable" ? await getPautaAplicable(filters) : [];

  return (
    <main className="module-shell master-page">
      <section className="module-header">
        <h1>Datos Maestros</h1>
        <p className="lead">Consulta y mantiene la información base utilizada por inspecciones, reportes y notificaciones.</p>
      </section>

      <nav className="master-tabs" aria-label="Secciones de datos maestros">
        {tabs.map((item) => (
          <Link className={tab === item.key ? "active" : ""} href={buildHref(filters, { tab: item.key })} key={item.key}>
            {item.label}
          </Link>
        ))}
      </nav>

      {tab === "buses" ? (
        <section className="master-panel">
          <MasterFilters filters={filters}>
            <label>
              PPU
              <input name="ppu" defaultValue={filters.ppu} placeholder="Buscar PPU" />
            </label>
            <label>
              Operador
              <select name="operador" defaultValue={filters.operador}>
                <option value="">Todos</option>
                {operadores.map((operador) => (
                  <option key={operador.id} value={operador.id}>{operador.nombre}</option>
                ))}
              </select>
            </label>
            <label>
              Tecnología
              <select name="tecnologia" defaultValue={filters.tecnologia}>
                <option value="">Todas</option>
                {tecnologias.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Tipo bus
              <select name="tipoBus" defaultValue={filters.tipoBus}>
                <option value="">Todos</option>
                {tiposBus.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </MasterFilters>
          <TableWrap>
            <table className="master-table">
              <thead>
                <tr>
                  <th>PPU</th>
                  <th>Operador</th>
                  <th>Tecnología</th>
                  <th>Tipo bus</th>
                  <th>Año</th>
                  <th>Chasis</th>
                  <th>Carrocería</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {buses.map((bus) => (
                  <tr key={bus.ppu}>
                    <td>{bus.ppu}</td>
                    <td>{bus.operadorNombre}</td>
                    <td>{bus.tecnologia ?? "Sin dato"}</td>
                    <td>{bus.tipoBus ?? "Sin dato"}</td>
                    <td>{bus.anio ?? "Sin dato"}</td>
                    <td>{joinParts(bus.chasisMarca, bus.chasisModelo)}</td>
                    <td>{joinParts(bus.carroceriaMarca, bus.carroceriaModelo)}</td>
                    <td><StatusBadge estado={bus.estadoBus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </section>
      ) : null}

      {tab === "operadores" ? (
        <section className="master-panel">
          <div className="section-heading">
            <h2>Operadores</h2>
            <p>{operadores.length} registro(s)</p>
          </div>
          <TableWrap>
            <table className="master-table">
              <thead>
                <tr>
                  <th>Nombre operador</th>
                  <th>Certificador asociado</th>
                  <th>Correo operador</th>
                  <th>Correo certificador</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {operadores.map((operador) => {
                  const busRef = operador.buses[0];
                  return (
                    <tr key={operador.id}>
                      <td>{operador.nombre}</td>
                      <td>{busRef?.certificador ?? "Sin dato"}</td>
                      <td>{busRef?.correoOperadorSimulado ?? "Sin dato"}</td>
                      <td>{busRef?.correoCertificadorSimulado ?? "Sin dato"}</td>
                      <td><StatusBadge estado={operador.estado} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        </section>
      ) : null}

      {tab === "pauta" ? (
        <section className="master-panel">
          <MasterFilters filters={filters}>
            <label>
              ID o texto
              <input name="q" defaultValue={filters.q} placeholder="Buscar ID, elemento o ítem" />
            </label>
            <label>
              Elemento
              <select name="elemento" defaultValue={filters.elemento}>
                <option value="">Todos</option>
                {elementos.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Criticidad
              <select name="criticidad" defaultValue={filters.criticidad}>
                <option value="">Todas</option>
                <option value="Baja">Baja</option>
                <option value="Media">Media</option>
                <option value="Alta">Alta</option>
              </select>
            </label>
          </MasterFilters>
          <TableWrap>
            <table className="master-table pauta-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Elemento</th>
                  <th>Ítem</th>
                  <th>Atributo</th>
                  <th>Criterio específico</th>
                  <th>Criticidad</th>
                </tr>
              </thead>
              <tbody>
                {pauta.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.elemento}</td>
                    <td>{item.item}</td>
                    <td>{item.atributo}</td>
                    <td>{item.criterioEspecifico}</td>
                    <td><SeverityBadge value={item.criticidad} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </section>
      ) : null}

      {tab === "pauta-aplicable" ? (
        <section className="master-panel">
          <MasterFilters filters={filters}>
            <label>
              PPU
              <input name="ppu" defaultValue={filters.ppu} placeholder="Buscar PPU" />
            </label>
            <label>
              Aplica
              <select name="aplica" defaultValue={filters.aplica}>
                <option value="">Todos</option>
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </label>
          </MasterFilters>
          <TableWrap>
            <table className="master-table pauta-table">
              <thead>
                <tr>
                  <th>PPU</th>
                  <th>ID ítem</th>
                  <th>Elemento</th>
                  <th>Ítem</th>
                  <th>Aplica</th>
                  <th>Motivo/regla</th>
                </tr>
              </thead>
              <tbody>
                {pautaAplicable.map((item) => (
                  <tr key={`${item.ppu}-${item.itemPautaId}`}>
                    <td>{item.ppu}</td>
                    <td>{item.itemPautaId}</td>
                    <td>{item.pauta.elemento}</td>
                    <td>{item.pauta.item}</td>
                    <td>{item.aplica ? "Sí" : "No"}</td>
                    <td>{item.aplica ? "Aplicable según bus semilla." : "No aplicable según bus semilla."}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </section>
      ) : null}
    </main>
  );
}

function MasterFilters({ children, filters }: { children: ReactNode; filters: ReturnType<typeof normalizeFilters> }) {
  return (
    <form className="master-filters" method="get">
      <input name="tab" type="hidden" value={filters.tab} />
      {children}
      <div className="master-filter-actions">
        <button type="submit">Buscar</button>
        <Link href={`/datos-maestros?tab=${filters.tab}`}>Limpiar</Link>
      </div>
    </form>
  );
}

function TableWrap({ children }: { children: ReactNode }) {
  return <div className="table-wrap master-table-wrap">{children}</div>;
}

function StatusBadge({ estado }: { estado: string }) {
  const active = estado === "Activo" || estado === "Vigente" || estado === "Operativo";
  return <span className={`admin-status ${active ? "active" : "inactive"}`}>{estado}</span>;
}

function normalizeFilters(params?: Record<string, string | string[] | undefined>) {
  return {
    tab: normalizeTab(getParam(params, "tab")),
    q: getParam(params, "q"),
    ppu: getParam(params, "ppu").toUpperCase(),
    operador: getParam(params, "operador"),
    tecnologia: getParam(params, "tecnologia"),
    tipoBus: getParam(params, "tipoBus"),
    elemento: getParam(params, "elemento"),
    criticidad: getParam(params, "criticidad"),
    aplica: getParam(params, "aplica"),
  };
}

function normalizeTab(value: string): MasterTab {
  return tabs.some((item) => item.key === value) ? (value as MasterTab) : "buses";
}

function getParam(params: Record<string, string | string[] | undefined> | undefined, key: string) {
  const value = params?.[key];
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

async function getBuses(filters: ReturnType<typeof normalizeFilters>) {
  const where: Prisma.BusWhereInput = {};
  if (filters.ppu) where.ppu = { contains: filters.ppu };
  if (filters.operador) where.operadorId = filters.operador;
  if (filters.tecnologia) where.tecnologia = filters.tecnologia;
  if (filters.tipoBus) where.tipoBus = filters.tipoBus;
  return prisma.bus.findMany({ where, orderBy: { ppu: "asc" }, take: 100 });
}

async function getPauta(filters: ReturnType<typeof normalizeFilters>) {
  const and: Prisma.PautaInspeccionWhereInput[] = [];
  if (filters.q) {
    and.push({
      OR: [
        { id: { contains: filters.q } },
        { elemento: { contains: filters.q } },
        { item: { contains: filters.q } },
        { atributo: { contains: filters.q } },
      ],
    });
  }
  if (filters.elemento) and.push({ elemento: filters.elemento });
  if (filters.criticidad) and.push({ criticidad: filters.criticidad });
  return prisma.pautaInspeccion.findMany({
    where: and.length ? { AND: and } : {},
    orderBy: { id: "asc" },
    take: 100,
  });
}

async function getPautaAplicable(filters: ReturnType<typeof normalizeFilters>) {
  const where: Prisma.PautaPorBusWhereInput = {};
  if (filters.ppu) where.ppu = { contains: filters.ppu };
  if (filters.aplica === "true") where.aplica = true;
  if (filters.aplica === "false") where.aplica = false;
  return prisma.pautaPorBus.findMany({
    where,
    include: { pauta: true },
    orderBy: [{ ppu: "asc" }, { itemPautaId: "asc" }],
    take: 100,
  });
}

async function getTecnologias() {
  const rows = await prisma.bus.findMany({
    select: { tecnologia: true },
    distinct: ["tecnologia"],
    orderBy: { tecnologia: "asc" },
  });
  return rows.map((row) => row.tecnologia).filter((value): value is string => Boolean(value));
}

async function getTiposBus() {
  const rows = await prisma.bus.findMany({
    select: { tipoBus: true },
    distinct: ["tipoBus"],
    orderBy: { tipoBus: "asc" },
  });
  return rows.map((row) => row.tipoBus).filter((value): value is string => Boolean(value));
}

async function getElementos() {
  const rows = await prisma.pautaInspeccion.findMany({
    select: { elemento: true },
    distinct: ["elemento"],
    orderBy: { elemento: "asc" },
  });
  return rows.map((row) => row.elemento).filter(Boolean);
}

function buildHref(filters: ReturnType<typeof normalizeFilters>, overrides: Partial<ReturnType<typeof normalizeFilters>>) {
  const params = new URLSearchParams();
  const next = { ...filters, ...overrides };
  for (const [key, value] of Object.entries(next)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/datos-maestros?${query}` : "/datos-maestros";
}

function joinParts(...parts: Array<string | null>) {
  return parts.filter(Boolean).join(" ") || "Sin dato";
}
