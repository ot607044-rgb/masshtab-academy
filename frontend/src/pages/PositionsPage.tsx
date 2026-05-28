import React, { useState, useEffect } from "react";
import { getPositions, createPosition, deletePosition } from "../api/positions";
import { getDepartments } from "../api/departments";
import type { Position, Department } from "../types";
import { useAuth } from "../context/AuthContext";
import CreateModal from "../components/CreateModal";
import styles from "./PageContent.module.css";

const PositionsPage: React.FC = () => {
  const { user } = useAuth();
  const canEdit = user?.role === "company_admin" || user?.role === "hr";

  const [positions, setPositions] = useState<Position[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      getPositions().then(setPositions),
      getDepartments().then(setDepartments),
    ]).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (form: Record<string, string>) => {
    const created = await createPosition({
      name: form.name,
      description: form.description || undefined,
      department_id: form.department_id || undefined,
      required_skills: skills.length ? skills : undefined,
    });
    setPositions((prev) => [...prev, created]);
    setSkills([]);
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить должность?")) return;
    await deletePosition(id);
    setPositions((prev) => prev.filter((p) => p.id !== id));
  };

  const deptName = (id: string | null) =>
    id ? (departments.find((d) => d.id === id)?.name ?? "—") : "—";

  const fields = [
    { name: "name", label: "Название должности *", required: true },
    { name: "description", label: "Описание" },
    {
      name: "department_id", label: "Отдел", type: "select",
      options: [
        { value: "", label: "— не выбран —" },
        ...departments.map((d) => ({ value: d.id, label: d.name })),
      ],
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Должности</h1>
          <p className={styles.subtitle}>{positions.length} должностей</p>
        </div>
        {canEdit && (
          <button className="btn-primary" onClick={() => { setSkills([]); setShowModal(true); }}>
            + Создать должность
          </button>
        )}
      </div>

      {loading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Название</th>
                <th>Отдел</th>
                <th>Обязательные навыки</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => (
                <tr key={pos.id}>
                  <td>
                    <span className={styles.nameCell}>{pos.name}</span>
                    {pos.description && (
                      <p className={styles.subtext}>{pos.description}</p>
                    )}
                  </td>
                  <td>{deptName(pos.department_id)}</td>
                  <td>
                    <div className={styles.tagList}>
                      {pos.required_skills?.map((s) => (
                        <span key={s} className={styles.tag}>{s}</span>
                      )) ?? <span className={styles.muted}>—</span>}
                    </div>
                  </td>
                  {canEdit && (
                    <td>
                      <button className="btn-danger" onClick={() => handleDelete(pos.id)}>
                        Удалить
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {positions.length === 0 && (
            <div className={styles.empty}>Должностей пока нет</div>
          )}
        </div>
      )}

      {showModal && (
        <CreateModal
          title="Новая должность"
          fields={fields}
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
          extraContent={
            <div className="form-group">
              <label>Обязательные навыки</label>
              <div className={styles.skillInputRow}>
                <input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && skillInput.trim()) {
                      e.preventDefault();
                      setSkills((prev) => [...prev, skillInput.trim()]);
                      setSkillInput("");
                    }
                  }}
                  placeholder="Введите навык и нажмите Enter"
                />
              </div>
              <div className={styles.tagList} style={{ marginTop: "0.5rem" }}>
                {skills.map((s, i) => (
                  <span key={i} className={`${styles.tag} ${styles.tagRemovable}`}
                    onClick={() => setSkills((prev) => prev.filter((_, j) => j !== i))}>
                    {s} ✕
                  </span>
                ))}
              </div>
            </div>
          }
        />
      )}
    </div>
  );
};

export default PositionsPage;
