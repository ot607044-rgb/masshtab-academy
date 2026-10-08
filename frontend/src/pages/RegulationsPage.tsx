import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, BriefcaseBusiness, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock, Copy,
  MoreHorizontal, Pencil, Plus, Search, Trash2, X,
} from "lucide-react";
import { getPositions, createPosition } from "../api/positions";
import { getEmployees } from "../api/employees";
import { getDepartments } from "../api/departments";
import { apiError } from "../api/workspace";
import {
  assignRegulation, createRegulation, deleteRegulation, getRegulationAssignments, getRegulations,
  removeRegulationAssignment, updateRegulation,
  type Regulation, type RegulationAssignment, type RegulationPayload,
} from "../api/regulations";
import type { Department, Employee, Position } from "../types";
import { LoadState } from "../components/AcademyUI";
import usePhotoSrc from "../components/usePhotoSrc";
import s from "./Regulations.module.css";

// ── Утилиты ──────────────────────────────────────────────────────────────────
const plural = (n: number, forms: [string, string, string]) => {
  const m10 = n % 10, m100 = n % 100;
  const form = m10 === 1 && m100 !== 11 ? forms[0] : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? forms[1] : forms[2];
  return `${n} ${form}`;
};
const variants = (n: number) => plural(n, ["вариант", "варианта", "вариантов"]);
const staffCount = (n: number) => plural(n, ["сотрудник", "сотрудника", "сотрудников"]);
const points = (n: number) => plural(n, ["пункт", "пункта", "пунктов"]);
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
// Сервер хранит UTC без смещения
const parseUtc = (v: string) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(v) ? v : `${v}Z`);
const time = (d: Date) => d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
const whenLabel = (v: string) => {
  const d = parseUtc(v);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (diff === 0) return `сегодня в ${time(d)}`;
  if (diff === 1) return `вчера в ${time(d)}`;
  return `${d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} в ${time(d)}`;
};
const shortDate = (v: string) => parseUtc(v).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
const SUMMARY_PRESETS = ["Полный функционал", "Специализация", "На испытательный срок", "Совмещение"];

const Avatar: React.FC<{ e: Employee; size?: "md" | "sm" }> = ({ e, size = "md" }) => {
  const src = usePhotoSrc(e.photo_url);
  return <span className={`${s.avatar} ${size === "sm" ? s.avatarSm : ""}`}>{src ? <img src={src} alt="" /> : initials(e.full_name)}</span>;
};

// Меню «⋯» с действиями
const Menu: React.FC<{ label: string; items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[] }> = ({ label, items }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (ev: MouseEvent) => { if (!ref.current?.contains(ev.target as Node)) setOpen(false); };
    const esc = (ev: KeyboardEvent) => { if (ev.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className={s.menu} ref={ref}>
      <button type="button" className={s.menuBtn} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><MoreHorizontal size={18} /></button>
      {open && (
        <div className={s.menuList} role="menu">
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" className={it.danger ? s.danger : ""} onClick={() => { setOpen(false); it.onClick(); }}>{it.icon}{it.label}</button>
          ))}
        </div>
      )}
    </div>
  );
};

// Общая оболочка модального окна
const Dialog: React.FC<{ title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; busy?: boolean }> = ({ title, subtitle, onClose, children, busy }) => {
  useEffect(() => {
    const esc = (ev: KeyboardEvent) => { if (ev.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose, busy]);
  return (
    <div className={s.overlay} onMouseDown={(ev) => { if (ev.target === ev.currentTarget && !busy) onClose(); }}>
      <div className={s.dialog} role="dialog" aria-modal="true" aria-label={title}>
        <header className={s.dialogHead}>
          <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button type="button" className={s.closeBtn} onClick={onClose} disabled={busy} aria-label="Закрыть"><X size={16} /></button>
        </header>
        {children}
      </div>
    </div>
  );
};

// ── Окно создания / редактирования варианта ──────────────────────────────────
const RegulationDialog: React.FC<{
  positions: Position[]; initial?: Regulation; positionId?: string;
  onClose: () => void; onSave: (positionId: string, payload: RegulationPayload & { name: string }) => Promise<void>;
}> = ({ positions, initial, positionId, onClose, onSave }) => {
  const [form, setForm] = useState({
    position_id: initial?.position_id ?? positionId ?? positions[0]?.id ?? "",
    name: initial?.name ?? "", summary: initial?.summary ?? "", goal: initial?.goal ?? "", draft: initial?.status === "draft",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.name.trim()) { setError("Введите название варианта"); return; }
    if (!form.position_id) { setError("Выберите должность"); return; }
    setBusy(true); setError("");
    try {
      await onSave(form.position_id, { name: form.name.trim(), summary: form.summary.trim() || null, goal: form.goal.trim() || null, status: form.draft ? "draft" : "active" });
      onClose();
    } catch (e) { setError(apiError(e)); setBusy(false); }
  };
  return (
    <Dialog title={initial ? "Редактирование варианта" : "Новый вариант регламента"} subtitle="Вариант описывает функционал должности: цель и обязанности" onClose={onClose} busy={busy}>
      <form className={s.form} onSubmit={submit}>
        <label htmlFor="reg-position">Должность</label>
        <select id="reg-position" value={form.position_id} disabled={!!initial} onChange={(e) => setForm({ ...form, position_id: e.target.value })}>
          {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label htmlFor="reg-name">Название варианта *</label>
        <input id="reg-name" type="text" value={form.name} maxLength={255} placeholder="Например, «Банк и платежи»" autoFocus onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <label htmlFor="reg-summary">Тип</label>
        <input id="reg-summary" type="text" list="reg-summary-presets" value={form.summary} maxLength={255} placeholder="Полный функционал или специализация" onChange={(e) => setForm({ ...form, summary: e.target.value })} />
        <datalist id="reg-summary-presets">{SUMMARY_PRESETS.map((p) => <option key={p} value={p} />)}</datalist>
        <label htmlFor="reg-goal">Цель должности</label>
        <textarea id="reg-goal" rows={3} value={form.goal} maxLength={5000} placeholder="Зачем существует должность и какой результат она даёт компании" onChange={(e) => setForm({ ...form, goal: e.target.value })} />
        <label className={s.check}>
          <input type="checkbox" checked={form.draft} onChange={(e) => setForm({ ...form, draft: e.target.checked })} />
          <span><strong>Черновик</strong><small>Черновик можно доработать перед тем, как назначать сотрудникам</small></span>
        </label>
        {error && <p className="error-msg" role="alert">{error}</p>}
        <footer className={s.dialogFoot}>
          <button type="button" className={s.ghostBtn} onClick={onClose} disabled={busy}>Отмена</button>
          <button type="submit" className={s.primaryBtn} disabled={busy}>{busy ? "Сохранение..." : initial ? "Сохранить" : "Создать вариант"}</button>
        </footer>
      </form>
    </Dialog>
  );
};

// ── Окно назначения с подтверждением результата ─────────────────────────────
const AssignDialog: React.FC<{
  employees: Employee[]; positions: Position[]; departments: Department[]; regulations: Regulation[]; assignments: RegulationAssignment[];
  employeeId?: string; regulationId?: string; onClose: () => void;
  onAssigned: (a: RegulationAssignment) => void;
}> = ({ employees, positions, departments, regulations, assignments, employeeId, regulationId, onClose, onAssigned }) => {
  const posName = (id: string | null) => positions.find((p) => p.id === id)?.name;
  const deptName = (id: string | null) => departments.find((d) => d.id === id)?.name;
  const preset = regulations.find((r) => r.id === regulationId);
  const candidates = useMemo(() => employees.filter((e) => e.status !== "fired").sort((a, b) => a.full_name.localeCompare(b.full_name, "ru")), [employees]);
  const firstEmployee = employeeId ?? candidates.find((e) => !preset || e.position_id === preset.position_id)?.id ?? "";
  const [empId, setEmpId] = useState(firstEmployee);
  const [picking, setPicking] = useState(!firstEmployee);
  const [query, setQuery] = useState("");
  const employee = employees.find((e) => e.id === empId);
  const options = regulations.filter((r) => !employee?.position_id || r.position_id === employee.position_id)
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "active" ? -1 : 1));
  const [regId, setRegId] = useState(regulationId ?? "");
  const [ack, setAck] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RegulationAssignment | null>(null);

  useEffect(() => {
    if (!options.some((o) => o.id === regId)) setRegId(options.find((o) => o.status === "active")?.id ?? options[0]?.id ?? "");
  }, [empId]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = assignments.find((a) => a.employee_id === empId);
  const currentReg = current && regulations.find((r) => r.id === current.regulation_id);
  const chosen = regulations.find((r) => r.id === regId);
  const filtered = candidates.filter((e) => `${e.full_name} ${posName(e.position_id) ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  const submit = async () => {
    if (!empId || !regId) return;
    setBusy(true); setError("");
    try {
      const saved = await assignRegulation({ employee_id: empId, regulation_id: regId, require_ack: ack });
      onAssigned(saved);
      setResult(saved);
    } catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  };
  const again = () => { setResult(null); setEmpId(""); setPicking(true); setQuery(""); };

  if (result && employee && chosen) {
    return (
      <Dialog title="Назначить регламент" onClose={onClose}>
        <div className={s.result} role="status">
          <span className={s.resultIcon}><CheckCircle2 size={34} /></span>
          <h3>Регламент назначен</h3>
          <p>«{chosen.name}» назначен сотруднику <strong>{employee.full_name}</strong>.</p>
          <p className={s.resultNote}>
            {!result.require_ack ? "Ознакомление не запрашивалось."
              : result.notified ? "Сотрудник получил уведомление и подтвердит, что прочитал регламент."
              : "У сотрудника нет учётной записи — уведомление не отправлено. Статус: «Ожидает ознакомления»."}
          </p>
          <footer className={s.dialogFoot}>
            <button type="button" className={s.ghostBtn} onClick={again}>Назначить ещё</button>
            <button type="button" className={s.primaryBtn} onClick={onClose} autoFocus>Готово</button>
          </footer>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog title="Назначить регламент" subtitle="Выберите сотрудника и подходящий вариант функционала" onClose={onClose} busy={busy}>
      <div className={s.form}>
        <span className={s.fieldLabel} id="assign-employee">Сотрудник</span>
        {!picking && employee ? (
          <button type="button" className={s.picker} onClick={() => setPicking(true)} aria-label={`Сотрудник: ${employee.full_name}. Изменить`}>
            <Avatar e={employee} size="sm" />
            <span className={s.pickerCopy}><strong>{employee.full_name}</strong><small>{[posName(employee.position_id) ?? "Должность не указана", deptName(employee.department_id)].filter(Boolean).join(" · ")}</small></span>
            <ChevronRight size={16} />
          </button>
        ) : (
          <div className={s.pickList}>
            <div className={s.pickSearch}><Search size={15} /><input type="search" aria-label="Найти сотрудника" placeholder="Найти сотрудника" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus /></div>
            <ul>
              {filtered.map((e) => (
                <li key={e.id}><button type="button" className={e.id === empId ? s.picked : ""} onClick={() => { setEmpId(e.id); setPicking(false); }}>
                  <Avatar e={e} size="sm" /><span className={s.pickerCopy}><strong>{e.full_name}</strong><small>{posName(e.position_id) ?? "Должность не указана"}</small></span>
                  {assignments.some((a) => a.employee_id === e.id) && <span className={s.tag}>есть регламент</span>}
                </button></li>
              ))}
              {!filtered.length && <li className={s.muted}>Никого не найдено</li>}
            </ul>
          </div>
        )}

        <label htmlFor="assign-variant">Вариант функционала</label>
        {employee && !options.length ? (
          <p className={s.hint}>Для должности «{posName(employee.position_id) ?? "—"}» пока нет регламентов. Создайте вариант в библиотеке.</p>
        ) : (
          <select id="assign-variant" value={regId} onChange={(e) => setRegId(e.target.value)} disabled={!employee}>
            {options.map((r) => <option key={r.id} value={r.id}>{r.name}{r.status === "draft" ? " (черновик)" : ""}{employee?.position_id ? "" : ` — ${posName(r.position_id) ?? ""}`}</option>)}
          </select>
        )}
        {chosen && <p className={s.hint}>{points(chosen.duties.length)} обязанностей{chosen.summary ? ` · ${chosen.summary}` : ""}</p>}
        {currentReg && current && currentReg.id !== regId && (
          <p className={s.warn}><AlertTriangle size={15} />Сейчас назначен «{currentReg.name}» — он будет заменён.</p>
        )}

        <label className={`${s.check} ${s.checkCard}`}>
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span><strong>Запросить ознакомление</strong><small>Сотрудник получит уведомление и подтвердит, что прочитал регламент.</small></span>
        </label>
        {error && <p className="error-msg" role="alert">{error}</p>}
        <footer className={`${s.dialogFoot} ${s.footLine}`}>
          <button type="button" className={s.ghostBtn} onClick={onClose} disabled={busy}>Отмена</button>
          <button type="button" className={s.primaryBtn} onClick={submit} disabled={busy || !employee || !regId}>{busy ? "Назначение..." : "Назначить сотруднику"}</button>
        </footer>
      </div>
    </Dialog>
  );
};

// ── Страница ─────────────────────────────────────────────────────────────────
type Tab = "library" | "assignments";

const RegulationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<{ positions: Position[]; regulations: Regulation[]; assignments: RegulationAssignment[]; employees: Employee[]; departments: Department[] }>();
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("library");
  const [positionId, setPositionId] = useState("");
  const [regulationId, setRegulationId] = useState("");
  const [regDialog, setRegDialog] = useState<{ edit?: Regulation; positionId?: string } | null>(null);
  const [assign, setAssign] = useState<{ employeeId?: string; regulationId?: string } | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [newPosition, setNewPosition] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [dutyDraft, setDutyDraft] = useState<{ index: number; text: string } | null>(null); // index = -1 → новый пункт
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    setError("");
    Promise.all([getPositions(), getRegulations(), getRegulationAssignments(), getEmployees(), getDepartments()])
      .then(([positions, regulations, assignments, employees, departments]) => setData({ positions, regulations, assignments, employees, departments }))
      .catch((e) => setError(apiError(e)));
  }, []);
  useEffect(load, [load]);
  useEffect(() => { if (!notice) return; const t = window.setTimeout(() => setNotice(null), 4000); return () => window.clearTimeout(t); }, [notice]);

  const positions = data?.positions ?? [];
  const regulations = data?.regulations ?? [];
  const assignments = data?.assignments ?? [];
  const employees = data?.employees ?? [];
  const departments = data?.departments ?? [];
  const regsOf = (pid: string) => regulations.filter((r) => r.position_id === pid);
  const staffOf = (pid: string) => employees.filter((e) => e.position_id === pid && e.status !== "fired");
  const assignedTo = (rid: string) => assignments.filter((a) => a.regulation_id === rid).length;

  const position = positions.find((p) => p.id === positionId) ?? positions[0];
  const variantsHere = position ? regsOf(position.id) : [];
  const regulation = variantsHere.find((r) => r.id === regulationId) ?? variantsHere[0];

  const setRegs = (fn: (list: Regulation[]) => Regulation[]) => setData((d) => d && { ...d, regulations: fn(d.regulations) });
  const report = (e: unknown) => setNotice({ text: apiError(e), error: true });
  const patch = async (r: Regulation, payload: RegulationPayload, done?: string) => {
    try {
      const saved = await updateRegulation(r.id, payload);
      setRegs((list) => list.map((x) => (x.id === saved.id ? saved : x)));
      if (done) setNotice({ text: done });
      return true;
    } catch (e) { report(e); return false; }
  };

  const saveRegulation = async (pid: string, payload: RegulationPayload & { name: string }) => {
    if (regDialog?.edit) {
      const saved = await updateRegulation(regDialog.edit.id, payload);
      setRegs((list) => list.map((x) => (x.id === saved.id ? saved : x)));
      setNotice({ text: "Вариант сохранён" });
    } else {
      const saved = await createRegulation({ position_id: pid, ...payload });
      setRegs((list) => [...list, saved]);
      setPositionId(pid); setRegulationId(saved.id); setTab("library");
      setNotice({ text: `Вариант «${saved.name}» создан` });
    }
  };
  const duplicate = async (r: Regulation) => {
    try {
      const saved = await createRegulation({ position_id: r.position_id, name: `${r.name} (копия)`, summary: r.summary, goal: r.goal, duties: r.duties, status: "draft" });
      setRegs((list) => [...list, saved]);
      setRegulationId(saved.id);
      setNotice({ text: "Создана копия-черновик" });
    } catch (e) { report(e); }
  };
  const remove = async (r: Regulation) => {
    const n = assignedTo(r.id);
    if (!window.confirm(`Удалить вариант «${r.name}»?${n ? ` Назначение снимется у ${plural(n, ["сотрудника", "сотрудников", "сотрудников"])}.` : ""}`)) return;
    try {
      await deleteRegulation(r.id);
      setData((d) => d && { ...d, regulations: d.regulations.filter((x) => x.id !== r.id), assignments: d.assignments.filter((a) => a.regulation_id !== r.id) });
      setRegulationId("");
      setNotice({ text: "Вариант удалён" });
    } catch (e) { report(e); }
  };
  const addPosition = async () => {
    const name = newPosition?.trim();
    if (!name) { setNewPosition(null); return; }
    try {
      const saved: Position = await createPosition({ name });
      setData((d) => d && { ...d, positions: [...d.positions, saved].sort((a, b) => a.name.localeCompare(b.name, "ru")) });
      setPositionId(saved.id); setNewPosition(null);
    } catch (e) { report(e); }
  };
  const saveDuty = async () => {
    if (!regulation || !dutyDraft) return;
    const text = dutyDraft.text.trim();
    if (!text) { setDutyDraft(null); return; }
    const duties = dutyDraft.index < 0 ? [...regulation.duties, text] : regulation.duties.map((d, i) => (i === dutyDraft.index ? text : d));
    if (await patch(regulation, { duties })) setDutyDraft(dutyDraft.index < 0 ? { index: -1, text: "" } : null);
  };
  const unassign = async (a: RegulationAssignment) => {
    try {
      await removeRegulationAssignment(a.id);
      setData((d) => d && { ...d, assignments: d.assignments.filter((x) => x.id !== a.id) });
      setNotice({ text: "Назначение снято" });
    } catch (e) { report(e); }
  };

  if (!data) return <div className={s.page}><LoadState error={error} retry={load} /></div>;

  const empById = new Map(employees.map((e) => [e.id, e]));
  const regById = new Map(regulations.map((r) => [r.id, r]));
  const posName = (id: string | null) => positions.find((p) => p.id === id)?.name ?? "Должность не указана";
  const q = query.trim().toLowerCase();
  const assignmentCards = assignments
    .map((a) => ({ a, e: empById.get(a.employee_id), r: regById.get(a.regulation_id) }))
    .filter((x): x is { a: RegulationAssignment; e: Employee; r: Regulation } => !!x.e && !!x.r)
    .filter((x) => !q || `${x.e.full_name} ${x.r.name} ${posName(x.e.position_id)}`.toLowerCase().includes(q))
    .sort((x, y) => x.e.full_name.localeCompare(y.e.full_name, "ru"));
  const unassigned = employees.filter((e) => e.status !== "fired" && !assignments.some((a) => a.employee_id === e.id))
    .filter((e) => !q || `${e.full_name} ${posName(e.position_id)}`.toLowerCase().includes(q))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "ru"));

  return (
    <div className={s.page}>
      <button type="button" className={s.back} onClick={() => navigate(-1)}><ChevronLeft size={16} />Управление</button>
      <header className={s.heading}>
        <div>
          <h1>Регламенты должностей</h1>
          <p>Создавайте варианты обязанностей для каждой должности и назначайте подходящий регламент сотрудникам.</p>
        </div>
        <button type="button" className={s.primaryBtn} onClick={() => setRegDialog({ positionId: position?.id })} disabled={!positions.length}><Plus size={17} />Создать регламент</button>
      </header>

      <div className={s.tabs} role="tablist" aria-label="Разделы регламентов">
        <button type="button" role="tab" aria-selected={tab === "library"} className={tab === "library" ? s.tabActive : ""} onClick={() => setTab("library")}>Библиотека регламентов</button>
        <button type="button" role="tab" aria-selected={tab === "assignments"} className={tab === "assignments" ? s.tabActive : ""} onClick={() => setTab("assignments")}>Назначения сотрудникам</button>
      </div>

      {tab === "library" && (
        <div className={s.library}>
          <section className={s.card} aria-label="Должности">
            <header className={s.cardHead}><h2>Должности</h2><p>Выберите должность для настройки</p></header>
            <ul className={s.positionList}>
              {positions.map((p) => (
                <li key={p.id}>
                  <button type="button" className={`${s.positionItem} ${position?.id === p.id ? s.positionActive : ""}`} aria-current={position?.id === p.id} onClick={() => { setPositionId(p.id); setRegulationId(""); setDutyDraft(null); setEditingGoal(null); }}>
                    <span className={s.posIcon}><BriefcaseBusiness size={17} /></span>
                    <span className={s.posCopy}><strong>{p.name}</strong><small>{variants(regsOf(p.id).length)} · {staffCount(staffOf(p.id).length)}</small></span>
                    <ChevronRight size={16} />
                  </button>
                </li>
              ))}
              {!positions.length && <li className={s.muted}>Должностей пока нет</li>}
            </ul>
            {newPosition !== null ? (
              <form className={s.inlineAdd} onSubmit={(e) => { e.preventDefault(); void addPosition(); }}>
                <input type="text" aria-label="Название должности" value={newPosition} maxLength={255} placeholder="Название должности" autoFocus onChange={(e) => setNewPosition(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setNewPosition(null); }} />
                <button type="submit" className={s.iconBtn} aria-label="Сохранить должность"><Check size={16} /></button>
                <button type="button" className={s.iconBtn} aria-label="Отменить" onClick={() => setNewPosition(null)}><X size={16} /></button>
              </form>
            ) : (
              <button type="button" className={s.addLink} onClick={() => setNewPosition("")}><Plus size={16} />Добавить должность</button>
            )}
          </section>

          {position ? (
            <section className={`${s.card} ${s.detailCard}`} aria-label={`Регламенты должности ${position.name}`}>
              <header className={s.band}>
                <div>
                  <span className={s.chip}><BriefcaseBusiness size={14} />{staffCount(staffOf(position.id).length)} на должности</span>
                  <h2>{position.name}</h2>
                  <p>Настройте разные варианты функционала для этой должности</p>
                </div>
                <button type="button" className={s.whiteBtn} onClick={() => setRegDialog({ positionId: position.id })}><Plus size={17} />Новый вариант</button>
              </header>

              {variantsHere.length ? (
                <div className={s.variantsGrid}>
                  <nav className={s.variants} aria-label="Варианты функционала">
                    <span className={s.overline}>Варианты функционала</span>
                    {variantsHere.map((r) => (
                      <button key={r.id} type="button" className={`${s.variant} ${regulation?.id === r.id ? s.variantActive : ""}`} aria-current={regulation?.id === r.id} onClick={() => { setRegulationId(r.id); setDutyDraft(null); setEditingGoal(null); }}>
                        <span><strong>{r.name}</strong><small>{r.status === "draft" ? "Черновик" : r.summary || "Вариант функционала"}</small></span>
                        <em title="Назначено сотрудникам">{assignedTo(r.id)}</em>
                      </button>
                    ))}
                  </nav>

                  {regulation && (
                    <article className={s.detail}>
                      <header className={s.detailHead}>
                        <div>
                          <h3>{regulation.name}<span className={regulation.status === "active" ? s.badgeActive : s.badgeDraft}>{regulation.status === "active" ? "Активен" : "Черновик"}</span></h3>
                          <p>Обновлён {whenLabel(regulation.updated_at)}{regulation.updated_by_name ? ` · ${regulation.updated_by_name}` : ""}</p>
                        </div>
                        <div className={s.detailActions}>
                          <Menu label={`Действия с вариантом ${regulation.name}`} items={[
                            { label: "Редактировать", icon: <Pencil size={15} />, onClick: () => setRegDialog({ edit: regulation }) },
                            regulation.status === "active"
                              ? { label: "Перевести в черновик", icon: <Clock size={15} />, onClick: () => void patch(regulation, { status: "draft" }, "Вариант переведён в черновик") }
                              : { label: "Сделать активным", icon: <Check size={15} />, onClick: () => void patch(regulation, { status: "active" }, "Вариант активен") },
                            { label: "Дублировать", icon: <Copy size={15} />, onClick: () => void duplicate(regulation) },
                            { label: "Удалить", icon: <Trash2 size={15} />, onClick: () => void remove(regulation), danger: true },
                          ]} />
                          <button type="button" className={s.outlineBtn} onClick={() => setAssign({ regulationId: regulation.id })}>Назначить</button>
                        </div>
                      </header>

                      <div className={s.goal}>
                        <div className={s.goalHead}>
                          <span className={s.overline}>Цель должности</span>
                          {editingGoal === null && <button type="button" className={s.iconBtn} aria-label="Изменить цель должности" onClick={() => setEditingGoal(regulation.goal ?? "")}><Pencil size={14} /></button>}
                        </div>
                        {editingGoal !== null ? (
                          <form onSubmit={async (e) => { e.preventDefault(); if (await patch(regulation, { goal: editingGoal.trim() || null })) setEditingGoal(null); }}>
                            <textarea aria-label="Цель должности" rows={3} value={editingGoal} maxLength={5000} autoFocus onChange={(e) => setEditingGoal(e.target.value)} />
                            <div className={s.rowActions}>
                              <button type="button" className={s.ghostBtn} onClick={() => setEditingGoal(null)}>Отмена</button>
                              <button type="submit" className={s.primaryBtn}>Сохранить</button>
                            </div>
                          </form>
                        ) : (
                          <p className={regulation.goal ? "" : s.muted}>{regulation.goal || "Цель не указана — опишите, какой результат даёт должность."}</p>
                        )}
                      </div>

                      <div className={s.dutiesHead}>
                        <div><h4>Обязанности</h4><p>{points(regulation.duties.length)} в регламенте</p></div>
                        <button type="button" className={s.addLink} onClick={() => setDutyDraft({ index: -1, text: "" })}><Plus size={16} />Добавить пункт</button>
                      </div>
                      <ol className={s.duties}>
                        {regulation.duties.map((d, i) => (
                          <li key={`${i}-${d}`} className={s.duty}>
                            <span className={s.num}>{i + 1}</span>
                            {dutyDraft?.index === i ? (
                              <DutyInput value={dutyDraft.text} onChange={(text) => setDutyDraft({ index: i, text })} onSave={saveDuty} onCancel={() => setDutyDraft(null)} />
                            ) : (
                              <>
                                <span className={s.dutyText}>{d}</span>
                                <span className={s.dutyActions}>
                                  <button type="button" className={s.iconBtn} aria-label={`Изменить пункт ${i + 1}`} onClick={() => setDutyDraft({ index: i, text: d })}><Pencil size={14} /></button>
                                  <button type="button" className={s.iconBtn} aria-label={`Удалить пункт ${i + 1}`} onClick={() => void patch(regulation, { duties: regulation.duties.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
                                </span>
                              </>
                            )}
                          </li>
                        ))}
                        {dutyDraft?.index === -1 && (
                          <li className={`${s.duty} ${s.dutyNew}`}>
                            <span className={s.num}>{regulation.duties.length + 1}</span>
                            <DutyInput value={dutyDraft.text} onChange={(text) => setDutyDraft({ index: -1, text })} onSave={saveDuty} onCancel={() => setDutyDraft(null)} placeholder="Новая обязанность — Enter, чтобы добавить" />
                          </li>
                        )}
                        {!regulation.duties.length && dutyDraft === null && <li className={s.emptyDuties}>Пунктов пока нет. Нажмите «Добавить пункт».</li>}
                      </ol>
                    </article>
                  )}
                </div>
              ) : (
                <div className={s.emptyState}>
                  <BriefcaseBusiness size={28} />
                  <p>У должности «{position.name}» пока нет регламентов.</p>
                  <button type="button" className={s.primaryBtn} onClick={() => setRegDialog({ positionId: position.id })}><Plus size={17} />Создать первый вариант</button>
                </div>
              )}
            </section>
          ) : (
            <section className={`${s.card} ${s.emptyState}`}><p>Добавьте должность, чтобы настроить регламенты.</p></section>
          )}
        </div>
      )}

      {tab === "assignments" && (
        <section className={s.card}>
          <header className={`${s.cardHead} ${s.assignHead}`}>
            <div><h2>Назначения сотрудникам</h2><p>У каждого сотрудника может быть свой вариант функционала</p></div>
            <div className={s.assignTools}>
              <div className={s.searchBox}><Search size={15} /><input type="search" aria-label="Поиск по назначениям" placeholder="Сотрудник или регламент" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
              <button type="button" className={s.primaryBtn} onClick={() => setAssign({})} disabled={!regulations.length}><Plus size={17} />Назначить регламент</button>
            </div>
          </header>
          <div className={s.assignGrid}>
            {assignmentCards.map(({ a, e, r }) => (
              <article key={a.id} className={s.assignCard}>
                <header>
                  <Avatar e={e} />
                  <div className={s.posCopy}><strong>{e.full_name}</strong><small>{posName(e.position_id)}</small></div>
                  <Menu label={`Действия с назначением ${e.full_name}`} items={[
                    { label: "Изменить регламент", icon: <Pencil size={15} />, onClick: () => setAssign({ employeeId: e.id, regulationId: r.id }) },
                    { label: "Открыть вариант", icon: <ChevronRight size={15} />, onClick: () => { setTab("library"); setPositionId(r.position_id); setRegulationId(r.id); } },
                    { label: "Снять назначение", icon: <Trash2 size={15} />, onClick: () => void unassign(a), danger: true },
                  ]} />
                </header>
                <div className={s.assigned}>
                  <span className={s.overline}>Назначенный регламент</span>
                  <strong>{r.name}</strong>
                  {a.acknowledged_at ? <small className={s.ok}><Check size={14} />Ознакомлен {shortDate(a.acknowledged_at)}</small>
                    : a.require_ack ? <small className={s.pending}><Clock size={14} />Ожидает ознакомления</small>
                    : <small className={s.muted}><Check size={14} />Без запроса ознакомления</small>}
                </div>
              </article>
            ))}
            {!assignmentCards.length && <p className={s.muted}>{q ? "Ничего не найдено" : "Назначений пока нет — нажмите «Назначить регламент»."}</p>}
          </div>
          {unassigned.length > 0 && (
            <div className={s.unassigned}>
              <span className={s.overline}>Без регламента · {unassigned.length}</span>
              <ul>
                {unassigned.map((e) => (
                  <li key={e.id}>
                    <Avatar e={e} size="sm" />
                    <span className={s.posCopy}><strong>{e.full_name}</strong><small>{posName(e.position_id)}</small></span>
                    <button type="button" className={s.addLink} onClick={() => setAssign({ employeeId: e.id })} disabled={!regulations.length}><Plus size={15} />Назначить</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {regDialog && (
        <RegulationDialog positions={positions} initial={regDialog.edit} positionId={regDialog.positionId} onClose={() => setRegDialog(null)} onSave={saveRegulation} />
      )}
      {assign && (
        <AssignDialog
          employees={employees} positions={positions} departments={departments} regulations={regulations} assignments={assignments}
          employeeId={assign.employeeId} regulationId={assign.regulationId} onClose={() => setAssign(null)}
          onAssigned={(saved) => setData((d) => d && { ...d, assignments: [saved, ...d.assignments.filter((x) => x.employee_id !== saved.employee_id)] })}
        />
      )}
      {notice && (
        <button type="button" className={`${s.toast} ${notice.error ? s.toastError : ""}`} onClick={() => setNotice(null)} role="status">
          {notice.error ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}{notice.text}
        </button>
      )}
    </div>
  );
};

const DutyInput: React.FC<{ value: string; onChange: (v: string) => void; onSave: () => void; onCancel: () => void; placeholder?: string }> = ({ value, onChange, onSave, onCancel, placeholder }) => (
  <form className={s.dutyForm} onSubmit={(e) => { e.preventDefault(); onSave(); }}>
    <input type="text" aria-label="Текст обязанности" value={value} maxLength={2000} placeholder={placeholder} autoFocus onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }} />
    <button type="submit" className={s.iconBtn} aria-label="Сохранить пункт"><Check size={16} /></button>
    <button type="button" className={s.iconBtn} aria-label="Отменить" onClick={onCancel}><X size={16} /></button>
  </form>
);

export default RegulationsPage;
