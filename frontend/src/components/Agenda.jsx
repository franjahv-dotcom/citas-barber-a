import { useState } from "react";
import { api, useAction, useLoad, stamp, statuses } from "../api";
import { Modal, Feedback, LoadState, StateBadge, Pagination } from "./UI";
import { SlotFields } from "./BookingForm";

function Reschedule({ appointment, catalog, config, onClose, onSaved }) {
  const [values, setValues] = useState({
    service_id: String(appointment.service_id),
    barber_id: String(appointment.barber_id),
    date: appointment.start_time.slice(0, 10),
    time: "",
  });
  const [refresh, setRefresh] = useState(0);
  const action = useAction();
  return (
    <Modal
      title={`Reprogramar cita #${appointment.id}`}
      onClose={onClose}
      busy={action.busy}
    >
      <p className="muted">
        {appointment.client_name} · Actual: {stamp(appointment.start_time)}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          action.run(async () => {
            try {
              return await api(
                `/admin/appointments/${appointment.id}/reschedule`,
                {
                  method: "PUT",
                  body: {
                    ...values,
                    start_time: `${values.date}T${values.time}:00`,
                  },
                },
              );
            } finally {
              setRefresh((x) => x + 1);
              setValues((v) => ({ ...v, time: "" }));
            }
          }, onSaved);
        }}
      >
        <fieldset disabled={action.busy} className="form-fields">
          <SlotFields
            services={catalog.services}
            barbers={catalog.barbers}
            config={config}
            values={values}
            onChange={setValues}
            exclude={appointment.id}
            refresh={refresh}
          />
          <Feedback action={action} />
          <button className="full" disabled={!values.time || action.busy}>
            {action.busy ? "Guardando…" : "Guardar nuevo horario"}
          </button>
        </fieldset>
      </form>
    </Modal>
  );
}
function Events({ appointment, onClose }) {
  const events = useLoad(`/admin/appointments/${appointment.id}/events`);
  return (
    <Modal title={`Movimientos de cita #${appointment.id}`} onClose={onClose}>
      <LoadState resource={events}>
        <div className="history-list">
          {events.data?.length ? (
            events.data.map((item) => {
              const detail = JSON.parse(item.detail);
              return (
                <article key={item.id}>
                  <div>
                    <strong>
                      {
                        {
                          created: "Reserva creada",
                          rescheduled: "Cita reprogramada",
                          status: "Cambio de estado",
                        }[item.action]
                      }
                    </strong>
                    <p>
                      {item.action === "status"
                        ? `${statuses[detail.previous]} → ${statuses[detail.next]}`
                        : item.action === "rescheduled"
                          ? `${stamp(detail.previous.start_time)} → ${stamp(detail.next.start_time)}`
                          : stamp(detail.start)}
                    </p>
                    <small className="muted">
                      {detail.admin
                        ? `Por ${detail.admin}`
                        : "Reserva del cliente"}
                    </small>
                  </div>
                </article>
              );
            })
          ) : (
            <p className="empty">
              Sin movimientos registrados. Las citas anteriores a la
              actualización mantienen sus datos.
            </p>
          )}
        </div>
      </LoadState>
    </Modal>
  );
}
export default function Agenda({ catalog, config }) {
  const [filters, setFilters] = useState({
    date: config.today,
    barber_id: "",
    status: "",
    search: "",
    page: 1,
  });
  const [refresh, setRefresh] = useState(0);
  const resource = useLoad(
    "/admin/appointments?" + new URLSearchParams(filters),
    refresh,
  );
  const [edit, setEdit] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [events, setEvents] = useState(null);
  const action = useAction();
  const filter = (key, value) =>
    setFilters({ ...filters, [key]: value, page: 1 });
  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Agenda de citas</h2>
          <p className="muted">
            Organiza el día y resuelve los cambios de tus clientes.
          </p>
        </div>
        <button className="secondary" onClick={() => setRefresh((x) => x + 1)}>
          Actualizar
        </button>
      </div>
      <div className="panel filters">
        <label>
          Fecha
          <input
            type="date"
            value={filters.date}
            onChange={(e) => filter("date", e.target.value)}
          />
        </label>
        <label>
          Barbero
          <select
            aria-label="Barbero"
            value={filters.barber_id}
            onChange={(e) => filter("barber_id", e.target.value)}
          >
            <option value="">Todos</option>
            {catalog.barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {!b.active ? " (inactivo)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estado
          <select
            aria-label="Estado"
            value={filters.status}
            onChange={(e) => filter("status", e.target.value)}
          >
            <option value="">Todos</option>
            {Object.entries(statuses).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Buscar cliente
          <input
            type="search"
            placeholder="Nombre o teléfono"
            value={filters.search}
            onChange={(e) => filter("search", e.target.value)}
          />
        </label>
        <button
          className="secondary"
          onClick={() =>
            setFilters({
              date: "",
              barber_id: "",
              status: "",
              search: "",
              page: 1,
            })
          }
        >
          Ver todas
        </button>
      </div>
      <Feedback action={action} />
      <LoadState resource={resource}>
        <p className="muted">
          {resource.data?.total || 0} citas encontradas · Horarios de Ciudad de
          México
        </p>
        <div className="appointment-grid">
          {resource.data?.items.map((a) => (
            <article className="panel appointment-card" key={a.id}>
              <div className="card-head">
                <span className="eyebrow">CITA #{a.id}</span>
                <StateBadge value={a.status} />
              </div>
              <h3>{a.client_name}</h3>
              <a className="phone" href={`tel:${a.client_phone}`}>
                {a.client_phone}
              </a>
              <p className="appointment-time">
                {stamp(a.start_time)}–{a.end_time.slice(11, 16)}
              </p>
              <p>
                {a.service_name} <span className="muted">con</span>{" "}
                {a.barber_name}
              </p>
              {["pending", "confirmed"].includes(a.status) &&
                Boolean(a.blocked || a.outside_schedule) && (
                  <div className="notice warning">
                    Requiere atención:{" "}
                    {a.blocked
                      ? "coincide con un bloqueo."
                      : "fuera de jornada o barbero inactivo."}{" "}
                    Reprograma o cancela esta cita.
                  </div>
                )}
              <div className="actions">
                {["pending", "confirmed"].includes(a.status) && (
                  <>
                    <button className="secondary" onClick={() => setEdit(a)}>
                      Reprogramar
                    </button>
                    <button
                      className="danger"
                      onClick={() =>
                        setConfirm({ appointment: a, status: "cancelled" })
                      }
                    >
                      Cancelar cita
                    </button>
                  </>
                )}
                {a.status === "pending" && (
                  <button
                    className="secondary"
                    onClick={() =>
                      setConfirm({ appointment: a, status: "confirmed" })
                    }
                  >
                    Confirmar
                  </button>
                )}
                {a.status === "confirmed" && (
                  <>
                    <button
                      className="secondary"
                      onClick={() =>
                        setConfirm({ appointment: a, status: "completed" })
                      }
                    >
                      Completada
                    </button>
                    <button
                      className="secondary"
                      onClick={() =>
                        setConfirm({ appointment: a, status: "no_show" })
                      }
                    >
                      No asistió
                    </button>
                  </>
                )}
                <button className="text-button" onClick={() => setEvents(a)}>
                  Ver movimientos
                </button>
              </div>
            </article>
          ))}
        </div>
        {resource.data?.items.length === 0 && (
          <div className="panel empty">No hay citas con estos filtros.</div>
        )}
        <Pagination
          data={resource.data}
          onPage={(page) => setFilters({ ...filters, page })}
        />
      </LoadState>
      {edit && (
        <Reschedule
          appointment={edit}
          catalog={catalog}
          config={config}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            setRefresh((x) => x + 1);
          }}
        />
      )}
      {confirm && (
        <Modal
          title={`Cambiar cita #${confirm.appointment.id}`}
          onClose={() => setConfirm(null)}
          busy={action.busy}
        >
          <p>
            La cita de <strong>{confirm.appointment.client_name}</strong>{" "}
            quedará como <strong>{statuses[confirm.status]}</strong>.
          </p>
          {confirm.status === "cancelled" && (
            <p className="muted">
              Se liberará el horario y se conservará el historial.
            </p>
          )}
          <Feedback action={action} />
          <div className="actions">
            <button
              disabled={action.busy}
              onClick={() =>
                action.run(
                  () =>
                    api(
                      `/admin/appointments/${confirm.appointment.id}/status`,
                      { method: "PATCH", body: { status: confirm.status } },
                    ),
                  () => {
                    setConfirm(null);
                    setRefresh((x) => x + 1);
                  },
                )
              }
            >
              {action.busy ? "Guardando…" : "Confirmar cambio"}
            </button>
            <button
              className="secondary"
              disabled={action.busy}
              onClick={() => setConfirm(null)}
            >
              Volver
            </button>
          </div>
        </Modal>
      )}
      {events && (
        <Events appointment={events} onClose={() => setEvents(null)} />
      )}
    </section>
  );
}
