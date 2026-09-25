const config = require("./config");

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (message, status = 400) => {
  throw new HttpError(status, message);
};
function text(value, label, max = 100, min = 1) {
  if (typeof value !== "string") fail(`${label}: escribe un texto válido.`);
  const result = value.trim().replace(/\s+/g, " ");
  if (result.length < min || result.length > max)
    fail(`${label}: entre ${min} y ${max} caracteres.`);
  return result;
}
function integer(value, label = "Identificador", min = 1, max = 2147483647) {
  if (
    !/^[0-9]+$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < min ||
    Number(value) > max
  )
    fail(`${label} no válido.`);
  return Number(value);
}
function boolean(value) {
  if (![true, false, 1, 0].includes(value)) fail("Estado activo no válido.");
  return Boolean(value);
}
function phone(value) {
  const result = text(value, "Teléfono", 20, 7);
  if (!/^\+?[\d ()-]+$/.test(result))
    fail("El teléfono solo admite números, espacios, +, paréntesis y guiones.");
  const digits = result.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15)
    fail("El teléfono debe contener entre 10 y 15 dígitos.");
  return digits;
}
function date(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    fail("Fecha no válida.");
  const parsed = new Date(value + "T00:00:00Z");
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    fail("Fecha no válida.");
  return value;
}
function time(value) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    fail("Hora no válida.");
  return value;
}
function timestamp(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:00)?$/.test(value)
  )
    fail("Usa una fecha y hora local válida, con precisión de minutos.");
  return `${date(value.slice(0, 10))} ${time(value.slice(11, 16))}:00`;
}
function now() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: config.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
function addMinutes(value, minutes) {
  // Civil arithmetic: MySQL DATETIME and all public times use Mexico City wall time.
  return new Date(
    new Date(value.replace(" ", "T") + "Z").getTime() + minutes * 60000,
  )
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}
function horizon() {
  return addMinutes(now(), config.bookingDays * 1440).slice(0, 10);
}
function validateBookingDate(value) {
  date(value);
  if (value < now().slice(0, 10))
    fail("No se puede reservar en una fecha pasada.");
  if (value > horizon())
    fail(
      `Puedes reservar con hasta ${config.bookingDays} días de anticipación.`,
    );
}
function overlap(a, b, c, d) {
  return a < d && b > c;
}
const weekday = (value) => new Date(date(value) + "T12:00:00Z").getUTCDay();
module.exports = {
  HttpError,
  fail,
  text,
  integer,
  boolean,
  phone,
  date,
  time,
  timestamp,
  now,
  addMinutes,
  horizon,
  validateBookingDate,
  overlap,
  weekday,
};
