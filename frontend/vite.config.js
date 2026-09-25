import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({
  base: "/nombre-de-tu-repositorio/", // ⚠️ IMPORTANTE: Cambia "nombre-de-tu-repositorio" por el nombre exacto de tu repo en GitHub (ej. /barberia-citas/)
  plugins: [react()],
  server: { host: "127.0.0.1", proxy: { "/api": "http://127.0.0.1:3001" } },
  preview: { host: "127.0.0.1", proxy: { "/api": "http://127.0.0.1:3001" } },
});
