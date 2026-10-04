import React, { useState, useEffect } from "react";
import { getPositions, createPosition, updatePosition, deletePosition } from "../api/positions";
import { Pencil, Plus, X } from "lucide-react";
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
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      getPositions().then(setPositions),
      getDepartments().then(setDepartments),
    ]).finally(() => setLoading(false));
  }, []);

  const closeModal = () => {
    setShowModal(false);
    setEditingPosition(null);
    setSkills([]);
    setSkillInput("");
  };

  const openModal = (position: Position | null = null) => {
    setEditingPosition(position);
    setSkills(position?.required_skills ? [...position.required_skills] : []);
    setSkillInput("");
    setShowModal(true);
  };

  const addSkill = () => {
    const value = skillInput.trim();
    if (value && !skills.includes(value)) setSkills(prev => [...prev, value]);
    setSkillInput("");
  };

  const handleSave = async (form: Record<string, string>) => {
    const name = form.name.trim();
    if (!name) throw { response: { data: { detail: "Введите название должности" } } };
    const payload = {
      name,
      description: form.description.trim() || null,
      department_id: form.department_id || null,
      required_skills: [...new Set([...skills, skillInput.trim()].filter(Boolean))],
    };
    const saved = editingPosition ? await updatePosition(editingPosition.id, payload) : await createPosition(payload);
    setPositions(prev => (editingPosition ? prev.map(pos => pos.id === saved.id ? saved : pos) : [...prev, saved]).sort((a, b) => a.name.localeCompare(b.name, "ru")));
    setSkills([]);
    closeModal();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить должность?")) return;
    await deletePosition(id);
    setPositions((prev) => prev.filter((p) => p.id !== id));
  };

  const deptName = (id: string | null) =>
    id ? (departments.find((d) => d.id === id)?.name ?? "—") : "—";

  const fields = [
    { name: "name", label: "Название должности *", required: true, maxLength: 255 },
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
          <button className="btn-primary" onClick={() => openModal()}>
            <Plus size={16} aria-hidden="true" /> Создать должность
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
                      {pos.required_skills?.length ? pos.required_skills.map((s) => (
                        <span key={s} className={styles.tag}>{s}</span>
                      )) : <span className={styles.muted}>—</span>}
                    </div>
                  </td>
                  {canEdit && (
                    <td><div className={styles.positionActions}>
                      <button type="button" className={styles.positionEdit} onClick={() => openModal(pos)} title="Редактировать должность" aria-label={`Редактировать должность ${pos.name}`}>
                        <Pencil size={17} aria-hidden="true" />
                      </button>
                      <button className="btn-danger" onClick={() => handleDelete(pos.id)}>
                        Удалить
                      </button>
                    </div></td>
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
          title={editingPosition ? "Редактирование должности" : "Новая должность"}
          fields={fields}
          onClose={closeModal}
          onCreate={handleSave}
          initialValues={editingPosition ? { name: editingPosition.name, description: editingPosition.description ?? "", department_id: editingPosition.department_id ?? "" } : undefined}
          submitLabel={editingPosition ? "Сохранить" : "Создать"}
          errorMessage="Не удалось сохранить должность"
          extraContent={
            <div className="form-group">
              <label>Обязательные навыки</label>
              <div className={styles.skillInputRow}>
                <input
                  type="text"
                  aria-label="Добавить навык"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                  placeholder="Навык"
                />
                <button type="button" className={styles.positionEdit} onClick={addSkill} disabled={!skillInput.trim()} aria-label="Добавить введенный навык" title="Добавить навык"><Plus size={17} aria-hidden="true" /></button>
              </div>
              <div className={styles.tagList} style={{ marginTop: "0.5rem" }}>
                {skills.map((s, i) => (
                  <button type="button" key={i} className={`${styles.tag} ${styles.tagRemovable}`} aria-label={`Удалить навык ${s}`} title={`Удалить навык ${s}`}
                    onClick={() => setSkills((prev) => prev.filter((_, j) => j !== i))}>
                    {s} <X size={13} aria-hidden="true" />
                  </button>
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
