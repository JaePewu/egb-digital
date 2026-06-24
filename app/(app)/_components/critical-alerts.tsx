"use client";

import Link from "next/link";
import { BellRing, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CriticalAlertBatch } from "@/lib/critical-alerts";

const POLL_INTERVAL_MS = 30_000;

export function CriticalAlerts() {
  const [modalAlerts, setModalAlerts] = useState<CriticalAlertBatch | null>(null);
  const [toastAlerts, setToastAlerts] = useState<CriticalAlertBatch | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    let active = true;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    async function initialize() {
      const initialAlerts = await fetchCriticalAlerts();
      if (!active) return;

      if (initialAlerts?.total) setModalAlerts(initialAlerts);

      intervalId = setInterval(async () => {
        const newAlerts = await fetchCriticalAlerts();
        if (!active || !newAlerts?.total) return;

        setToastAlerts((current) => mergeAlerts(current, newAlerts));
      }, POLL_INTERVAL_MS);
    }

    void initialize();

    return () => {
      active = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return (
    <>
      {toastAlerts ? (
        <div className="critical-alert-toast" role="status" aria-live="polite">
          <BellRing aria-hidden="true" size={20} strokeWidth={2} />
          <div>
            <strong>Nuevas inspecciones con criticidad Alta</strong>
            <span>
              Defectos puntuales: {toastAlerts.defectoPuntual} · Revisión de pauta: {toastAlerts.revisionPauta}
            </span>
          </div>
          <Link href="/notificaciones">Ver notificaciones</Link>
          <button type="button" aria-label="Cerrar notificación" onClick={() => setToastAlerts(null)}>
            <X aria-hidden="true" size={20} strokeWidth={2} />
          </button>
        </div>
      ) : null}

      {modalAlerts ? (
        <div className="critical-alert-backdrop">
          <section
            className="critical-alert-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="critical-alert-title"
          >
            <header>
              <div>
                <BellRing aria-hidden="true" size={20} strokeWidth={2} />
                <div>
                  <h2 id="critical-alert-title">Nuevas alertas de criticidad Alta</h2>
                  <p>Se detectaron inspecciones nuevas que requieren atención.</p>
                </div>
              </div>
              <button type="button" aria-label="Cerrar alerta" onClick={() => setModalAlerts(null)}>
                <X aria-hidden="true" size={20} strokeWidth={2} />
              </button>
            </header>

            <div className="critical-alert-blocks">
              <AlertBlock
                className="punctual"
                label="Defectos puntuales"
                total={modalAlerts.defectoPuntual}
              />
              <AlertBlock
                className="review"
                label="Revisión de pauta"
                total={modalAlerts.revisionPauta}
              />
            </div>

            <footer>
              <button className="secondary-action" type="button" onClick={() => setModalAlerts(null)}>
                Cerrar
              </button>
              <Link className="primary-action" href="/notificaciones" onClick={() => setModalAlerts(null)}>
                Ver notificaciones
              </Link>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}

function AlertBlock({
  className,
  label,
  total,
}: {
  className: "punctual" | "review";
  label: string;
  total: number;
}) {
  return (
    <article className={`critical-alert-block ${className}`}>
      <BellRing aria-hidden="true" size={20} strokeWidth={2} />
      <div>
        <span>{label}</span>
        <strong>{total}</strong>
        <small>defecto(s) nuevo(s) con criticidad Alta</small>
      </div>
    </article>
  );
}

async function fetchCriticalAlerts() {
  try {
    const response = await fetch("/api/alertas-criticas", {
      method: "POST",
      cache: "no-store",
    });

    if (!response.ok) return null;
    return (await response.json()) as CriticalAlertBatch;
  } catch {
    return null;
  }
}

function mergeAlerts(current: CriticalAlertBatch | null, next: CriticalAlertBatch): CriticalAlertBatch {
  if (!current) return next;

  return {
    defectoPuntual: current.defectoPuntual + next.defectoPuntual,
    revisionPauta: current.revisionPauta + next.revisionPauta,
    total: current.total + next.total,
  };
}
