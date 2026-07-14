import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Eye, Pencil, UserPlus } from "lucide-react";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { canAccessModule } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SearchFeedback } from "../_components/search-feedback";
import { createUserAdministration, saveUserAdministration } from "./actions";

export const dynamic = "force-dynamic";

type AdministracionPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type UserWithOperators = Prisma.UsuarioGetPayload<{
  include: { operadores: { include: { operador: true } } };
}>;

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
      include: { operadores: { include: { operador: true } } },
    }),
    prisma.operador.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  const selectedUser = filters.usuario
    ? await prisma.usuario.findUnique({
        where: { id: filters.usuario },
        include: { operadores: { include: { operador: true } } },
      })
    : usuarios[0] ?? null;
  const isNew = filters.modo === "nuevo";

  return (
    <main className="module-shell admin-page">
      <section className="module-header">
        <h1>Administración</h1>
        <p className="lead">Crea, consulta y mantiene usuarios, perfiles, permisos y asignaciones operativas.</p>
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
          <Link className="admin-create-link" href="/administracion?modo=nuevo">
            <UserPlus aria-hidden="true" size={17} />
            Nuevo usuario
          </Link>
        </div>
      </div>

      {hasAdminSearch(filters) ? (
        <SearchFeedback
          message={usuarios.length > 0 ? `${usuarios.length} usuario(s) encontrado(s).` : "No se encontraron usuarios para la búsqueda."}
          status={usuarios.length > 0 ? "success" : "empty"}
        />
      ) : null}
      {filters.error ? <SearchFeedback message={filters.error} status="error" /> : null}
      {filters.guardado === "1" ? <SearchFeedback message="Usuario actualizado correctamente." status="success" /> : null}
      {filters.creado === "1" ? <SearchFeedback message="Usuario creado correctamente." status="success" /> : null}

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
                  <tr><td colSpan={8}>No se encontraron usuarios para los filtros seleccionados.</td></tr>
                ) : usuarios.map((item) => (
                  <tr className={selectedUser?.id === item.id && !isNew ? "is-selected" : ""} key={item.id}>
                    <td><span className="user-cell"><span>{getInitials(item.nombreCompleto)}</span>{item.nombreCompleto}</span></td>
                    <td>{item.correo}</td>
                    <td><StatusBadge estado={item.estado} /></td>
                    <td><RoleMark active={item.rolAdministrador} /></td>
                    <td><RoleMark active={item.rolInspector} /></td>
                    <td><RoleMark active={item.rolAutoridad} /></td>
                    <td><RoleMark active={item.rolOperador} /></td>
                    <td>
                      <Link className="text-link" href={buildHref(filters, { usuario: item.id, modo: "", error: "", creado: "", guardado: "" })}>
                        <Eye aria-hidden="true" size={16} strokeWidth={2} /> Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="admin-panel permissions-panel">
          <div className="section-heading">
            <h2>{isNew ? "Crear usuario" : "Detalle y edición"}</h2>
            {!isNew && selectedUser ? <Pencil aria-hidden="true" size={18} /> : null}
          </div>
          {isNew ? (
            <UserEditor action={createUserAdministration} operadores={operadores} />
          ) : selectedUser ? (
            <UserEditor action={saveUserAdministration} operadores={operadores} user={selectedUser} />
          ) : (
            <div className="empty-state">Seleccione un usuario o cree uno nuevo.</div>
          )}
        </aside>
      </div>
    </main>
  );
}

function UserEditor({
  action,
  operadores,
  user,
}: {
  action: (formData: FormData) => void | Promise<void>;
  operadores: Array<{ id: string; nombre: string }>;
  user?: UserWithOperators;
}) {
  const selectedOperatorIds = new Set(user?.operadores.map((item) => item.operadorId) ?? []);
  return (
    <form action={action} className="permissions-form admin-user-editor">
      {user ? <input name="usuarioId" type="hidden" value={user.id} /> : null}

      <div className="admin-user-fields">
        <label>
          Nombre completo <span aria-hidden="true">*</span>
          <input name="nombreCompleto" required defaultValue={user?.nombreCompleto ?? ""} maxLength={160} />
        </label>
        <label>
          Correo institucional <span aria-hidden="true">*</span>
          <input name="correo" type="email" required defaultValue={user?.correo ?? ""} maxLength={200} />
        </label>
        <label>
          {user ? "Nueva contraseña (opcional)" : "Contraseña *"}
          <input name="contrasena" type="password" required={!user} minLength={6} autoComplete="new-password" />
        </label>
        <label>
          Estado <span aria-hidden="true">*</span>
          <select name="estado" required defaultValue={user?.estado ?? "Activo"}>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>
        </label>
      </div>

      <PermissionCard help="Permite administrar usuarios, permisos, datos maestros y auditoría." name="rolAdministrador" title="Perfil Administrador" defaultChecked={user?.rolAdministrador ?? false} />
      <PermissionCard help="Permite registrar defectos puntuales y ejecutar revisiones de pauta." name="rolInspector" title="Perfil Inspector" defaultChecked={user?.rolInspector ?? false}>
        <label><input type="checkbox" name="inspectorDefectoPuntual" defaultChecked={user?.inspectorDefectoPuntual ?? false} /> Defectos puntuales</label>
        <label><input type="checkbox" name="inspectorRevisionPauta" defaultChecked={user?.inspectorRevisionPauta ?? false} /> Revisión de pauta</label>
      </PermissionCard>
      <PermissionCard help="Permite consultar información global, historial, notificaciones y reportes." name="rolAutoridad" title="Perfil Autoridad" defaultChecked={user?.rolAutoridad ?? false} />
      <PermissionCard help="Permite consultar operadores asignados y gestionar reparaciones habilitadas." name="rolOperador" title="Perfil Operador" defaultChecked={user?.rolOperador ?? false}>
        <div className="operator-assignment">
          <span>Operadores asignados</span>
          <div>
            {operadores.map((operador) => (
              <label key={operador.id}>
                <input type="checkbox" name="operadores" value={operador.id} defaultChecked={selectedOperatorIds.has(operador.id)} />
                {operador.nombre}
              </label>
            ))}
          </div>
        </div>
        <label><input type="checkbox" name="operadorPuedeResolver" defaultChecked={user?.operadorPuedeResolver ?? false} /> Puede resolver defectos</label>
      </PermissionCard>

      <p className="admin-note">Los campos marcados con * son obligatorios. El correo no puede repetirse.</p>
      <div className="admin-form-actions">
        <Link className="secondary-action" href="/administracion">Cancelar</Link>
        <button className="primary-action" type="submit">{user ? "Guardar cambios" : "Crear usuario"}</button>
      </div>
    </form>
  );
}

function PermissionCard({ children, defaultChecked, help, name, title }: { children?: ReactNode; defaultChecked: boolean; help: string; name: string; title: string }) {
  return (
    <section className="permission-card">
      <header>
        <div><h3>{title}</h3><p>{help}</p></div>
        <label className="switch"><input type="checkbox" name={name} defaultChecked={defaultChecked} /><span /></label>
      </header>
      {children ? <div className="permission-options">{children}</div> : null}
    </section>
  );
}

function StatusBadge({ estado }: { estado: string }) {
  return <span className={`admin-status ${estado === "Activo" ? "active" : "inactive"}`}>{estado}</span>;
}
function RoleMark({ active }: { active: boolean }) {
  return active ? <span className="role-mark active">✓</span> : <span className="role-mark">-</span>;
}
function normalizeFilters(params?: Record<string, string | string[] | undefined>) {
  return {
    q: getParam(params, "q"), estado: getParam(params, "estado"), perfil: getParam(params, "perfil"),
    usuario: getParam(params, "usuario"), guardado: getParam(params, "guardado"), creado: getParam(params, "creado"),
    error: getParam(params, "error"), modo: getParam(params, "modo"),
  };
}
function getParam(params: Record<string, string | string[] | undefined> | undefined, key: string) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0]?.trim() ?? "" : value?.trim() ?? "";
}
function buildWhere(filters: ReturnType<typeof normalizeFilters>): Prisma.UsuarioWhereInput {
  const and: Prisma.UsuarioWhereInput[] = [];
  if (filters.q) and.push({ OR: [{ nombreCompleto: { contains: filters.q, mode: "insensitive" } }, { correo: { contains: filters.q.toLowerCase(), mode: "insensitive" } }] });
  if (filters.estado) and.push({ estado: filters.estado });
  if (filters.perfil === "Administrador") and.push({ rolAdministrador: true });
  if (filters.perfil === "Inspector") and.push({ rolInspector: true });
  if (filters.perfil === "Autoridad") and.push({ rolAutoridad: true });
  if (filters.perfil === "Operador") and.push({ rolOperador: true });
  return and.length ? { AND: and } : {};
}
function hasAdminSearch(filters: ReturnType<typeof normalizeFilters>) { return Boolean(filters.q || filters.estado || filters.perfil); }
function buildHref(filters: ReturnType<typeof normalizeFilters>, overrides: Partial<ReturnType<typeof normalizeFilters>>) {
  const params = new URLSearchParams();
  const next = { ...filters, ...overrides };
  for (const [key, value] of Object.entries(next)) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `/administracion?${query}` : "/administracion";
}
function getInitials(value: string) { return value.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(""); }
