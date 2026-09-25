const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { query, transaction } = require("./db");
const { hashPassword } = require("./auth");
const config = require("./config");
async function initialize() {
  const schema = await fs.readFile(
    path.join(__dirname, "../../database/schema.sql"),
    "utf8",
  );
  for (const statement of schema
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean))
    await query(statement);
  const hasColumn = async (table, column) =>
    (
      await query(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?",
        [config.db.database, table, column],
      )
    ).length;
  if (!(await hasColumn("services", "description")))
    await query(
      "ALTER TABLE services ADD COLUMN description VARCHAR(500) NOT NULL DEFAULT ''",
    );
  if (!(await hasColumn("appointments", "client_id")))
    await query(
      "ALTER TABLE appointments ADD COLUMN client_id INT NULL, ADD FOREIGN KEY (client_id) REFERENCES clients(id)",
    );
  if (
    !(
      await query(
        "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME='appointments' AND INDEX_NAME='agenda_lookup'",
        [config.db.database],
      )
    ).length
  )
    await query(
      "ALTER TABLE appointments ADD INDEX agenda_lookup (barber_id,start_time,end_time)",
    );
  await transaction(async (q) => {
    if ((await q("SELECT version FROM migrations WHERE version=1")).length)
      return;
    if (!(await q("SELECT id FROM services LIMIT 1")).length)
      await q(
        `INSERT INTO services (name,description,duration_minutes,price) VALUES ('Corte Clásico','Corte y acabado a tu estilo.',40,250),('Corte y Barba','Corte completo y arreglo de barba.',60,350),('Diseño de Barba','Perfilado y cuidado de barba.',30,150)`,
      );
    if (!(await q("SELECT id FROM barbers LIMIT 1")).length)
      await q("INSERT INTO barbers (name) VALUES ('Marco'),('Luis')");
    await q(
      "INSERT IGNORE INTO barber_services (barber_id,service_id) SELECT b.id,s.id FROM barbers b CROSS JOIN services s",
    );
    for (const barber of await q("SELECT id FROM barbers")) {
      for (let day = 1; day <= 6; day++)
        await q(
          "INSERT INTO working_hours (barber_id,weekday,start_time,end_time) VALUES (?,?,'10:00','14:00'),(?,?,'15:00','20:00')",
          [barber.id, day, barber.id, day],
        );
    }
    for (const appointment of await q(
      "SELECT id,client_name,client_phone FROM appointments WHERE client_id IS NULL",
    )) {
      const matching = await q(
        "SELECT id FROM clients WHERE name=? AND phone=? ORDER BY id LIMIT 1",
        [appointment.client_name, appointment.client_phone || ""],
      );
      const id =
        matching[0]?.id ||
        (
          await q("INSERT INTO clients (name,phone) VALUES (?,?)", [
            appointment.client_name,
            appointment.client_phone || "",
          ])
        ).insertId;
      await q("UPDATE appointments SET client_id=? WHERE id=?", [
        id,
        appointment.id,
      ]);
    }
    await q("INSERT INTO migrations (version) VALUES (1)");
  });
  if (!(await query("SELECT id FROM admins LIMIT 1")).length) {
    const username = process.env.ADMIN_USERNAME || "admin";
    const password =
      process.env.ADMIN_PASSWORD ||
      crypto.randomBytes(15).toString("base64url");
    if (password.length < 12)
      throw new Error("ADMIN_PASSWORD debe tener al menos 12 caracteres.");
    await query("INSERT INTO admins (username,password_hash) VALUES (?,?)", [
      username,
      await hashPassword(password),
    ]);
    if (!process.env.ADMIN_PASSWORD) {
      await fs.writeFile(
        path.join(__dirname, "../.admin-access.txt"),
        `Acceso inicial a Mala Vida Barbers\nUsuario: ${username}\nContraseña: ${password}\nCambia esta contraseña desde el panel. Este archivo no se incluye en Git.\n`,
        { mode: 0o600 },
      );
      console.log(
        "Credenciales iniciales guardadas en backend/.admin-access.txt",
      );
    }
  }
  await query("DELETE FROM admin_sessions WHERE expires_at < UTC_TIMESTAMP()");
}
module.exports = { initialize };
