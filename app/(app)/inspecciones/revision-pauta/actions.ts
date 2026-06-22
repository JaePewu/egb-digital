"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { canAccessModule } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type ReviewedItemPayload = {
  id: string;
  resultado?: string;
  observacion?: string;
  foto?: boolean;
  video?: boolean;
};

const severityRank: Record<string, number> = {
  Baja: 1,
  Media: 2,
  Alta: 3,
};

export async function saveRevisionPauta(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessModule(user, "revision-pauta")) redirect("/sin-acceso");

  const ppu = String(formData.get("ppu") ?? "").trim().toUpperCase();
  const reviewedRaw = String(formData.get("reviewedItems") ?? "");

  if (!ppu) redirectWithError("Debe buscar y seleccionar un bus antes de guardar.", ppu);

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
  if (bus.pautaAplicable.length === 0) redirectWithError("El bus seleccionado no tiene pauta aplicable.", ppu);

  const reviewed = parseReviewedItems(reviewedRaw);
  const applicableIds = new Set(bus.pautaAplicable.map(({ pauta }) => pauta.id));
  const reviewedById = new Map(reviewed.map((item) => [item.id, item]));
  const missing = bus.pautaAplicable.filter(({ pauta }) => !reviewedById.has(pauta.id));

  if (missing.length > 0) {
    redirectWithError(`Faltan ${missing.length} ítem(s) por responder antes de guardar.`, ppu);
  }

  const invalid = reviewed.some((item) => !applicableIds.has(item.id));
  if (invalid) redirectWithError("Uno o más ítems revisados no aplican al bus.", ppu);

  const now = new Date();
  const inspectionId = buildId("INSP-RP", now);
  const reviewedPauta = bus.pautaAplicable.map(({ pauta }) => ({
    pauta,
    review: reviewedById.get(pauta.id)!,
  }));
  const failed = reviewedPauta.filter(({ review }) => review.resultado === "No cumple");
  const maxSeverity = failed.reduce((current, { pauta }) => {
    return (severityRank[pauta.criticidad] ?? 0) > (severityRank[current] ?? 0) ? pauta.criticidad : current;
  }, "Baja");
  const hasDefects = failed.length > 0;

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
        tipoInspeccion: "Revision de pauta",
        estado: hasDefects ? "Pendiente" : "Resuelta",
        inspectorId: user.id,
        inspectorNombre: user.nombreCompleto,
        inspectorCorreo: user.correo,
        latitud: -33.4489,
        longitud: -70.6693,
        ubicacionSimulada: "Santiago Centro - coordenadas simuladas",
        criticidadMasGrave: maxSeverity,
        cantidadDefectos: failed.length,
        efectoInspeccion: hasDefects ? getEfectoInspeccion(maxSeverity) : "Pauta revisada sin hallazgos.",
        fechaLimiteReparacion: hasDefects ? getRepairDeadline(now, maxSeverity) : null,
        ultimaActualizacion: now,
        todosDefectosReparados: !hasDefects,
        observacionGeneralInspector: "Registro MVP de revisión de pauta.",
      },
    });

    await tx.resultadoPauta.createMany({
      data: reviewedPauta.map(({ pauta, review }) => {
        const evidenceBase = `https://evidencias.egb.local/mvp/${inspectionId}/${pauta.id}`;
        const hasEvidence = review.foto || review.video;

        return {
          inspeccionId: inspectionId,
          ppu: bus.ppu,
          itemPautaId: pauta.id,
          elemento: pauta.elemento,
          item: pauta.item,
          atributo: pauta.atributo,
          criterioEspecifico: pauta.criterioEspecifico,
          criticidad: pauta.criticidad,
          resultado: review.resultado ?? "Cumple",
          observacion: review.resultado === "No cumple" ? truncate(review.observacion ?? "", 200) || null : null,
          urlEvidencia: hasEvidence ? `${evidenceBase}.${review.video ? "mp4" : "jpg"}` : null,
        };
      }),
    });

    if (failed.length > 0) {
      await tx.defectoDetectado.createMany({
        data: failed.map(({ pauta, review }, index) => {
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
            observacionInspector: truncate(review.observacion ?? "", 200) || null,
            cantidadAdjuntosInspector: Number(Boolean(review.foto)) + Number(Boolean(review.video)),
            urlFotoInspector: review.foto ? `${evidenceBase}.jpg` : null,
            urlVideoInspector: review.video ? `${evidenceBase}.mp4` : null,
            defectoReparado: false,
            estadoDefecto: "Pendiente",
          };
        }),
      });
    }

    const shouldSendSimulatedEmail = maxSeverity === "Alta";

    await tx.notificacion.create({
      data: {
        id: `${inspectionId}-NOT-REG`,
        fechaHora: now,
        tipoNotificacion: hasDefects && maxSeverity === "Alta" ? "Alerta criticidad alta" : "Registro",
        canal: shouldSendSimulatedEmail ? "Interna y correo simulado" : "Interna",
        tipoInspeccion: "Revision de pauta",
        ppu: bus.ppu,
        inspeccionId: inspectionId,
        operador: bus.operadorNombre,
        responsable: bus.operadorNombre,
        certificador: bus.certificador,
        correoOperadorSimulado: shouldSendSimulatedEmail ? bus.correoOperadorSimulado : null,
        correoCertificadorSimulado: shouldSendSimulatedEmail ? bus.correoCertificadorSimulado : null,
        correoAutoridadSimulado: shouldSendSimulatedEmail ? bus.correoAutoridadSimulado : null,
        asuntoCorreoSimulado: shouldSendSimulatedEmail ? `Registro revisión de pauta ${bus.ppu}` : null,
        cuerpoCorreoSimulado: shouldSendSimulatedEmail
          ? `Se registró la inspección ${inspectionId} con ${failed.length} defecto(s).`
          : null,
        estado: "Nueva",
      },
    });
  });

  redirect(`/historial/${inspectionId}`);
}

function parseReviewedItems(raw: string) {
  try {
    const parsed = JSON.parse(raw) as ReviewedItemPayload[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        const resultado = item.resultado === "No cumple" ? "No cumple" : item.resultado === "Cumple" ? "Cumple" : "";

        return {
          id: String(item.id ?? "").trim(),
          resultado,
          observacion: truncate(String(item.observacion ?? ""), 200),
          foto: Boolean(item.foto),
          video: Boolean(item.video),
        };
      })
      .filter((item) => item.id && item.resultado);
  } catch {
    return [];
  }
}

function redirectWithError(message: string, ppu: string): never {
  const params = new URLSearchParams();
  if (ppu) params.set("ppu", ppu);
  params.set("error", message);
  redirect(`/inspecciones/revision-pauta?${params.toString()}`);
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
