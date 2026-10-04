import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from "../api/departments";
import { getPositions, createPosition } from "../api/positions";
import { getEmployees } from "../api/employees";
import { getCompany } from "../api/companies";
import type { Department, Employee, Position } from "../types";
import { useAuth } from "../context/AuthContext";
import CreateModal from "../components/CreateModal";
import page from "./PageContent.module.css";
import styles from "./StructureMap.module.css";

const ACCENTS = ["#8c7ae6", "#e7a35c", "#6fa3d8", "#5fb08a", "#d784a6", "#9aa5b1"];

type Draft = { kind: "department" | "position"; parentId: string | null };

const apiError = (err: unknown, fallback: string) => {
  const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return typeof msg === "string" ? msg : fallback;
};

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
    <form className={styles.inlineForm} onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <input aria-label={label} placeholder={placeholder} value={name} maxLength={255} autoFocus disabled={saving}
        onChange={(e) => { setName(e.target.value); setError(""); }} />
      {error && <p className={styles.formError}>{error}</p>}
      <div className={styles.formActions}>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>Отмена</button>
        <button type="submit" className="btn-primary" disabled={saving}>Создать</button>
      </div>
    </form>
  );
};

const StructureMapPage: React.FC = () => {
  const { user } = useAuth();
  const canEdit = user?.role === "company_admin" || user?.role === "hr";

  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companyName, setCompanyName] = useState("Компания");
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<Department | null>(null);
  const newColumnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.company_id) getCompany(user.company_id).then((c) => c?.name && setCompanyName(c.name)).catch(() => undefined);
    Promise.all([
      getDepartments().then(setDepartments),
      getPositions().then(setPositions),
      getEmployees().then(setEmployees),
    ]).finally(() => setLoading(false));
  }, [user?.company_id]);

  const byName = (a: Department, b: Department) => a.name.localeCompare(b.name, "ru");
  const ids = useMemo(() => new Set(departments.map((d) => d.id)), [departments]);
  const childrenOf = (id: string | null) =>
    departments.filter((d) => (id === null ? !d.parent_id || !ids.has(d.parent_id) : d.parent_id === id)).sort(byName);
  const descendants = (id: string): string[] => childrenOf(id).flatMap((c) => [c.id, ...descendants(c.id)]);
  const peopleIn = (id: string) => {
    const scope = new Set([id, ...descendants(id)]);
    return employees.filter((e) => e.department_id && scope.has(e.department_id)).length;
  };
  const headName = (id: string | null) => (id ? employees.find((e) => e.id === id)?.full_name ?? null : null);
  const roots = childrenOf(null);

  const addDepartment = async (name: string, parentId: string | null) => {
    const saved: Department = await createDepartment({ name, parent_id: parentId });
    setDepartments((prev) => [...prev, saved]);
    setDraft(null);
  };
  const addPosition = async (name: string, departmentId: string) => {
    const saved: Position = await createPosition({ name, department_id: departmentId });
    setPositions((prev) => [...prev, saved]);
    setDraft(null);
  };
  const remove = async (dept: Department) => {
    if (!confirm(`Удалить отдел «${dept.name}»? Его подотделы перейдут на уровень выше.`)) return;
    await deleteDepartment(dept.id);
    setDepartments(await getDepartments());
  };
  const saveEdit = async (form: Record<string, string>) => {
    if (!editing) return;
    const name = form.name.trim();
    if (!name) throw { response: { data: { detail: "Введите название отдела" } } };
    const saved: Department = await updateDepartment(editing.id, {
      name, description: form.description.trim() || null, head_id: form.head_id || null, parent_id: form.parent_id || null,
    });
    setDepartments((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
    setEditing(null);
  };
  const startNewDepartment = () => {
    setDraft({ kind: "department", parentId: null });
    requestAnimationFrame(() => newColumnRef.current?.scrollIntoView({ behavior: "smooth", inline: "end", block: "nearest" }));
  };

  const isDraft = (kind: Draft["kind"], parentId: string | null) => draft?.kind === kind && draft.parentId === parentId;

  const renderDepartment = (dept: Department, depth: number): React.ReactNode => {
    const deptPositions = positions.filter((p) => p.department_id === dept.id).sort((a, b) => a.name.localeCompare(b.name, "ru"));
    const head = headName(dept.head_id);
    const Heading = depth === 0 ? "h3" : "h4";
    return (
      <div key={dept.id} className={depth === 0 ? styles.branch : styles.subBranch}>
        <div className={depth === 0 ? styles.deptCard : styles.subCard}>
          <div className={styles.cardTop}>
            <Heading className={styles.deptName}>{dept.name}</Heading>
            <span className={page.countBadge}>{peopleIn(dept.id)} чел.</span>
          </div>
          <p className={styles.head}>Руководитель: <strong>{head ?? "—"}</strong></p>
          {canEdit && (
            <div className={styles.cardTools}>
              <button type="button" className={styles.iconBtn} onClick={() => setEditing(dept)} aria-label={`Редактировать отдел ${dept.name}`} title="Редактировать">
                <Pencil size={15} aria-hidden="true" />
              </button>
              <button type="button" className={styles.iconBtn} onClick={() => remove(dept)} aria-label={`Удалить отдел ${dept.name}`} title="Удалить">
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {deptPositions.length > 0 && (
          <ul className={styles.positions} aria-label={`Должности: ${dept.name}`}>
            {deptPositions.map((p) => (
              <li key={p.id}><span>{p.name}</span><span className={styles.posCount}>{employees.filter((e) => e.position_id === p.id).length}</span></li>
            ))}
          </ul>
        )}

        {childrenOf(dept.id).map((child) => renderDepartment(child, depth + 1))}

        {canEdit && (isDraft("position", dept.id) ? (
          <InlineForm label={`Новая должность в отделе ${dept.name}`} placeholder="Название должности" onSubmit={(n) => addPosition(n, dept.id)} onCancel={() => setDraft(null)} />
        ) : isDraft("department", dept.id) ? (
          <InlineForm label={`Новый подотдел в отделе ${dept.name}`} placeholder="Название подотдела" onSubmit={(n) => addDepartment(n, dept.id)} onCancel={() => setDraft(null)} />
        ) : (
          <div className={styles.addRow}>
            <button type="button" className={styles.addBtn} onClick={() => setDraft({ kind: "position", parentId: dept.id })} aria-label={`Добавить должность в отдел ${dept.name}`}><Plus size={14} aria-hidden="true" /> должность</button>
            <button type="button" className={styles.addBtn} onClick={() => setDraft({ kind: "department", parentId: dept.id })} aria-label={`Добавить подотдел в отдел ${dept.name}`}><Plus size={14} aria-hidden="true" /> подотдел</button>
          </div>
        ))}
      </div>
    );
  };

  const parentOptions = editing ? [
    { value: "", label: "— верхний уровень —" },
    ...departments.filter((d) => d.id !== editing.id && !descendants(editing.id).includes(d.id)).sort(byName).map((d) => ({ value: d.id, label: d.name })),
  ] : [];

  return (
    <div className={page.page}>
      <div className={page.pageHeader}>
        <div>
          <h1 className={page.title}>Карта структуры</h1>
          <p className={page.subtitle}>{departments.length} отделов · {positions.length} должностей · {employees.length} сотрудников</p>
        </div>
        {canEdit && (
          <button className="btn-primary" onClick={startNewDepartment}>
            <Plus size={16} aria-hidden="true" /> Отдел
          </button>
        )}
      </div>

      {loading ? (
        <div className={page.loading}>Загрузка...</div>
      ) : (
        <div className={styles.map}>
          <div className={styles.tree}>
          <div className={styles.root}>
            <strong>{companyName}</strong>
            <span>{roots.length} отделов верхнего уровня</span>
          </div>
          <div className={styles.columns}>
            {roots.map((dept, i) => (
              <div key={dept.id} className={styles.column} style={{ "--branch": ACCENTS[i % ACCENTS.length] } as React.CSSProperties}>
                {renderDepartment(dept, 0)}
              </div>
            ))}
            {canEdit && (
              <div className={`${styles.column} ${styles.newColumn}`} ref={newColumnRef}>
                {isDraft("department", null) ? (
                  <InlineForm label="Новый отдел" placeholder="Название отдела" onSubmit={(n) => addDepartment(n, null)} onCancel={() => setDraft(null)} />
                ) : (
                  <button type="button" className={styles.newDept} onClick={() => setDraft({ kind: "department", parentId: null })}>
                    <span className={styles.plus}><Plus size={16} aria-hidden="true" /></span>
                    Новый отдел
                  </button>
                )}
              </div>
            )}
            {roots.length === 0 && !canEdit && <div className={page.emptyWide}>Отделов пока нет.</div>}
          </div>
          </div>
        </div>
      )}

      {editing && (
        <CreateModal
          title="Редактирование отдела"
          fields={[
            { name: "name", label: "Название отдела *", required: true, maxLength: 255 },
            { name: "description", label: "Описание" },
            { name: "head_id", label: "Руководитель", type: "select", options: [{ value: "", label: "— не выбран —" }, ...employees.map((e) => ({ value: e.id, label: e.full_name }))] },
            { name: "parent_id", label: "Входит в", type: "select", options: parentOptions },
          ]}
          onClose={() => setEditing(null)}
          onCreate={saveEdit}
          initialValues={{ name: editing.name, description: editing.description ?? "", head_id: editing.head_id ?? "", parent_id: editing.parent_id ?? "" }}
          submitLabel="Сохранить"
          errorMessage="Не удалось сохранить отдел"
        />
      )}
    </div>
  );
};

export default StructureMapPage;
