export type Role = "Administrador" | "Inspector" | "Autoridad" | "Operador";

export type SessionUser = {
  id: string;
  nombreCompleto: string;
  correo: string;
  estado: string;
  roles: Role[];
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
    label: "Revision de pauta",
    href: "/inspecciones/revision-pauta",
    description: "Placeholder para revision digital de pauta aplicable.",
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
    label: "Administracion",
    href: "/administracion",
    description: "Placeholder para usuarios, permisos y auditoria.",
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

export function getPrimaryRole(user: SessionUser) {
  return user.roles[0] ?? "Sin rol";
}

export function canAccessModule(user: SessionUser, moduleKey: ModuleKey) {
  switch (moduleKey) {
    case "inicio":
      return user.roles.length > 0;
    case "defecto-puntual":
      return hasRole(user, "Inspector") && user.permisos.inspectorDefectoPuntual;
    case "revision-pauta":
      return hasRole(user, "Inspector") && user.permisos.inspectorRevisionPauta;
    case "historial":
      return hasRole(user, "Inspector") || hasRole(user, "Autoridad") || hasRole(user, "Operador");
    case "notificaciones":
      return hasRole(user, "Autoridad") || hasRole(user, "Operador");
    case "reportes":
      return hasRole(user, "Autoridad") || hasRole(user, "Operador");
    case "resolver-defectos":
      return hasRole(user, "Operador") && user.permisos.operadorPuedeResolver;
    case "administracion":
    case "datos-maestros":
      return hasRole(user, "Administrador");
    default:
      return false;
  }
}

export function getNavigationForUser(user: SessionUser) {
  const visibleKeys = new Set<ModuleKey>(["inicio"]);

  if (hasRole(user, "Administrador")) {
    visibleKeys.add("administracion");
    visibleKeys.add("datos-maestros");
  }

  if (hasRole(user, "Inspector")) {
    if (user.permisos.inspectorDefectoPuntual) visibleKeys.add("defecto-puntual");
    if (user.permisos.inspectorRevisionPauta) visibleKeys.add("revision-pauta");
    visibleKeys.add("historial");
  }

  if (hasRole(user, "Autoridad")) {
    visibleKeys.add("historial");
    visibleKeys.add("notificaciones");
    visibleKeys.add("reportes");
  }

  if (hasRole(user, "Operador")) {
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
  if (hasRole(user, "Administrador")) return "Acceso completo al sistema.";
  if (hasRole(user, "Autoridad")) return "Acceso general de consulta, notificaciones y reportes.";
  if (hasRole(user, "Inspector")) return "Acceso a sus inspecciones y registros habilitados.";
  if (hasRole(user, "Operador")) return "Acceso a operadores asignados y resolucion segun permiso.";
  return "Sin permisos asignados.";
}
