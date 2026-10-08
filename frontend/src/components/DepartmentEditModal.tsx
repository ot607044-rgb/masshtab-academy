import React, { useEffect, useId, useRef, useState } from "react";
import { Bold, ChevronLeft, ChevronRight, Heading, List, ListOrdered, X } from "lucide-react";
import type { Department, DepartmentCreate, DescriptionFont, Employee } from "../types";
import DescriptionText, { DEFAULT_DESCRIPTION_SIZE, DESCRIPTION_FONTS, DESCRIPTION_SIZES } from "./DescriptionText";
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
  const textRef = useRef<HTMLTextAreaElement>(null);

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

  // ── Панель форматирования: правит текст вокруг выделения ──
  const edit = (fn: (text: string, start: number, end: number) => { text: string; start: number; end: number }) => {
    const el = textRef.current;
    if (!el) return;
    const r = fn(form.description, el.selectionStart, el.selectionEnd);
    set("description", r.text);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(r.start, r.end); });
  };
  const wrapBold = () => edit((t, a, b) => {
    const inner = t.slice(a, b) || "текст";
    return { text: `${t.slice(0, a)}**${inner}**${t.slice(b)}`, start: a + 2, end: a + 2 + inner.length };
  });
  const insertHeading = () => edit((t, a, b) => {
    const label = t.slice(a, b).replace(/:$/, "") || "Заголовок";
    const before = t.slice(0, a);
    const lead = before && !before.endsWith("\n") ? "\n" : "";
    return { text: `${before}${lead}${label}: ${t.slice(b)}`, start: a + lead.length, end: a + lead.length + label.length };
  });
  const prefixLines = (numbered: boolean) => edit((t, a, b) => {
    const from = t.lastIndexOf("\n", a - 1) + 1;
    const toIdx = t.indexOf("\n", b);
    const to = toIdx === -1 ? t.length : toIdx;
    const block = t.slice(from, to).split("\n").map((l, i) => `${numbered ? `${i + 1}.` : "•"} ${l.replace(/^(\d{1,2}[.)]|[•\-–])\s+/, "")}`).join("\n");
    return { text: t.slice(0, from) + block + t.slice(to), start: from, end: from + block.length };
  });

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

          <section className={s.editor}>
            <div className={s.toolbar} role="toolbar" aria-label="Оформление описания">
              <label className={s.toolField}>
                <span>Шрифт</span>
                <select value={form.font} onChange={(e) => set("font", e.target.value as DescriptionFont)}>
                  {DESCRIPTION_FONTS.map((f) => <option key={f.value} value={f.value} style={{ fontFamily: f.css }}>{f.label}</option>)}
                </select>
              </label>
              <label className={s.toolField}>
                <span>Размер</span>
                <select value={form.size} onChange={(e) => set("size", Number(e.target.value))}>
                  {DESCRIPTION_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <span className={s.sep} />
              <button type="button" className={s.tool} onClick={wrapBold} title="Жирный (**текст**)" aria-label="Жирный"><Bold size={15} /></button>
              <button type="button" className={s.tool} onClick={insertHeading} title="Заголовок («Работы:»)" aria-label="Заголовок"><Heading size={15} /></button>
              <button type="button" className={s.tool} onClick={() => prefixLines(true)} title="Нумерованный список" aria-label="Нумерованный список"><ListOrdered size={15} /></button>
              <button type="button" className={s.tool} onClick={() => prefixLines(false)} title="Маркированный список" aria-label="Маркированный список"><List size={15} /></button>
            </div>
            <div className={s.panes}>
              <div className={s.pane}>
                <label htmlFor={`${id}-desc`}>Описание</label>
                <textarea
                  id={`${id}-desc`} ref={textRef} value={form.description} onChange={(e) => set("description", e.target.value)}
                  placeholder={"Продукт: …\nРаботы:\n1. …\n2. …"}
                  style={{ fontFamily: DESCRIPTION_FONTS.find((f) => f.value === form.font)?.css, fontSize: form.size }}
                />
              </div>
              <div className={s.pane}>
                <span className={s.paneLabel}>Как будет в карточке</span>
                <div className={s.preview}>
                  {form.description.trim()
                    ? <DescriptionText text={form.description} font={form.font} size={form.size} />
                    : <p className={s.empty}>Описание пока пустое</p>}
                </div>
              </div>
            </div>
          </section>

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
