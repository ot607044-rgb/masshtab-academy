import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./CalendarUI";

export function CalendarModal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className={wide ? "availability-modal" : "modal"} aria-labelledby={id} onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className={wide ? "availability-head" : "modal-head"}><div><span className="eyebrow">КАЛЕНДАРЬ</span><h2 className="modal-title" id={id}>{title}</h2></div><button type="button" className="icon-btn" aria-label="Закрыть" onClick={onClose}><Icon name="close" /></button></div>
    {children}
  </dialog>;
}

export const localInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
export const localDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const clock = (value: string | Date) => new Date(value).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
