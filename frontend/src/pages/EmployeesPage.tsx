import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Trash2, Pencil } from "lucide-react";
import { apiError } from "../api/workspace";
import { getEmployees, createEmployee, deleteEmployee } from "../api/employees";
import { getDepartments } from "../api/departments";
import { getPositions } from "../api/positions";
import type { Employee, EmployeeCreate, Department, Position } from "../types";
import { EMPLOYEE_STATUS_LABELS } from "../types";
import { useAuth } from "../context/AuthContext";
import CreateModal from "../components/CreateModal";
import EmployeeEditModal from "../components/EmployeeEditModal";
import { EmployeeAvatar } from "../components/EmployeePhoto";
import styles from "./PageContent.module.css";
import statusStyles from "./EmployeeStatusFilters.module.css";

const STATUS_FILTERS = [
  { value: "working", label: "Работающие" },
  { value: "active", label: "Активные" },
  { value: "probation", label: "Испытательный срок" },
  { value: "vacation", label: "В отпуске" },
  { value: "fired", label: "Уволенные" },
  { value: "all", label: "Все" },
] as const;
const matchesStatus = (employee: Employee, status: string) => status === "all" || (status === "working" ? employee.status !== "fired" : employee.status === status);

const STATUS_COLORS: Record<string, string> = {
  active: "statusGreen",
  probation: "statusYellow",
  vacation: "statusBlue",
  fired: "statusRed",
};

const EmployeesPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const [error, setError] = useState("");
  const { user } = useAuth();
  const canEdit = user?.role === "company_admin" || user?.role === "hr";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const filterDept = params.get("department") ?? "";
  const statusFilter = STATUS_FILTERS.find(item => item.value === params.get("status")) ?? STATUS_FILTERS[0];
  const updateFilter = (key: string, value: string) => setParams(previous => {
    const next = new URLSearchParams(previous);
    if (value) next.set(key, value); else next.delete(key);
    return next;
  }, { replace: true });

  useEffect(() => {
    Promise.all([
      getEmployees().then(setEmployees),
      getDepartments().then(setDepartments),
      getPositions().then(setPositions),
    ]).catch(e => setError(apiError(e))).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (form: Record<string, string>) => {
    const payload: EmployeeCreate = {
      full_name: form.full_name,
      email: form.email || undefined,
      phone: form.phone || undefined,
      department_id: form.department_id || undefined,
      position_id: form.position_id || undefined,
      hire_date: form.hire_date || undefined,
      status: (form.status as EmployeeCreate["status"]) || "active",
    };
    const created = await createEmployee(payload);
    setEmployees((prev) => [...prev, created]);
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить сотрудника?")) return;
    try { await deleteEmployee(id); setEmployees((prev) => prev.filter((e) => e.id !== id)); }
    catch (e) { setError(apiError(e)); }
  };

  const deptName = (id: string | null) =>
    id ? (departments.find((d) => d.id === id)?.name ?? "—") : "—";
  const posName = (id: string | null) =>
    id ? (positions.find((p) => p.id === id)?.name ?? "—") : "—";

  const matchingEmployees = employees.filter(e => (!filterDept || e.department_id === filterDept) && `${e.full_name} ${e.email ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  const filtered = matchingEmployees.filter(e => matchesStatus(e, statusFilter.value));
  const workingCount = employees.filter(e => e.status !== "fired").length;
  const firedCount = employees.length - workingCount;

  const fields = [
    { name: "full_name", label: "ФИО *", required: true },
    { name: "email", label: "Email" },
    { name: "phone", label: "Телефон" },
    {
      name: "department_id", label: "Отдел", type: "select",
      options: [{ value: "", label: "— не выбран —" }, ...departments.map((d) => ({ value: d.id, label: d.name }))],
    },
    {
      name: "position_id", label: "Должность", type: "select",
      options: [{ value: "", label: "— не выбрана —" }, ...positions.map((p) => ({ value: p.id, label: p.name }))],
    },
    { name: "hire_date", label: "Дата приёма", type: "date" },
    {
      name: "status", label: "Статус", type: "select",
      options: [
        { value: "active", label: "Активен" },
        { value: "probation", label: "Испытательный срок" },
        { value: "vacation", label: "Отпуск" },
        { value: "fired", label: "Уволен" },
      ],
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Сотрудники</h1>
          <p className={styles.subtitle} aria-live="polite">{loading ? "Загрузка сотрудников…" : `Работающие: ${workingCount} · Уволенные: ${firedCount}`}</p>
        </div>
        <div className={styles.headerActions}>
          <input type="search" aria-label="Поиск сотрудников" placeholder="Имя или email" value={query} onChange={e => updateFilter("q", e.target.value)} />
          <select
            className={styles.filterSelect}
            aria-label="Фильтр по отделу"
            value={filterDept}
            onChange={(e) => updateFilter("department", e.target.value)}
          >
            <option value="">Все отделы</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {canEdit && (
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={16} /> Добавить сотрудника
            </button>
          )}
        </div>
      </div>

      {error && <p className="error-msg" role="alert">{error}</p>}
      {!loading && <section className={statusStyles.section} aria-label="Фильтры сотрудников">
        <div className={statusStyles.filters} role="group" aria-label="Статус сотрудников">
          {STATUS_FILTERS.map(item => <button key={item.value} type="button" aria-pressed={statusFilter.value === item.value} onClick={() => updateFilter("status", item.value)}>{item.label} · {matchingEmployees.filter(e => matchesStatus(e, item.value)).length}</button>)}
        </div>
        <p className={statusStyles.hint}>Работающие — активные, на испытательном сроке и в отпуске. Уволенные хранятся отдельно.</p>
        <p className={statusStyles.count} role="status">{statusFilter.label}: показано {filtered.length}{query || filterDept ? " · с учётом поиска и отдела" : ""}</p>
      </section>}
      {loading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Email / Телефон</th>
                <th>Отдел</th>
                <th>Должность</th>
                <th>Дата приёма</th>
                <th>Статус</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => (
                <tr key={emp.id}>
                  <td className={styles.nameCell}><Link style={{ display: "inline-flex", alignItems: "center", gap: 10 }} to={`/dashboard/employees/${emp.id}`}><EmployeeAvatar employee={emp} />{emp.full_name}</Link></td>
                  <td>
                    <div className={styles.contactCell}>
                      {emp.email && <span>{emp.email}</span>}
                      {emp.phone && <span className={styles.phone}>{emp.phone}</span>}
                    </div>
                  </td>
                  <td>{deptName(emp.department_id)}</td>
                  <td>{posName(emp.position_id)}</td>
                  <td className={styles.dateCell}>
                    {emp.hire_date
                      ? new Date(emp.hire_date).toLocaleDateString("ru-RU")
                      : "—"}
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles[STATUS_COLORS[emp.status] || "statusGreen"]}`}>
                      {EMPLOYEE_STATUS_LABELS[emp.status]}
                    </span>
                  </td>
                  {canEdit && (
                    <td><div className={styles.positionActions}>
                      <button type="button" className={styles.positionEdit} title="Редактировать сотрудника" aria-label={`Редактировать сотрудника ${emp.full_name}`} onClick={() => setEditingEmployee(emp)}><Pencil size={17} aria-hidden="true" /></button>
                      <button
                        className="btn-danger"
                        title="Удалить сотрудника"
                        aria-label={`Удалить ${emp.full_name}`}
                        onClick={() => handleDelete(emp.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className={styles.empty}>Сотрудники не найдены</div>
          )}
        </div>
      )}

      {showModal && (
        <CreateModal
          title="Новый сотрудник"
          fields={fields}
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
      {editingEmployee && <EmployeeEditModal employee={editingEmployee} onClose={() => setEditingEmployee(null)} onSaved={updated => setEmployees(prev => prev.map(emp => emp.id === updated.id ? updated : emp).sort((a, b) => a.full_name.localeCompare(b.full_name, "ru")))} />}
    </div>
  );
};

export default EmployeesPage;
