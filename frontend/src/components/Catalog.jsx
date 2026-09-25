import { useState } from "react";
import { api, useAction, money } from "../api";
import { Modal, Feedback } from "./UI";

function ServiceEditor({ item, onClose, onSaved }) {
  const [form, setForm] = useState(
    item || {
      name: "",
      description: "",
      duration_minutes: 40,
      price: 250,
      active: true,
    },
  );
  const action = useAction();
  const change = (key, value) => setForm({ ...form, [key]: value });
  return (
    <Modal
      title={item ? "Editar servicio" : "Nuevo servicio"}
      onClose={onClose}
      busy={action.busy}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          action.run(
            () =>
              api("/admin/services" + (item ? "/" + item.id : ""), {
                method: item ? "PUT" : "POST",
                body: { ...form, active: Boolean(form.active) },
              }),
            onSaved,
          );
        }}
      >
        <fieldset disabled={action.busy} className="form-fields">
          <label>
            Nombre
            <input
              required
              minLength={2}
              maxLength={100}
              value={form.name}
              onChange={(e) => change("name", e.target.value)}
            />
          </label>
          <label>
            Descripción
            <textarea
              maxLength={500}
              value={form.description}
              onChange={(e) => change("description", e.target.value)}
            />
          </label>
          <div className="form-grid">
            <label>
              Duración en minutos
              <input
                required
                type="number"
                min={5}
                max={480}
                value={form.duration_minutes}
                onChange={(e) => change("duration_minutes", e.target.value)}
              />
            </label>
            <label>
              Precio en MXN
              <input
                required
                type="number"
                min={0}
                max={999999.99}
                step="0.01"
                value={form.price}
                onChange={(e) => change("price", e.target.value)}
              />
            </label>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={Boolean(form.active)}
              onChange={(e) => change("active", e.target.checked)}
            />
            Disponible para nuevas reservas
          </label>
          <p className="hint">
            Los cambios no alteran los intervalos de las citas ya reservadas. Al
            crear un servicio, asígnalo a los barberos que lo ofrecen.
          </p>
          <Feedback action={action} />
          <button disabled={action.busy}>
            {action.busy ? "Guardando…" : "Guardar servicio"}
          </button>
        </fieldset>
      </form>
    </Modal>
  );
}
function BarberEditor({ item, services, onClose, onSaved }) {
  const [form, setForm] = useState(
    item || { name: "", active: true, service_ids: [] },
  );
  const action = useAction();
  return (
    <Modal
      title={item ? "Editar barbero" : "Nuevo barbero"}
      onClose={onClose}
      busy={action.busy}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          action.run(
            () =>
              api("/admin/barbers" + (item ? "/" + item.id : ""), {
                method: item ? "PUT" : "POST",
                body: { ...form, active: Boolean(form.active) },
              }),
            onSaved,
          );
        }}
      >
        <fieldset disabled={action.busy} className="form-fields">
          <label>
            Nombre
            <input
              required
              minLength={2}
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <fieldset className="choice-list">
            <legend>Servicios que realiza</legend>
            {services.map((s) => (
              <label className="check" key={s.id}>
                <input
                  type="checkbox"
                  checked={form.service_ids.includes(s.id)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      service_ids: e.target.checked
                        ? [...form.service_ids, s.id]
                        : form.service_ids.filter((id) => id !== s.id),
                    })
                  }
                />
                {s.name}
                {!s.active ? " (inactivo)" : ""}
              </label>
            ))}
          </fieldset>
          <label className="check">
            <input
              type="checkbox"
              checked={Boolean(form.active)}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Barbero activo
          </label>
          <p className="hint">
            Desactivar conserva sus citas. Las que necesiten resolución
            aparecerán señaladas en la agenda.
          </p>
          <Feedback action={action} />
          <button disabled={action.busy}>
            {action.busy ? "Guardando…" : "Guardar barbero"}
          </button>
        </fieldset>
      </form>
    </Modal>
  );
}
export default function Catalog({ kind, catalog, onChanged }) {
  const [editor, setEditor] = useState(null);
  const [result, setResult] = useState(null);
  const isService = kind === "services";
  const items = isService ? catalog.services : catalog.barbers;
  const saved = (value) => {
    setResult(value);
    setEditor(null);
    onChanged();
  };
  return (
    <section>
      <div className="section-head">
        <div>
          <h2>{isService ? "Servicios" : "Equipo de barberos"}</h2>
          <p className="muted">
            {isService
              ? "Precios y duraciones claros para cada visita."
              : "Define quién atiende y qué servicios ofrece."}
          </p>
        </div>
        <button onClick={() => setEditor({ item: null })}>
          {isService ? "+ Nuevo servicio" : "+ Nuevo barbero"}
        </button>
      </div>
      <Feedback action={{ result }} />
      <div className="catalog-grid">
        {items.map((item) => (
          <article className="panel" key={item.id}>
            <div className="card-head">
              <h3>{item.name}</h3>
              <span
                className={`badge ${item.active ? "confirmed" : "cancelled"}`}
              >
                {item.active ? "Activo" : "Inactivo"}
              </span>
            </div>
            {isService ? (
              <>
                <p className="muted">{item.description}</p>
                <p className="catalog-price">
                  {money(item.price)}{" "}
                  <small>· {item.duration_minutes} min</small>
                </p>
              </>
            ) : (
              <p className="muted">
                {item.service_ids
                  .map((id) => catalog.services.find((s) => s.id === id)?.name)
                  .filter(Boolean)
                  .join(" · ") || "Sin servicios asignados"}
              </p>
            )}
            <button className="secondary" onClick={() => setEditor({ item })}>
              Editar
            </button>
          </article>
        ))}
      </div>
      {editor &&
        (isService ? (
          <ServiceEditor
            item={editor.item}
            onClose={() => setEditor(null)}
            onSaved={saved}
          />
        ) : (
          <BarberEditor
            item={editor.item}
            services={catalog.services}
            onClose={() => setEditor(null)}
            onSaved={saved}
          />
        ))}
    </section>
  );
}
