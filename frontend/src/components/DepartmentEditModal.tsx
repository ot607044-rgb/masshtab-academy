import React, { useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Department, DepartmentCreate, DescriptionFont, Employee } from "../types";
import { DEFAULT_DESCRIPTION_SIZE } from "./DescriptionText";
import DescriptionEditor from "./DescriptionEditor";
import s from "./DepartmentEditModal.module.css";

interface Option { value: string; label: string }

interface Props {
  department: Department;
  /** Все отделы в порядке обхода дерева — для перехода «предыдущий / следующий». */
  order: Department[];
  employees: Employee[];
  parentOptions: Option[];
  onSave: (id: string, payload: Partial<DepartmentCreate>) => Promise<Department>;
  onNavigate: (department: Department) => void;
  onClose: () => void;
}

type Form = { name: string; description: string; head_id: string; parent_id: string; font: DescriptionFont; size: number };

const formOf = (d: Department): Form => ({
  name: d.name, description: d.description ?? "", head_id: d.head_id ?? "", parent_id: d.parent_id ?? "",
  font: d.description_font ?? "sans", size: d.description_size ?? DEFAULT_DESCRIPTION_SIZE,
});
const errorText = (err: unknown) => {
  const msg = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof msg === "string" ? msg : "Не удалось сохранить отдел";
};

const DepartmentEditModal: React.FC<Props> = ({ department, order, employees, parentOptions, onSave, onNavigate, onClose }) => {
  const id = useId();
  const initial = formOf(department);
  const [form, setForm] = useState<Form>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Department | null>(null);

  const dirty = (Object.keys(initial) as (keyof Form)[]).some((k) => initial[k] !== form[k]);
  const index = order.findIndex((d) => d.id === department.id);
  const prev = index > 0 ? order[index - 1] : undefined;
  const next = index >= 0 && index < order.length - 1 ? order[index + 1] : undefined;
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((p) => ({ ...p, [key]: value }));

  const save = async (): Promise<boolean> => {
    const name = form.name.trim();
    if (!name) { setError("Введите название отдела"); return false; }
    setBusy(true); setError("");
    try {
      await onSave(department.id, {
        name, description: form.description.trim() || null, head_id: form.head_id || null, parent_id: form.parent_id || null,
        description_font: form.font === "sans" ? null : form.font,
        description_size: form.size === DEFAULT_DESCRIPTION_SIZE ? null : form.size,
      });
      return true;
    } catch (err) {
      setError(errorText(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const go = (target?: Department) => {
    if (!target || target.id === department.id || busy) return;
    if (dirty) setPending(target); else onNavigate(target);
  };
  const close = () => { if (!busy && (!dirty || window.confirm("Закрыть без сохранения изменений?"))) onClose(); };
  const submit = async (e?: React.FormEvent) => { e?.preventDefault(); if (await save()) onClose(); };

  // Esc — закрыть, Ctrl+S — сохранить, Alt+←/→ — соседний отдел
  const keys = useRef({ close, submit, go, prev, next });
  keys.current = { close, submit, go, prev, next };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keys.current;
      if (e.key === "Escape") { e.preventDefault(); k.close(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); void k.submit(); }
      else if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); k.go(k.prev); }
      else if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); k.go(k.next); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const heads = employees.filter((e) => e.status !== "fired" || e.id === department.head_id).sort((a, b) => a.full_name.localeCompare(b.full_name, "ru"));

  return (
    <div className={s.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className={s.modal} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
        <header className={s.header}>
          <div className={s.titleBlock}>
            <h2 id={`${id}-title`}>Редактирование отдела</h2>
            {dirty && <span className={s.dirty}>есть несохранённые изменения</span>}
          </div>
          <nav className={s.nav} aria-label="Переход к другому отделу">
            <button type="button" className={s.navBtn} onClick={() => go(prev)} disabled={!prev || busy} title={prev ? `${prev.name} (Alt+←)` : undefined} aria-label="Предыдущий отдел"><ChevronLeft size={16} /></button>
            <select className={s.navSelect} value={department.id} onChange={(e) => go(order.find((d) => d.id === e.target.value))} disabled={busy} aria-label="Выбрать отдел">
              {order.map((d, i) => <option key={d.id} value={d.id}>{i + 1}. {d.name}</option>)}
            </select>
            <button type="button" className={s.navBtn} onClick={() => go(next)} disabled={!next || busy} title={next ? `${next.name} (Alt+→)` : undefined} aria-label="Следующий отдел"><ChevronRight size={16} /></button>
            <span className={s.counter}>{index + 1} из {order.length}</span>
          </nav>
          <button type="button" className={s.close} onClick={close} disabled={busy} aria-label="Закрыть"><X size={16} /></button>
        </header>

        {pending && (
          <div className={s.pending} role="alert">
            <span>Перейти к «{pending.name}»? Изменения в этом отделе не сохранены.</span>
            <button type="button" className="btn-primary" disabled={busy} onClick={async () => { if (await save()) { const t = pending; setPending(null); onNavigate(t); } }}>Сохранить и перейти</button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => { const t = pending; setPending(null); onNavigate(t); }}>Не сохранять</button>
            <button type="button" className={s.linkBtn} disabled={busy} onClick={() => setPending(null)}>Остаться</button>
          </div>
        )}

        <form className={s.body} onSubmit={submit}>
          <aside className={s.side}>
            <label htmlFor={`${id}-name`}>Название отдела *</label>
            <input id={`${id}-name`} type="text" value={form.name} required maxLength={255} onChange={(e) => set("name", e.target.value)} autoFocus />
            <label htmlFor={`${id}-head`}>Руководитель</label>
            <select id={`${id}-head`} value={form.head_id} onChange={(e) => set("head_id", e.target.value)}>
              <option value="">— не выбран —</option>
              {heads.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
            <label htmlFor={`${id}-parent`}>Входит в</label>
            <select id={`${id}-parent`} value={form.parent_id} onChange={(e) => set("parent_id", e.target.value)}>
              {parentOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <p className={s.hint}>
              <b>Подсказка.</b> «Слово:» в начале строки — заголовок, «1.» — нумерованный пункт, «•» или «-» — маркер, **текст** — жирный.
              <br />Ctrl+S — сохранить, Alt+←/→ — соседний отдел.
            </p>
          </aside>

          <div className={s.editor}>
            <DescriptionEditor
              fill label="Описание" value={form.description} font={form.font} size={form.size}
              onChange={(v) => set("description", v)} onFont={(v) => set("font", v)} onSize={(v) => set("size", v)}
              placeholder={"Продукт: …\nРаботы:\n1. …\n2. …"}
            />
          </div>

          <footer className={s.footer}>
            {error && <div className="error-msg" role="alert">{error}</div>}
            <button type="button" className="btn-secondary" onClick={close} disabled={busy}>Отмена</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Сохранение..." : "Сохранить"}</button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default DepartmentEditModal;
