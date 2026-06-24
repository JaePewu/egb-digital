"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { saveDefectoPuntual } from "./actions";

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

type SelectedDefect = PautaItem & {
  observacion: string;
  foto: boolean;
  video: boolean;
};

type DefectoPuntualFormProps = {
  bus: BusData;
  error?: string;
  pautaItems: PautaItem[];
  ppu: string;
};

export function DefectoPuntualForm({ bus, error, pautaItems, ppu }: DefectoPuntualFormProps) {
  const [query, setQuery] = useState("");
  const [elemento, setElemento] = useState("");
  const [atributo, setAtributo] = useState("");
  const [criticidad, setCriticidad] = useState("");
  const [selected, setSelected] = useState<SelectedDefect[]>([]);
  const [clientError, setClientError] = useState("");

  const elementos = useMemo(() => uniqueOptions(pautaItems.map((item) => item.elemento)), [pautaItems]);
  const atributos = useMemo(() => uniqueOptions(pautaItems.map((item) => item.atributo)), [pautaItems]);
  const criticidades = useMemo(() => uniqueOptions(pautaItems.map((item) => item.criticidad)), [pautaItems]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalize(query);

    return pautaItems.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        normalize(item.id).includes(normalizedQuery) ||
        normalize(item.elemento).includes(normalizedQuery) ||
        normalize(item.item).includes(normalizedQuery);

      return (
        matchesQuery &&
        (!elemento || item.elemento === elemento) &&
        (!atributo || item.atributo === atributo) &&
        (!criticidad || item.criticidad === criticidad)
      );
    });
  }, [atributo, criticidad, elemento, pautaItems, query]);

  const selectedIds = new Set(selected.map((item) => item.id));
  const payload = selected.map(({ id, observacion, foto, video }) => ({ id, observacion, foto, video }));

  function addItem(item: PautaItem) {
    setClientError("");
    setSelected((current) => {
      if (current.some((selectedItem) => selectedItem.id === item.id)) return current;
      return [...current, { ...item, observacion: "", foto: false, video: false }];
    });
  }

  function removeItem(id: string) {
    setSelected((current) => current.filter((item) => item.id !== id));
  }

  function updateItem(id: string, patch: Partial<SelectedDefect>) {
    setSelected((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function clearFilters() {
    setQuery("");
    setElemento("");
    setAtributo("");
    setCriticidad("");
  }

  function validateSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!bus) {
      event.preventDefault();
      setClientError("Debe buscar y seleccionar un bus existente antes de guardar.");
      return;
    }

    if (selected.length === 0) {
      event.preventDefault();
      setClientError("Debe seleccionar al menos un defecto antes de guardar.");
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
        {ppu && !bus ? <p className="defect-error">No se encontró un bus con la PPU ingresada.</p> : null}
        {error ? <p className="defect-error">{error}</p> : null}
      </section>

      {bus ? <BusSummary bus={bus} /> : null}

      {bus ? (
        <>
          <section className="defect-card">
            <div className="defect-section-title">
              <h2>2. Buscar y seleccionar defectos</h2>
              <span>Pauta aplicable: {pautaItems.length} ítems</span>
            </div>

            <div className="defect-filters">
              <input
                aria-label="Buscar pauta"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por ID, elemento o ítem"
                value={query}
              />
              <label>
                Elemento
                <select onChange={(event) => setElemento(event.target.value)} value={elemento}>
                  <option value="">Todos</option>
                  {elementos.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Atributo
                <select onChange={(event) => setAtributo(event.target.value)} value={atributo}>
                  <option value="">Todos</option>
                  {atributos.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Criticidad
                <select onChange={(event) => setCriticidad(event.target.value)} value={criticidad}>
                  <option value="">Todas</option>
                  {criticidades.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <button className="ghost-button" type="button" onClick={clearFilters}>
                Limpiar filtros
              </button>
            </div>

            <div className="table-wrap defect-table-wrap">
              <table className="defect-picker-table">
                <thead>
                  <tr>
                    <th>Selección</th>
                    <th>ID</th>
                    <th>Ítem</th>
                    <th>Atributo</th>
                    <th>Criterio específico</th>
                    <th>Criticidad</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={6}>No hay ítems para los filtros seleccionados.</td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <input
                            aria-label={`Seleccionar ${item.id}`}
                            checked={selectedIds.has(item.id)}
                            onChange={(event) => {
                              if (event.target.checked) {
                                addItem(item);
                              } else {
                                removeItem(item.id);
                              }
                            }}
                            type="checkbox"
                          />
                        </td>
                        <td>{item.id}</td>
                        <td>{item.item}</td>
                        <td>{item.atributo}</td>
                        <td>{item.criterioEspecifico}</td>
                        <td>{item.criticidad}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <form action={saveDefectoPuntual} className="defect-card" onSubmit={validateSubmit}>
            <input name="ppu" type="hidden" value={bus.ppu} />
            <input name="selectedDefects" type="hidden" value={JSON.stringify(payload)} />

            <div className="defect-section-title">
              <h2>3. Defectos seleccionados ({selected.length})</h2>
              <button className="link-button danger-link" type="button" onClick={() => setSelected([])}>
                Limpiar todos
              </button>
            </div>

            {clientError ? <p className="defect-error">{clientError}</p> : null}

            {selected.length === 0 ? (
              <div className="empty-state">Seleccione uno o más ítems de pauta para registrar defectos.</div>
            ) : (
              <div className="selected-defects-list">
                {selected.map((item, index) => (
                  <article className="selected-defect-card" key={item.id}>
                    <header>
                      <span>{index + 1}</span>
                      <div>
                        <h3>{item.item}</h3>
                        <p>{item.id} · {item.atributo}</p>
                      </div>
                      <strong>{item.criticidad}</strong>
                    </header>

                    <dl className="selected-defect-details">
                      <div>
                        <dt>ID</dt>
                        <dd>{item.id}</dd>
                      </div>
                      <div>
                        <dt>Atributo</dt>
                        <dd>{item.atributo}</dd>
                      </div>
                      <div className="wide">
                        <dt>Criterio específico</dt>
                        <dd>{item.criterioEspecifico}</dd>
                      </div>
                    </dl>

                    <div className="selected-defect-inputs">
                      <label className="observation-field">
                        Observación
                        <textarea
                          maxLength={200}
                          onChange={(event) => updateItem(item.id, { observacion: event.target.value })}
                          placeholder="Agregue una observación..."
                          value={item.observacion}
                        />
                        <span>{item.observacion.length}/200</span>
                      </label>

                      <div className="selected-defect-actions">
                        <span>Evidencia</span>
                        <div className="evidence-actions">
                          <button
                            className={item.foto ? "evidence-active" : ""}
                            type="button"
                            onClick={() => updateItem(item.id, { foto: !item.foto })}
                          >
                            Agregar foto
                          </button>
                          <button
                            className={item.video ? "evidence-active" : ""}
                            type="button"
                            onClick={() => updateItem(item.id, { video: !item.video })}
                          >
                            Agregar video
                          </button>
                        </div>
                        <button className="link-button danger-link" type="button" onClick={() => removeItem(item.id)}>
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <div className="defect-final-actions">
              <Link className="secondary-action" href="/inicio" onClick={() => setSelected([])}>
                Cancelar
              </Link>
              <button className="primary-action" type="submit">
                Guardar y enviar
              </button>
            </div>
          </form>
        </>
      ) : null}
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

function uniqueOptions(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "es"));
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function joinParts(...parts: Array<string | null>) {
  return parts.filter(Boolean).join(" ") || "Sin dato";
}
