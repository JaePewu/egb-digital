export function getInspectionTypeLabel(value: string) {
  if (value === "Defecto puntual") return "Defectos puntuales";
  if (value === "Revision de pauta") return "Revisión de pauta";
  return value;
}
