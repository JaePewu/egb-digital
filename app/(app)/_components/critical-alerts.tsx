"use client";

import Link from "next/link";
import { BellRing, BusFront, CalendarClock, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CriticalAlertBatch, CriticalAlertItem } from "@/lib/critical-alerts";

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
            className="critical-alert-modal critical-alert-modal-detailed"
            role="dialog"
            aria-modal="true"
            aria-labelledby="critical-alert-title"
          >
            <header>
              <div>
                <BellRing aria-hidden="true" size={20} strokeWidth={2} />
                <div>
                  <h2 id="critical-alert-title">Nuevas alertas de criticidad Alta</h2>
                  <p>Se detectaron inspecciones nuevas que requieren atención prioritaria.</p>
                </div>
              </div>
              <button type="button" aria-label="Cerrar alerta" onClick={() => setModalAlerts(null)}>
                <X aria-hidden="true" size={20} strokeWidth={2} />
              </button>
            </header>

            <div className="critical-alert-blocks">
              <AlertBlock className="punctual" label="Defectos puntuales" total={modalAlerts.defectoPuntual} />
              <AlertBlock className="review" label="Revisión de pauta" total={modalAlerts.revisionPauta} />
            </div>

            <div className="critical-alert-detail-list">
              {modalAlerts.alertas.map((alerta) => (
                <AlertDetail key={alerta.inspeccionId} alerta={alerta} />
              ))}
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

function AlertBlock({ className, label, total }: { className: "punctual" | "review"; label: string; total: number }) {
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

function AlertDetail({ alerta }: { alerta: CriticalAlertItem }) {
  const review = alerta.tipoInspeccion === "Revision de pauta";
  return (
    <article className={`critical-alert-detail ${review ? "review" : "punctual"}`}>
      <header>
        <div>
          <BellRing aria-hidden="true" size={18} strokeWidth={2} />
          <strong>{review ? "Revisión de pauta" : "Defectos puntuales"}</strong>
        </div>
        <Link href={`/historial/${alerta.inspeccionId}`}>Ver inspección</Link>
      </header>
      <dl>
        <div>
          <dt><BusFront aria-hidden="true" size={15} /> PPU</dt>
          <dd>{alerta.ppu}</dd>
        </div>
        <div>
          <dt>Operador</dt>
          <dd>{alerta.operador}</dd>
        </div>
        <div>
          <dt><CalendarClock aria-hidden="true" size={15} /> Fecha y hora</dt>
          <dd>{alerta.fecha} · {alerta.hora}</dd>
        </div>
        <div>
          <dt>Efecto</dt>
          <dd>{alerta.efecto}</dd>
        </div>
      </dl>
      <div className="critical-alert-defects">
        <strong>Defectos de criticidad Alta ({alerta.defectosAlta.length})</strong>
        <ul>
          {alerta.defectosAlta.map((defecto) => (
            <li key={defecto.id}>
              <span>{defecto.elemento} · {defecto.item}</span>
              <small>{defecto.criterio}</small>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

async function fetchCriticalAlerts() {
  try {
    const response = await fetch("/api/alertas-criticas", { method: "POST", cache: "no-store" });
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
    alertas: [...current.alertas, ...next.alertas],
  };
}
