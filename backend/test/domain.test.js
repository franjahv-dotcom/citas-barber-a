const { test } = require("node:test");
const assert = require("node:assert/strict");
const d = require("../src/domain");
test("Valida fechas reales y rechaza fechas imposibles o con zona horaria ambigua", () => {
  assert.equal(d.date("2028-02-29"), "2028-02-29");
  for (const value of ["2026-02-29", "2026-13-01", "2026-04-31", "ayer"])
    assert.throws(() => d.date(value));
  assert.equal(d.timestamp("2026-10-01T10:30"), "2026-10-01 10:30:00");
  assert.throws(() => d.timestamp("2026-10-01T10:30:00Z"));
});
test("Los intervalos adyacentes no son cruces; los cruces parciales y completos sí", () => {
  assert.equal(d.overlap("10:00", "10:40", "10:40", "11:00"), false);
  assert.equal(d.overlap("10:00", "10:40", "10:30", "11:00"), true);
  assert.equal(d.overlap("10:00", "12:00", "10:30", "11:00"), true);
});
test("Normaliza teléfonos sin usarlos como identidad única y valida valores", () => {
  assert.equal(d.phone("+52 (55) 1234-5678"), "525512345678");
  assert.throws(() => d.phone("123"));
  assert.throws(() => d.phone("abcdefghij"));
  assert.throws(() => d.integer("1 OR 1=1"));
  assert.throws(() => d.boolean("false"));
});
test("La aritmética civil conserva minutos y cambia el día correctamente", () => {
  assert.equal(d.addMinutes("2026-12-31 23:40:00", 40), "2027-01-01 00:20:00");
  assert.equal(d.weekday("2026-09-27"), 0);
});
