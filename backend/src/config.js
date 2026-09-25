const path = require("node:path");
const fs = require("node:fs");
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
module.exports = {
  port: Number(process.env.PORT || 3001),
  host: process.env.HOST || "0.0.0.0",
  timeZone: "America/Mexico_City",
  bookingDays: 90,
  db: {
    host: process.env.DB_HOST || "mysql-28052c0-jrperea3-b92b.b.aivencloud.com",
    port: Number(process.env.DB_PORT || 17510),
    user: process.env.DB_USER || "avnadmin",
    password: process.env.DB_PASSWORD || "AVNS_ZoI29fTcmAL9CXJiDA9",
    database: process.env.DB_NAME || "defaultdb",
    dateStrings: true,
    charset: "utf8mb4",
    connectionLimit: 10,
    ssl: {
      rejectUnauthorized: false
    }
  },
};

