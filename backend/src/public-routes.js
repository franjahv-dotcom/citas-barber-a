const { Router } = require("express");
const { query, transaction } = require("./db");
const d = require("./domain");
const s = require("./scheduling");
const { rateLimit } = require("./auth");
const config = require("./config");
const router = Router();
router.get("/health", async (req, res) => {
  await query("SELECT 1");
  res.json({ status: "ok" });
});
router.get("/config", (req, res) =>
  res.json({
    today: d.now().slice(0, 10),
    maxDate: d.horizon(),
    timeZone: config.timeZone,
    bookingDays: config.bookingDays,
  }),
);
router.get("/services", async (req, res) =>
  res.json(await query("SELECT * FROM services WHERE active=1 ORDER BY name")),
);
router.get("/barbers", async (req, res) => {
  const rows = await query(
    "SELECT * FROM barbers WHERE active=1 ORDER BY name",
  );
  const links = await query("SELECT * FROM barber_services");
  res.json(
    rows.map((b) => ({
      ...b,
      service_ids: links
        .filter((l) => l.barber_id === b.id)
        .map((l) => l.service_id),
    })),
  );
});
router.get("/availability", async (req, res) => {
  res.json({
    slots: await s.availability(
      query,
      d.integer(req.query.barber_id),
      d.integer(req.query.service_id),
      req.query.date,
    ),
  });
});
router.post("/appointments", rateLimit(60, 60000), async (req, res) => {
  const name = d.text(req.body.client_name, "Nombre", 100, 2);
  const phone = d.phone(req.body.client_phone);
  const barberId = d.integer(req.body.barber_id);
  const serviceId = d.integer(req.body.service_id);
  const result = await transaction(async (q) => {
    const { start, end } = await s.validateSlot(
      q,
      barberId,
      serviceId,
      req.body.start_time,
    );
    const clients = await q(
      "SELECT id FROM clients WHERE name=? AND phone=? ORDER BY id LIMIT 1",
      [name, phone],
    );
    const clientId =
      clients[0]?.id ||
      (await q("INSERT INTO clients (name,phone) VALUES (?,?)", [name, phone]))
        .insertId;
    const { insertId } = await q(
      "INSERT INTO appointments (client_id,client_name,client_phone,barber_id,service_id,start_time,end_time) VALUES (?,?,?,?,?,?,?)",
      [clientId, name, phone, barberId, serviceId, start, end],
    );
    await s.event(q, insertId, "created", { start, end });
    return {
      id: insertId,
      start_time: start,
      end_time: end,
      message: "Cita confirmada",
    };
  });
  res.status(201).json(result);
});
module.exports = router;
