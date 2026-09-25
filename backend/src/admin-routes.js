const { Router } = require("express");
const crypto = require("node:crypto");
const { query, transaction } = require("./db");
const d = require("./domain");
const s = require("./scheduling");
const auth = require("./auth");
const router = Router();
router.post("/login", auth.rateLimit(10, 15 * 60000), async (req, res) => {
  const username = d.text(req.body.username, "Usuario", 60);
  const password = req.body.password;
  if (typeof password !== "string" || password.length > 200)
    d.fail("Credenciales no válidas.", 401);
  const users = await query("SELECT * FROM admins WHERE username=?", [
    username,
  ]);
  if (
    !users.length ||
    !(await auth.verifyPassword(password, users[0].password_hash))
  )
    d.fail("Usuario o contraseña incorrectos.", 401);
  const token = crypto.randomBytes(32).toString("hex");
  await query(
    "INSERT INTO admin_sessions (token_hash,admin_id,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))",
    [auth.tokenHash(token), users[0].id],
  );
  res
    .cookie(auth.cookieName, token, auth.cookieOptions)
    .json({ username: users[0].username });
});
router.use(auth.requireAdmin);
router.get("/me", (req, res) => res.json(req.admin));
router.post("/logout", async (req, res) => {
  await query("DELETE FROM admin_sessions WHERE token_hash=?", [
    auth.tokenHash(auth.cookieToken(req)),
  ]);
  res
    .clearCookie(auth.cookieName, { ...auth.cookieOptions, maxAge: undefined })
    .json({ message: "Sesión cerrada." });
});
router.post("/password", async (req, res) => {
  const { current_password: current, new_password: password } = req.body;
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 200
  )
    d.fail("La nueva contraseña debe tener entre 12 y 200 caracteres.");
  if (typeof current !== "string" || current.length > 200)
    d.fail("Contraseña actual incorrecta.", 401);
  const [user] = await query("SELECT password_hash FROM admins WHERE id=?", [
    req.admin.id,
  ]);
  if (!(await auth.verifyPassword(current, user.password_hash)))
    d.fail("Contraseña actual incorrecta.", 400);
  const hash = await auth.hashPassword(password);
  await transaction(async (q) => {
    await q("UPDATE admins SET password_hash=? WHERE id=?", [
      hash,
      req.admin.id,
    ]);
    await q("DELETE FROM admin_sessions WHERE admin_id=?", [req.admin.id]);
  });
  res
    .clearCookie(auth.cookieName, { ...auth.cookieOptions, maxAge: undefined })
    .json({ message: "Contraseña actualizada. Inicia sesión nuevamente." });
});
router.get("/catalog", async (req, res) => {
  const services = await query("SELECT * FROM services ORDER BY name");
  const links = await query("SELECT * FROM barber_services");
  const barbers = (await query("SELECT * FROM barbers ORDER BY name")).map(
    (b) => ({
      ...b,
      service_ids: links
        .filter((l) => l.barber_id === b.id)
        .map((l) => l.service_id),
    }),
  );
  res.json({ services, barbers });
});
async function saveService(req, res) {
  const name = d.text(req.body.name, "Nombre", 100, 2);
  const description = d.text(req.body.description ?? "", "Descripción", 500, 0);
  const duration = d.integer(req.body.duration_minutes, "Duración", 5, 480);
  const price = Number(req.body.price);
  if (
    !/^\d+(\.\d{1,2})?$/.test(String(req.body.price)) ||
    !Number.isFinite(price) ||
    price < 0 ||
    price > 999999.99
  )
    d.fail("Precio no válido.");
  const active = d.boolean(req.body.active);
  const id = await transaction(async (q) => {
    if (req.params.id) {
      const id = d.integer(req.params.id);
      if (!(await q("SELECT id FROM services WHERE id=?", [id])).length)
        d.fail("Servicio no encontrado.", 404);
      await q(
        "UPDATE services SET name=?,description=?,duration_minutes=?,price=?,active=? WHERE id=?",
        [name, description, duration, price, active, id],
      );
      return id;
    }
    return (
      await q(
        "INSERT INTO services (name,description,duration_minutes,price,active) VALUES (?,?,?,?,?)",
        [name, description, duration, price, active],
      )
    ).insertId;
  });
  res
    .status(req.params.id ? 200 : 201)
    .json({
      id,
      message: "Servicio guardado. Las citas existentes conservan su duración.",
    });
}
router.post("/services", saveService);
router.put("/services/:id", saveService);
async function saveBarber(req, res) {
  const name = d.text(req.body.name, "Nombre", 100, 2);
  const active = d.boolean(req.body.active);
  if (!Array.isArray(req.body.service_ids) || req.body.service_ids.length > 100)
    d.fail("Selecciona los servicios del barbero.");
  const services = [...new Set(req.body.service_ids.map((x) => d.integer(x)))];
  if (active && !services.length)
    d.fail("Un barbero activo debe ofrecer al menos un servicio.");
  const id = await transaction(async (q) => {
    for (const service of services)
      if (!(await q("SELECT id FROM services WHERE id=?", [service])).length)
        d.fail("Servicio no encontrado.");
    let id;
    if (req.params.id) {
      id = d.integer(req.params.id);
      if (!(await q("SELECT id FROM barbers WHERE id=?", [id])).length)
        d.fail("Barbero no encontrado.", 404);
      await q("UPDATE barbers SET name=?,active=? WHERE id=?", [
        name,
        active,
        id,
      ]);
      await q("DELETE FROM barber_services WHERE barber_id=?", [id]);
    } else
      id = (
        await q("INSERT INTO barbers (name,active) VALUES (?,?)", [
          name,
          active,
        ])
      ).insertId;
    for (const service of services)
      await q(
        "INSERT INTO barber_services (barber_id,service_id) VALUES (?,?)",
        [id, service],
      );
    return id;
  });
  const affected = !active
    ? await query(
        s.appointmentSelect +
          " WHERE a.barber_id=? AND a.status IN ('pending','confirmed') AND a.end_time>?",
        [id, d.now()],
      )
    : [];
  res
    .status(req.params.id ? 200 : 201)
    .json({
      id,
      affected,
      message: req.params.id
        ? "Barbero guardado."
        : "Barbero creado. Configura su jornada para habilitar reservas.",
    });
}
router.post("/barbers", saveBarber);
router.put("/barbers/:id", saveBarber);
router.get("/barbers/:id/hours", async (req, res) =>
  res.json(
    await query(
      "SELECT * FROM working_hours WHERE barber_id=? ORDER BY weekday,start_time",
      [d.integer(req.params.id)],
    ),
  ),
);
router.put("/barbers/:id/hours", async (req, res) => {
  const id = d.integer(req.params.id);
  if (!Array.isArray(req.body.hours) || req.body.hours.length > 28)
    d.fail("Jornada no válida.");
  const hours = req.body.hours.map((h) => ({
    weekday: d.integer(h.weekday, "Día", 0, 6),
    start: d.time(h.start_time),
    end: d.time(h.end_time),
  }));
  for (let i = 0; i < hours.length; i++) {
    const h = hours[i];
    if (h.start >= h.end)
      d.fail("Cada periodo debe terminar después de su inicio.");
    if (
      hours.some(
        (b, j) =>
          i !== j &&
          b.weekday === h.weekday &&
          d.overlap(h.start, h.end, b.start, b.end),
      )
    )
      d.fail("Los periodos de una jornada no deben cruzarse.");
  }
  const affected = await transaction(async (q) => {
    if (!(await q("SELECT id FROM barbers WHERE id=?", [id])).length)
      d.fail("Barbero no encontrado.", 404);
    await q("DELETE FROM working_hours WHERE barber_id=?", [id]);
    for (const h of hours)
      await q(
        "INSERT INTO working_hours (barber_id,weekday,start_time,end_time) VALUES (?,?,?,?)",
        [id, h.weekday, h.start, h.end],
      );
    return q(
      s.appointmentSelect +
        " WHERE a.barber_id=? AND a.status IN ('pending','confirmed') AND a.end_time>? HAVING outside_schedule=1",
      [id, d.now()],
    );
  });
  res.json({
    message: "Jornada guardada. Los espacios entre periodos son descansos.",
    affected,
  });
});
router.get("/blocks", async (req, res) =>
  res.json(
    await query(
      "SELECT bl.*,b.name AS barber_name FROM blocks bl JOIN barbers b ON b.id=bl.barber_id ORDER BY bl.start_time DESC",
    ),
  ),
);
router.post("/blocks", async (req, res) => {
  const barber = d.integer(req.body.barber_id);
  const start = d.timestamp(req.body.start_time);
  const end = d.timestamp(req.body.end_time);
  const reason = d.text(req.body.reason, "Motivo", 250, 3);
  if (end <= start || end <= d.now())
    d.fail(
      "El bloqueo debe tener un intervalo válido y terminar en el futuro.",
    );
  const result = await transaction(async (q) => {
    if (!(await q("SELECT id FROM barbers WHERE id=?", [barber])).length)
      d.fail("Barbero no encontrado.");
    const { insertId } = await q(
      "INSERT INTO blocks (barber_id,start_time,end_time,reason) VALUES (?,?,?,?)",
      [barber, start, end, reason],
    );
    const affected = await q(
      s.appointmentSelect +
        " WHERE a.barber_id=? AND a.status IN ('pending','confirmed') AND a.start_time<? AND a.end_time>?",
      [barber, end, start],
    );
    return {
      id: insertId,
      affected,
      message:
        "Bloqueo creado. Las citas existentes se conservan para que puedas resolverlas.",
    };
  });
  res.status(201).json(result);
});
router.delete("/blocks/:id", async (req, res) => {
  await transaction(async (q) => {
    if (
      !(await q("DELETE FROM blocks WHERE id=?", [d.integer(req.params.id)]))
        .affectedRows
    )
      d.fail("Bloqueo no encontrado.", 404);
  });
  res.json({ message: "Bloqueo eliminado." });
});
router.get("/appointments", async (req, res) => {
  const where = ["1=1"];
  const params = [];
  if (req.query.date) {
    where.push("a.start_time>=? AND a.start_time<?");
    const day = d.date(req.query.date);
    params.push(day + " 00:00:00", d.addMinutes(day + " 00:00:00", 1440));
  }
  if (req.query.barber_id) {
    where.push("a.barber_id=?");
    params.push(d.integer(req.query.barber_id));
  }
  if (req.query.status) {
    if (
      !["pending", "confirmed", "completed", "cancelled", "no_show"].includes(
        req.query.status,
      )
    )
      d.fail("Estado no válido.");
    where.push("a.status=?");
    params.push(req.query.status);
  }
  if (req.query.search) {
    const search = d.text(req.query.search, "Búsqueda", 100);
    where.push("(a.client_name LIKE ? OR a.client_phone LIKE ?)");
    params.push("%" + search + "%", "%" + search + "%");
  }
  const page = d.integer(req.query.page || 1, "Página", 1, 100000);
  const [{ total }] = await query(
    "SELECT COUNT(*) AS total FROM appointments a WHERE " + where.join(" AND "),
    params,
  );
  const items = await query(
    s.appointmentSelect +
      " WHERE " +
      where.join(" AND ") +
      ` ORDER BY a.start_time DESC,a.id DESC LIMIT 30 OFFSET ${(page - 1) * 30}`,
    params,
  );
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / 30)) });
});
router.get("/availability", async (req, res) =>
  res.json({
    slots: await s.availability(
      query,
      d.integer(req.query.barber_id),
      d.integer(req.query.service_id),
      req.query.date,
      req.query.exclude ? d.integer(req.query.exclude) : 0,
    ),
  }),
);
router.put("/appointments/:id/reschedule", async (req, res) => {
  const id = d.integer(req.params.id);
  const result = await transaction(async (q) => {
    const [old] = await q("SELECT * FROM appointments WHERE id=?", [id]);
    if (!old) d.fail("Cita no encontrada.", 404);
    if (!["pending", "confirmed"].includes(old.status))
      d.fail("Solo puedes reprogramar citas pendientes o confirmadas.", 409);
    const barber = d.integer(req.body.barber_id);
    const service = d.integer(req.body.service_id);
    const { start, end } = await s.validateSlot(
      q,
      barber,
      service,
      req.body.start_time,
      id,
    );
    await q(
      "UPDATE appointments SET barber_id=?,service_id=?,start_time=?,end_time=? WHERE id=?",
      [barber, service, start, end, id],
    );
    await s.event(q, id, "rescheduled", {
      admin: req.admin.username,
      previous: {
        barber_id: old.barber_id,
        service_id: old.service_id,
        start_time: old.start_time,
        end_time: old.end_time,
      },
      next: {
        barber_id: barber,
        service_id: service,
        start_time: start,
        end_time: end,
      },
    });
    return { message: "Cita reprogramada.", start_time: start, end_time: end };
  });
  res.json(result);
});
router.patch("/appointments/:id/status", async (req, res) => {
  const id = d.integer(req.params.id);
  const status = req.body.status;
  await transaction(async (q) => {
    const [old] = await q("SELECT * FROM appointments WHERE id=?", [id]);
    if (!old) d.fail("Cita no encontrada.", 404);
    const allowed = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["completed", "cancelled", "no_show"],
    };
    if (!allowed[old.status]?.includes(status))
      d.fail("Este cambio de estado no está permitido.", 409);
    if (status === "completed" && old.end_time > d.now())
      d.fail(
        "No puedes completar una cita antes de su hora de finalización.",
        409,
      );
    if (status === "no_show" && old.start_time > d.now())
      d.fail("No puedes registrar una ausencia antes de la cita.", 409);
    await q("UPDATE appointments SET status=? WHERE id=?", [status, id]);
    await s.event(q, id, "status", {
      admin: req.admin.username,
      previous: old.status,
      next: status,
    });
  });
  res.json({ message: "Estado actualizado." });
});
router.get("/appointments/:id/events", async (req, res) =>
  res.json(
    await query(
      "SELECT * FROM appointment_events WHERE appointment_id=? ORDER BY id",
      [d.integer(req.params.id)],
    ),
  ),
);
router.get("/clients", async (req, res) => {
  const search = d.text(req.query.search || "", "Búsqueda", 100, 0);
  const page = d.integer(req.query.page || 1, "Página", 1, 100000);
  const params = ["%" + search + "%", "%" + search + "%"];
  const [{ total }] = await query(
    "SELECT COUNT(*) total FROM clients WHERE name LIKE ? OR phone LIKE ?",
    params,
  );
  const items = await query(
    `SELECT c.*, (SELECT COUNT(*) FROM appointments a WHERE a.client_id=c.id) AS appointments_count FROM clients c WHERE c.name LIKE ? OR c.phone LIKE ? ORDER BY c.name,c.id LIMIT 30 OFFSET ${(page - 1) * 30}`,
    params,
  );
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / 30)) });
});
router.get("/clients/:id/history", async (req, res) =>
  res.json(
    await query(
      s.appointmentSelect + " WHERE a.client_id=? ORDER BY a.start_time DESC",
      [d.integer(req.params.id)],
    ),
  ),
);
module.exports = router;
