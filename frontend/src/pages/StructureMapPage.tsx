import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ChevronRight, Download, Pencil, Plus, Search, Trash2, Users, X } from "lucide-react";
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from "../api/departments";
import { getPositions, createPosition, updatePosition, deletePosition } from "../api/positions";
import { getEmployees, updateEmployee } from "../api/employees";
import { getCompany } from "../api/companies";
import type { Department, DepartmentCreate, Employee, Position } from "../types";
import { EMPLOYEE_STATUS_LABELS } from "../types";
import { useAuth } from "../context/AuthContext";
import DepartmentEditModal from "../components/DepartmentEditModal";
import DescriptionText from "../components/DescriptionText";
import page from "./PageContent.module.css";
import s from "./StructureMap.module.css";

const TONES = ["blue", "sand", "green", "rose", "purple", "slate"] as const;
const NO_POSITION = "__none__";
// Branch layout: columns adapt to the available width; wrap into rows before falling back to horizontal scroll.
const COL_MIN = 228, COL_MAX = 300, GAP = 10, SPINE = 14;

type Draft = { kind: "department" | "position"; parentId: string | null };
type Selection = { kind: "department" | "position" | "employee"; id: string } | null;
type Drag = { kind: "position" | "employee"; id: string };
type DropTarget = { kind: "department" | "position" | "company"; id: string };
type DragAttrs = Pick<React.HTMLAttributes<HTMLElement>, "draggable" | "onDragStart" | "onDragEnd">;
const COMPANY_TARGET: DropTarget = { kind: "company", id: "company" };

const apiError = (err: unknown, fallback: string) => {
  const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return typeof msg === "string" ? msg : fallback;
};
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  return `${n} ${m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many}`;
};
const people = (n: number) => plural(n, "сотрудник", "сотрудника", "сотрудников");
const roles = (n: number) => plural(n, "должность", "должности", "должностей");
const units = (n: number) => plural(n, "отдел", "отдела", "отделов");
const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, "ru");

const InlineForm: React.FC<{ label: string; placeholder: string; onSubmit: (name: string) => Promise<void>; onCancel: () => void }> = ({ label, placeholder, onSubmit, onCancel }) => {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Введите название"); return; }
    setSaving(true);
    try { await onSubmit(name.trim()); } catch (err) { setError(apiError(err, "Не удалось сохранить")); setSaving(false); }
  };
  return (
    <form className={s.inlineForm} onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <input aria-label={label} placeholder={placeholder} value={name} maxLength={255} autoFocus disabled={saving}
        onChange={(e) => { setName(e.target.value); setError(""); }} />
      {error && <p className={s.formError}>{error}</p>}
      <div className={s.formActions}>
        <button type="button" className={s.button} onClick={onCancel} disabled={saving}>Отмена</button>
        <button type="submit" className={`${s.button} ${s.primary}`} disabled={saving}>Создать</button>
      </div>
    </form>
  );
};

type HoverAttrs = Pick<React.HTMLAttributes<HTMLElement>, "onMouseEnter" | "onMouseLeave" | "onFocus" | "onBlur">;
const PersonNode: React.FC<{ title: string; name: string; tone: string; selected: boolean; compact?: boolean; onSelect: () => void; drag?: DragAttrs; avatarOf?: string; hover?: HoverAttrs }> = ({ title, name, tone, selected, compact, onSelect, drag, avatarOf, hover }) => (
  <button type="button" className={`${s.personNode} ${compact ? s.compact : ""} ${selected ? s.selected : ""} ${drag?.draggable ? s.draggable : ""}`} onClick={onSelect} aria-pressed={selected} {...drag} {...hover}>
    <span className={`${s.avatar} ${s[`tone_${tone}`]}`}>{initials(avatarOf ?? name)}</span>
    <span className={s.personCopy}><strong>{title}</strong><small>{name}</small></span>
    {!compact && <ChevronRight size={15} aria-hidden="true" />}
  </button>
);

const LeaderForm: React.FC<{ employees: Employee[]; onSubmit: (name: string, employeeId: string) => Promise<void>; onCancel: () => void }> = ({ employees, onSubmit, onCancel }) => {
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Введите название должности"); return; }
    setSaving(true);
    try { await onSubmit(name.trim(), employeeId); } catch (err) { setError(apiError(err, "Не удалось сохранить")); setSaving(false); }
  };
  return (
    <form className={`${s.inlineForm} ${s.leaderForm}`} onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <input aria-label="Должность руководства" placeholder="Например: Генеральный директор" value={name} maxLength={255} autoFocus disabled={saving}
        onChange={(e) => { setName(e.target.value); setError(""); }} />
      <select aria-label="Сотрудник на должности" value={employeeId} disabled={saving} onChange={(e) => setEmployeeId(e.target.value)}>
        <option value="">— вакансия —</option>
        {employees.filter((x) => x.status !== "fired").sort((a, b) => a.full_name.localeCompare(b.full_name, "ru")).map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}
      </select>
      {employeeId && <p className={s.formHint}>Сотрудник перейдёт на уровень руководства компании (вне отделов). Руководство отделами сохранится.</p>}
      {error && <p className={s.formError}>{error}</p>}
      <div className={s.formActions}>
        <button type="button" className={s.button} onClick={onCancel} disabled={saving}>Отмена</button>
        <button type="submit" className={`${s.button} ${s.primary}`} disabled={saving}>Создать</button>
      </div>
    </form>
  );
};

const StructureMapPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = user?.role === "company_admin" || user?.role === "hr";

  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companyName, setCompanyName] = useState("Компания");
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<Department | null>(null);
  const [hovered, setHovered] = useState<{ id: string; rect: DOMRect } | null>(null);
  const hoverTimer = useRef<number>();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [openRoles, setOpenRoles] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<Selection>(null);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(0);
  const newColumnRef = useRef<HTMLDivElement>(null);
  const [leaderDraft, setLeaderDraft] = useState(false);
  const [removingTop, setRemovingTop] = useState<{ pos: Position; deptId: string; busy: boolean; error: string } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [busyMove, setBusyMove] = useState(false);
  const [over, setOver] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (user?.company_id) getCompany(user.company_id).then((c) => c?.name && setCompanyName(c.name)).catch(() => undefined);
    Promise.all([
      getDepartments().then(setDepartments),
      getPositions().then(setPositions),
      getEmployees().then(setEmployees),
    ]).finally(() => setLoading(false));
  }, [user?.company_id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Escape" && !(e.target as HTMLElement)?.closest?.("form, [role=dialog]")) setSelection(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => setAvail(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading]);

  // ── Structure helpers (real CRM data) ────────────────────────────────────────
  const deptById = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);
  const posById = useMemo(() => new Map(positions.map((p) => [p.id, p])), [positions]);
  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const childrenOf = (id: string | null) =>
    departments.filter((d) => (id === null ? !d.parent_id || !deptById.has(d.parent_id) : d.parent_id === id)).sort(byName);
  const descendants = (id: string): string[] => childrenOf(id).flatMap((c) => [c.id, ...descendants(c.id)]);
  const peopleIn = (id: string) => {
    const scope = new Set([id, ...descendants(id)]);
    return employees.filter((e) => e.department_id && scope.has(e.department_id)).length;
  };
  const positionsOf = (deptId: string) => positions.filter((p) => p.department_id === deptId).sort(byName);
  const holders = (posId: string) => employees.filter((e) => e.position_id === posId).sort((a, b) => a.full_name.localeCompare(b.full_name, "ru"));
  const belongsHere = (e: Employee, deptId: string) => e.department_id === deptId || !e.department_id || !deptById.has(e.department_id);
  /** Staff whose own department differs from their position's department, grouped by position. */
  const foreignStaff = (deptId: string) => {
    const groups = new Map<string, Employee[]>();
    employees.forEach((e) => {
      const pos = e.position_id ? posById.get(e.position_id) : undefined;
      if (e.department_id !== deptId || !pos || pos.department_id === deptId || topIds.has(pos.id)) return;
      groups.set(pos.id, [...(groups.get(pos.id) ?? []), e]);
    });
    return [...groups.entries()].map(([posId, staff]) => ({ pos: posById.get(posId)!, staff })).sort((a, b) => byName(a.pos, b.pos));
  };
  const unpositioned = (deptId: string) => employees.filter((e) => e.department_id === deptId && (!e.position_id || !posById.has(e.position_id)));
  const titleOf = (e: Employee) => (e.position_id && posById.get(e.position_id)?.name) || "Должность не указана";
  const deptPath = (id: string | null): string => {
    const names: string[] = [];
    for (let d = id ? deptById.get(id) : undefined; d && names.length < 20; d = d.parent_id ? deptById.get(d.parent_id) : undefined) names.unshift(d.name);
    return names.join(" · ");
  };
  const roots = childrenOf(null);
  // Nearest department head up the chain (a subdepartment without a head reports to its parent's head).
  const headFor = (deptId: string | null, exclude?: string) => {
    for (let d = deptId ? deptById.get(deptId) : undefined, i = 0; d && i < 20; d = d.parent_id ? deptById.get(d.parent_id) : undefined, i++) {
      if (d.head_id && d.head_id !== exclude && empById.has(d.head_id)) return empById.get(d.head_id);
    }
    return undefined;
  };
  // ── Company leadership (positions without a department) & subordination ────
  const topPositions = positions.filter((p) => !p.department_id || !deptById.has(p.department_id)).sort(byName);
  const topIds = new Set(topPositions.map((p) => p.id));
  const isTop = (e?: Employee) => !!e?.position_id && topIds.has(e.position_id);
  const topHolderCount = new Set(topPositions.flatMap((p) => holders(p.id).filter((e) => e.status !== "fired").map((e) => e.id))).size;
  const topLeader = (exclude?: string) => topPositions.flatMap((p) => holders(p.id)).find((e) => e.id !== exclude && e.status !== "fired");
  /** Direct reports: members of departments the person heads (sub-departments without their own head included),
   *  heads of their sub-departments, explicit manager links; company leaders also lead top-level departments. */
  const directOf = (id: string): Set<string> => {
    const out = new Set<string>();
    const add = (e?: Employee) => { if (e && e.id !== id) out.add(e.id); };
    const seen = new Set<string>();
    const absorb = (d: Department) => {
      if (seen.has(d.id)) return;
      seen.add(d.id);
      employees.forEach((e) => { if (e.department_id === d.id) add(e); });
      childrenOf(d.id).forEach((c) => { const h = c.head_id ? empById.get(c.head_id) : undefined; if (h && h.id !== id) add(h); else absorb(c); });
    };
    departments.filter((d) => d.head_id === id).forEach(absorb);
    // Implicit control over top-level departments only when the company has a single leader.
    if (isTop(empById.get(id)) && topHolderCount === 1) roots.forEach((r) => { const h = r.head_id ? empById.get(r.head_id) : undefined; if (h && h.id !== id) add(h); else absorb(r); });
    employees.forEach((e) => { if (e.manager_id === id) add(e); });
    return out;
  };
  const statsCache = new Map<string, { direct: number; total: number }>();
  const statsOf = (id: string) => {
    const cached = statsCache.get(id);
    if (cached) return cached;
    const active = (x: string) => empById.get(x)?.status !== "fired";
    const direct = directOf(id);
    const all = new Set<string>();
    const stack = [...direct];
    while (stack.length) {
      const x = stack.pop()!;
      if (x === id || all.has(x)) continue;
      all.add(x);
      directOf(x).forEach((y) => stack.push(y));
    }
    const res = { direct: [...direct].filter(active).length, total: [...all].filter(active).length };
    statsCache.set(id, res);
    return res;
  };

  const toneOf = useMemo(() => {
    const map = new Map<string, string>();
    const top = (id: string) => { let d = deptById.get(id); for (let i = 0; d?.parent_id && deptById.has(d.parent_id) && i < 20; i++) d = deptById.get(d.parent_id); return d?.id; };
    const rootIds = departments.filter((d) => !d.parent_id || !deptById.has(d.parent_id)).sort(byName).map((d) => d.id);
    departments.forEach((d) => { const r = top(d.id); map.set(d.id, TONES[Math.max(0, rootIds.indexOf(r ?? "")) % TONES.length]); });
    return (deptId: string | null) => (deptId && map.get(deptId)) || "slate";
  }, [departments, deptById]);

  // ── Search ───────────────────────────────────────────────────────────────────
  const q = query.trim().toLocaleLowerCase("ru");
  const hit = (text: string | null | undefined) => !!q && !!text && text.toLocaleLowerCase("ru").includes(q);
  const matches = useMemo(() => {
    if (!q) return null;
    const depts = new Set<string>(), full = new Set<string>(), roleIds = new Set<string>(), emps = new Set<string>();
    const mark = (id: string | null) => { for (let d = id ? deptById.get(id) : undefined; d && !depts.has(d.id); d = d.parent_id ? deptById.get(d.parent_id) : undefined) depts.add(d.id); };
    departments.forEach((d) => { if (hit(d.name)) { mark(d.id); [d.id, ...descendants(d.id)].forEach((c) => { depts.add(c); full.add(c); }); } });
    positions.forEach((p) => { if (hit(p.name)) { roleIds.add(p.id); mark(p.department_id); } });
    employees.forEach((e) => {
      if (!hit(e.full_name) && !hit(e.email)) return;
      emps.add(e.id);
      roleIds.add(e.position_id && posById.has(e.position_id) ? e.position_id : `${NO_POSITION}:${e.department_id}`);
      if (e.position_id) roleIds.add(`${e.position_id}@${e.department_id}`);
      mark(e.department_id ?? (e.position_id ? posById.get(e.position_id)?.department_id ?? null : null));
    });
    return { depts, full, roleIds, emps };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, departments, positions, employees]);
  const deptVisible = (id: string) => !matches || matches.depts.has(id);
  const deptOpen = (id: string) => (matches ? true : !collapsed.has(id));

  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
    set((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const allCollapsed = roots.length > 0 && roots.every((r) => collapsed.has(r.id));

  // ── Mutations (existing API) ─────────────────────────────────────────────────
  const addDepartment = async (name: string, parentId: string | null) => {
    const saved: Department = await createDepartment({ name, parent_id: parentId });
    setDepartments((prev) => [...prev, saved]);
    setDraft(null);
    setSelection({ kind: "department", id: saved.id });
  };
  const addPosition = async (name: string, departmentId: string) => {
    const saved: Position = await createPosition({ name, department_id: departmentId });
    setPositions((prev) => [...prev, saved]);
    setDraft(null);
  };
  const addLeaderPosition = async (name: string, employeeId: string) => {
    const saved: Position = await createPosition({ name, department_id: null });
    setPositions((prev) => [...prev, saved]);
    if (employeeId) {
      const emp: Employee = await updateEmployee(employeeId, { position_id: saved.id, department_id: null });
      setEmployees((prev) => prev.map((e) => (e.id === emp.id ? emp : e)));
    }
    setLeaderDraft(false);
    setSelection({ kind: "position", id: saved.id });
  };
  const openRemoveTop = (pos: Position) => {
    const holder = holders(pos.id)[0];
    const headed = holder ? departments.find((d) => d.head_id === holder.id && !d.parent_id) ?? departments.find((d) => d.head_id === holder.id) : undefined;
    setRemovingTop({ pos, deptId: headed?.id ?? roots[0]?.id ?? "", busy: false, error: "" });
  };
  /** Takes a position off the company leadership level: back into a department, or deleted outright. */
  const removeTop = async (mode: "move" | "delete") => {
    if (!removingTop) return;
    const { pos, deptId } = removingTop;
    const dept = deptById.get(deptId);
    const staff = holders(pos.id);
    if (mode === "move" && !dept) { setRemovingTop({ ...removingTop, error: "Выберите отдел" }); return; }
    if (mode === "delete" && !confirm(`Удалить должность «${pos.name}» безвозвратно?\nПривязанные к ней материалы базы знаний будут удалены, уроки и тесты отвяжутся.${staff.length ? `\nСотрудники (${staff.length}) останутся без должности${dept ? ` в отделе «${dept.name}»` : ""}.` : ""}`)) return;
    setRemovingTop({ ...removingTop, busy: true, error: "" });
    try {
      if (mode === "move") {
        const saved: Position = await updatePosition(pos.id, { department_id: deptId });
        setPositions((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
        const moved: Employee[] = await Promise.all(staff.map((e) => updateEmployee(e.id, { department_id: deptId })));
        const byId = new Map(moved.map((e) => [e.id, e]));
        setEmployees((prev) => prev.map((e) => byId.get(e.id) ?? e));
        setNotice({ text: `«${pos.name}» перенесена в отдел «${dept!.name}»` });
      } else {
        const moved: Employee[] = await Promise.all(staff.map((e) => updateEmployee(e.id, { position_id: null, department_id: deptId || null })));
        const byId = new Map(moved.map((e) => [e.id, e]));
        setEmployees((prev) => prev.map((e) => byId.get(e.id) ?? e));
        await deletePosition(pos.id);
        setPositions((prev) => prev.filter((p) => p.id !== pos.id));
        if (selection?.id === pos.id) setSelection(null);
        setNotice({ text: `Должность «${pos.name}» удалена` });
      }
      setRemovingTop(null);
    } catch (err) {
      setRemovingTop({ ...removingTop, busy: false, error: apiError(err, "Не удалось сохранить. Изменения не применены полностью — обновите страницу.") });
    }
  };
  const changeHead = async (dept: Department, headId: string) => {
    try {
      const saved: Department = await updateDepartment(dept.id, { head_id: headId || null });
      setDepartments((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
      setNotice({ text: `Руководитель отдела «${dept.name}» обновлён` });
    } catch (err) {
      setNotice({ text: apiError(err, "Не удалось сменить руководителя"), error: true });
    }
  };
  const remove = async (dept: Department) => {
    if (!confirm(`Удалить отдел «${dept.name}»? Его подотделы перейдут на уровень выше.`)) return;
    await deleteDepartment(dept.id);
    setDepartments(await getDepartments());
    if (selection?.id === dept.id) setSelection(null);
  };
  const saveEdit = async (id: string, payload: Partial<DepartmentCreate>) => {
    const saved: Department = await updateDepartment(id, payload);
    setDepartments((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
    return saved;
  };
  const startNewDepartment = () => {
    setQuery("");
    setDraft({ kind: "department", parentId: null });
    requestAnimationFrame(() => newColumnRef.current?.scrollIntoView({ behavior: "smooth", inline: "end", block: "nearest" }));
  };
  // ── Drag & drop: positions → departments, employees → positions / departments ──
  const canDrop = (d: Drag | null, target: DropTarget) => {
    if (!d || !canEdit) return false;
    if (d.kind === "position") {
      if (target.kind === "company") return !topIds.has(d.id);
      return target.kind === "department" && posById.get(d.id)?.department_id !== target.id;
    }
    const emp = empById.get(d.id);
    if (!emp || target.kind === "company") return false;
    return target.kind === "position" ? emp.position_id !== target.id : emp.department_id !== target.id;
  };
  const dragAttrs = (kind: Drag["kind"], id: string): DragAttrs => (canEdit && !busyMove ? {
    draggable: true,
    onDragStart: (e) => {
      e.stopPropagation();
      e.dataTransfer.setData("text/plain", id);
      e.dataTransfer.effectAllowed = "move";
      setDrag({ kind, id });
    },
    onDragEnd: () => { setDrag(null); setOver(null); },
  } : {});
  const dropAttrs = (target: DropTarget) => {
    const key = `${target.kind}:${target.id}`;
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!drag) return;
        // An invalid position target lets the enclosing department take the drop.
        if (!canDrop(drag, target)) { if (target.kind !== "position") { e.stopPropagation(); if (over === key) setOver(null); } return; }
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        if (over !== key) setOver(key);
      },
      onDragLeave: (e: React.DragEvent) => {
        if (over === key && !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setOver(null);
      },
      onDrop: (e: React.DragEvent) => {
        if (!drag || !canDrop(drag, target)) return;
        e.preventDefault();
        e.stopPropagation();
        const current = drag;
        setDrag(null);
        setOver(null);
        void move(current, target);
      },
    };
  };
  const dropClass = (target: DropTarget) => (over === `${target.kind}:${target.id}` ? s.dropOver : "");
  const move = async (d: Drag, target: DropTarget) => {
    try {
      if (d.kind === "position" && target.kind === "company") {
        const pos = posById.get(d.id)!;
        const staff = holders(pos.id).filter((e) => e.department_id);
        if (!confirm(`Перенести должность «${pos.name}» на уровень руководства компании?${staff.length ? `\nСотрудники на должности (${staff.length}) выйдут из отделов, руководство отделами сохранится.` : ""}`)) return;
        setBusyMove(true);
        const saved: Position = await updatePosition(pos.id, { department_id: null });
        setPositions((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
        const moved: Employee[] = await Promise.all(staff.map((e) => updateEmployee(e.id, { department_id: null })));
        const byId = new Map(moved.map((e) => [e.id, e]));
        setEmployees((prev) => prev.map((e) => byId.get(e.id) ?? e));
        setNotice({ text: `«${pos.name}» — теперь руководство компании` });
        return;
      }
      if (d.kind === "position") {
        const pos = posById.get(d.id)!;
        const dept = deptById.get(target.id)!;
        // Only staff who sit in the position's current department move with it.
        const staff = holders(pos.id).filter((e) => e.department_id !== dept.id && (e.department_id === pos.department_id || !e.department_id));
        if (!confirm(`Перенести должность «${pos.name}» в отдел «${dept.name}»?${staff.length ? `\nСотрудники на должности (${staff.length}) перейдут вместе с ней.` : ""}`)) return;
        setBusyMove(true);
        const saved: Position = await updatePosition(pos.id, { department_id: dept.id });
        setPositions((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
        const moved: Employee[] = await Promise.all(staff.map((e) => updateEmployee(e.id, { department_id: dept.id })));
        const byId = new Map(moved.map((e) => [e.id, e]));
        setEmployees((prev) => prev.map((e) => byId.get(e.id) ?? e));
        setCollapsed((prev) => { const next = new Set(prev); next.delete(dept.id); return next; });
        setNotice({ text: `Должность «${pos.name}» перенесена в «${dept.name}»` });
        return;
      }
      const emp = empById.get(d.id)!;
      let payload: { department_id: string | null; position_id: string | null };
      let text: string;
      if (target.kind === "position") {
        const pos = posById.get(target.id)!;
        const dept = pos.department_id ? deptById.get(pos.department_id) : undefined;
        if (!confirm(`Назначить ${emp.full_name} на должность «${pos.name}»${dept ? ` (отдел «${dept.name}»)` : ""}?`)) return;
        payload = { position_id: pos.id, department_id: pos.department_id };
        text = `${emp.full_name} → «${pos.name}»`;
      } else {
        const dept = deptById.get(target.id)!;
        const pos = emp.position_id ? posById.get(emp.position_id) : undefined;
        if (!confirm(`Перевести ${emp.full_name} в отдел «${dept.name}»?${pos ? `\nДолжность «${pos.name}» сохранится. Чтобы сменить её, перетащите сотрудника на нужную должность.` : ""}`)) return;
        payload = { department_id: dept.id, position_id: emp.position_id };
        text = `${emp.full_name} переведён(а) в «${dept.name}»`;
      }
      setBusyMove(true);
      const saved: Employee = await updateEmployee(emp.id, payload);
      setEmployees((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
      const roleKey = saved.position_id && posById.has(saved.position_id) ? saved.position_id : `${NO_POSITION}:${saved.department_id}`;
      setOpenRoles((prev) => new Set(prev).add(roleKey));
      setNotice({ text });
    } catch (err) {
      setNotice({ text: apiError(err, "Не удалось перенести. Изменения не сохранены."), error: true });
    } finally {
      setBusyMove(false);
    }
  };

  const isDraft = (kind: Draft["kind"], parentId: string | null) => draft?.kind === kind && draft.parentId === parentId;
  const isSel = (kind: NonNullable<Selection>["kind"], id: string) => selection?.kind === kind && selection.id === id;

  // ── Rendering ────────────────────────────────────────────────────────────────
  const tools = (dept: Department) => canEdit && (
    <span className={s.cardTools}>
      <button type="button" className={s.iconBtn} onClick={(e) => { e.stopPropagation(); setEditing(dept); }} aria-label={`Редактировать отдел ${dept.name}`} title="Редактировать">
        <Pencil size={14} aria-hidden="true" />
      </button>
      <button type="button" className={s.iconBtn} onClick={(e) => { e.stopPropagation(); remove(dept); }} aria-label={`Удалить отдел ${dept.name}`} title="Удалить">
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </span>
  );

  const renderRole = (key: string, name: string, staff: Employee[], deptId: string, position?: Position, foreignDept?: string) => {
    if (matches && !matches.full.has(deptId) && !matches.roleIds.has(key)) return null;
    const showAll = !matches || matches.full.has(deptId) || hit(name);
    const shown = showAll ? staff : staff.filter((e) => matches!.emps.has(e.id));
    const open = openRoles.has(key) || (!!matches && staff.some((e) => matches.emps.has(e.id)));
    if (foreignDept !== undefined) position = undefined;
    return (
      <li key={key} className={`${s.roleBranch} ${position ? dropClass({ kind: "position", id: position.id }) : ""}`} {...(position ? dropAttrs({ kind: "position", id: position.id }) : {})}>
        <div className={`${s.roleNode} ${position && isSel("position", position.id) ? s.roleSelected : ""} ${hit(name) ? s.hit : ""} ${position && canEdit ? s.draggable : ""} ${drag?.kind === "position" && drag.id === position?.id ? s.dragging : ""}`}
          {...(position ? dragAttrs("position", position.id) : {})} title={position && canEdit ? "Перетащите в другой отдел" : undefined}>
          <button type="button" className={s.disclosure} aria-expanded={open} aria-label={`${open ? "Скрыть" : "Показать"} сотрудников: ${name}`}
            onClick={() => toggle(setOpenRoles, key)} disabled={staff.length === 0}>
            <ChevronRight size={14} aria-hidden="true" className={open ? s.rotated : ""} />
          </button>
          <button type="button" className={s.roleBody} onClick={() => position ? setSelection({ kind: "position", id: position.id }) : toggle(setOpenRoles, key)}>
            <span className={s.roleName}>{name}</span>
            <small className={s.posCount}>{staff.length ? people(staff.length) : "вакансия"}{foreignDept !== undefined && <em className={s.foreign}> · должность отдела «{foreignDept}»</em>}</small>
          </button>
        </div>
        {open && staff.length > 0 && (
          <ul className={s.employees}>
            {shown.map((e) => (
              <li key={e.id} className={s.employeeNode}>
                <PersonNode compact title={titleOf(e)} name={e.full_name} tone={toneOf(deptId)} selected={isSel("employee", e.id)} onSelect={() => setSelection({ kind: "employee", id: e.id })} drag={dragAttrs("employee", e.id)} hover={hoverOf(e)} />
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  };

  const renderContents = (dept: Department, depth: number): React.ReactNode => {
    const deptPositions = positionsOf(dept.id);
    const loose = unpositioned(dept.id);
    const rolesList = [
      ...deptPositions.map((p) => renderRole(p.id, p.name, holders(p.id).filter((e) => belongsHere(e, dept.id)), dept.id, p)),
      ...foreignStaff(dept.id).map(({ pos, staff }) => renderRole(`${pos.id}@${dept.id}`, pos.name, staff, dept.id, pos, pos.department_id ? deptById.get(pos.department_id)?.name ?? "—" : "—")),
      loose.length > 0 ? renderRole(`${NO_POSITION}:${dept.id}`, "Без должности", loose, dept.id) : null,
    ].filter(Boolean);
    return (
      <>
        {rolesList.length > 0 && <ul className={s.roles} aria-label={`Должности: ${dept.name}`}>{rolesList}</ul>}
        {childrenOf(dept.id).filter((c) => deptVisible(c.id)).map((child) => renderUnit(child, depth + 1))}
        {canEdit && !matches && (isDraft("position", dept.id) ? (
          <InlineForm label={`Новая должность в отделе ${dept.name}`} placeholder="Название должности" onSubmit={(n) => addPosition(n, dept.id)} onCancel={() => setDraft(null)} />
        ) : isDraft("department", dept.id) ? (
          <InlineForm label={`Новый подотдел в отделе ${dept.name}`} placeholder="Название подотдела" onSubmit={(n) => addDepartment(n, dept.id)} onCancel={() => setDraft(null)} />
        ) : (
          <div className={s.addRow}>
            <button type="button" className={s.addBtn} onClick={() => setDraft({ kind: "position", parentId: dept.id })} aria-label={`Добавить должность в отдел ${dept.name}`}><Plus size={13} aria-hidden="true" /> должность</button>
            <button type="button" className={s.addBtn} onClick={() => setDraft({ kind: "department", parentId: dept.id })} aria-label={`Добавить подотдел в отдел ${dept.name}`}><Plus size={13} aria-hidden="true" /> подотдел</button>
          </div>
        ))}
      </>
    );
  };

  const renderUnit = (dept: Department, depth: number): React.ReactNode => {
    const open = deptOpen(dept.id);
    const Heading = depth <= 1 ? "h4" : "h5";
    return (
      <div key={dept.id} className={`${s.unitBranch} ${dropClass({ kind: "department", id: dept.id })}`} {...dropAttrs({ kind: "department", id: dept.id })}>
        <div className={`${s.unitNode} ${isSel("department", dept.id) ? s.unitSelected : ""} ${hit(dept.name) ? s.hit : ""}`}>
          <button type="button" className={s.disclosure} aria-expanded={open} aria-label={`${open ? "Свернуть" : "Раскрыть"} отдел ${dept.name}`} onClick={() => toggle(setCollapsed, dept.id)}>
            <ChevronRight size={14} aria-hidden="true" className={open ? s.rotated : ""} />
          </button>
          <button type="button" className={s.unitBody} onClick={() => setSelection({ kind: "department", id: dept.id })}>
            <span className={s.unitIcon}><Building2 size={16} aria-hidden="true" /></span>
            <span className={s.unitCopy}>
              <Heading className={s.unitName}>{dept.name}</Heading>
              <small>{roles(positionsOf(dept.id).length)} · {peopleIn(dept.id)} чел.</small>
            </span>
          </button>
          {tools(dept)}
        </div>
        {open && <div className={s.unitContent}>{renderContents(dept, depth)}</div>}
      </div>
    );
  };

  const renderBranch = (dept: Department) => {
    const open = deptOpen(dept.id);
    const head = dept.head_id ? empById.get(dept.head_id) : undefined;
    const subCount = descendants(dept.id).length;
    return (
      <div key={dept.id} className={`${s.leaderBranch} ${open ? s.expanded : ""} ${dropClass({ kind: "department", id: dept.id })}`} {...dropAttrs({ kind: "department", id: dept.id })}>
        <div className={`${s.leaderCard} ${isSel("department", dept.id) ? s.cardSelected : ""}`}>
          <div className={`${s.departmentTitle} ${hit(dept.name) ? s.hit : ""}`}>
            <button type="button" className={s.titleBtn} onClick={() => setSelection({ kind: "department", id: dept.id })}>
              <span>Отдел</span>
              <h3 className={s.deptName}>{dept.name}</h3>
            </button>
            {tools(dept)}
          </div>
          {head ? (
            <PersonNode title={titleOf(head)} name={head.full_name} tone={toneOf(dept.id)} selected={isSel("employee", head.id)} onSelect={() => setSelection({ kind: "employee", id: head.id })} hover={hoverOf(head)} />
          ) : (
            <div className={s.noHead}>Руководитель не назначен</div>
          )}
          <div className={s.leaderMeta}>
            <span>{roles(positionsOf(dept.id).length)}{subCount ? ` · ${units(subCount)}` : ""} · <b>{peopleIn(dept.id)} чел.</b></span>
            <button type="button" aria-expanded={open} aria-label={`${open ? "Свернуть" : "Раскрыть"} ветку ${dept.name}`} onClick={() => toggle(setCollapsed, dept.id)}>
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className={s.branchContent}>
          {open ? renderContents(dept, 0) : (
            <button type="button" className={s.collapsedSummary} onClick={() => toggle(setCollapsed, dept.id)}>
              <Building2 size={16} aria-hidden="true" />
              <span><strong>{roles(positionsOf(dept.id).length)}{subCount ? ` · ${units(subCount)}` : ""}</strong><small>{people(peopleIn(dept.id))}</small></span>
            </button>
          )}
        </div>
      </div>
    );
  };

  // Наведение на сотрудника с заполненными обязанностями → всплывающая карточка
  const hoverOf = (e: Employee): HoverAttrs | undefined => {
    if (!e.duties) return undefined;
    const show = (ev: React.SyntheticEvent<HTMLElement>) => {
      const rect = ev.currentTarget.getBoundingClientRect();
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = window.setTimeout(() => setHovered({ id: e.id, rect }), 250);
    };
    const hide = () => { window.clearTimeout(hoverTimer.current); setHovered(null); };
    return { onMouseEnter: show, onFocus: show, onMouseLeave: hide, onBlur: hide };
  };
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  // ── Inspector ────────────────────────────────────────────────────────────────
  const current = selection && (selection.kind === "department" ? deptById.has(selection.id) : selection.kind === "position" ? posById.has(selection.id) : empById.has(selection.id)) ? selection : null;
  const closeBtn = <button type="button" className={s.closeBtn} onClick={() => setSelection(null)} aria-label="Закрыть карточку" title="Закрыть (Esc)"><X size={16} aria-hidden="true" /></button>;

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className={s.relationRow}><span>{label}</span><strong>{children}</strong></div>
  );
  const PersonLink = ({ e }: { e?: Employee }) => e
    ? <button type="button" className={s.linkBtn} onClick={() => setSelection({ kind: "employee", id: e.id })}>{e.full_name}</button>
    : <>—</>;

  const renderInspector = () => {
    if (!current) return null;
    if (current.kind === "department") {
      const d = deptById.get(current.id)!;
      const head = d.head_id ? empById.get(d.head_id) : undefined;
      const parent = d.parent_id ? deptById.get(d.parent_id) : undefined;
      const subs = childrenOf(d.id);
      const deptPositions = positionsOf(d.id);
      return (
        <>
          <div className={s.inspectorHead}><span>Карточка отдела</span>{closeBtn}</div>
          <div className={s.hero}>
            <span className={`${s.avatar} ${s.avatarLarge} ${s[`tone_${toneOf(d.id)}`]}`}><Building2 size={22} aria-hidden="true" /></span>
            <div><strong className={s.heroTitle}>{d.name}</strong><p>{parent ? `Входит в «${parent.name}»` : companyName}</p></div>
            {canEdit && <button type="button" className={s.editButton} onClick={() => setEditing(d)} aria-label={`Изменить отдел ${d.name}`} title="Редактировать"><Pencil size={15} aria-hidden="true" /></button>}
          </div>
          <div className={s.section}>
            <span className={s.detailLabel}>Место в структуре</span>
            <Row label="Руководитель"><PersonLink e={head} /></Row>
            <Row label="Вышестоящий">{parent ? <button type="button" className={s.linkBtn} onClick={() => setSelection({ kind: "department", id: parent.id })}>{parent.name}</button> : companyName}</Row>
            <Row label="Подотделы">{subs.length ? subs.map((c) => c.name).join(", ") : "Нет"}</Row>
            <Row label="Численность">{people(peopleIn(d.id))}</Row>
          </div>
          {d.description && <div className={s.section}><span className={s.detailLabel}>Описание</span><DescriptionText text={d.description} font={d.description_font} size={d.description_size} /></div>}
          <div className={s.section}>
            <span className={s.detailLabel}>Должности · {deptPositions.length}</span>
            {deptPositions.length ? (
              <ul className={s.questions}>
                {deptPositions.map((p) => (
                  <li key={p.id}><button type="button" className={s.linkBtn} onClick={() => setSelection({ kind: "position", id: p.id })}>{p.name}</button><small>{holders(p.id).length}</small></li>
                ))}
              </ul>
            ) : <p className={s.muted}>Должности ещё не добавлены</p>}
          </div>
        </>
      );
    }
    if (current.kind === "position") {
      const p = posById.get(current.id)!;
      const d = p.department_id ? deptById.get(p.department_id) : undefined;
      const staff = holders(p.id);
      const head = headFor(p.department_id);
      return (
        <>
          <div className={s.inspectorHead}><span>Карточка должности</span>{closeBtn}</div>
          <div className={s.hero}>
            <span className={`${s.avatar} ${s.avatarLarge} ${s[`tone_${toneOf(p.department_id)}`]}`}>{initials(p.name)}</span>
            <div><strong className={s.heroTitle}>{p.name}</strong><p>{d ? deptPath(d.id) : "Руководство компании"}</p></div>
          </div>
          <div className={s.section}>
            <span className={s.detailLabel}>Место в структуре</span>
            <Row label="Подразделение">{d ? <button type="button" className={s.linkBtn} onClick={() => setSelection({ kind: "department", id: d.id })}>{d.name}</button> : "Руководство компании"}</Row>
            <Row label="Руководитель"><PersonLink e={d ? head ?? topLeader() : undefined} /></Row>
            <Row label="Занято">{staff.length ? people(staff.length) : "Вакансия"}</Row>
          </div>
          {(p.required_skills?.length ?? 0) > 0 && (
            <div className={s.section}><span className={s.detailLabel}>Ключевые навыки</span><div className={s.tags}>{p.required_skills!.map((k) => <span key={k}>{k}</span>)}</div></div>
          )}
          {p.description && <div className={s.section}><span className={s.detailLabel}>Зона ответственности</span><p className={s.text}>{p.description}</p></div>}
          <div className={s.section}>
            <span className={s.detailLabel}>Сотрудники</span>
            {staff.length ? (
              <div className={s.stack}>{staff.map((e) => <PersonNode key={e.id} compact title={titleOf(e)} name={e.full_name} tone={toneOf(p.department_id)} selected={false} onSelect={() => setSelection({ kind: "employee", id: e.id })} />)}</div>
            ) : <p className={s.muted}>На должность пока никто не назначен</p>}
          </div>
        </>
      );
    }
    const e = empById.get(current.id)!;
    const pos = e.position_id ? posById.get(e.position_id) : undefined;
    const d = e.department_id ? deptById.get(e.department_id) : undefined;
    const manager = (e.manager_id ? empById.get(e.manager_id) : undefined) ?? headFor(e.department_id, e.id) ?? (isTop(e) ? undefined : topLeader(e.id));
    const stats = statsOf(e.id);
    const headed = departments.filter((x) => x.head_id === e.id);
    return (
      <>
        <div className={s.inspectorHead}><span>Карточка сотрудника</span>{closeBtn}</div>
        <div className={s.hero}>
          <span className={`${s.avatar} ${s.avatarLarge} ${s[`tone_${toneOf(e.department_id)}`]}`}>{initials(e.full_name)}</span>
          <div><strong className={s.heroTitle}>{titleOf(e)}</strong><p>{e.full_name}</p></div>
          {canEdit && <button type="button" className={s.editButton} onClick={() => navigate(`/dashboard/employees/${e.id}`)} aria-label={`Редактировать сотрудника ${e.full_name}`} title="Редактировать"><Pencil size={15} aria-hidden="true" /></button>}
        </div>
        <div className={s.section}>
          <span className={s.detailLabel}>Место в структуре</span>
          <Row label="Руководитель"><PersonLink e={manager} /></Row>
          {pos && d && pos.department_id && pos.department_id !== d.id && (
            <Row label="Внимание"><span className={s.warn}>Должность относится к отделу «{deptById.get(pos.department_id)?.name}»</span></Row>
          )}
          {headed.length > 0 && <Row label="Руководит">{headed.map((x) => x.name).join(", ")}</Row>}
          <Row label="Прямые подчинённые">{stats.direct ? people(stats.direct) : "Нет"}</Row>
          <Row label="Всего в подчинении">{stats.total ? people(stats.total) : "Нет"}</Row>
          <Row label="Подразделение">{d ? deptPath(d.id) : isTop(e) ? "Руководство компании" : "—"}</Row>
          {e.status && <Row label="Статус">{EMPLOYEE_STATUS_LABELS[e.status] ?? e.status}</Row>}
        </div>
        {e.duties && <div className={s.section}><span className={s.detailLabel}>Обязанности</span><DescriptionText text={e.duties} font={e.duties_font} size={e.duties_size} /></div>}
        {(pos?.required_skills?.length ?? 0) > 0 && (
          <div className={s.section}><span className={s.detailLabel}>Зона ответственности</span><div className={s.tags}>{pos!.required_skills!.map((k) => <span key={k}>{k}</span>)}</div></div>
        )}
        {pos?.description && <div className={s.section}><span className={s.detailLabel}>Обращайтесь по вопросам</span><p className={s.text}>{pos.description}</p></div>}
        {(e.email || e.phone) && (
          <div className={s.section}>
            <span className={s.detailLabel}>Контакты</span>
            {e.email && <Row label="Email"><a href={`mailto:${e.email}`}>{e.email}</a></Row>}
            {e.phone && <Row label="Телефон"><a href={`tel:${e.phone}`}>{e.phone}</a></Row>}
          </div>
        )}
        <button type="button" className={`${s.button} ${s.fullWidth}`} onClick={() => navigate(`/dashboard/employees/${e.id}`)}>Открыть полный профиль</button>
      </>
    );
  };

  const parentOptions = editing ? [
    { value: "", label: "— верхний уровень —" },
    ...departments.filter((d) => d.id !== editing.id && !descendants(editing.id).includes(d.id)).sort(byName).map((d) => ({ value: d.id, label: d.name })),
  ] : [];
  const treeOrder: Department[] = [];
  const pushTree = (list: Department[]) => list.forEach((d) => { treeOrder.push(d); pushTree(childrenOf(d.id)); });
  pushTree(roots);
  const visibleRoots = roots.filter((r) => deptVisible(r.id));

  const renderLeader = (p: Position) => {
    const staff = holders(p.id);
    const target: DropTarget = { kind: "position", id: p.id };
    return (
      <div key={p.id} className={`${s.topCard} ${dropClass(target)} ${isSel("position", p.id) ? s.cardSelected : ""} ${hit(p.name) ? s.hit : ""}`} {...dropAttrs(target)}>
        <div className={`${s.topTitle} ${canEdit ? s.draggable : ""} ${drag?.kind === "position" && drag.id === p.id ? s.dragging : ""}`} {...dragAttrs("position", p.id)} title={canEdit ? "Перетащите в отдел, чтобы перенести" : undefined}>
          <button type="button" className={s.titleBtn} onClick={() => setSelection({ kind: "position", id: p.id })}>
            <span>Руководство</span>
            <h3 className={s.deptName}>{p.name}</h3>
          </button>
          {canEdit && (
            <span className={s.cardTools}>
              <button type="button" className={s.iconBtn} onClick={() => openRemoveTop(p)} aria-label={`Убрать из руководства ${p.name}`} title="Убрать из руководства">
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </span>
          )}
        </div>
        {staff.length ? staff.map((e) => {
          const st = statsOf(e.id);
          return (
            <PersonNode key={e.id} title={e.full_name} name={st.total ? `в подчинении ${st.total} чел. · прямых ${st.direct}` : "нет подчинённых"} avatarOf={e.full_name}
              tone="purple" selected={isSel("employee", e.id)} onSelect={() => setSelection({ kind: "employee", id: e.id })} drag={dragAttrs("employee", e.id)} hover={hoverOf(e)} />
          );
        }) : <div className={s.noHead}>Вакансия{canEdit ? " — перетащите сюда сотрудника" : ""}</div>}
      </div>
    );
  };
  const visibleTop = topPositions.filter((p) => !matches || matches.roleIds.has(p.id));
  const showTop = canEdit ? !matches || visibleTop.length > 0 : visibleTop.length > 0;

  const leaderRows = [...new Set([
    ...topPositions.flatMap((p) => holders(p.id).map((e) => e.id)),
    ...departments.map((d) => d.head_id).filter((x): x is string => !!x && empById.has(x)),
    ...employees.map((e) => e.manager_id).filter((x): x is string => !!x && empById.has(x)),
  ])].map((id) => {
    const e = empById.get(id)!;
    return { e, title: titleOf(e), headed: departments.filter((d) => d.head_id === id).map((d) => d.name), ...statsOf(id) };
  }).sort((a, b) => b.total - a.total || a.e.full_name.localeCompare(b.e.full_name, "ru"));
  const deptRows: { d: Department; depth: number }[] = [];
  const walk = (id: string | null, depth: number) => childrenOf(id).forEach((d) => { deptRows.push({ d, depth }); walk(d.id, depth + 1); });
  walk(null, 0);
  const exportCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [["Руководитель", "Должность", "Руководит отделами", "Прямые подчинённые", "Всего в подчинении"],
      ...leaderRows.map((r) => [r.e.full_name, r.title, r.headed.join(", "), r.direct, r.total])];
    const blob = new Blob(["\ufeff" + lines.map((l) => l.map(esc).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `podchinenie-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const items: React.ReactNode[] = visibleRoots.map(renderBranch);
  if (canEdit && !matches) items.push(
    <div key="__new" className={`${s.leaderBranch} ${s.newBranch}`} ref={newColumnRef}>
      {isDraft("department", null) ? (
        <InlineForm label="Новый отдел" placeholder="Название отдела" onSubmit={(n) => addDepartment(n, null)} onCancel={() => setDraft(null)} />
      ) : (
        <button type="button" className={s.newDept} onClick={() => setDraft({ kind: "department", parentId: null })}>
          <span className={s.plus}><Plus size={16} aria-hidden="true" /></span>
          Новый отдел
        </button>
      )}
    </div>,
  );
  const width = avail || 1200;
  const fit = (w: number) => Math.max(1, Math.floor((w + GAP) / (COL_MIN + GAP)));
  const stack = fit(width) === 1;
  const multi = !stack && items.length > fit(width);
  const perRow = stack ? 1 : multi ? fit(width - SPINE) : Math.max(1, items.length);
  const col = stack ? Math.min(340, width) : Math.min(COL_MAX, Math.floor((width - (multi ? SPINE : 0) - GAP * (perRow - 1)) / perRow));
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow));
  const layout = stack ? s.stack : multi ? s.multi : s.single;
  const inspector = renderInspector();

  return (
    <div className={`${page.page} ${s.module}`}>
      <header className={s.pageHeader}>
        <div className={s.headTitle}>
          <p className={s.eyebrow}>Команда</p>
          <h1 className={s.title}>Структура компании</h1>
          <p className={s.subtitle}>Карта подчинения и зон ответственности · {units(departments.length)} · {roles(positions.length)} · {people(employees.length)}</p>
        </div>
        {!loading && (
          <div className={s.headActions}>
            <label className={s.search}>
              <Search size={17} aria-hidden="true" />
              <input ref={searchRef} type="search" aria-label="Поиск по структуре" placeholder="Найти отдел, должность или сотрудника" value={query} onChange={(e) => { setQuery(e.target.value); setSelection(null); }} />
              <span className={s.shortcut}>Ctrl K</span>
            </label>
            <button type="button" className={s.button} onClick={() => setReportOpen(true)}>
              <Users size={16} aria-hidden="true" /> Подчинённость
            </button>
            <button type="button" className={s.button} disabled={!!matches} onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(departments.map((d) => d.id)))}>
              {allCollapsed ? "Раскрыть ветки" : "Свернуть ветки"}
            </button>
            {canEdit && (
              <button type="button" className={`${s.button} ${s.primary}`} onClick={startNewDepartment}>
                <Plus size={16} aria-hidden="true" /> Добавить отдел
              </button>
            )}
          </div>
        )}
      </header>

      {loading ? (
        <div className={page.loading}>Загрузка...</div>
      ) : (
        <div className={`${s.workspace} ${inspector ? s.withInspector : ""}`}>
          <section className={s.canvas} aria-label="Оргструктура">
            <span className={s.structureKey}><i /> линия прямого подчинения{canEdit && <> · перетащите должность или сотрудника, чтобы перенести</>}</span>
            <div className={s.scroller} ref={scrollerRef}>
              <div className={s.orgTree}>
                <div className={s.rootNode}>
                  <div className={s.companyNode}>
                    <span className={s.companySymbol}><Building2 size={18} aria-hidden="true" /></span>
                    <span><small>Компания</small><strong>{companyName}</strong></span>
                    <em>{units(roots.length)} верхнего уровня · {people(employees.length)}</em>
                  </div>
                </div>

                {showTop && (
                  <div className={`${s.topLevel} ${dropClass(COMPANY_TARGET)}`} {...dropAttrs(COMPANY_TARGET)}>
                    <span className={s.levelLabel}>Руководство компании</span>
                    <div className={s.topCards}>
                      {visibleTop.map(renderLeader)}
                      {canEdit && !matches && (leaderDraft ? (
                        <LeaderForm employees={employees} onSubmit={addLeaderPosition} onCancel={() => setLeaderDraft(false)} />
                      ) : (
                        <button type="button" className={s.addLeader} onClick={() => setLeaderDraft(true)} aria-label="Добавить должность руководства" title="Добавить должность руководства (директор, собственник)">
                          <span className={s.plus}><Plus size={16} aria-hidden="true" /></span>
                          {topPositions.length === 0 && <span>Директор / собственник</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {items.length > 0 && (
                  <div className={`${s.rows} ${layout}`} style={{ "--col": `${col}px` } as React.CSSProperties}>
                    {rows.map((row, i) => (
                      <div key={i} className={s.leadersRow} style={{ gridTemplateColumns: `repeat(${row.length}, var(--col))` }}>{row}</div>
                    ))}
                  </div>
                )}
                {roots.length === 0 && !canEdit && <div className={s.empty}>Отделов пока нет.</div>}
                {matches && visibleRoots.length === 0 && <div className={s.empty}>Ничего не найдено по запросу «{query.trim()}».</div>}
              </div>
            </div>
          </section>

          {inspector && <aside className={s.inspector} aria-label="Информационная карточка">{inspector}</aside>}
        </div>
      )}

      {removingTop && (
        <div className={s.backdrop} onClick={(e) => e.target === e.currentTarget && !removingTop.busy && setRemovingTop(null)}>
          <div className={`${s.report} ${s.dialogSmall}`} role="dialog" aria-modal="true" aria-label="Убрать из руководства" onKeyDown={(e) => e.key === "Escape" && !removingTop.busy && setRemovingTop(null)}>
            <div className={s.reportHead}>
              <div>
                <strong className={s.heroTitle}>Убрать «{removingTop.pos.name}» из руководства</strong>
                <p className={s.muted}>
                  {holders(removingTop.pos.id).length
                    ? `На должности: ${holders(removingTop.pos.id).map((e) => e.full_name).join(", ")}. Руководство отделами не изменится.`
                    : "На должности никого нет."}
                </p>
              </div>
              <button type="button" className={s.closeBtn} onClick={() => setRemovingTop(null)} disabled={removingTop.busy} aria-label="Закрыть" autoFocus><X size={16} aria-hidden="true" /></button>
            </div>
            <label className={s.field}>
              <span>Отдел, куда перенести должность и сотрудников</span>
              <select value={removingTop.deptId} disabled={removingTop.busy} onChange={(e) => setRemovingTop({ ...removingTop, deptId: e.target.value, error: "" })}>
                <option value="">— выберите отдел —</option>
                {deptRows.map(({ d, depth }) => <option key={d.id} value={d.id}>{"\u00a0\u00a0".repeat(depth)}{d.name}</option>)}
              </select>
            </label>
            {removingTop.error && <p className={s.formError}>{removingTop.error}</p>}
            <div className={s.dialogActions}>
              <button type="button" className={`${s.button} ${s.danger}`} onClick={() => removeTop("delete")} disabled={removingTop.busy}>Удалить должность</button>
              <span />
              <button type="button" className={s.button} onClick={() => setRemovingTop(null)} disabled={removingTop.busy}>Отмена</button>
              <button type="button" className={`${s.button} ${s.primary}`} onClick={() => removeTop("move")} disabled={removingTop.busy}>Перенести в отдел</button>
            </div>
          </div>
        </div>
      )}

      {reportOpen && (
        <div className={s.backdrop} onClick={(e) => e.target === e.currentTarget && setReportOpen(false)}>
          <div className={s.report} role="dialog" aria-modal="true" aria-label="Отчёт по подчинению" onKeyDown={(e) => e.key === "Escape" && setReportOpen(false)}>
            <div className={s.reportHead}>
              <div>
                <strong className={s.heroTitle}>Отчёт по подчинению</strong>
                <p className={s.muted}>Без учёта уволенных. Руководитель отдела отвечает за отдел и подотделы без своего руководителя; руководство компании — за отделы верхнего уровня.</p>
              </div>
              <button type="button" className={s.button} onClick={exportCsv}><Download size={15} aria-hidden="true" /> CSV</button>
              <button type="button" className={s.closeBtn} onClick={() => setReportOpen(false)} aria-label="Закрыть отчёт" autoFocus><X size={16} aria-hidden="true" /></button>
            </div>
            <span className={s.detailLabel}>Руководители</span>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead><tr><th>Руководитель</th><th>Должность</th><th>Руководит</th><th>Прямые</th><th>Всего в подчинении</th></tr></thead>
                <tbody>
                  {leaderRows.map((r) => (
                    <tr key={r.e.id}>
                      <td><button type="button" className={s.linkBtn} onClick={() => { setSelection({ kind: "employee", id: r.e.id }); setReportOpen(false); }}>{r.e.full_name}</button></td>
                      <td>{r.title}</td>
                      <td>{r.headed.join(", ") || "—"}</td>
                      <td className={s.num}>{r.direct}</td>
                      <td className={s.num}><b>{r.total}</b></td>
                    </tr>
                  ))}
                  {leaderRows.length === 0 && <tr><td colSpan={5} className={s.muted}>Руководители ещё не назначены</td></tr>}
                </tbody>
              </table>
            </div>
            <span className={s.detailLabel}>Руководители отделов</span>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead><tr><th>Отдел</th><th>Руководитель</th><th>Сотрудников</th></tr></thead>
                <tbody>
                  {deptRows.map(({ d, depth }) => (
                    <tr key={d.id}>
                      <td style={{ paddingLeft: 10 + depth * 16 }}>{d.name}</td>
                      <td>{canEdit ? (
                        <select aria-label={`Руководитель отдела ${d.name}`} value={d.head_id ?? ""} onChange={(e) => changeHead(d, e.target.value)}>
                          <option value="">— не назначен —</option>
                          {employees.filter((x) => x.status !== "fired" || x.id === d.head_id).sort((a, b) => a.full_name.localeCompare(b.full_name, "ru")).map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}
                        </select>
                      ) : (d.head_id ? empById.get(d.head_id)?.full_name ?? "—" : "—")}</td>
                      <td className={s.num}>{peopleIn(d.id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {hovered && (() => {
        const e = empById.get(hovered.id);
        if (!e?.duties) return null;
        const width = 320;
        const left = hovered.rect.right + 10 + width < window.innerWidth ? hovered.rect.right + 10 : Math.max(8, hovered.rect.left - width - 10);
        const top = Math.min(Math.max(8, hovered.rect.top), window.innerHeight - 340);
        return (
          <div className={s.hoverCard} style={{ left, top, width }} role="tooltip">
            <strong>{e.full_name}</strong>
            <small>{titleOf(e)}</small>
            <DescriptionText text={e.duties} font={e.duties_font} size={e.duties_size} />
          </div>
        );
      })()}

      {notice && (
        <button type="button" className={`${s.toast} ${notice.error ? s.toastError : ""}`} onClick={() => setNotice(null)} role="status">
          <span>{notice.error ? "!" : "✓"}</span>{notice.text}
        </button>
      )}

      {editing && (
        <DepartmentEditModal
          key={editing.id}
          department={editing}
          order={treeOrder}
          employees={employees}
          parentOptions={parentOptions}
          onSave={saveEdit}
          onNavigate={(d) => setEditing(deptById.get(d.id) ?? d)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};

export default StructureMapPage;
