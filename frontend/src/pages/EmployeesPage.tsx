import React, { useState, useEffect } from "react";
import { getEmployees, createEmployee, deleteEmployee } from "../api/employees";
import { getDepartments } from "../api/departments";
import { getPositions } from "../api/positions";
import type { Employee, EmployeeCreate, Department, Position } from "../types";
import { EMPLOYEE_STATUS_LABELS } from "../types";
import { useAuth } from "../context/AuthContext";
import CreateModal from "../components/CreateModal";
import styles from "./PageContent.module.css";

const STATUS_COLORS: Record<string, string> = {
  active: "statusGreen",
  probation: "statusYellow",
  vacation: "statusBlue",
  fired: "statusRed",
};

const EmployeesPage: React.FC = () => {
  const { user } = useAuth();
  const canEdit = user?.role === "company_admin" || user?.role === "hr";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterDept, setFilterDept] = useState("");

  useEffect(() => {
    Promise.all([
      getEmployees().then(setEmployees),
      getDepartments().then(setDepartments),
      getPositions().then(setPositions),
    ]).finally(() => setLoading(false));
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
    await deleteEmployee(id);
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  };

  const deptName = (id: string | null) =>
    id ? (departments.find((d) => d.id === id)?.name ?? "—") : "—";
  const posName = (id: string | null) =>
    id ? (positions.find((p) => p.id === id)?.name ?? "—") : "—";

  const filtered = filterDept
    ? employees.filter((e) => e.department_id === filterDept)
    : employees;

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
          <p className={styles.subtitle}>{filtered.length} из {employees.length}</p>
        </div>
        <div className={styles.headerActions}>
          <select
            className={styles.filterSelect}
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
          >
            <option value="">Все отделы</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {canEdit && (
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              + Добавить сотрудника
            </button>
          )}
        </div>
      </div>

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
                  <td className={styles.nameCell}>{emp.full_name}</td>
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
                    <td>
                      <button
                        className="btn-danger"
                        onClick={() => handleDelete(emp.id)}
                      >
                        Удалить
                      </button>
                    </td>
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
    </div>
  );
};

export default EmployeesPage;
