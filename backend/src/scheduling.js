const d = require("./domain");
async function getContext(q, barberId, serviceId, day, exclude = 0) {
  const rows = await q(
    `SELECT s.duration_minutes FROM services s JOIN barber_services bs ON bs.service_id=s.id JOIN barbers b ON b.id=bs.barber_id WHERE s.id=? AND b.id=? AND s.active=1 AND b.active=1`,
    [serviceId, barberId],
  );
  if (!rows.length)
    d.fail(
      "El servicio o el barbero no están disponibles para esta combinación.",
    );
  const periods = await q(
    "SELECT start_time,end_time FROM working_hours WHERE barber_id=? AND weekday=? ORDER BY start_time",
    [barberId, d.weekday(day)],
  );
  const hours = [];
  for (const period of periods) {
    const previous = hours.at(-1);
    if (previous && period.start_time <= previous.end_time)
      previous.end_time =
        period.end_time > previous.end_time
          ? period.end_time
          : previous.end_time;
    else hours.push({ ...period });
  }
  const appointments = await q(
    "SELECT start_time,end_time FROM appointments WHERE barber_id=? AND id<>? AND status IN ('pending','confirmed') AND start_time < ? AND end_time > ?",
    [barberId, exclude, day + " 23:59:59", day + " 00:00:00"],
  );
  const blocks = await q(
    "SELECT start_time,end_time FROM blocks WHERE barber_id=? AND start_time < ? AND end_time > ?",
    [barberId, day + " 23:59:59", day + " 00:00:00"],
  );
  return {
    duration: rows[0].duration_minutes,
    hours,
    occupied: [...appointments, ...blocks],
  };
}
function fits(context, start, end) {
  const day = start.slice(0, 10);
  return (
    end.slice(0, 10) === day &&
    context.hours.some(
      (h) => start >= day + " " + h.start_time && end <= day + " " + h.end_time,
    ) &&
    !context.occupied.some((a) =>
      d.overlap(start, end, a.start_time, a.end_time),
    )
  );
}
async function availability(q, barberId, serviceId, day, exclude = 0) {
  d.validateBookingDate(day);
  const context = await getContext(q, barberId, serviceId, day, exclude);
  const slots = [];
  const current = d.now();
  for (const h of context.hours) {
    for (
      let start = day + " " + h.start_time;
      d.addMinutes(start, context.duration) <= day + " " + h.end_time;
      start = d.addMinutes(start, 10)
    ) {
      if (
        start > current &&
        fits(context, start, d.addMinutes(start, context.duration))
      )
        slots.push(start.slice(11, 16));
    }
  }
  return slots;
}
async function validateSlot(q, barberId, serviceId, rawStart, exclude = 0) {
  const start = d.timestamp(rawStart);
  d.validateBookingDate(start.slice(0, 10));
  if (start <= d.now())
    d.fail("El horario debe ser posterior a la hora actual.");
  const context = await getContext(
    q,
    barberId,
    serviceId,
    start.slice(0, 10),
    exclude,
  );
  const end = d.addMinutes(start, context.duration);
  if (!fits(context, start, end))
    d.fail(
      "Ese horario ya no está disponible o queda fuera de la jornada. Elige otro.",
      409,
    );
  return { start, end };
}
const appointmentSelect = `SELECT a.*,b.name AS barber_name,s.name AS service_name,
 EXISTS(SELECT 1 FROM blocks bl WHERE bl.barber_id=a.barber_id AND bl.start_time<a.end_time AND bl.end_time>a.start_time) AS blocked,
 (b.active=0 OR NOT EXISTS(SELECT 1 FROM working_hours w WHERE w.barber_id=a.barber_id AND w.weekday=DAYOFWEEK(a.start_time)-1 AND TIME(a.start_time)>=w.start_time AND TIME(a.end_time)<=w.end_time)) AS outside_schedule
 FROM appointments a JOIN barbers b ON b.id=a.barber_id JOIN services s ON s.id=a.service_id`;
async function event(q, id, action, detail) {
  await q(
    "INSERT INTO appointment_events (appointment_id,action,detail) VALUES (?,?,?)",
    [id, action, JSON.stringify(detail)],
  );
}
module.exports = { availability, validateSlot, appointmentSelect, event };
