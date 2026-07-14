import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Pencil, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { canAccessModule } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SearchFeedback } from "../_components/search-feedback";
import { SeverityBadge } from "../_components/severity-badge";
import { saveApplicabilityMaster, saveBusMaster, saveOperatorMaster, savePautaMaster } from "./actions";

export const dynamic = "force-dynamic";

type DatosMaestrosPageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };
type MasterTab = "buses" | "operadores" | "inspectores" | "pauta" | "pauta-aplicable";
const tabs: Array<{ key: MasterTab; label: string }> = [
  { key: "buses", label: "Buses" },
  { key: "operadores", label: "Operadores" },
  { key: "inspectores", label: "Inspectores" },
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

  const [operadores, tecnologias, tiposBus, elementos, allBuses, allPauta] = await Promise.all([
    prisma.operador.findMany({
      orderBy: { nombre: "asc" },
      include: { buses: { select: { certificador: true, correoOperadorSimulado: true, correoCertificadorSimulado: true }, take: 5 } },
    }),
    getTecnologias(), getTiposBus(), getElementos(),
    prisma.bus.findMany({ select: { ppu: true }, orderBy: { ppu: "asc" } }),
    prisma.pautaInspeccion.findMany({ select: { id: true, item: true }, orderBy: { id: "asc" }, take: 300 }),
  ]);

  const buses = tab === "buses" ? await getBuses(filters) : [];
  const pauta = tab === "pauta" ? await getPauta(filters) : [];
  const pautaAplicable = tab === "pauta-aplicable" ? await getPautaAplicable(filters) : [];
  const inspectores = tab === "inspectores" ? await prisma.usuario.findMany({ where: { rolInspector: true }, orderBy: { nombreCompleto: "asc" } }) : [];

  const editBus = filters.editarBus ? await prisma.bus.findUnique({ where: { ppu: filters.editarBus.toUpperCase() } }) : null;
  const editOperator = filters.editarOperador ? await prisma.operador.findUnique({ where: { id: filters.editarOperador } }) : null;
  const editPauta = filters.editarPauta ? await prisma.pautaInspeccion.findUnique({ where: { id: filters.editarPauta } }) : null;
  const [editAppPpu, editAppItem] = filters.editarAplicabilidad.split("|");
  const editApplicability = editAppPpu && editAppItem
    ? await prisma.pautaPorBus.findUnique({ where: { ppu_itemPautaId: { ppu: editAppPpu, itemPautaId: editAppItem } } })
    : null;

  const count = tab === "buses" ? buses.length : tab === "operadores" ? operadores.length : tab === "inspectores" ? inspectores.length : tab === "pauta" ? pauta.length : pautaAplicable.length;

  return (
    <main className="module-shell master-page">
      <section className="module-header">
        <h1>Datos Maestros</h1>
        <p className="lead">Mantiene buses, operadores, inspectores, pauta y aplicabilidad sin modificar inspecciones ni defectos registrados.</p>
      </section>

      <nav className="master-tabs" aria-label="Secciones de datos maestros">
        {tabs.map((item) => <Link className={tab === item.key ? "active" : ""} href={`/datos-maestros?tab=${item.key}`} key={item.key}>{item.label}</Link>)}
      </nav>

      {filters.error ? <SearchFeedback message={filters.error} status="error" /> : null}
      {filters.guardado === "1" ? <SearchFeedback message="Dato maestro guardado y registrado en auditoría." status="success" /> : null}
      {hasMasterSearch(filters) ? <SearchFeedback message={count ? `${count} registro(s) encontrado(s).` : "No se encontraron registros para la búsqueda."} status={count ? "success" : "empty"} /> : null}

      {tab === "buses" ? (
        <section className="master-panel">
          <MasterEditor title={editBus ? `Editar bus ${editBus.ppu}` : "Nuevo bus"} resetHref="/datos-maestros?tab=buses">
            <form action={saveBusMaster} className="master-editor-form master-editor-grid">
              {editBus ? <input type="hidden" name="originalPpu" value={editBus.ppu} /> : null}
              <Field label="PPU *"><input name="ppu" required readOnly={Boolean(editBus)} defaultValue={editBus?.ppu ?? ""} maxLength={10} /></Field>
              <Field label="Operador *"><select name="operadorId" required defaultValue={editBus?.operadorId ?? ""}><option value="">Seleccione</option>{operadores.map((op) => <option key={op.id} value={op.id}>{op.nombre}</option>)}</select></Field>
              <Field label="Tecnología"><input name="tecnologia" defaultValue={editBus?.tecnologia ?? ""} /></Field>
              <Field label="Tipo de bus"><input name="tipoBus" defaultValue={editBus?.tipoBus ?? ""} /></Field>
              <Field label="Año"><input name="anio" type="number" min="1990" max="2100" defaultValue={editBus?.anio ?? ""} /></Field>
              <Field label="Estado *"><select name="estadoBus" required defaultValue={editBus?.estadoBus ?? "Operativo"}><option value="Operativo">Operativo</option><option value="Fuera de servicio">Fuera de servicio</option><option value="Inactivo">Inactivo</option></select></Field>
              <Field label="Marca chasis"><input name="chasisMarca" defaultValue={editBus?.chasisMarca ?? ""} /></Field>
              <Field label="Modelo chasis"><input name="chasisModelo" defaultValue={editBus?.chasisModelo ?? ""} /></Field>
              <Field label="Marca carrocería"><input name="carroceriaMarca" defaultValue={editBus?.carroceriaMarca ?? ""} /></Field>
              <Field label="Modelo carrocería"><input name="carroceriaModelo" defaultValue={editBus?.carroceriaModelo ?? ""} /></Field>
              <Field label="Certificador"><input name="certificador" defaultValue={editBus?.certificador ?? ""} /></Field>
              <Field label="Correo operador"><input name="correoOperadorSimulado" type="email" defaultValue={editBus?.correoOperadorSimulado ?? ""} /></Field>
              <Field label="Correo certificador"><input name="correoCertificadorSimulado" type="email" defaultValue={editBus?.correoCertificadorSimulado ?? ""} /></Field>
              <Field label="Correo autoridad"><input name="correoAutoridadSimulado" type="email" defaultValue={editBus?.correoAutoridadSimulado ?? ""} /></Field>
              <EditorActions saveLabel={editBus ? "Guardar bus" : "Crear bus"} />
            </form>
          </MasterEditor>

          <MasterFilters filters={filters}>
            <Field label="PPU"><input name="ppu" defaultValue={filters.ppu} placeholder="Buscar PPU" /></Field>
            <Field label="Operador"><select name="operador" defaultValue={filters.operador}><option value="">Todos</option>{operadores.map((op) => <option key={op.id} value={op.id}>{op.nombre}</option>)}</select></Field>
            <Field label="Tecnología"><select name="tecnologia" defaultValue={filters.tecnologia}><option value="">Todas</option>{tecnologias.map((v) => <option key={v} value={v}>{v}</option>)}</select></Field>
            <Field label="Tipo bus"><select name="tipoBus" defaultValue={filters.tipoBus}><option value="">Todos</option>{tiposBus.map((v) => <option key={v} value={v}>{v}</option>)}</select></Field>
          </MasterFilters>
          <TableWrap><table className="master-table buses-master-table"><thead><tr><th>PPU</th><th>Operador</th><th>Tecnología</th><th>Tipo bus</th><th>Año</th><th>Chasis</th><th>Carrocería</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
            {buses.map((bus) => <tr key={bus.ppu}><td>{bus.ppu}</td><td>{bus.operadorNombre}</td><td>{bus.tecnologia ?? "Sin dato"}</td><td>{bus.tipoBus ?? "Sin dato"}</td><td>{bus.anio ?? "Sin dato"}</td><td>{joinParts(bus.chasisMarca,bus.chasisModelo)}</td><td>{joinParts(bus.carroceriaMarca,bus.carroceriaModelo)}</td><td><StatusBadge estado={bus.estadoBus} /></td><td><Link className="text-link" href={buildHref(filters,{editarBus:bus.ppu})}><Pencil size={15}/>Editar</Link></td></tr>)}
          </tbody></table></TableWrap>
        </section>
      ) : null}

      {tab === "operadores" ? (
        <section className="master-panel">
          <MasterEditor title={editOperator ? `Editar ${editOperator.nombre}` : "Nuevo operador"} resetHref="/datos-maestros?tab=operadores">
            <form action={saveOperatorMaster} className="master-editor-form master-editor-grid compact">
              {editOperator ? <input type="hidden" name="operadorId" value={editOperator.id} /> : null}
              <Field label="Nombre operador *"><input name="nombre" required defaultValue={editOperator?.nombre ?? ""} /></Field>
              <Field label="RUT"><input name="rut" defaultValue={editOperator?.rut ?? ""} /></Field>
              <Field label="Estado *"><select name="estado" required defaultValue={editOperator?.estado ?? "Activo"}><option value="Activo">Activo</option><option value="Inactivo">Inactivo</option></select></Field>
              <EditorActions saveLabel={editOperator ? "Guardar operador" : "Crear operador"} />
            </form>
          </MasterEditor>
          <TableWrap><table className="master-table"><thead><tr><th>Nombre operador</th><th>RUT</th><th>Certificador asociado</th><th>Correo operador</th><th>Correo certificador</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
            {operadores.map((op) => { const ref=op.buses[0]; return <tr key={op.id}><td>{op.nombre}</td><td>{op.rut ?? "Sin dato"}</td><td>{ref?.certificador ?? "Sin dato"}</td><td>{ref?.correoOperadorSimulado ?? "Sin dato"}</td><td>{ref?.correoCertificadorSimulado ?? "Sin dato"}</td><td><StatusBadge estado={op.estado}/></td><td><Link className="text-link" href={`/datos-maestros?tab=operadores&editarOperador=${encodeURIComponent(op.id)}`}><Pencil size={15}/>Editar</Link></td></tr>; })}
          </tbody></table></TableWrap>
        </section>
      ) : null}

      {tab === "inspectores" ? (
        <section className="master-panel">
          <div className="master-maintenance-note"><div><strong>Mantención de inspectores</strong><span>Los Inspectores se mantienen como usuarios para conservar un único control de acceso y evitar duplicidad.</span></div><Link className="primary-action" href="/administracion?perfil=Inspector">Gestionar inspectores</Link></div>
          <TableWrap><table className="master-table"><thead><tr><th>Nombre</th><th>Correo</th><th>Estado</th><th>Defectos puntuales</th><th>Revisión de pauta</th><th>Acción</th></tr></thead><tbody>
            {inspectores.map((inspector) => <tr key={inspector.id}><td>{inspector.nombreCompleto}</td><td>{inspector.correo}</td><td><StatusBadge estado={inspector.estado}/></td><td>{inspector.inspectorDefectoPuntual ? "Habilitado" : "No habilitado"}</td><td>{inspector.inspectorRevisionPauta ? "Habilitado" : "No habilitado"}</td><td><Link className="text-link" href={`/administracion?usuario=${encodeURIComponent(inspector.id)}`}><Pencil size={15}/>Editar usuario</Link></td></tr>)}
          </tbody></table></TableWrap>
        </section>
      ) : null}

      {tab === "pauta" ? (
        <section className="master-panel">
          <MasterEditor title={editPauta ? `Editar ítem ${editPauta.id}` : "Nuevo ítem de pauta"} resetHref="/datos-maestros?tab=pauta">
            <form action={savePautaMaster} className="master-editor-form master-editor-grid">
              {editPauta ? <input type="hidden" name="originalId" value={editPauta.id} /> : null}
              <Field label="ID ítem *"><input name="id" required readOnly={Boolean(editPauta)} defaultValue={editPauta?.id ?? ""} /></Field>
              <Field label="Elemento *"><input name="elemento" required defaultValue={editPauta?.elemento ?? ""} /></Field>
              <Field label="Ítem *"><input name="item" required defaultValue={editPauta?.item ?? ""} /></Field>
              <Field label="Atributo *"><input name="atributo" required defaultValue={editPauta?.atributo ?? ""} /></Field>
              <Field label="Criterio específico *"><textarea name="criterioEspecifico" required defaultValue={editPauta?.criterioEspecifico ?? ""} /></Field>
              <Field label="Criticidad *"><select name="criticidad" required defaultValue={editPauta?.criticidad ?? "Baja"}><option value="Baja">Baja</option><option value="Media">Media</option><option value="Alta">Alta</option></select></Field>
              <Field label="Cobertura / interacción"><input name="coberturaInteraccion" defaultValue={editPauta?.coberturaInteraccion ?? ""} /></Field>
              <EditorActions saveLabel={editPauta ? "Guardar ítem" : "Crear ítem"} />
            </form>
          </MasterEditor>
          <MasterFilters filters={filters}>
            <Field label="ID o texto"><input name="q" defaultValue={filters.q} placeholder="Buscar ID, elemento o ítem" /></Field>
            <Field label="Elemento"><select name="elemento" defaultValue={filters.elemento}><option value="">Todos</option>{elementos.map((v)=><option key={v} value={v}>{v}</option>)}</select></Field>
            <Field label="Criticidad"><select name="criticidad" defaultValue={filters.criticidad}><option value="">Todas</option><option value="Baja">Baja</option><option value="Media">Media</option><option value="Alta">Alta</option></select></Field>
          </MasterFilters>
          <TableWrap><table className="master-table pauta-table"><thead><tr><th>ID</th><th>Elemento</th><th>Ítem</th><th>Atributo</th><th>Criterio específico</th><th>Criticidad</th><th>Acción</th></tr></thead><tbody>
            {pauta.map((item)=><tr key={item.id}><td>{item.id}</td><td>{item.elemento}</td><td>{item.item}</td><td>{item.atributo}</td><td>{item.criterioEspecifico}</td><td><SeverityBadge value={item.criticidad}/></td><td><Link className="text-link" href={buildHref(filters,{editarPauta:item.id})}><Pencil size={15}/>Editar</Link></td></tr>)}
          </tbody></table></TableWrap>
        </section>
      ) : null}

      {tab === "pauta-aplicable" ? (
        <section className="master-panel">
          <MasterEditor title="Definir pauta aplicable" resetHref="/datos-maestros?tab=pauta-aplicable">
            <form action={saveApplicabilityMaster} className="master-editor-form master-editor-grid compact">
              <Field label="PPU *"><select name="ppu" required defaultValue={editApplicability?.ppu ?? ""}><option value="">Seleccione</option>{allBuses.map((bus)=><option key={bus.ppu} value={bus.ppu}>{bus.ppu}</option>)}</select></Field>
              <Field label="Ítem de pauta *"><select name="itemPautaId" required defaultValue={editApplicability?.itemPautaId ?? ""}><option value="">Seleccione</option>{allPauta.map((item)=><option key={item.id} value={item.id}>{item.id} · {item.item}</option>)}</select></Field>
              <Field label="Aplicabilidad *"><select name="aplica" required defaultValue={editApplicability?.aplica === false ? "false" : "true"}><option value="true">Sí aplica</option><option value="false">No aplica</option></select></Field>
              <EditorActions saveLabel="Guardar aplicabilidad" />
            </form>
          </MasterEditor>
          <MasterFilters filters={filters}>
            <Field label="PPU"><input name="ppu" defaultValue={filters.ppu} placeholder="Buscar PPU" /></Field>
            <Field label="Aplica"><select name="aplica" defaultValue={filters.aplica}><option value="">Todos</option><option value="true">Sí</option><option value="false">No</option></select></Field>
          </MasterFilters>
          <TableWrap><table className="master-table pauta-table"><thead><tr><th>PPU</th><th>ID ítem</th><th>Elemento</th><th>Ítem</th><th>Aplica</th><th>Acción</th></tr></thead><tbody>
            {pautaAplicable.map((item)=><tr key={`${item.ppu}-${item.itemPautaId}`}><td>{item.ppu}</td><td>{item.itemPautaId}</td><td>{item.pauta.elemento}</td><td>{item.pauta.item}</td><td>{item.aplica ? "Sí" : "No"}</td><td><Link className="text-link" href={`/datos-maestros?tab=pauta-aplicable&editarAplicabilidad=${encodeURIComponent(`${item.ppu}|${item.itemPautaId}`)}`}><Pencil size={15}/>Editar</Link></td></tr>)}
          </tbody></table></TableWrap>
        </section>
      ) : null}
    </main>
  );
}

function MasterEditor({ children, title, resetHref }: { children: ReactNode; title: string; resetHref: string }) {
  return <section className="master-editor"><header><div><Plus aria-hidden="true" size={18}/><h2>{title}</h2></div><Link href={resetHref}>Limpiar formulario</Link></header>{children}</section>;
}
function Field({ children, label }: { children: ReactNode; label: string }) { return <label className="master-field"><span>{label}</span>{children}</label>; }
function EditorActions({ saveLabel }: { saveLabel: string }) { return <div className="master-editor-actions"><button className="primary-action" type="submit">{saveLabel}</button></div>; }
function MasterFilters({ children, filters }: { children: ReactNode; filters: ReturnType<typeof normalizeFilters> }) { return <form className="master-filters" method="get"><input name="tab" type="hidden" value={filters.tab}/>{children}<div className="master-filter-actions"><button type="submit">Buscar</button><Link href={`/datos-maestros?tab=${filters.tab}`}>Limpiar</Link></div></form>; }
function TableWrap({ children }: { children: ReactNode }) { return <div className="table-wrap master-table-wrap">{children}</div>; }
function StatusBadge({ estado }: { estado: string }) { const active=["Activo","Vigente","Operativo"].includes(estado); return <span className={`admin-status ${active ? "active":"inactive"}`}>{estado}</span>; }
function normalizeFilters(params?: Record<string,string|string[]|undefined>) { return { tab:normalizeTab(getParam(params,"tab")),q:getParam(params,"q"),ppu:getParam(params,"ppu").toUpperCase(),operador:getParam(params,"operador"),tecnologia:getParam(params,"tecnologia"),tipoBus:getParam(params,"tipoBus"),elemento:getParam(params,"elemento"),criticidad:getParam(params,"criticidad"),aplica:getParam(params,"aplica"),editarBus:getParam(params,"editarBus"),editarOperador:getParam(params,"editarOperador"),editarPauta:getParam(params,"editarPauta"),editarAplicabilidad:getParam(params,"editarAplicabilidad"),guardado:getParam(params,"guardado"),error:getParam(params,"error")}; }
function hasMasterSearch(f:ReturnType<typeof normalizeFilters>) { if(f.tab==="buses")return Boolean(f.ppu||f.operador||f.tecnologia||f.tipoBus); if(f.tab==="pauta")return Boolean(f.q||f.elemento||f.criticidad); if(f.tab==="pauta-aplicable")return Boolean(f.ppu||f.aplica); return false; }
function normalizeTab(value:string):MasterTab { return tabs.some((item)=>item.key===value)?value as MasterTab:"buses"; }
function getParam(params:Record<string,string|string[]|undefined>|undefined,key:string){const value=params?.[key];return Array.isArray(value)?value[0]?.trim()??"":value?.trim()??"";}
async function getBuses(f:ReturnType<typeof normalizeFilters>){const where:Prisma.BusWhereInput={};if(f.ppu)where.ppu={contains:f.ppu,mode:"insensitive"};if(f.operador)where.operadorId=f.operador;if(f.tecnologia)where.tecnologia=f.tecnologia;if(f.tipoBus)where.tipoBus=f.tipoBus;return prisma.bus.findMany({where,orderBy:{ppu:"asc"},take:100});}
async function getPauta(f:ReturnType<typeof normalizeFilters>){const and:Prisma.PautaInspeccionWhereInput[]=[];if(f.q)and.push({OR:[{id:{contains:f.q,mode:"insensitive"}},{elemento:{contains:f.q,mode:"insensitive"}},{item:{contains:f.q,mode:"insensitive"}},{atributo:{contains:f.q,mode:"insensitive"}}]});if(f.elemento)and.push({elemento:f.elemento});if(f.criticidad)and.push({criticidad:f.criticidad});return prisma.pautaInspeccion.findMany({where:and.length?{AND:and}:{},orderBy:{id:"asc"},take:100});}
async function getPautaAplicable(f:ReturnType<typeof normalizeFilters>){const where:Prisma.PautaPorBusWhereInput={};if(f.ppu)where.ppu={contains:f.ppu,mode:"insensitive"};if(f.aplica==="true")where.aplica=true;if(f.aplica==="false")where.aplica=false;return prisma.pautaPorBus.findMany({where,include:{pauta:true},orderBy:[{ppu:"asc"},{itemPautaId:"asc"}],take:100});}
async function getTecnologias(){const rows=await prisma.bus.findMany({select:{tecnologia:true},distinct:["tecnologia"],orderBy:{tecnologia:"asc"}});return rows.map(r=>r.tecnologia).filter((v):v is string=>Boolean(v));}
async function getTiposBus(){const rows=await prisma.bus.findMany({select:{tipoBus:true},distinct:["tipoBus"],orderBy:{tipoBus:"asc"}});return rows.map(r=>r.tipoBus).filter((v):v is string=>Boolean(v));}
async function getElementos(){const rows=await prisma.pautaInspeccion.findMany({select:{elemento:true},distinct:["elemento"],orderBy:{elemento:"asc"}});return rows.map(r=>r.elemento).filter(Boolean);}
function buildHref(f:ReturnType<typeof normalizeFilters>,o:Partial<ReturnType<typeof normalizeFilters>>){const p=new URLSearchParams();for(const [k,v] of Object.entries({...f,...o}))if(v)p.set(k,v);const q=p.toString();return q?`/datos-maestros?${q}`:"/datos-maestros";}
function joinParts(...parts:Array<string|null>){return parts.filter(Boolean).join(" ")||"Sin dato";}
