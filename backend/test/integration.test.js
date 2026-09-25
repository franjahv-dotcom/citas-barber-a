const { test } = require("node:test");
const assert = require("node:assert/strict");
const mysql = require("mysql2/promise");
const crypto = require("node:crypto");
const path = require("node:path");
const fs = require("node:fs/promises");

test(
  "Integración con MySQL real y recorridos en navegador",
  { timeout: 240000 },
  async (t) => {
    const config = require("../src/config");
    const database = "barberia_test_" + crypto.randomBytes(6).toString("hex");
    const {
      database: originalDatabase,
      connectionLimit,
      ...connectionConfig
    } = config.db;
    const root = await mysql.createConnection(connectionConfig);
    await root.query(
      `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await root.end();
    t.diagnostic(`Base de prueba aislada: ${database}`);
    config.db.database = database;
    process.env.ADMIN_USERNAME = "qaadmin";
    process.env.ADMIN_PASSWORD = "Pruebas-Seguras-2026!";
    const { initialize } = require("../src/init");
    const { pool, query } = require("../src/db");
    let server;
    t.after(async () => {
      if (server) await new Promise((resolve) => server.close(resolve));
      await pool.end();
      // Only this randomly named, freshly created test database can be removed.
      assert.match(database, /^barberia_test_[a-f0-9]{12}$/);
      const cleanup = await mysql.createConnection(connectionConfig);
      try {
        await cleanup.query(`DROP DATABASE \`${database}\``);
      } finally {
        await cleanup.end();
      }
    });
    await initialize();
    const app = require("../src/app");
    server = await new Promise((resolve) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    let cookie = "";
    async function request(
      url,
      { method = "GET", body, admin = false, headers = {} } = {},
    ) {
      const response = await fetch(base + "/api" + url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "barberia",
          ...(admin ? { Cookie: cookie } : {}),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return {
        status: response.status,
        data: await response.json(),
        cookie: response.headers.get("set-cookie"),
      };
    }
    const d = require("../src/domain");
    const day = (offset) =>
      d
        .addMinutes(d.now().slice(0, 10) + " 00:00:00", offset * 1440)
        .slice(0, 10);
    const login = await request("/admin/login", {
      method: "POST",
      body: { username: "qaadmin", password: process.env.ADMIN_PASSWORD },
    });
    assert.equal(login.status, 200);
    cookie = login.cookie.split(";")[0];
    const catalog = (await request("/admin/catalog", { admin: true })).data;
    const service = catalog.services.find((s) => s.name === "Corte Clásico");
    const allHours = Array.from({ length: 7 }, (_, weekday) => [
      { weekday, start_time: "10:00", end_time: "14:00" },
      { weekday, start_time: "15:00", end_time: "20:00" },
    ]).flat();
    const createBarber = async (name) => {
      const result = await request("/admin/barbers", {
        method: "POST",
        admin: true,
        body: { name, active: true, service_ids: [service.id] },
      });
      assert.equal(result.status, 201);
      assert.equal(
        (
          await request(`/admin/barbers/${result.data.id}/hours`, {
            method: "PUT",
            admin: true,
            body: { hours: allHours },
          })
        ).status,
        200,
      );
      return result.data.id;
    };
    const barber = await createBarber("QA Barbero");
    const otherBarber = await createBarber("QA Segundo");
    const booking = (offset = 1, time = "10:00", overrides = {}) => ({
      client_name: "Cliente de prueba",
      client_phone: "5512345678",
      barber_id: barber,
      service_id: service.id,
      start_time: `${day(offset)}T${time}:00`,
      ...overrides,
    });
    const reserve = (body) =>
      request("/appointments", { method: "POST", body });
    const slots = (offset, barberId = barber) =>
      request(
        "/availability?" +
          new URLSearchParams({
            barber_id: barberId,
            service_id: service.id,
            date: day(offset),
          }),
      );
    let first;
    await t.test(
      "Protege agenda, clientes y configuración sin sesión; cookie HttpOnly y SameSite",
      async () => {
        for (const url of [
          "/appointments",
          "/admin/appointments",
          "/admin/clients",
          "/admin/catalog",
          "/admin/blocks",
        ])
          assert.equal((await request(url)).status, 401);
        assert.match(login.cookie, /HttpOnly/i);
        assert.match(login.cookie, /SameSite=Strict/i);
        assert.equal(
          (
            await request("/admin/login", {
              method: "POST",
              body: { username: "qaadmin", password: "incorrecta" },
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await request("/appointments", {
              method: "POST",
              body: booking(),
              headers: { "X-Requested-With": "" },
            })
          ).status,
          403,
        );
      },
    );
    await t.test(
      "Catálogo público no expone clientes; disponibilidad descuenta descansos y duración",
      async () => {
        const result = await slots(1);
        assert.equal(result.status, 200);
        assert.ok(result.data.slots.includes("10:00"));
        assert.ok(result.data.slots.includes("13:20"));
        assert.ok(!result.data.slots.includes("13:30"));
        assert.ok(!result.data.slots.includes("14:00"));
        assert.ok(!result.data.slots.includes("19:30"));
        assert.ok(!JSON.stringify(result.data).includes("client_phone"));
      },
    );
    await t.test(
      "Reserva válida, persistencia y rechazo de cruce parcial; permite límite adyacente",
      async () => {
        first = await reserve(booking());
        assert.equal(first.status, 201);
        assert.equal(first.data.end_time, day(1) + " 10:40:00");
        assert.equal((await reserve(booking(1, "10:30"))).status, 409);
        assert.equal((await reserve(booking(1, "10:40"))).status, 201);
        assert.ok(!(await slots(1)).data.slots.includes("10:00"));
        const [saved] = await query("SELECT * FROM appointments WHERE id=?", [
          first.data.id,
        ]);
        assert.equal(saved.client_phone, "5512345678");
      },
    );
    await t.test(
      "Veinte reservas simultáneas generan exactamente una cita",
      async () => {
        const results = await Promise.all(
          Array.from({ length: 20 }, () => reserve(booking(2))),
        );
        assert.equal(results.filter((r) => r.status === 201).length, 1);
        assert.equal(results.filter((r) => r.status === 409).length, 19);
        const [{ n }] = await query(
          "SELECT COUNT(*) n FROM appointments WHERE barber_id=? AND start_time=?",
          [barber, day(2) + " 10:00:00"],
        );
        assert.equal(n, 1);
      },
    );
    await t.test(
      "Distintos barberos pueden atender a la misma hora",
      async () =>
        assert.equal(
          (await reserve(booking(1, "10:00", { barber_id: otherBarber })))
            .status,
          201,
        ),
    );
    await t.test(
      "Valida teléfono obligatorio, fecha pasada, fecha imposible, jornada y anticipación",
      async () => {
        for (const overrides of [
          { client_phone: "" },
          { client_phone: "abc" },
          { client_name: " " },
          { start_time: "2020-01-01T10:00:00" },
          { start_time: "2026-02-30T10:00:00" },
          { start_time: day(91) + "T10:00:00" },
          { service_id: 999999 },
          { barber_id: 999999 },
        ])
          assert.equal(
            (await reserve(booking(3, "10:00", overrides))).status,
            400,
          );
        for (const time of ["09:00", "13:40", "14:00", "19:40"])
          assert.equal((await reserve(booking(3, time))).status, 409);
      },
    );
    await t.test(
      "Una reprogramación rechazada mantiene intacta la cita original; una válida conserva su ID",
      async () => {
        const url = `/admin/appointments/${first.data.id}/reschedule`;
        const failed = await request(url, {
          method: "PUT",
          admin: true,
          body: booking(1, "10:50"),
        });
        assert.equal(failed.status, 409);
        assert.equal(
          (
            await query("SELECT start_time FROM appointments WHERE id=?", [
              first.data.id,
            ])
          )[0].start_time,
          day(1) + " 10:00:00",
        );
        assert.equal(
          (
            await request(url, {
              method: "PUT",
              admin: true,
              body: booking(1, "12:00"),
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await query("SELECT start_time FROM appointments WHERE id=?", [
              first.data.id,
            ])
          )[0].start_time,
          day(1) + " 12:00:00",
        );
        const events = await request(
          `/admin/appointments/${first.data.id}/events`,
          { admin: true },
        );
        assert.equal(events.data.length, 2);
      },
    );
    await t.test(
      "Bloqueo señala citas afectadas sin borrarlas e impide nuevas reservas",
      async () => {
        const result = await request("/admin/blocks", {
          method: "POST",
          admin: true,
          body: {
            barber_id: barber,
            start_time: day(1) + "T12:00",
            end_time: day(1) + "T14:00",
            reason: "Ausencia programada",
          },
        });
        assert.equal(result.status, 201);
        assert.equal(result.data.affected.length, 1);
        assert.equal(result.data.affected[0].id, first.data.id);
        assert.equal((await reserve(booking(1, "13:00"))).status, 409);
        const list = await request("/admin/appointments?date=" + day(1), {
          admin: true,
        });
        assert.equal(
          list.data.items.find((a) => a.id === first.data.id).blocked,
          1,
        );
        assert.equal(
          (
            await request(`/admin/blocks/${result.data.id}`, {
              method: "DELETE",
              admin: true,
            })
          ).status,
          200,
        );
        assert.ok((await slots(1)).data.slots.includes("13:00"));
      },
    );
    await t.test(
      "Cancelación conserva historial, libera espacio y no permite reactivar una cita cerrada",
      async () => {
        const url = `/admin/appointments/${first.data.id}/status`;
        assert.equal(
          (
            await request(url, {
              method: "PATCH",
              admin: true,
              body: { status: "cancelled" },
            })
          ).status,
          200,
        );
        assert.ok((await slots(1)).data.slots.includes("12:00"));
        assert.equal(
          (
            await request(url, {
              method: "PATCH",
              admin: true,
              body: { status: "confirmed" },
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await query("SELECT status FROM appointments WHERE id=?", [
              first.data.id,
            ])
          )[0].status,
          "cancelled",
        );
      },
    );
    await t.test(
      "No completa citas futuras ni marca ausencias antes de hora; procesa citas pasadas",
      async () => {
        const result = await reserve(booking(3));
        for (const status of ["completed", "no_show"])
          assert.equal(
            (
              await request(`/admin/appointments/${result.data.id}/status`, {
                method: "PATCH",
                admin: true,
                body: { status },
              })
            ).status,
            409,
          );
        await query(
          "UPDATE appointments SET start_time=?,end_time=? WHERE id=?",
          [day(-1) + " 10:00:00", day(-1) + " 10:40:00", result.data.id],
        );
        assert.equal(
          (
            await request(`/admin/appointments/${result.data.id}/status`, {
              method: "PATCH",
              admin: true,
              body: { status: "completed" },
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await request(`/admin/appointments/${result.data.id}/status`, {
              method: "PATCH",
              admin: true,
              body: { status: "cancelled" },
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      "Nombre y teléfono identifican coincidencias; teléfonos compartidos conservan clientes distintos",
      async () => {
        assert.equal(
          (await reserve(booking(4, "10:00", { client_name: "Otra Persona" })))
            .status,
          201,
        );
        const result = await request("/admin/clients?search=5512345678", {
          admin: true,
        });
        assert.equal(result.data.total, 2);
        const client = result.data.items.find(
          (c) => c.name === "Cliente de prueba",
        );
        const history = await request(`/admin/clients/${client.id}/history`, {
          admin: true,
        });
        assert.ok(history.data.some((a) => a.status === "cancelled"));
        assert.ok(history.data.some((a) => a.status === "completed"));
      },
    );
    await t.test(
      "Cambio de duración preserva intervalos reservados; servicio inactivo desaparece y no se acepta por API",
      async () => {
        const saved = (
          await query("SELECT end_time FROM appointments WHERE id=?", [
            first.data.id,
          ])
        )[0].end_time;
        assert.equal(
          (
            await request(`/admin/services/${service.id}`, {
              method: "PUT",
              admin: true,
              body: { ...service, duration_minutes: 60, active: false },
            })
          ).status,
          200,
        );
        assert.ok(
          !(await request("/services")).data.some((s) => s.id === service.id),
        );
        assert.equal((await reserve(booking(5))).status, 400);
        assert.equal(
          (
            await query("SELECT end_time FROM appointments WHERE id=?", [
              first.data.id,
            ])
          )[0].end_time,
          saved,
        );
        assert.equal(
          (
            await request(`/admin/services/${service.id}`, {
              method: "PUT",
              admin: true,
              body: { ...service, active: true },
            })
          ).status,
          200,
        );
      },
    );
    await t.test(
      "Barbero inactivo conserva sus citas y rechaza nuevas; solo ofrece servicios asignados",
      async () => {
        const otherService = catalog.services.find((s) => s.id !== service.id);
        assert.equal(
          (await reserve(booking(5, "10:00", { service_id: otherService.id })))
            .status,
          400,
        );
        const result = await request(`/admin/barbers/${barber}`, {
          method: "PUT",
          admin: true,
          body: {
            name: "QA Barbero",
            active: false,
            service_ids: [service.id],
          },
        });
        assert.equal(result.status, 200);
        assert.ok(result.data.affected.length > 0);
        assert.equal((await reserve(booking(5))).status, 400);
        await request(`/admin/barbers/${barber}`, {
          method: "PUT",
          admin: true,
          body: { name: "QA Barbero", active: true, service_ids: [service.id] },
        });
      },
    );
    await t.test(
      "Jornadas cruzadas se rechazan; cambiar jornadas señala citas afectadas sin eliminarlas",
      async () => {
        const url = `/admin/barbers/${barber}/hours`;
        assert.equal(
          (
            await request(url, {
              method: "PUT",
              admin: true,
              body: {
                hours: [
                  { weekday: 1, start_time: "10:00", end_time: "14:00" },
                  { weekday: 1, start_time: "13:00", end_time: "16:00" },
                ],
              },
            })
          ).status,
          400,
        );
        const result = await request(url, {
          method: "PUT",
          admin: true,
          body: { hours: [] },
        });
        assert.equal(result.status, 200);
        assert.ok(result.data.affected.length > 0);
        assert.deepEqual((await slots(6)).data.slots, []);
        assert.equal(
          (
            await request(url, {
              method: "PUT",
              admin: true,
              body: { hours: allHours },
            })
          ).status,
          200,
        );
      },
    );
    await t.test(
      "Filtra agenda por fecha, barbero, nombre y estado; paginación validada",
      async () => {
        const result = await request(
          "/admin/appointments?" +
            new URLSearchParams({
              date: day(1),
              barber_id: barber,
              status: "cancelled",
              search: "Cliente",
            }),
          { admin: true },
        );
        assert.equal(result.data.total, 1);
        assert.equal(result.data.items[0].id, first.data.id);
        assert.equal(
          (await request("/admin/appointments?page=-1", { admin: true }))
            .status,
          400,
        );
      },
    );
    await t.test(
      "Periodos adyacentes forman una jornada continua; bloqueos de varios días se respetan",
      async () => {
        await request(`/admin/barbers/${otherBarber}/hours`, {
          method: "PUT",
          admin: true,
          body: {
            hours: [
              {
                weekday: d.weekday(day(7)),
                start_time: "10:00",
                end_time: "11:00",
              },
              {
                weekday: d.weekday(day(7)),
                start_time: "11:00",
                end_time: "13:00",
              },
            ],
          },
        });
        assert.ok((await slots(7, otherBarber)).data.slots.includes("10:40"));
        const block = await request("/admin/blocks", {
          method: "POST",
          admin: true,
          body: {
            barber_id: otherBarber,
            start_time: day(6) + "T18:00",
            end_time: day(8) + "T12:00",
            reason: "Ausencia de varios días",
          },
        });
        assert.equal(block.status, 201);
        assert.deepEqual((await slots(7, otherBarber)).data.slots, []);
        await request(`/admin/blocks/${block.data.id}`, {
          method: "DELETE",
          admin: true,
        });
        await request(`/admin/barbers/${otherBarber}/hours`, {
          method: "PUT",
          admin: true,
          body: { hours: allHours },
        });
      },
    );
    await t.test(
      "Solicitudes de reserva y bloqueo concurrentes mantienen una agenda consistente",
      async () => {
        const results = await Promise.all([
          reserve(booking(8)),
          request("/admin/blocks", {
            method: "POST",
            admin: true,
            body: {
              barber_id: barber,
              start_time: day(8) + "T10:00",
              end_time: day(8) + "T11:00",
              reason: "Bloqueo concurrente",
            },
          }),
        ]);
        assert.equal(results[1].status, 201);
        if (results[0].status === 201)
          assert.ok(
            results[1].data.affected.some((a) => a.id === results[0].data.id),
          );
        else assert.equal(results[0].status, 409);
        assert.ok(!(await slots(8)).data.slots.includes("10:00"));
      },
    );
    await t.test(
      "Consultas habituales responden en menos de dos segundos en la carga de prueba local",
      async () => {
        const measurements = [];
        for (let i = 0; i < 20; i++) {
          const start = performance.now();
          assert.equal((await slots(9)).status, 200);
          measurements.push(performance.now() - start);
        }
        measurements.sort((a, b) => a - b);
        t.diagnostic(
          `Disponibilidad, 20 consultas secuenciales locales: mediana ${measurements[10].toFixed(1)} ms, máximo ${measurements.at(-1).toFixed(1)} ms.`,
        );
        assert.ok(measurements.at(-1) < 2000);
      },
    );
    await t.test(
      "Consultas parametrizadas no interpretan búsquedas como SQL",
      async () => {
        assert.equal(
          (
            await request(
              "/admin/clients?search=" + encodeURIComponent("' OR 1=1 --"),
              { admin: true },
            )
          ).data.total,
          0,
        );
        assert.equal(
          (await reserve(booking(6, "10:00", { barber_id: "1 OR 1=1" })))
            .status,
          400,
        );
      },
    );
    await t.test(
      "La inicialización puede repetirse sin duplicar servicios, jornadas ni citas",
      async () => {
        const before = (await query("SELECT COUNT(*) n FROM working_hours"))[0]
          .n;
        await initialize();
        assert.equal(
          (await query("SELECT COUNT(*) n FROM working_hours"))[0].n,
          before,
        );
        assert.equal((await query("SELECT COUNT(*) n FROM services"))[0].n, 3);
      },
    );
    if (process.env.RUN_BROWSER_TESTS === "1") {
      await t.test(
        "Navegador real: reserva, administración, reprogramación, cancelación e historial",
        { timeout: 120000 },
        async () => {
          const { chromium } = require("playwright");
          const browser = await chromium.launch({
            headless: true,
            ...(process.env.BROWSER_CHANNEL
              ? { channel: process.env.BROWSER_CHANNEL }
              : {}),
          });
          const out = path.join(__dirname, "../test-results");
          await fs.mkdir(out, { recursive: true });
          const errors = [];
          try {
            const page = await browser.newPage({
              viewport: { width: 1440, height: 1050 },
            });
            page.on("pageerror", (e) => errors.push(e.message));
            await page.goto(base);
            await page
              .getByLabel("Servicio", { exact: true })
              .selectOption(String(service.id));
            await page
              .getByLabel("Barbero", { exact: true })
              .selectOption(String(barber));
            await page.getByLabel("Fecha", { exact: true }).fill(day(20));
            await page
              .getByRole("button", { name: "10:00", exact: true })
              .click();
            await page.getByLabel("Nombre completo").fill("Cliente Navegador");
            await page
              .getByLabel("Teléfono", { exact: true })
              .fill("5598765432");
            await page.screenshot({
              path: path.join(out, "reserva-escritorio.png"),
              fullPage: true,
            });
            await page
              .getByRole("button", { name: "Confirmar reserva", exact: true })
              .click();
            await page
              .getByRole("heading", { name: "Tu cita está confirmada." })
              .waitFor();
            await page
              .getByRole("button", { name: "Administración", exact: true })
              .click();
            await page.getByLabel("Usuario", { exact: true }).fill("qaadmin");
            await page
              .getByLabel("Contraseña", { exact: true })
              .fill(process.env.ADMIN_PASSWORD);
            await page
              .getByRole("button", { name: "Iniciar sesión", exact: true })
              .click();
            await page
              .getByRole("heading", { name: "Agenda de citas" })
              .waitFor();
            await page
              .getByRole("button", { name: "Ver todas", exact: true })
              .click();
            await page
              .getByLabel("Buscar cliente", { exact: true })
              .fill("Cliente Navegador");
            let card = page
              .locator(".appointment-card")
              .filter({ hasText: "Cliente Navegador" });
            await card
              .getByRole("button", { name: "Reprogramar", exact: true })
              .click();
            const dialog = page.getByRole("dialog");
            await dialog
              .getByRole("button", { name: "11:00", exact: true })
              .click();
            await dialog
              .getByRole("button", { name: "Guardar nuevo horario" })
              .click();
            await dialog.waitFor({ state: "hidden" });
            await card.getByText(/11:00/).waitFor();
            await card
              .getByRole("button", { name: "Cancelar cita", exact: true })
              .click();
            await page
              .getByRole("dialog")
              .getByRole("button", { name: "Confirmar cambio" })
              .click();
            await page.getByRole("dialog").waitFor({ state: "hidden" });
            await card.getByText("Cancelada", { exact: true }).waitFor();
            await page.screenshot({
              path: path.join(out, "agenda-escritorio.png"),
              fullPage: true,
            });
            await page
              .getByRole("button", { name: "Clientes", exact: true })
              .click();
            await page
              .getByLabel("Buscar por nombre o teléfono")
              .fill("Cliente Navegador");
            await page.getByRole("button", { name: "Ver historial" }).click();
            await page
              .getByRole("dialog")
              .getByText("Cancelada", { exact: true })
              .waitFor();
            await page.getByRole("button", { name: "Cerrar ventana" }).click();
            await page
              .getByRole("button", { name: "Servicios", exact: true })
              .click();
            await page
              .getByRole("button", { name: "+ Nuevo servicio", exact: true })
              .click();
            await page
              .getByRole("dialog")
              .getByLabel("Nombre", { exact: true })
              .fill("Servicio de navegador");
            await page
              .getByRole("dialog")
              .getByRole("button", { name: "Guardar servicio" })
              .click();
            await page.getByRole("dialog").waitFor({ state: "hidden" });
            await page
              .getByRole("heading", { name: "Servicio de navegador" })
              .waitFor();
            await page
              .getByRole("button", { name: "Jornadas", exact: true })
              .click();
            await page
              .getByLabel("Barbero", { exact: true })
              .selectOption(String(barber));
            await page
              .getByRole("button", { name: "Guardar jornada", exact: true })
              .click();
            await page
              .getByRole("status")
              .filter({ hasText: "Jornada guardada" })
              .waitFor();
            await page
              .getByRole("button", { name: "Barberos", exact: true })
              .click();
            await page
              .getByRole("button", { name: "+ Nuevo barbero", exact: true })
              .click();
            await page
              .getByRole("dialog")
              .getByLabel("Nombre", { exact: true })
              .fill("Barbero Navegador");
            await page
              .getByRole("dialog")
              .getByLabel("Corte Clásico", { exact: true })
              .check();
            await page
              .getByRole("dialog")
              .getByRole("button", { name: "Guardar barbero" })
              .click();
            await page.getByRole("dialog").waitFor({ state: "hidden" });
            await page
              .getByRole("heading", { name: "Barbero Navegador" })
              .waitFor();
            await page
              .getByRole("button", { name: "Bloqueos", exact: true })
              .click();
            await page
              .getByLabel("Barbero", { exact: true })
              .selectOption(String(barber));
            await page
              .getByLabel("Inicio", { exact: true })
              .fill(day(22) + "T10:00");
            await page
              .getByLabel("Fin", { exact: true })
              .fill(day(22) + "T12:00");
            await page
              .getByLabel("Motivo", { exact: true })
              .fill("Bloqueo Navegador");
            await page
              .getByRole("button", { name: "Crear bloqueo", exact: true })
              .click();
            const blockCard = page
              .locator(".history-list article")
              .filter({ hasText: "Bloqueo Navegador" });
            await blockCard
              .getByRole("button", { name: "Eliminar", exact: true })
              .click();
            await page
              .getByRole("dialog")
              .getByRole("button", { name: "Confirmar eliminación" })
              .click();
            await page.getByRole("dialog").waitFor({ state: "hidden" });
            await blockCard.waitFor({ state: "hidden" });
            await page.setViewportSize({ width: 390, height: 844 });
            await page
              .getByRole("button", { name: "Agenda", exact: true })
              .click();
            await page
              .getByRole("button", { name: "Ver todas", exact: true })
              .click();
            await page
              .getByRole("heading", { name: "Agenda de citas" })
              .waitFor();
            assert.equal(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
              ),
              true,
            );
            await page.screenshot({
              path: path.join(out, "agenda-movil.png"),
              fullPage: true,
            });
            await page
              .getByRole("button", { name: "Salir", exact: true })
              .click();
            await page
              .getByRole("heading", { name: "Bienvenido de nuevo." })
              .waitFor();
            await page
              .getByRole("button", { name: "Reservar", exact: true })
              .click();
            await page.setViewportSize({ width: 390, height: 844 });
            await page
              .getByLabel("Servicio", { exact: true })
              .selectOption(String(service.id));
            await page
              .getByLabel("Barbero", { exact: true })
              .selectOption(String(barber));
            await page.getByLabel("Fecha", { exact: true }).fill(day(21));
            await page
              .getByRole("button", { name: "10:00", exact: true })
              .waitFor();
            assert.equal(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
              ),
              true,
            );
            await page.screenshot({
              path: path.join(out, "reserva-movil.png"),
              fullPage: true,
            });
            assert.deepEqual(errors, []);
          } finally {
            await browser.close();
          }
        },
      );
    }
    await t.test(
      "Cambio de contraseña invalida sesiones anteriores; acceso con la nueva contraseña",
      async () => {
        const result = await request("/admin/password", {
          method: "POST",
          admin: true,
          body: {
            current_password: process.env.ADMIN_PASSWORD,
            new_password: "Nueva-Prueba-Segura-2026!",
          },
        });
        assert.equal(result.status, 200);
        assert.equal((await request("/admin/me", { admin: true })).status, 401);
        const next = await request("/admin/login", {
          method: "POST",
          body: { username: "qaadmin", password: "Nueva-Prueba-Segura-2026!" },
        });
        assert.equal(next.status, 200);
        cookie = next.cookie.split(";")[0];
        assert.equal(
          (await request("/admin/logout", { method: "POST", admin: true }))
            .status,
          200,
        );
        assert.equal((await request("/admin/me", { admin: true })).status, 401);
      },
    );
  },
);
