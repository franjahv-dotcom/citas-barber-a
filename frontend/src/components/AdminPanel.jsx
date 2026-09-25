import { useState } from "react";
import { useLoad } from "../api";
import { LoadState } from "./UI";
import Agenda from "./Agenda";
import Catalog from "./Catalog";
import { Schedules, Blocks } from "./Schedules";
import { Clients, Account } from "./Clients";
const tabs = [
  ["agenda", "Agenda"],
  ["clients", "Clientes"],
  ["services", "Servicios"],
  ["barbers", "Barberos"],
  ["hours", "Jornadas"],
  ["blocks", "Bloqueos"],
  ["account", "Mi cuenta"],
];
export default function AdminPanel({ onSignedOut }) {
  const [tab, setTab] = useState("agenda");
  const [refresh, setRefresh] = useState(0);
  const catalog = useLoad("/admin/catalog", refresh);
  const config = useLoad("/config");
  return (
    <>
      <div className="admin-heading">
        <p className="eyebrow">ADMINISTRACIÓN</p>
        <h1>Todo en su lugar.</h1>
      </div>
      <nav className="admin-tabs" aria-label="Secciones de administración">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            aria-current={tab === key ? "page" : undefined}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      <LoadState resource={catalog}>
        <LoadState resource={config}>
          {catalog.data && config.data && (
            <div key={tab}>
              {tab === "agenda" && (
                <Agenda catalog={catalog.data} config={config.data} />
              )}{" "}
              {["services", "barbers"].includes(tab) && (
                <Catalog
                  kind={tab}
                  catalog={catalog.data}
                  onChanged={() => setRefresh((x) => x + 1)}
                />
              )}{" "}
              {tab === "hours" && <Schedules catalog={catalog.data} />}{" "}
              {tab === "blocks" && (
                <Blocks catalog={catalog.data} config={config.data} />
              )}{" "}
              {tab === "clients" && <Clients />}{" "}
              {tab === "account" && <Account onSignedOut={onSignedOut} />}
            </div>
          )}
        </LoadState>
      </LoadState>
    </>
  );
}
