import { useState } from "react";
import { api, useAction, useLoad, money, stamp } from "../api";
import { Feedback, Notice, LoadState } from "./UI";

export function SlotFields({
  services,
  barbers,
  config,
  values,
  onChange,
  exclude = 0,
  refresh = 0,
}) {
  const eligible = barbers.filter(
    (b) => b.active && b.service_ids.includes(Number(values.service_id)),
  );
  const query =
    values.service_id && values.barber_id && values.date
      ? `${exclude ? "/admin" : ""}/availability?` +
        new URLSearchParams({
          service_id: values.service_id,
          barber_id: values.barber_id,
          date: values.date,
          ...(exclude ? { exclude } : {}),
        })
      : null;
  const slots = useLoad(query, refresh);
  return (
    <>
      <div className="form-grid">
        <label>
          Servicio
          <select
            aria-label="Servicio"
            required
            value={values.service_id}
            onChange={(e) =>
              onChange({
                ...values,
                service_id: e.target.value,
                barber_id: "",
                time: "",
              })
            }
          >
            <option value="">Elige tu servicio</option>
            {services
              .filter((s) => s.active)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.duration_minutes} min · {money(s.price)}
                </option>
              ))}
          </select>
        </label>
        <label>
          Barbero
          <select
            aria-label="Barbero"
            required
            value={values.barber_id}
            disabled={!values.service_id}
            onChange={(e) =>
              onChange({ ...values, barber_id: e.target.value, time: "" })
            }
          >
            <option value="">Elige tu barbero</option>
            {eligible.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {values.service_id && eligible.length === 0 && (
        <Notice error>No hay barberos disponibles para este servicio.</Notice>
      )}
      <label>
        Fecha
        <input
          required
          type="date"
          min={config.today}
          max={config.maxDate}
          value={values.date}
          onChange={(e) =>
            onChange({ ...values, date: e.target.value, time: "" })
          }
        />
      </label>
      <fieldset className="slots-field">
        <legend>Horarios disponibles</legend>
        {!query && (
          <p className="muted">
            Elige servicio, barbero y fecha para consultar la agenda.
          </p>
        )}
        {query && (
          <LoadState resource={slots}>
            {slots.data?.slots.length ? (
              <div className="slots">
                {slots.data.slots.map((time) => (
                  <button
                    type="button"
                    key={time}
                    aria-pressed={values.time === time}
                    className={values.time === time ? "slot selected" : "slot"}
                    onClick={() => onChange({ ...values, time })}
                  >
                    {time}
                  </button>
                ))}
              </div>
            ) : (
              <p className="empty">
                No quedan horarios disponibles para esta fecha. Prueba otro día
                o barbero.
              </p>
            )}
          </LoadState>
        )}
      </fieldset>
      <p className="hint">
        Hora de Ciudad de México. Reservas con hasta {config.bookingDays} días
        de anticipación.
      </p>
    </>
  );
}

export default function BookingForm() {
  const [refresh, setRefresh] = useState(0);
  const services = useLoad("/services");
  const barbers = useLoad("/barbers");
  const config = useLoad("/config");
  const [values, setValues] = useState({
    client_name: "",
    client_phone: "",
    service_id: "",
    barber_id: "",
    date: "",
    time: "",
  });
  const action = useAction();
  const selectedService = services.data?.find(
    (s) => s.id === Number(values.service_id),
  );
  const [confirmation, setConfirmation] = useState(null);
  function submit(e) {
    e.preventDefault();
    if (!values.time) return;
    action.run(
      async () => {
        try {
          return await api("/appointments", {
            method: "POST",
            body: { ...values, start_time: `${values.date}T${values.time}:00` },
          });
        } finally {
          setRefresh((x) => x + 1);
          setValues((v) => ({ ...v, time: "" }));
        }
      },
      (result) => {
        setConfirmation({
          ...result,
          service: selectedService.name,
          barber: barbers.data.find((b) => b.id === Number(values.barber_id))
            .name,
          price: selectedService.price,
        });
      },
    );
  }
  const error = services.error || barbers.error || config.error;
  if (error)
    return (
      <Notice error>
        {error}{" "}
        <button className="secondary" onClick={() => window.location.reload()}>
          Volver a intentar
        </button>
      </Notice>
    );
  if (!services.data || !barbers.data || !config.data)
    return (
      <p className="empty" role="status">
        Preparando tu próxima visita…
      </p>
    );
  if (confirmation)
    return (
      <section className="panel confirmation">
        <div className="confirmation-icon">✓</div>
        <p className="eyebrow">RESERVA #{confirmation.id}</p>
        <h1>Tu cita está confirmada.</h1>
        <p>
          {confirmation.service} con {confirmation.barber}
        </p>
        <p className="confirmation-date">
          {stamp(confirmation.start_time)}–{confirmation.end_time.slice(11, 16)}
        </p>
        <p>{money(confirmation.price)} · Hora de Ciudad de México</p>
        <p className="muted">
          Guarda tu número de reserva. Para cambiar o cancelar tu cita,
          comunícate con el administrador de la barbería.
        </p>
        <button
          onClick={() => {
            setConfirmation(null);
            setValues((v) => ({
              ...v,
              time: "",
              client_name: "",
              client_phone: "",
            }));
          }}
        >
          Reservar otra cita
        </button>
      </section>
    );
  return (
    <div className="booking-layout">
      <section className="intro">
        <p className="eyebrow">MALA VIDA BARBERS</p>
        <h1>
          Tu estilo.
          <br />
          <span>Tu momento.</span>
        </h1>
        <p>
          Elige tu servicio y encuentra un espacio con tu barbero. Nosotros nos
          encargamos del resto.
        </p>
        <div className="service-preview">
          {services.data.map((s) => (
            <div key={s.id}>
              <div>
                <strong>{s.name}</strong>
                <small>
                  {s.description || `${s.duration_minutes} minutos para ti`}
                </small>
              </div>
              <div className="service-price">
                {money(s.price)}
                <small>{s.duration_minutes} min</small>
              </div>
            </div>
          ))}
        </div>
        <p className="hint">
          Sin cuenta, sin complicaciones. Tu reserva se confirma al terminar.
        </p>
      </section>
      <section className="panel booking-panel">
        <p className="eyebrow">AGENDA TU VISITA</p>
        <h2>Reserva tu cita</h2>
        <form onSubmit={submit}>
          <fieldset disabled={action.busy} className="form-fields">
            <SlotFields
              services={services.data}
              barbers={barbers.data}
              config={config.data}
              values={values}
              onChange={setValues}
              refresh={refresh}
            />
            <div className="divider" />
            <div className="form-grid">
              <label>
                Nombre completo
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  value={values.client_name}
                  onChange={(e) =>
                    setValues({ ...values, client_name: e.target.value })
                  }
                />
              </label>
              <label>
                Teléfono
                <input
                  required
                  type="tel"
                  minLength={10}
                  maxLength={20}
                  autoComplete="tel"
                  value={values.client_phone}
                  onChange={(e) =>
                    setValues({ ...values, client_phone: e.target.value })
                  }
                />
              </label>
            </div>
            <p className="hint">
              Tus datos se usan para gestionar tu cita y solo son visibles para
              el administrador.
            </p>
            {values.time && (
              <div className="booking-summary">
                <strong>
                  {values.time} · {selectedService?.name}
                </strong>
                <span>{money(selectedService?.price || 0)}</span>
              </div>
            )}
            <Feedback action={action} />
            <button className="full" disabled={!values.time || action.busy}>
              {action.busy ? "Confirmando…" : "Confirmar reserva"}
            </button>
          </fieldset>
        </form>
      </section>
    </div>
  );
}
