import type { Prisma } from "@prisma/client";
import { hasActiveRole, type SessionUser } from "@/lib/access";

export function getInspectionWhere(user: SessionUser): Prisma.InspeccionWhereInput {
  if (hasActiveRole(user, "Autoridad")) return {};

  if (hasActiveRole(user, "Inspector")) return { inspectorId: user.id };

  if (hasActiveRole(user, "Operador")) {
    const operadorIds = user.operadores.map((operador) => operador.id);
    if (operadorIds.length > 0) {
      return { bus: { operadorId: { in: operadorIds } } };
    }
  }

  return { id: "__sin_alcance_operativo__" };
}

export function getInspectionScopeText(user: SessionUser) {
  if (hasActiveRole(user, "Autoridad")) return "Perfil Autoridad: vista general de inspecciones.";
  if (hasActiveRole(user, "Inspector")) return "Perfil Inspector: solo inspecciones realizadas por el usuario.";
  if (hasActiveRole(user, "Operador")) return "Perfil Operador: solo buses de operadores asignados.";
  return "Sin perfil operativo para historial.";
}
