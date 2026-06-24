"use client";

import { CircleCheck, CircleX, X } from "lucide-react";
import { useEffect, useState } from "react";

type SearchFeedbackProps = {
  message: string;
  status: "success" | "empty" | "error";
};

export function SearchFeedback({ message, status }: SearchFeedbackProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timeout = window.setTimeout(() => setVisible(false), 4200);
    return () => window.clearTimeout(timeout);
  }, [message, status]);

  if (!visible) return null;

  const ResultIcon = status === "success" ? CircleCheck : CircleX;

  return (
    <div className={`search-feedback ${status}`} role="status" aria-live="polite">
      <ResultIcon aria-hidden="true" size={20} strokeWidth={2} />
      <span>{message}</span>
      <button type="button" aria-label="Cerrar notificación" onClick={() => setVisible(false)}>
        <X aria-hidden="true" size={18} strokeWidth={2} />
      </button>
    </div>
  );
}
