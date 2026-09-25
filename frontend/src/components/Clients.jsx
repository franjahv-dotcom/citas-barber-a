import { useState } from "react";
import { api, useAction, useLoad } from "../api";
import { Feedback, LoadState, Modal, Pagination, AppointmentList } from "./UI";
function History({ client, onClose }) {
  const resource = useLoad(`/admin/clients/${client.id}/history`);
  return (
    <Modal title={`Historial de ${client.name}`} onClose={onClose}>
      <p className="muted">
        Cliente #{client.id} · {client.phone}
      </p>
      <LoadState resource={resource}>
        <AppointmentList items={resource.data} />
      </LoadState>
    </Modal>
  );
}
export function Clients() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [client, setClient] = useState(null);
  const resource = useLoad(
    "/admin/clients?" + new URLSearchParams({ search, page }),
  );
  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Clientes e historial</h2>
          <p className="muted">
            Consulta visitas anteriores sin confundir personas que comparten un
            teléfono.
          </p>
        </div>
      </div>
      <label className="compact-field">
        Buscar por nombre o teléfono
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Buscar cliente"
        />
      </label>
      <LoadState resource={resource}>
        <div className="catalog-grid">
          {resource.data?.items.map((c) => (
            <article className="panel" key={c.id}>
              <p className="eyebrow">CLIENTE #{c.id}</p>
              <h3>{c.name}</h3>
              <p>{c.phone}</p>
              <p className="muted">{c.appointments_count} citas registradas</p>
              <button className="secondary" onClick={() => setClient(c)}>
                Ver historial
              </button>
            </article>
          ))}
        </div>
        {!resource.data?.items.length && (
          <p className="empty">No se encontraron clientes.</p>
        )}
        <Pagination data={resource.data} onPage={setPage} />
      </LoadState>
      {client && <History client={client} onClose={() => setClient(null)} />}
    </section>
  );
}
export function Account({ onSignedOut }) {
  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    repeat: "",
  });
  const action = useAction();
  return (
    <section className="panel narrow">
      <h2>Cambiar contraseña</h2>
      <p className="muted">
        Usa al menos 12 caracteres. Al guardar se cerrarán todas las sesiones.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          action.run(async () => {
            if (form.new_password !== form.repeat)
              throw new Error("Las contraseñas nuevas no coinciden.");
            return api("/admin/password", { method: "POST", body: form });
          }, onSignedOut);
        }}
      >
        <fieldset className="form-fields" disabled={action.busy}>
          <label>
            Contraseña actual
            <input
              required
              type="password"
              autoComplete="current-password"
              value={form.current_password}
              onChange={(e) =>
                setForm({ ...form, current_password: e.target.value })
              }
            />
          </label>
          <label>
            Nueva contraseña
            <input
              required
              minLength={12}
              maxLength={200}
              type="password"
              autoComplete="new-password"
              value={form.new_password}
              onChange={(e) =>
                setForm({ ...form, new_password: e.target.value })
              }
            />
          </label>
          <label>
            Repetir nueva contraseña
            <input
              required
              type="password"
              autoComplete="new-password"
              value={form.repeat}
              onChange={(e) => setForm({ ...form, repeat: e.target.value })}
            />
          </label>
          <Feedback action={action} />
          <button disabled={action.busy}>
            {action.busy ? "Guardando…" : "Actualizar contraseña"}
          </button>
        </fieldset>
      </form>
    </section>
  );
}
