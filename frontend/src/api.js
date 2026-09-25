import { useEffect, useState } from "react";

export async function api(path, options = {}) {
  const { body, ...rest } = options;
  const response = await fetch("https://backend-barberia-4h38.onrender.com/api" + path, {
    credentials: "include",
    ...rest,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "barberia",
      ...rest.headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response
    .json()
    .catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
  if (!response.ok) {
    if (
      response.status === 401 &&
      !["/admin/login", "/admin/me"].includes(path)
    )
      window.dispatchEvent(new Event("session-ended"));
    const error = new Error(data.error || "No se pudo completar la operación.");
    error.status = response.status;
    throw error;
  }
  return data;
}

export function useLoad(path, refresh = 0) {
  const [result, setResult] = useState({
    key: null,
    path: null,
    data: null,
    error: null,
  });
  const key = path + ":" + refresh;
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    api(path, { signal: controller.signal })
      .then((data) => setResult({ key, path, data, error: null }))
      .catch((error) => {
        if (error.name !== "AbortError")
          setResult({ key, path, data: null, error: error.message });
      });
    return () => controller.abort();
  }, [path, key]);
  return {
    data: result.path === path ? result.data : null,
    error: result.path === path ? result.error : null,
    loading: Boolean(path) && result.path !== path,
    refreshing: Boolean(path) && result.key !== key,
  };
}

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  async function run(work, after) {
    if (busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const value = await work();
      setResult(value);
      after?.(value);
    } catch (error) {
      setError(error.message || "No hay conexión con el servidor.");
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, result, run };
}

export const money = (value) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    value,
  );
export const stamp = (value) =>
  value
    ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)} · ${value.slice(11, 16)}`
    : "";
export const statuses = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};
