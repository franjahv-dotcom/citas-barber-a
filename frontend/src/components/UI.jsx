import { useEffect, useRef } from "react";
import { stamp, statuses } from "../api";

export function Notice({ error, children }) {
  if (!children) return null;
  return (
    <div
      className={`notice ${error ? "error" : "success"}`}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
export function Feedback({ action }) {
  return (
    <>
      <Notice error>{action.error}</Notice>
      <Notice>{action.result?.message}</Notice>
      {action.result?.affected?.length > 0 && (
        <div className="notice warning" role="status">
          <strong>
            Hay {action.result.affected.length} cita(s) que requieren atención.
          </strong>
          <p>
            Se conservaron sus datos. Reprográmalas o cancélalas desde Agenda.
          </p>
          <ul>
            {action.result.affected.map((a) => (
              <li key={a.id}>
                #{a.id} · {a.client_name} · {stamp(a.start_time)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
export function LoadState({ resource, children }) {
  if (resource.loading)
    return (
      <p className="empty" role="status">
        Cargando…
      </p>
    );
  if (resource.error) return <Notice error>{resource.error}</Notice>;
  return children;
}
export function Modal({ title, onClose, children, busy = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      aria-label={title}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Cerrar ventana"
          onClick={onClose}
          disabled={busy}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function StateBadge({ value }) {
  return <span className={`badge ${value}`}>{statuses[value] || value}</span>;
}
export function Pagination({ data, onPage }) {
  if (!data || data.pages <= 1) return null;
  return (
    <div className="pagination">
      <button
        className="secondary"
        disabled={data.page <= 1}
        onClick={() => onPage(data.page - 1)}
      >
        Anterior
      </button>
      <span>
        Página {data.page} de {data.pages} · {data.total} registros
      </span>
      <button
        className="secondary"
        disabled={data.page >= data.pages}
        onClick={() => onPage(data.page + 1)}
      >
        Siguiente
      </button>
    </div>
  );
}
export function AppointmentList({ items }) {
  if (!items?.length) return <p className="empty">No hay citas registradas.</p>;
  return (
    <div className="history-list">
      {items.map((a) => (
        <article key={a.id}>
          <div>
            <strong>
              #{a.id} · {stamp(a.start_time)}
            </strong>
            <p>
              {a.service_name} con {a.barber_name}
            </p>
          </div>
          <StateBadge value={a.status} />
        </article>
      ))}
    </div>
  );
}
