import React, { useState, useEffect } from "react";
import { getDepartments, createDepartment, deleteDepartment } from "../api/departments";
import { getEmployees } from "../api/employees";
import type { Department, Employee } from "../types";
import { useAuth } from "../context/AuthContext";
import CreateModal from "../components/CreateModal";
import styles from "./PageContent.module.css";

const DepartmentsPage: React.FC = () => {
  const { user } = useAuth();
  const canEdit = user?.role === "company_admin" || user?.role === "hr";

  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    Promise.all([
      getDepartments().then(setDepartments),
      getEmployees().then(setEmployees),
    ]).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (form: Record<string, string>) => {
    const created = await createDepartment({
      name: form.name,
      description: form.description || undefined,
      head_id: form.head_id || undefined,
    });
    setDepartments((prev) => [...prev, created]);
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить отдел? Все связанные данные могут быть затронуты.")) return;
    await deleteDepartment(id);
    setDepartments((prev) => prev.filter((d) => d.id !== id));
  };

  const headName = (id: string | null) =>
    id ? (employees.find((e) => e.id === id)?.full_name ?? "—") : "—";

  const empCount = (deptId: string) =>
    employees.filter((e) => e.department_id === deptId).length;

  const fields = [
    { name: "name", label: "Название отдела *", required: true },
    { name: "description", label: "Описание" },
    {
      name: "head_id", label: "Руководитель", type: "select",
      options: [
        { value: "", label: "— не выбран —" },
        ...employees.map((e) => ({ value: e.id, label: e.full_name })),
      ],
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Отделы</h1>
          <p className={styles.subtitle}>{departments.length} отделов</p>
        </div>
        {canEdit && (
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            + Создать отдел
          </button>
        )}
      </div>

      {loading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : (
        <div className={styles.cardGrid}>
          {departments.map((dept) => (
            <div key={dept.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{dept.name}</h3>
                <span className={styles.countBadge}>{empCount(dept.id)} чел.</span>
              </div>
              {dept.description && (
                <p className={styles.cardDesc}>{dept.description}</p>
              )}
              <div className={styles.cardMeta}>
                <span>Руководитель: <strong>{headName(dept.head_id)}</strong></span>
              </div>
              {canEdit && (
                <div className={styles.cardActions}>
                  <button className="btn-danger" onClick={() => handleDelete(dept.id)}>
                    Удалить
                  </button>
                </div>
              )}
            </div>
          ))}
          {departments.length === 0 && (
            <div className={styles.emptyWide}>Отделов пока нет. Создайте первый.</div>
          )}
        </div>
      )}

      {showModal && (
        <CreateModal
          title="Новый отдел"
          fields={fields}
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
};

export default DepartmentsPage;
