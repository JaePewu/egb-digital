"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { SearchFeedback } from "../../_components/search-feedback";
import { saveRevisionPauta } from "./actions";

type BusData = {
  ppu: string;
  operadorNombre: string;
  chasisMarca: string | null;
  chasisModelo: string | null;
  carroceriaMarca: string | null;
  carroceriaModelo: string | null;
  tecnologia: string | null;
  tipoBus: string | null;
  anio: number | null;
} | null;

type PautaItem = {
  id: string;
  elemento: string;
  item: string;
  atributo: string;
  criterioEspecifico: string;
  criticidad: string;
};

type ItemReview = {
  resultado: "Cumple" | "No cumple";
  observacion: string;
  foto: boolean;
  video: boolean;
};

type RevisionPautaFormProps = {
  bus: BusData;
  error?: string;
  pautaItems: PautaItem[];
  ppu: string;
};

export function RevisionPautaForm({ bus, error, pautaItems, ppu }: RevisionPautaFormProps) {
  const [reviews, setReviews] = useState<Record<string, ItemReview>>({});
  const [clientError, setClientError] = useState("");

  const answered = Object.keys(reviews).length;
  const pending = Math.max(pautaItems.length - answered, 0);
  const percent = pautaItems.length ? Math.round((answered / pautaItems.length) * 100) : 0;
  const payload = Object.entries(reviews).map(([id, review]) => ({ id, ...review }));

  const noCumpleCount = useMemo(
    () => Object.values(reviews).filter((review) => review.resultado === "No cumple").length,
    [reviews],
  );

  function setResult(itemId: string, resultado: "Cumple" | "No cumple") {
    setClientError("");
    setReviews((current) => {
      const previous = current[itemId];
      return {
        ...current,
        [itemId]: {
          resultado,
          observacion: resultado === "No cumple" ? previous?.observacion ?? "" : "",
          foto: resultado === "No cumple" ? previous?.foto ?? false : false,
          video: resultado === "No cumple" ? previous?.video ?? false : false,
        },
      };
    });
  }

  function updateReview(itemId: string, patch: Partial<ItemReview>) {
    setReviews((current) => {
      const previous = current[itemId] ?? { resultado: "No cumple", observacion: "", foto: false, video: false };
      return {
        ...current,
        [itemId]: {
          ...previous,
          ...patch,
          resultado: previous.resultado,
        },
      };
    });
  }

  function validateSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!bus) {
      event.preventDefault();
      setClientError("Debe buscar y seleccionar un bus existente antes de guardar.");
      return;
    }

    if (pautaItems.length === 0) {
      event.preventDefault();
      setClientError("El bus seleccionado no tiene pauta aplicable.");
      return;
    }

    if (pending > 0) {
      event.preventDefault();
      setClientError(`Faltan ${pending} ítem(s) por responder antes de guardar.`);
    }
  }

  return (
    <div className="defect-flow">
      <section className="defect-card">
        <h2>1. Buscar bus por PPU</h2>
        <form className="defect-search" method="get">
          <input
            aria-label="PPU"
            defaultValue={ppu}
            name="ppu"
            placeholder="Ingrese PPU (ej. ABCD12)"
          />
          <button type="submit">
            <Search aria-hidden="true" size={20} strokeWidth={2} />
            <span>Buscar bus</span>
          </button>
        </form>
        {error ? (
          <SearchFeedback message={error} status="error" />
        ) : ppu && bus ? (
          <SearchFeedback message={`Bus ${bus.ppu} encontrado.`} status="success" />
        ) : ppu ? (
          <SearchFeedback message="No se encontró un bus con la PPU ingresada." status="empty" />
        ) : null}
      </section>

      {bus ? <BusSummary bus={bus} /> : null}

      {bus ? (
        <form action={saveRevisionPauta} className="defect-card" onSubmit={validateSubmit}>
          <input name="ppu" type="hidden" value={bus.ppu} />
          <input name="reviewedItems" type="hidden" value={JSON.stringify(payload)} />

          <div className="defect-section-title">
            <h2>2. Revisar ítems de la pauta</h2>
            <span>Total pauta: {pautaItems.length} ítems</span>
          </div>

          <div className="pauta-progress-panel">
            <div className="pauta-progress-metrics">
              <Metric label="Total ítems" value={pautaItems.length} />
              <Metric label="Respondidos" value={answered} />
              <Metric label="Pendientes" value={pending} />
              <Metric label="% completado" value={`${percent}%`} />
            </div>
            <div className="pauta-progress-copy">
              <strong>
                {answered} de {pautaItems.length} ítems respondidos
              </strong>
              <span>{noCumpleCount} ítem(s) marcado(s) como No cumple</span>
            </div>
            <div className="pauta-progress-bar" aria-label={`Progreso ${percent}%`}>
              <span style={{ width: `${percent}%` }} />
            </div>
          </div>

          {clientError ? <p className="defect-error">{clientError}</p> : null}

          {pautaItems.length === 0 ? (
            <div className="empty-state">El bus seleccionado no tiene ítems de pauta aplicables.</div>
          ) : (
            <div className="pauta-items-scroll">
              {pautaItems.map((item, index) => {
                const review = reviews[item.id];
                const isFailed = review?.resultado === "No cumple";

                return (
                  <article className="pauta-review-item" key={item.id}>
                    <div className="pauta-review-main">
                      <div className="pauta-review-number">{index + 1}</div>
                      <div className="pauta-review-copy">
                        <div className="pauta-review-title">
                          <span>{item.id}</span>
                          <strong>{item.item}</strong>
                        </div>
                        <dl>
                          <div>
                            <dt>Elemento</dt>
                            <dd>{item.elemento}</dd>
                          </div>
                          <div>
                            <dt>Atributo</dt>
                            <dd>{item.atributo}</dd>
                          </div>
                          <div>
                            <dt>Criticidad</dt>
                            <dd>{item.criticidad}</dd>
                          </div>
                        </dl>
                        <p>{item.criterioEspecifico}</p>
                      </div>
                      <div className="pauta-review-options" aria-label={`Resultado ${item.id}`}>
                        <button
                          className={review?.resultado === "Cumple" ? "selected complies" : ""}
                          type="button"
                          onClick={() => setResult(item.id, "Cumple")}
                        >
                          Cumple
                        </button>
                        <button
                          className={isFailed ? "selected fails" : ""}
                          type="button"
                          onClick={() => setResult(item.id, "No cumple")}
                        >
                          No cumple
                        </button>
                      </div>
                    </div>

                    {isFailed ? (
                      <div className="pauta-failure-panel">
                        <div className="observation-field">
                          <textarea
                            maxLength={200}
                            onChange={(event) => updateReview(item.id, { observacion: event.target.value })}
                            placeholder="Agregue una observación opcional..."
                            value={review.observacion}
                          />
                          <span>{review.observacion.length}/200</span>
                        </div>
                        <div className="evidence-actions">
                          <button
                            className={review.foto ? "evidence-active" : ""}
                            type="button"
                            onClick={() => updateReview(item.id, { foto: !review.foto })}
                          >
                            Agregar foto
                          </button>
                          <button
                            className={review.video ? "evidence-active" : ""}
                            type="button"
                            onClick={() => updateReview(item.id, { video: !review.video })}
                          >
                            Agregar video
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}

          <div className="defect-final-actions">
            <Link className="secondary-action" href="/inicio" onClick={() => setReviews({})}>
              Cancelar
            </Link>
            <button className="primary-action" type="submit">
              Guardar y enviar
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function BusSummary({ bus }: { bus: NonNullable<BusData> }) {
  return (
    <section className="defect-card bus-summary-card">
      <h2>Información del bus</h2>
      <dl className="bus-summary-grid">
        <div>
          <dt>PPU</dt>
          <dd>{bus.ppu}</dd>
        </div>
        <div>
          <dt>Operador</dt>
          <dd>{bus.operadorNombre}</dd>
        </div>
        <div>
          <dt>Chasis</dt>
          <dd>{joinParts(bus.chasisMarca, bus.chasisModelo)}</dd>
        </div>
        <div>
          <dt>Carrocería</dt>
          <dd>{joinParts(bus.carroceriaMarca, bus.carroceriaModelo)}</dd>
        </div>
        <div>
          <dt>Tecnología</dt>
          <dd>{bus.tecnologia ?? "Sin dato"}</dd>
        </div>
        <div>
          <dt>Tipo Bus</dt>
          <dd>{bus.tipoBus ?? "Sin dato"}</dd>
        </div>
        <div>
          <dt>Año</dt>
          <dd>{bus.anio ?? "Sin dato"}</dd>
        </div>
      </dl>
    </section>
  );
}

function joinParts(...parts: Array<string | null>) {
  return parts.filter(Boolean).join(" ") || "Sin dato";
}
