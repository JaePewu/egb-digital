import Link from "next/link";
import { Eye } from "lucide-react";
import { getInspectionTypeLabel } from "@/lib/display-labels";

export type InspectionTableRow = {
  id: string;
  fechaHora: Date;
  ppu: string;
  tipoInspeccion: string;
  criticidadMasGrave: string;
  cantidadDefectos: number;
  inspectorNombre: string | null;
  bus: {
    operadorNombre: string;
  };
  inspector?: {
    nombreCompleto: string;
  } | null;
  defectos: Array<{
    defectoReparado: boolean;
    estadoDefecto: string;
  }>;
};

type InspectionsTableProps = {
  inspections: InspectionTableRow[];
  emptyMessage: string;
};

export function InspectionsTable({ emptyMessage, inspections }: InspectionsTableProps) {
  if (inspections.length === 0) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  return (
    <div className="table-wrap">
      <table className="inspections-table">
        <thead>
          <tr>
            <th>Fecha/hora</th>
            <th>PPU</th>
            <th>Operador</th>
            <th>Tipo de inspección</th>
            <th>Defectos totales</th>
            <th>Defectos pendientes</th>
            <th>Criticidad max</th>
            <th>Inspector</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {inspections.map((inspection) => {
            const status = getVisualStatus(inspection);
            const hasDefects = inspection.cantidadDefectos > 0;
            const pendingDefects = getPendingDefectCount(inspection);
            const severity = inspection.criticidadMasGrave.toLowerCase();

            return (
              <tr key={inspection.id}>
                <td data-label="Fecha/hora">{formatDateTime(inspection.fechaHora)}</td>
                <td data-label="PPU">{inspection.ppu}</td>
                <td data-label="Operador">{inspection.bus.operadorNombre}</td>
                <td data-label="Tipo">{getInspectionTypeLabel(inspection.tipoInspeccion)}</td>
                <td data-label="Defectos">{inspection.cantidadDefectos}</td>
                <td data-label="Pendientes">{pendingDefects}</td>
                <td data-label="Criticidad">
                  {hasDefects ? (
                    <span className={`severity ${severity}`}>{inspection.criticidadMasGrave}</span>
                  ) : (
                    <span className="severity-empty">Sin defectos</span>
                  )}
                </td>
                <td data-label="Inspector">{inspection.inspectorNombre ?? inspection.inspector?.nombreCompleto ?? "Sin inspector"}</td>
                <td data-label="Estado">
                  <span className={`status-badge ${status.className}`}>{status.label}</span>
                </td>
                <td data-label="Acción">
                  <Link className="text-link" href={`/historial/${inspection.id}`}>
                    <Eye aria-hidden="true" size={16} strokeWidth={2} />
                    Ver detalle
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function getPendingDefectCount(inspection: InspectionTableRow) {
  return inspection.defectos.filter(
    (defect) => !defect.defectoReparado && defect.estadoDefecto !== "Reparado",
  ).length;
}

function getVisualStatus(inspection: InspectionTableRow) {
  const hasPendingDefect = inspection.defectos.some(
    (defect) => !defect.defectoReparado && defect.estadoDefecto !== "Reparado",
  );

  return hasPendingDefect
    ? { className: "pending", label: "Pendiente" }
    : { className: "resolved", label: "Resuelta" };
}

function formatDateTime(value: Date) {
  const day = String(value.getDate()).padStart(2, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const year = value.getFullYear();
  const hour = String(value.getHours()).padStart(2, "0");
  const minute = String(value.getMinutes()).padStart(2, "0");

  return `${day}-${month}-${year} ${hour}:${minute}`;
}
