import { useEffect, useState } from "react";
import BookingForm from "./components/BookingForm";
import AdminPanel from "./components/AdminPanel";
import { api, useAction } from "./api";
import { Feedback, Notice } from "./components/UI";
function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const action = useAction();
  return (
    <section className="panel login-panel">
      <p className="eyebrow">SOLO PERSONAL AUTORIZADO</p>
      <h1>Bienvenido de nuevo.</h1>
      <p className="muted">
        Inicia sesión para gestionar la agenda de la barbería.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          action.run(
            () =>
              api("/admin/login", {
                method: "POST",
                body: { username, password },
              }),
            onLogin,
          );
        }}
      >
        <fieldset className="form-fields" disabled={action.busy}>
          <label>
            Usuario
            <input
              required
              maxLength={60}
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label>
            Contraseña
            <input
              required
              type="password"
              maxLength={200}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <Feedback action={action} />
          <button className="full" disabled={action.busy}>
            {action.busy ? "Entrando…" : "Iniciar sesión"}
          </button>
        </fieldset>
      </form>
    </section>
  );
}
export default function App() {
  const [view, setView] = useState("client");
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState("");
  const action = useAction();
  useEffect(() => {
    const controller = new AbortController();
    api("/admin/me", { signal: controller.signal })
      .then(setSession)
      .catch((error) => {
        if (error.name !== "AbortError" && error.status !== 401)
          setNotice(
            "No pudimos verificar la sesión. Puedes volver a iniciar sesión.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false);
      });
    const expired = () => {
      setSession(null);
      setNotice("Tu sesión terminó. Inicia sesión para continuar.");
    };
    window.addEventListener("session-ended", expired);
    return () => {
      controller.abort();
      window.removeEventListener("session-ended", expired);
    };
  }, []);
  return (
    <div className="site">
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={() => setView("client")}
            aria-label="Mala Vida Barbers, inicio"
          >
            <span className="brand-mark">MV</span>
            <span>
              MALA VIDA<small>BARBERS</small>
            </span>
          </button>
          <nav aria-label="Navegación principal">
            <button
              className={
                view === "client" ? "nav-button selected" : "nav-button"
              }
              onClick={() => {
                setView("client");
                setNotice("");
              }}
            >
              Reservar
            </button>
            <button
              className={
                view === "admin" ? "nav-button selected" : "nav-button"
              }
              onClick={() => setView("admin")}
            >
              Administración
            </button>
            {session && (
              <button
                className="nav-button"
                disabled={action.busy}
                onClick={() =>
                  action.run(
                    () => api("/admin/logout", { method: "POST" }),
                    () => {
                      setSession(null);
                      setNotice("Sesión cerrada.");
                    },
                  )
                }
              >
                Salir
              </button>
            )}
          </nav>
        </div>
      </header>
      <main id="main" className="main">
        <Notice>{notice}</Notice>
        <Feedback action={action} />
        {view === "client" ? (
          <BookingForm />
        ) : checking ? (
          <p className="empty">Verificando sesión…</p>
        ) : session ? (
          <AdminPanel
            onSignedOut={() => {
              setSession(null);
              setNotice("Contraseña actualizada. Inicia sesión nuevamente.");
            }}
          />
        ) : (
          <Login
            onLogin={(user) => {
              setSession(user);
              setNotice("");
            }}
          />
        )}
      </main>
      <footer className="site-footer">
        <span>MALA VIDA BARBERS</span>
        <span>Agenda con confianza. Llega con estilo.</span>
      </footer>
    </div>
  );
}
