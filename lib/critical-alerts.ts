import "server-only";

import type { SessionUser } from "@/lib/access";
import { hasActiveRole } from "@/lib/access";
import { prisma } from "@/lib/db";
import { getInspectionWhere } from "@/lib/inspection-access";

export type CriticalAlertItem = {
  inspeccionId: string;
  ppu: string;
  operador: string;
  tipoInspeccion: string;
  fecha: string;
  hora: string;
  efecto: string;
  defectosAlta: Array<{
    id: string;
    elemento: string;
    item: string;
    criterio: string;
  }>;
};

export type CriticalAlertBatch = {
  defectoPuntual: number;
  revisionPauta: number;
  total: number;
  alertas: CriticalAlertItem[];
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
        ppu: true,
        operadorNombre: true,
        tipoInspeccion: true,
        fecha: true,
        hora: true,
        efectoInspeccion: true,
        defectos: {
          where: {
            criticidad: "Alta",
          },
          select: {
            id: true,
            elemento: true,
            item: true,
            criterioEspecifico: true,
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

    await tx.logActividad.create({
      data: {
        usuarioId: user.id,
        usuarioNombre: user.nombreCompleto,
        usuarioCorreo: user.correo,
        perfil: user.activeRole,
        accion: "Recepción de alerta crítica visual",
        modulo: "Notificaciones",
        resultado: "Éxito",
        detalle: `Se notificaron ${inspections.length} inspección(es) nueva(s) con defectos de criticidad Alta.`,
      },
    });

    const alertas: CriticalAlertItem[] = inspections.map((inspection) => ({
      inspeccionId: inspection.id,
      ppu: inspection.ppu,
      operador: inspection.operadorNombre,
      tipoInspeccion: inspection.tipoInspeccion,
      fecha: inspection.fecha,
      hora: inspection.hora,
      efecto: inspection.efectoInspeccion ?? "Requiere atención prioritaria.",
      defectosAlta: inspection.defectos.map((defecto) => ({
        id: defecto.id,
        elemento: defecto.elemento,
        item: defecto.item,
        criterio: defecto.criterioEspecifico,
      })),
    }));

    const defectoPuntual = alertas
      .filter((inspection) => inspection.tipoInspeccion === "Defecto puntual")
      .reduce((total, inspection) => total + inspection.defectosAlta.length, 0);
    const revisionPauta = alertas
      .filter((inspection) => inspection.tipoInspeccion === "Revision de pauta")
      .reduce((total, inspection) => total + inspection.defectosAlta.length, 0);

    return {
      defectoPuntual,
      revisionPauta,
      total: defectoPuntual + revisionPauta,
      alertas,
    };
  });
}

function emptyBatch(): CriticalAlertBatch {
  return {
    defectoPuntual: 0,
    revisionPauta: 0,
    total: 0,
    alertas: [],
  };
}
