import "server-only";

import type { SessionUser } from "@/lib/access";
import { hasActiveRole } from "@/lib/access";
import { prisma } from "@/lib/db";
import { getInspectionWhere } from "@/lib/inspection-access";

export type CriticalAlertBatch = {
  defectoPuntual: number;
  revisionPauta: number;
  total: number;
};

export function canReceiveCriticalAlerts(user: SessionUser) {
  return hasActiveRole(user, "Operador") || hasActiveRole(user, "Autoridad");
}

export async function consumeCriticalAlerts(user: SessionUser): Promise<CriticalAlertBatch> {
  if (!canReceiveCriticalAlerts(user)) return emptyBatch();

  return prisma.$transaction(async (tx) => {
    const inspections = await tx.inspeccion.findMany({
      where: {
        AND: [
          getInspectionWhere(user),
          {
            defectos: {
              some: {
                criticidad: "Alta",
              },
            },
          },
          {
            alertasCriticasVistas: {
              none: {
                usuarioId: user.id,
                perfil: user.activeRole,
              },
            },
          },
        ],
      },
      orderBy: {
        fechaHora: "asc",
      },
      select: {
        id: true,
        tipoInspeccion: true,
        defectos: {
          where: {
            criticidad: "Alta",
          },
          select: {
            id: true,
          },
        },
      },
    });

    if (inspections.length === 0) return emptyBatch();

    await tx.alertaCriticaVista.createMany({
      data: inspections.map((inspection) => ({
        usuarioId: user.id,
        perfil: user.activeRole,
        inspeccionId: inspection.id,
      })),
      skipDuplicates: true,
    });

    const defectoPuntual = inspections
      .filter((inspection) => inspection.tipoInspeccion === "Defecto puntual")
      .reduce((total, inspection) => total + inspection.defectos.length, 0);
    const revisionPauta = inspections
      .filter((inspection) => inspection.tipoInspeccion === "Revision de pauta")
      .reduce((total, inspection) => total + inspection.defectos.length, 0);

    return {
      defectoPuntual,
      revisionPauta,
      total: defectoPuntual + revisionPauta,
    };
  });
}

function emptyBatch(): CriticalAlertBatch {
  return {
    defectoPuntual: 0,
    revisionPauta: 0,
    total: 0,
  };
}
