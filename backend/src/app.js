const express = require("express");
const path = require("node:path");
const { HttpError } = require("./domain");
const { requireAdmin } = require("./auth");
const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "same-origin");
  res.set("X-Frame-Options", "DENY");
  res.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  );
  if (req.path.startsWith("/api")) res.set("Cache-Control", "no-store");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.get("X-Requested-With") !== "barberia"
  )
    return next(
      new HttpError(403, "Solicitud no autorizada. Recarga la página."),
    );
  next();
});
app.use(express.json({ limit: "32kb" }));
app.use((req, res, next) => {
  if (
    req.body !== undefined &&
    (!req.body || Array.isArray(req.body) || typeof req.body !== "object")
  )
    return next(new HttpError(400, "El contenido debe ser un objeto JSON."));
  req.body ??= {};
  next();
});
app.use("/api/admin", require("./admin-routes"));
app.use("/api", require("./public-routes"));
// Preserve the old agenda URL without exposing customer information.
app.get("/api/appointments", requireAdmin, (req, res) =>
  res.redirect(307, "/api/admin/appointments"),
);
app.use("/api", (req, res) =>
  res.status(404).json({ error: "Ruta no encontrada." }),
);
app.use(express.static(path.join(__dirname, "../../frontend/dist")));
app.get("/", (req, res) =>
  res
    .status(503)
    .send(
      "La interfaz aún no está compilada. Ejecuta npm run build en frontend.",
    ),
);
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.status || 500;
  if (status >= 500)
    console.error("Error del servidor:", error.code || error.message);
  res
    .status(status)
    .json({
      error:
        status >= 500
          ? "No pudimos completar la operación. Inténtalo nuevamente."
          : error.type === "entity.parse.failed"
            ? "El contenido de la solicitud no es válido."
            : error.message,
    });
});
module.exports = app;
