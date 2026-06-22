export type Role = "Administrador" | "Inspector" | "Autoridad" | "Operador";

export type SessionUser = {
  id: string;
  nombreCompleto: string;
  correo: string;
  estado: string;
  roles: Role[];
  activeRole: Role;
  permisos: {
    inspectorDefectoPuntual: boolean;
    inspectorRevisionPauta: boolean;
    operadorPuedeResolver: boolean;
  };
  operadores: Array<{
    id: string;
    nombre: string;
  }>;
};

export const rolePriority: Role[] = ["Administrador", "Autoridad", "Operador", "Inspector"];

export type ModuleKey =
  | "inicio"
  | "defecto-puntual"
  | "revision-pauta"
  | "historial"
  | "notificaciones"
  | "reportes"
  | "resolver-defectos"
  | "administracion"
  | "datos-maestros";

export type NavigationItem = {
  key: ModuleKey;
  label: string;
  href: string;
  description: string;
};

export const navigationItems: NavigationItem[] = [
  {
    key: "inicio",
    label: "Inicio",
    href: "/inicio",
    description: "Resumen operativo segun permisos del usuario.",
  },
  {
    key: "defecto-puntual",
    label: "Defecto puntual",
    href: "/inspecciones/defecto-puntual",
    description: "Placeholder para registro de defectos puntuales.",
  },
  {
    key: "revision-pauta",
    label: "Revisión de pauta",
    href: "/inspecciones/revision-pauta",
    description: "Placeholder para revisión digital de pauta aplicable.",
  },
  {
    key: "historial",
    label: "Historial",
    href: "/historial",
    description: "Consulta de inspecciones con alcance filtrado por rol.",
  },
  {
    key: "notificaciones",
    label: "Notificaciones",
    href: "/notificaciones",
    description: "Notificaciones internas y correos simulados.",
  },
  {
    key: "reportes",
    label: "Reportes",
    href: "/reportes",
    description: "Placeholder para indicadores y reportes.",
  },
  {
    key: "administracion",
    label: "Administración",
    href: "/administracion",
    description: "Placeholder para usuarios, permisos y auditoría.",
  },
  {
    key: "datos-maestros",
    label: "Datos maestros",
    href: "/datos-maestros",
    description: "Placeholder para buses, operadores y pauta.",
  },
];

export function hasRole(user: SessionUser, role: Role) {
  return user.roles.includes(role);
}

export function hasActiveRole(user: SessionUser, role: Role) {
  return user.activeRole === role;
}

export function getPrimaryRole(user: SessionUser) {
  return user.activeRole ?? "Sin rol";
}

export function getDefaultActiveRole(roles: Role[]) {
  return rolePriority.find((role) => roles.includes(role)) ?? roles[0] ?? "Inspector";
}

export function canAccessModule(user: SessionUser, moduleKey: ModuleKey) {
  switch (moduleKey) {
    case "inicio":
      return user.roles.length > 0;
    case "defecto-puntual":
      return hasActiveRole(user, "Inspector") && user.permisos.inspectorDefectoPuntual;
    case "revision-pauta":
      return hasActiveRole(user, "Inspector") && user.permisos.inspectorRevisionPauta;
    case "historial":
      return (
        hasActiveRole(user, "Inspector") ||
        hasActiveRole(user, "Autoridad") ||
        hasActiveRole(user, "Operador")
      );
    case "notificaciones":
      return hasActiveRole(user, "Autoridad") || hasActiveRole(user, "Operador");
    case "reportes":
      return hasActiveRole(user, "Autoridad") || hasActiveRole(user, "Operador");
    case "resolver-defectos":
      return hasActiveRole(user, "Operador") && user.permisos.operadorPuedeResolver;
    case "administracion":
    case "datos-maestros":
      return hasActiveRole(user, "Administrador");
    default:
      return false;
  }
}

export function getNavigationForUser(user: SessionUser) {
  const visibleKeys = new Set<ModuleKey>(["inicio"]);

  if (hasActiveRole(user, "Administrador")) {
    visibleKeys.add("administracion");
    visibleKeys.add("datos-maestros");
  }

  if (hasActiveRole(user, "Inspector")) {
    if (user.permisos.inspectorDefectoPuntual) visibleKeys.add("defecto-puntual");
    if (user.permisos.inspectorRevisionPauta) visibleKeys.add("revision-pauta");
    visibleKeys.add("historial");
  }

  if (hasActiveRole(user, "Autoridad")) {
    visibleKeys.add("historial");
    visibleKeys.add("notificaciones");
    visibleKeys.add("reportes");
  }

  if (hasActiveRole(user, "Operador")) {
    visibleKeys.add("historial");
    visibleKeys.add("notificaciones");
    visibleKeys.add("reportes");
  }

  return navigationItems.filter((item) => visibleKeys.has(item.key));
}

export function getDefaultPathForUser(user: SessionUser) {
  if (canAccessModule(user, "inicio")) return "/inicio";
  return "/login";
}

export function getAccessScopeLabel(user: SessionUser) {
  if (hasActiveRole(user, "Administrador")) return "Perfil activo: administración y datos maestros.";
  if (hasActiveRole(user, "Autoridad")) return "Perfil activo: consulta general, notificaciones y reportes.";
  if (hasActiveRole(user, "Inspector")) return "Perfil activo: inspecciones propias y registros habilitados.";
  if (hasActiveRole(user, "Operador")) return "Perfil activo: operadores asignados y reportes.";
  return "Sin permisos asignados.";
}
