import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";

type SeverityBadgeProps = {
  value: string;
};

export function SeverityBadge({ value }: SeverityBadgeProps) {
  const severity = normalizeSeverity(value);

  return (
    <span className={`severity-indicator ${severity.className}`}>
      <SeverityIcon severity={severity.className} />
      <span>{severity.label}</span>
    </span>
  );
}

function SeverityIcon({ severity }: { severity: "alta" | "media" | "baja" }) {
  if (severity === "alta") {
    return <CircleAlert aria-hidden="true" size={18} strokeWidth={2} />;
  }
  if (severity === "media") {
    return <TriangleAlert aria-hidden="true" size={18} strokeWidth={2} />;
  }
  return <CircleCheck aria-hidden="true" size={18} strokeWidth={2} />;
}

function normalizeSeverity(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === "alta") return { className: "alta" as const, label: "Alta" };
  if (normalized === "media") return { className: "media" as const, label: "Mediana" };
  return { className: "baja" as const, label: "Baja" };
}
