const crypto = require("node:crypto");
const { promisify } = require("node:util");
const scrypt = promisify(crypto.scrypt);
const { query } = require("./db");
const { HttpError } = require("./domain");
const cookieName = "barberia_session";
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${(await scrypt(password, salt, 64)).toString("hex")}`;
}
async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const actual = await scrypt(password, salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(hash, "hex"));
}
function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function cookieToken(req) {
  return (
    (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1) || ""
  );
}
const cookieOptions = {
  httpOnly: true,
  sameSite: "none",
  secure: true,
  path: "/",
  maxAge: 8 * 3600000,
};

async function requireAdmin(req, res, next) {
  const token = cookieToken(req);
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new HttpError(401, "Inicia sesión para continuar.");
  const users = await query(
    `SELECT a.id, a.username FROM admin_sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=? AND s.expires_at > UTC_TIMESTAMP()`,
    [tokenHash(token)],
  );
  if (!users.length)
    throw new HttpError(401, "Tu sesión terminó. Vuelve a iniciar sesión.");
  req.admin = users[0];
  next();
}
function rateLimit(max, windowMs) {
  const entries = new Map();
  const timer = setInterval(() => {
    for (const [key, value] of entries)
      if (value.until < Date.now()) entries.delete(key);
  }, windowMs);
  timer.unref();
  return (req, res, next) => {
    const key = req.ip;
    let entry = entries.get(key);
    if (!entry || entry.until < Date.now()) {
      entry = { count: 0, until: Date.now() + windowMs };
      entries.set(key, entry);
    }
    if (++entry.count > max) {
      res.set(
        "Retry-After",
        String(Math.ceil((entry.until - Date.now()) / 1000)),
      );
      return next(
        new HttpError(
          429,
          "Demasiados intentos. Espera unos minutos e inténtalo otra vez.",
        ),
      );
    }
    next();
  };
}
module.exports = {
  hashPassword,
  verifyPassword,
  tokenHash,
  cookieToken,
  cookieName,
  cookieOptions,
  requireAdmin,
  rateLimit,
};
