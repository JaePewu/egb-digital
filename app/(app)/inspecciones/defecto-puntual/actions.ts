"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { canAccessModule } from "@/lib/access";
import { activityActorFromUser, buildActivityData } from "@/lib/activity-log";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type SelectedDefectPayload = {
  id: string;
  observacion?: string;
  foto?: boolean;
  video?: boolean;
};

const severityRank: Record<string, number> = {
  Baja: 1,
  Media: 2,
  Alta: 3,
};

export async function saveDefectoPuntual(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessModule(user, "defecto-puntual")) redirect("/sin-acceso");

  const ppu = String(formData.get("ppu") ?? "").trim().toUpperCase();
  const selectedRaw = String(formData.get("selectedDefects") ?? "");

  if (!ppu) redirectWithError("Debe buscar y seleccionar un bus antes de guardar.", ppu);

  const selected = parseSelectedDefects(selectedRaw);
  if (selected.length === 0) {
    redirectWithError("Debe seleccionar al menos un defecto.", ppu);
  }

  const bus = await prisma.bus.findUnique({
    where: { ppu },
    include: {
      pautaAplicable: {
        where: { aplica: true },
        include: { pauta: true },
      },
    },
  });

  if (!bus) redirectWithError("No se encontró un bus con la PPU indicada.", ppu);

  const pautaById = new Map(bus.pautaAplicable.map(({ pauta }) => [pauta.id, pauta]));
  const uniqueSelected = dedupeById(selected);
  const incompleteDefect = uniqueSelected.find(
    (defect) => !defect.observacion?.trim() || (!defect.foto && !defect.video),
  );
  if (incompleteDefect) {
    redirectWithError("Cada defecto requiere observación y al menos una evidencia.", ppu);
  }
  const selectedPauta = uniqueSelected.map((defect) => {
    const pauta = pautaById.get(defect.id);
    if (!pauta) redirectWithError("Uno o más defectos seleccionados no aplican al bus.", ppu);
    return { defect, pauta };
  });

  const now = new Date();
  const inspectionId = buildId("INSP-DP", now);
  const maxSeverity = selectedPauta.reduce((current, { pauta }) => {
    return (severityRank[pauta.criticidad] ?? 0) > (severityRank[current] ?? 0) ? pauta.criticidad : current;
  }, "Baja");
  const auditData = await buildActivityData({
    actor: activityActorFromUser(user),
    accion: "Registro de defecto puntual",
    modulo: "Inspecciones",
    resultado: "Éxito",
    detalle: `Inspección ${inspectionId}, PPU ${bus.ppu}, ${selectedPauta.length} defecto(s), criticidad máxima ${maxSeverity}.`,
  });

  await prisma.$transaction(async (tx) => {
    await tx.inspeccion.create({
      data: {
        id: inspectionId,
        fecha: formatDate(now),
        hora: formatTime(now),
        fechaHora: now,
        ppu: bus.ppu,
        operadorNombre: bus.operadorNombre,
        chasis: joinParts(bus.chasisMarca, bus.chasisModelo),
        carroceria: joinParts(bus.carroceriaMarca, bus.carroceriaModelo),
        tecnologia: bus.tecnologia,
        tipoBus: bus.tipoBus,
        anio: bus.anio,
        tipoInspeccion: "Defecto puntual",
        estado: "Pendiente",
        inspectorId: user.id,
        inspectorNombre: user.nombreCompleto,
        inspectorCorreo: user.correo,
        latitud: -33.4489,
        longitud: -70.6693,
        ubicacionSimulada: "Santiago Centro - coordenadas simuladas",
        criticidadMasGrave: maxSeverity,
        cantidadDefectos: selectedPauta.length,
        efectoInspeccion: getEfectoInspeccion(maxSeverity),
        fechaLimiteReparacion: getRepairDeadline(now, maxSeverity),
        ultimaActualizacion: now,
        todosDefectosReparados: false,
        observacionGeneralInspector: "Registro MVP de defecto puntual.",
      },
    });

    await tx.defectoDetectado.createMany({
      data: selectedPauta.map(({ defect, pauta }, index) => {
        const observation = truncate(defect.observacion ?? "", 200);
        const evidenceBase = `https://evidencias.egb.local/mvp/${inspectionId}/${pauta.id}`;

        return {
          id: `${inspectionId}-DET-${String(index + 1).padStart(2, "0")}`,
          inspeccionId: inspectionId,
          ppu: bus.ppu,
          itemPautaId: pauta.id,
          elemento: pauta.elemento,
          item: pauta.item,
          atributo: pauta.atributo,
          criterioEspecifico: pauta.criterioEspecifico,
          criticidad: pauta.criticidad,
          observacionInspector: observation || null,
          cantidadAdjuntosInspector: Number(Boolean(defect.foto)) + Number(Boolean(defect.video)),
          urlFotoInspector: defect.foto ? `${evidenceBase}.jpg` : null,
          urlVideoInspector: defect.video ? `${evidenceBase}.mp4` : null,
          defectoReparado: false,
          estadoDefecto: "Pendiente",
        };
      }),
    });

    const shouldSendSimulatedEmail = maxSeverity === "Alta";

    await tx.notificacion.create({
      data: {
        id: `${inspectionId}-NOT-REG`,
        fechaHora: now,
        tipoNotificacion: maxSeverity === "Alta" ? "Alerta criticidad alta" : "Registro",
        canal: shouldSendSimulatedEmail ? "Interna y correo simulado" : "Interna",
        tipoInspeccion: "Defecto puntual",
        ppu: bus.ppu,
        inspeccionId: inspectionId,
        operador: bus.operadorNombre,
        responsable: bus.operadorNombre,
        certificador: bus.certificador,
        correoOperadorSimulado: shouldSendSimulatedEmail ? bus.correoOperadorSimulado : null,
        correoCertificadorSimulado: shouldSendSimulatedEmail ? bus.correoCertificadorSimulado : null,
        correoAutoridadSimulado: shouldSendSimulatedEmail ? bus.correoAutoridadSimulado : null,
        asuntoCorreoSimulado: shouldSendSimulatedEmail ? `Registro defecto puntual ${bus.ppu}` : null,
        cuerpoCorreoSimulado: shouldSendSimulatedEmail
          ? `Se registró la inspección ${inspectionId} con ${selectedPauta.length} defecto(s).`
          : null,
        estado: "Nueva",
      },
    });

    await tx.logActividad.create({ data: auditData });
  });

  redirect(`/historial/${inspectionId}?enviada=${encodeURIComponent("Defectos puntuales")}`);
}

function parseSelectedDefects(raw: string) {
  try {
    const parsed = JSON.parse(raw) as SelectedDefectPayload[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => ({
        id: String(item.id ?? "").trim(),
        observacion: truncate(String(item.observacion ?? ""), 200),
        foto: Boolean(item.foto),
        video: Boolean(item.video),
      }))
      .filter((item) => item.id);
  } catch {
    return [];
  }
}

function dedupeById(items: SelectedDefectPayload[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function redirectWithError(message: string, ppu: string): never {
  const params = new URLSearchParams();
  if (ppu) params.set("ppu", ppu);
  params.set("error", message);
  redirect(`/inspecciones/defecto-puntual?${params.toString()}`);
}

function buildId(prefix: string, date: Date) {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join("");

  return `${prefix}-${stamp}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function formatDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function getRepairDeadline(date: Date, severity: string) {
  const days = severity === "Alta" ? 7 : severity === "Media" ? 15 : 30;
  const deadline = new Date(date);
  deadline.setDate(deadline.getDate() + days);
  return deadline;
}

function getEfectoInspeccion(severity: string) {
  if (severity === "Alta") return "Debe generar seguimiento prioritario.";
  if (severity === "Media") return "Debe generar seguimiento programado.";
  return "Debe quedar disponible para consulta y seguimiento.";
}

function joinParts(...parts: Array<string | null>) {
  return parts.filter(Boolean).join(" ") || null;
}

function truncate(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength);
}
