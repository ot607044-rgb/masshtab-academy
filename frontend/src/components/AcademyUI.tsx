import { useEffect, useId, useRef, type ReactNode } from "react";
import { X, Inbox, RefreshCw } from "lucide-react";
import "../styles/academy.css";

export function PageHeading({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return <header className="academy-page-heading"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div><div className="academy-actions">{children}</div></header>;
}
export function Metrics({ items }: { items: { label: string; value: string | number; note?: string; warning?: boolean }[] }) {
  return <div className="academy-metrics">{items.map(item => <div key={item.label}><span>{item.label}</span><strong className={item.warning ? "academy-danger" : ""}>{item.value}</strong>{item.note && <small>{item.note}</small>}</div>)}</div>;
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="academy-empty"><Inbox size={26} strokeWidth={1.5} /><p>{children}</p></div>;
}
export function LoadState({ error, retry }: { error: string; retry: () => void }) {
  return error ? <div className="academy-load" role="alert"><p>{error}</p><button className="btn-secondary" onClick={retry}><RefreshCw size={16} />Повторить</button></div> : <div className="academy-load" role="status">Загрузка данных...</div>;
}
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className="academy-dialog" aria-labelledby={id} onCancel={onClose}><div className="academy-dialog-heading"><h2 id={id}>{title}</h2><button type="button" className="academy-icon" title="Закрыть" aria-label="Закрыть" onClick={onClose}><X size={20} /></button></div>{children}</dialog>;
}
export function ProgressBar({ value, danger = false }: { value: number; danger?: boolean }) {
  return <div className="academy-progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><span className={danger ? "danger" : ""} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}
export const dateLabel = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }) : "Не указан";
