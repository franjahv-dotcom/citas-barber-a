import { useState } from "react";
import { api, useAction, useLoad, stamp } from "../api";
import { Feedback, LoadState, Modal } from "./UI";
const days = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
function HoursEditor({ barberId, initial, onSaved }) {
  const [hours, setHours] = useState(
    initial.map((h) => ({
      weekday: h.weekday,
      start_time: h.start_time.slice(0, 5),
      end_time: h.end_time.slice(0, 5),
    })),
  );
  const action = useAction();
  const change = (index, key, value) =>
    setHours(hours.map((h, i) => (i === index ? { ...h, [key]: value } : h)));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        action.run(
          () =>
            api(`/admin/barbers/${barberId}/hours`, {
              method: "PUT",
              body: { hours },
            }),
          onSaved,
        );
      }}
    >
      <fieldset disabled={action.busy} className="form-fields">
        <div className="week-grid">
          {days.map((day, weekday) => (
            <section className="day-row" key={day}>
              <div className="day-title">
                <strong>{day}</strong>
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setHours([
                      ...hours,
                      { weekday, start_time: "10:00", end_time: "14:00" },
                    ])
                  }
                >
                  + Periodo
                </button>
              </div>
              {hours.filter((h) => h.weekday === weekday).length === 0 && (
                <p className="muted">Día de descanso</p>
              )}
              {hours.map(
                (h, i) =>
                  h.weekday === weekday && (
                    <div className="period" key={i}>
                      <label>
                        Desde
                        <input
                          required
                          type="time"
                          value={h.start_time}
                          onChange={(e) =>
                            change(i, "start_time", e.target.value)
                          }
                        />
                      </label>
                      <label>
                        Hasta
                        <input
                          required
                          type="time"
                          value={h.end_time}
                          onChange={(e) =>
                            change(i, "end_time", e.target.value)
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Eliminar periodo de ${day}`}
                        onClick={() =>
                          setHours(hours.filter((_, index) => index !== i))
                        }
                      >
                        ×
                      </button>
                    </div>
                  ),
              )}
            </section>
          ))}
        </div>
        <Feedback action={action} />
        <button disabled={action.busy}>
          {action.busy ? "Guardando…" : "Guardar jornada"}
        </button>
      </fieldset>
    </form>
  );
}
export function Schedules({ catalog }) {
  const [barber, setBarber] = useState(String(catalog.barbers[0]?.id || ""));
  const resource = useLoad(barber ? `/admin/barbers/${barber}/hours` : null);
  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Jornadas y descansos</h2>
          <p className="muted">
            Cada periodo permite citas completas. Los espacios entre periodos
            quedan libres para descansar.
          </p>
        </div>
      </div>
      <div className="panel">
        <label className="compact-field">
          Barbero
          <select
            aria-label="Barbero"
            value={barber}
            onChange={(e) => setBarber(e.target.value)}
          >
            {catalog.barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <p className="hint">
          Ejemplo: 10:00–14:00 y 15:00–20:00 deja un descanso de 14:00 a 15:00.
          Sin periodos, el día permanece cerrado.
        </p>
        <LoadState resource={resource}>
          {resource.data && (
            <HoursEditor
              key={barber}
              barberId={barber}
              initial={resource.data}
            />
          )}
        </LoadState>
      </div>
    </section>
  );
}
export function Blocks({ catalog, config }) {
  const [refresh, setRefresh] = useState(0);
  const resource = useLoad("/admin/blocks", refresh);
  const [form, setForm] = useState({
    barber_id: String(catalog.barbers[0]?.id || ""),
    start_time: "",
    end_time: "",
    reason: "",
  });
  const [remove, setRemove] = useState(null);
  const action = useAction();
  const deletion = useAction();
  const change = (key, value) => setForm({ ...form, [key]: value });
  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Bloqueos y ausencias</h2>
          <p className="muted">
            Reserva tiempo para vacaciones, imprevistos o actividades del
            negocio.
          </p>
        </div>
      </div>
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          action.run(
            () => api("/admin/blocks", { method: "POST", body: form }),
            () => {
              setRefresh((x) => x + 1);
              setForm({ ...form, start_time: "", end_time: "", reason: "" });
            },
          );
        }}
      >
        <fieldset disabled={action.busy} className="form-fields">
          <div className="form-grid three">
            <label>
              Barbero
              <select
                aria-label="Barbero"
                required
                value={form.barber_id}
                onChange={(e) => change("barber_id", e.target.value)}
              >
                {catalog.barbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Inicio
              <input
                required
                type="datetime-local"
                min={config.today + "T00:00"}
                value={form.start_time}
                onChange={(e) => change("start_time", e.target.value)}
              />
            </label>
            <label>
              Fin
              <input
                required
                type="datetime-local"
                min={form.start_time || config.today + "T00:00"}
                value={form.end_time}
                onChange={(e) => change("end_time", e.target.value)}
              />
            </label>
          </div>
          <label>
            Motivo
            <input
              required
              minLength={3}
              maxLength={250}
              placeholder="Por ejemplo: cita médica"
              value={form.reason}
              onChange={(e) => change("reason", e.target.value)}
            />
          </label>
          <button disabled={action.busy}>
            {action.busy ? "Guardando…" : "Crear bloqueo"}
          </button>
          <Feedback action={action} />
        </fieldset>
      </form>
      <LoadState resource={resource}>
        <div className="history-list panel">
          {resource.data?.length ? (
            resource.data.map((b) => (
              <article key={b.id}>
                <div>
                  <strong>
                    {b.barber_name} · {b.reason}
                  </strong>
                  <p>
                    {stamp(b.start_time)} → {stamp(b.end_time)}
                  </p>
                </div>
                <button className="danger" onClick={() => setRemove(b)}>
                  Eliminar
                </button>
              </article>
            ))
          ) : (
            <p className="empty">No hay bloqueos registrados.</p>
          )}
        </div>
      </LoadState>
      {remove && (
        <Modal
          title="Eliminar bloqueo"
          onClose={() => setRemove(null)}
          busy={deletion.busy}
        >
          <p>
            Se habilitará nuevamente este intervalo si la jornada y las citas lo
            permiten.
          </p>
          <p>
            <strong>{remove.reason}</strong> · {remove.barber_name}
          </p>
          <Feedback action={deletion} />
          <button
            disabled={deletion.busy}
            onClick={() =>
              deletion.run(
                () => api(`/admin/blocks/${remove.id}`, { method: "DELETE" }),
                () => {
                  setRemove(null);
                  setRefresh((x) => x + 1);
                },
              )
            }
          >
            {deletion.busy ? "Eliminando…" : "Confirmar eliminación"}
          </button>
        </Modal>
      )}
    </section>
  );
}
