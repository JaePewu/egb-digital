"use server";

import { redirect } from "next/navigation";
import { canAccessModule, hasActiveRole } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getInspectionWhere } from "@/lib/inspection-access";

export async function saveInspectionResolution(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessModule(user, "historial")) redirect("/sin-acceso");
  if (!hasActiveRole(user, "Operador") || !user.permisos.operadorPuedeResolver) redirect("/sin-acceso");

  const inspectionId = String(formData.get("inspectionId") ?? "");
  const defectIds = String(formData.get("defectIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!inspectionId || defectIds.length === 0) redirect("/historial");

  const inspeccion = await prisma.inspeccion.findFirst({
    where: {
      AND: [{ id: inspectionId }, getInspectionWhere(user)],
    },
    include: {
      bus: true,
      defectos: {
        orderBy: {
          id: "asc",
        },
      },
    },
  });

  if (!inspeccion) redirect("/sin-acceso");

  const now = new Date();
  const updates = inspeccion.defectos.map((defecto) => {
    const repaired = formData.get(`reparado:${defecto.id}`) === "on";
    const observation = truncate(String(formData.get(`observacion:${defecto.id}`) ?? ""), 400);
    const previousObservation = defecto.observacionOperador ?? "";
    const repairedChanged = repaired !== defecto.defectoReparado;
    const observationChanged = observation !== previousObservation;

    return {
      id: defecto.id,
      repaired,
      observation,
      repairedChanged,
      observationChanged,
      changed: repairedChanged || observationChanged,
      previousRepairDate: defecto.fechaMarcadoReparado,
    };
  });
  const allRepaired = updates.length > 0 && updates.every((update) => update.repaired);
  const nextInspectionState = allRepaired ? "Resuelta" : "Pendiente";
  const changedUpdates = updates.filter((update) => update.changed);
  const inspectionNeedsUpdate =
    inspeccion.todosDefectosReparados !== allRepaired || inspeccion.estado !== nextInspectionState;

  if (changedUpdates.length === 0 && !inspectionNeedsUpdate) {
    redirect(`/historial/${inspeccion.id}?sinCambios=1`);
  }

  await prisma.$transaction(async (tx) => {
    for (const update of changedUpdates) {
      await tx.defectoDetectado.update({
        where: { id: update.id },
        data: {
          defectoReparado: update.repaired,
          observacionOperador: update.observation || null,
          fechaMarcadoReparado: getNextRepairDate(update, now),
          estadoDefecto: update.repaired ? "Reparado" : "Pendiente",
        },
      });
    }

    if (changedUpdates.length > 0 || inspectionNeedsUpdate) {
      await tx.inspeccion.update({
        where: { id: inspeccion.id },
        data: {
          estado: nextInspectionState,
          todosDefectosReparados: allRepaired,
          ultimaActualizacion: now,
          operadorResolutorId: allRepaired ? user.id : null,
          operadorResolutorNombre: allRepaired ? user.nombreCompleto : null,
          observacionGeneralOperador: allRepaired
            ? "Defectos marcados como reparados por operador en MVP."
            : "Resolución parcial registrada por operador en MVP.",
        },
      });
    }

    if (changedUpdates.length > 0) {
      await tx.notificacion.create({
        data: {
          id: `${inspeccion.id}-NOT-REP-${Date.now()}`,
          fechaHora: now,
          tipoNotificacion: allRepaired ? "Reparacion completada" : "Resolucion actualizada",
          canal: "Interna y correo simulado",
          tipoInspeccion: inspeccion.tipoInspeccion,
          ppu: inspeccion.ppu,
          inspeccionId: inspeccion.id,
          operador: inspeccion.operadorNombre,
          responsable: user.nombreCompleto,
          certificador: inspeccion.bus.certificador,
          correoOperadorSimulado: inspeccion.bus.correoOperadorSimulado,
          correoCertificadorSimulado: inspeccion.bus.correoCertificadorSimulado,
          correoAutoridadSimulado: inspeccion.bus.correoAutoridadSimulado,
          asuntoCorreoSimulado: allRepaired
            ? `Reparación completada ${inspeccion.ppu}`
            : `Resolución actualizada ${inspeccion.ppu}`,
          cuerpoCorreoSimulado: allRepaired
            ? `El operador actualizó la resolución de ${changedUpdates.length} defecto(s) y marcó reparada la inspección ${inspeccion.id}.`
            : `El operador actualizó la resolución de ${changedUpdates.length} defecto(s) de la inspección ${inspeccion.id}.`,
          estado: "Nueva",
        },
      });
    }
  });

  redirect(`/historial/${inspeccion.id}`);
}

function truncate(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength);
}

function getNextRepairDate(
  update: {
    repaired: boolean;
    repairedChanged: boolean;
    previousRepairDate: Date | null;
  },
  now: Date,
) {
  if (update.repairedChanged && update.repaired) return now;
  if (update.repairedChanged && !update.repaired) return null;
  return update.previousRepairDate;
}
