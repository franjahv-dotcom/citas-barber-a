const { initialize } = require("./src/init");
const { pool } = require("./src/db");
const config = require("./src/config");
const app = require("./src/app");
initialize()
  .then(() => {
    const server = app.listen(config.port, config.host, () =>
      console.log(`Mala Vida Barbers: http://${config.host}:${config.port}`),
    );
    server.on("error", (error) => {
      console.error("No se pudo iniciar el servidor:", error.message);
      pool.end();
      process.exitCode = 1;
    });
    for (const signal of ["SIGINT", "SIGTERM"])
      process.on(signal, () =>
        server.close(() => pool.end().then(() => process.exit(0))),
      );
  })
  .catch((error) => {
    console.error("No se pudo preparar la base de datos:", error.message);
    pool.end();
    process.exitCode = 1;
  });
