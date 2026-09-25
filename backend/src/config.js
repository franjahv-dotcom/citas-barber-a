const path = require("node:path");
const fs = require("node:fs");
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
module.exports = {
  port: Number(process.env.PORT || 3001),
  host: process.env.HOST || "127.0.0.1",
  timeZone: "America/Mexico_City",
  bookingDays: 90,
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "barberia_db",
    dateStrings: true,
    charset: "utf8mb4",
    connectionLimit: 10,
  },
};
