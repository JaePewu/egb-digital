import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Eye } from "lucide-react";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { canAccessModule } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SearchFeedback } from "../_components/search-feedback";
import { saveUserAdministration } from "./actions";

export const dynamic = "force-dynamic";

type AdministracionPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdministracionPage({ searchParams }: AdministracionPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessModule(user, "administracion")) redirect("/sin-acceso");

  const params = await searchParams;
  const filters = normalizeFilters(params);
  const where = buildWhere(filters);

  const [usuarios, operadores] = await Promise.all([
    prisma.usuario.findMany({
      where,
      orderBy: { nombreCompleto: "asc" },
      include: {
        operadores: {
          include: {
            operador: true,
          },
        },
      },
    }),
    prisma.operador.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  const selectedUser = usuarios.find((item) => item.id === filters.usuario) ?? usuarios[0] ?? null;
  const selectedOperatorIds = new Set(selectedUser?.operadores.map((item) => item.operadorId) ?? []);

  return (
    <main className="module-shell admin-page">
      <section className="module-header">
        <h1>Administración</h1>
        <p className="lead">Administra usuarios, perfiles, permisos y asignaciones operativas de la plataforma.</p>
      </section>

      <div className="admin-toolbar">
        <form className="admin-filters" method="get">
          <label>
            Buscar
            <input name="q" defaultValue={filters.q} placeholder="Buscar por nombre o correo" />
          </label>
          <label>
            Estado
            <select name="estado" defaultValue={filters.estado}>
              <option value="">Todos</option>
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
            </select>
          </label>
          <label>
            Perfil
            <select name="perfil" defaultValue={filters.perfil}>
              <option value="">Todos</option>
              <option value="Administrador">Administrador</option>
              <option value="Inspector">Inspector</option>
              <option value="Autoridad">Autoridad</option>
              <option value="Operador">Operador</option>
            </select>
          </label>
          <button type="submit">Buscar</button>
          <Link href="/administracion">Limpiar</Link>
        </form>

        <div className="admin-actions">
          <button type="button" disabled title="Simulado para MVP">
            Nuevo usuario
          </button>
          <button type="button" disabled title="Simulado para MVP">
            Descargar listado
          </button>
          <button type="button" disabled title="Simulado para MVP">
            Cargar masivamente
          </button>
        </div>
      </div>

      {hasAdminSearch(filters) ? (
        <SearchFeedback
          message={
            usuarios.length > 0
              ? `${usuarios.length} usuario(s) encontrado(s).`
              : "No se encontraron usuarios para la búsqueda."
          }
          status={usuarios.length > 0 ? "success" : "empty"}
        />
      ) : null}

      {filters.guardado === "1" ? <p className="admin-success">Cambios guardados correctamente.</p> : null}

      <div className="admin-grid">
        <section className="admin-panel">
          <div className="section-heading">
            <h2>Listado de usuarios</h2>
            <p>{usuarios.length} usuario(s)</p>
          </div>
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Correo</th>
                  <th>Estado</th>
                  <th>Administrador</th>
                  <th>Inspector</th>
                  <th>Autoridad</th>
                  <th>Operador</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.length === 0 ? (
                  <tr>
                    <td colSpan={8}>No se encontraron usuarios para los filtros seleccionados.</td>
                  </tr>
                ) : (
                  usuarios.map((item) => (
                    <tr className={selectedUser?.id === item.id ? "is-selected" : ""} key={item.id}>
                      <td>
                        <span className="user-cell">
                          <span>{getInitials(item.nombreCompleto)}</span>
                          {item.nombreCompleto}
                        </span>
                      </td>
                      <td>{item.correo}</td>
                      <td>
                        <StatusBadge estado={item.estado} />
                      </td>
                      <td><RoleMark active={item.rolAdministrador} /></td>
                      <td><RoleMark active={item.rolInspector} /></td>
                      <td><RoleMark active={item.rolAutoridad} /></td>
                      <td><RoleMark active={item.rolOperador} /></td>
                      <td>
                        <Link className="text-link" href={buildHref(filters, { usuario: item.id })}>
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
        </section>

        <aside className="admin-panel permissions-panel">
          <div className="section-heading">
            <h2>Detalle de permisos</h2>
          </div>
          {selectedUser ? (
            <form action={saveUserAdministration} className="permissions-form">
              <input name="usuarioId" type="hidden" value={selectedUser.id} />
              <input name="returnTo" type="hidden" value={buildHref(filters, { usuario: selectedUser.id, guardado: "1" })} />

              <div className="permissions-user">
                <span>{getInitials(selectedUser.nombreCompleto)}</span>
                <div>
                  <strong>{selectedUser.nombreCompleto}</strong>
                  <small>{selectedUser.correo}</small>
                </div>
                <label>
                  Estado
                  <select name="estado" defaultValue={selectedUser.estado}>
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </label>
              </div>

              <PermissionCard
                help="Permite administrar usuarios, permisos y datos maestros."
                name="rolAdministrador"
                title="Perfil Administrador"
                defaultChecked={selectedUser.rolAdministrador}
              />

              <PermissionCard
                help="Permite registrar defectos puntuales y ejecutar revisiones de pauta."
                name="rolInspector"
                title="Perfil Inspector"
                defaultChecked={selectedUser.rolInspector}
              >
                <label><input type="checkbox" name="inspectorDefectoPuntual" defaultChecked={selectedUser.inspectorDefectoPuntual} /> Defectos puntuales</label>
                <label><input type="checkbox" name="inspectorRevisionPauta" defaultChecked={selectedUser.inspectorRevisionPauta} /> Revisión de pauta</label>
              </PermissionCard>

              <PermissionCard
                help="Permite consultar información global, historial, notificaciones y reportes."
                name="rolAutoridad"
                title="Perfil Autoridad"
                defaultChecked={selectedUser.rolAutoridad}
              />

              <PermissionCard
                help="Permite consultar operadores asignados y gestionar reparaciones habilitadas."
                name="rolOperador"
                title="Perfil Operador"
                defaultChecked={selectedUser.rolOperador}
              >
                <div className="operator-assignment">
                  <span>Operadores asignados</span>
                  <div>
                    {operadores.map((operador) => (
                      <label key={operador.id}>
                        <input
                          type="checkbox"
                          name="operadores"
                          value={operador.id}
                          defaultChecked={selectedOperatorIds.has(operador.id)}
                        />
                        {operador.nombre}
                      </label>
                    ))}
                  </div>
                </div>
                <label>
                  <input type="checkbox" name="operadorPuedeResolver" defaultChecked={selectedUser.operadorPuedeResolver} />
                  Puede resolver defectos
                </label>
                <p className="admin-note">En MVP, este permiso aplica a nivel usuario.</p>
              </PermissionCard>

              <div className="admin-form-actions">
                <Link className="secondary-action" href="/administracion">Cancelar</Link>
                <button className="primary-action" type="submit">Guardar cambios</button>
              </div>
            </form>
          ) : (
            <div className="empty-state">Seleccione un usuario para revisar permisos.</div>
          )}
        </aside>
      </div>
    </main>
  );
}

function hasAdminSearch(filters: ReturnType<typeof normalizeFilters>) {
  return Boolean(filters.q || filters.estado || filters.perfil);
}

function PermissionCard({
  children,
  defaultChecked,
  help,
  name,
  title,
}: {
  children?: ReactNode;
  defaultChecked: boolean;
  help: string;
  name: string;
  title: string;
}) {
  return (
    <section className="permission-card">
      <header>
        <div>
          <h3>{title}</h3>
          <p>{help}</p>
        </div>
        <label className="switch">
          <input type="checkbox" name={name} defaultChecked={defaultChecked} />
          <span />
        </label>
      </header>
      {children ? <div className="permission-options">{children}</div> : null}
    </section>
  );
}

function StatusBadge({ estado }: { estado: string }) {
  const active = estado === "Activo";
  return <span className={`admin-status ${active ? "active" : "inactive"}`}>{estado}</span>;
}

function RoleMark({ active }: { active: boolean }) {
  return active ? <span className="role-mark active">✓</span> : <span className="role-mark">-</span>;
}

function normalizeFilters(params?: Record<string, string | string[] | undefined>) {
  return {
    q: getParam(params, "q"),
    estado: getParam(params, "estado"),
    perfil: getParam(params, "perfil"),
    usuario: getParam(params, "usuario"),
    guardado: getParam(params, "guardado"),
  };
}

function getParam(params: Record<string, string | string[] | undefined> | undefined, key: string) {
  const value = params?.[key];
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

function buildWhere(filters: ReturnType<typeof normalizeFilters>): Prisma.UsuarioWhereInput {
  const and: Prisma.UsuarioWhereInput[] = [];
  if (filters.q) {
    and.push({
      OR: [
        { nombreCompleto: { contains: filters.q } },
        { correo: { contains: filters.q.toLowerCase() } },
      ],
    });
  }
  if (filters.estado) and.push({ estado: filters.estado });
  if (filters.perfil === "Administrador") and.push({ rolAdministrador: true });
  if (filters.perfil === "Inspector") and.push({ rolInspector: true });
  if (filters.perfil === "Autoridad") and.push({ rolAutoridad: true });
  if (filters.perfil === "Operador") and.push({ rolOperador: true });
  return and.length > 0 ? { AND: and } : {};
}

function buildHref(filters: ReturnType<typeof normalizeFilters>, overrides: Partial<ReturnType<typeof normalizeFilters>>) {
  const params = new URLSearchParams();
  const next = { ...filters, ...overrides };
  for (const [key, value] of Object.entries(next)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/administracion?${query}` : "/administracion";
}

function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
