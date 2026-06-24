"use client";

import { CircleCheck } from "lucide-react";
import { useEffect, useState } from "react";

type InspectionSuccessOverlayProps = {
  inspectionType: string;
};

export function InspectionSuccessOverlay({ inspectionType }: InspectionSuccessOverlayProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(false), 2600);
    return () => window.clearTimeout(timeout);
  }, []);

  if (!visible) return null;

  return (
    <div className="inspection-success-overlay" role="status" aria-live="assertive">
      <div className="inspection-success-dialog">
        <CircleCheck aria-hidden="true" size={54} strokeWidth={2} />
        <strong>Inspección enviada correctamente</strong>
        <span>{inspectionType}</span>
      </div>
    </div>
  );
}
