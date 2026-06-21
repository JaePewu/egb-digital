import type { Prisma } from "@prisma/client";
import { hasRole, type SessionUser } from "@/lib/access";

export function getInspectionWhere(user: SessionUser): Prisma.InspeccionWhereInput {
  if (hasRole(user, "Autoridad")) return {};

  const visibility: Prisma.InspeccionWhereInput[] = [];

  if (hasRole(user, "Inspector")) {
    visibility.push({ inspectorId: user.id });
  }

  if (hasRole(user, "Operador")) {
    const operadorIds = user.operadores.map((operador) => operador.id);
    if (operadorIds.length > 0) {
      visibility.push({ bus: { operadorId: { in: operadorIds } } });
    }
  }

  if (visibility.length === 1) return visibility[0];
  if (visibility.length > 1) return { OR: visibility };

  return { id: "__sin_alcance_operativo__" };
}

export function getInspectionScopeText(user: SessionUser) {
  if (hasRole(user, "Autoridad")) return "Vista general de inspecciones.";
  if (hasRole(user, "Inspector") && hasRole(user, "Operador")) {
    return "Inspecciones propias y de operadores asignados.";
  }
  if (hasRole(user, "Inspector")) return "Solo inspecciones realizadas por el inspector.";
  if (hasRole(user, "Operador")) return "Solo buses de operadores asignados.";
  return "Sin perfil operativo para historial.";
}
