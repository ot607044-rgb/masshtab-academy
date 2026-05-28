import React, { useState, useEffect } from "react";
import { getTopics, createTopic, deleteTopic, getMatrix, assignTopic, removeTopicFromMatrix } from "../api/knowledge";
import { getPositions } from "../api/positions";
import type { KnowledgeTopic, KnowledgeTopicCreate, Position, PositionTopic } from "../types";
import { DIFFICULTY_LABELS, CRITICALITY_LABELS } from "../types";
import { useAuth } from "../context/AuthContext";
import CreateModal from "../components/CreateModal";
import styles from "./PageContent.module.css";

const CRITICALITY_COLOR: Record<string, string> = {
  low: "statusBlue",
  medium: "statusYellow",
  high: "statusOrange",
  critical: "statusRed",
};

const KnowledgePage: React.FC = () => {
  const { user } = useAuth();
  const canEdit = user?.role === "company_admin" || user?.role === "hr" || user?.role === "methodologist";

  const [topics, setTopics] = useState<KnowledgeTopic[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [matrix, setMatrix] = useState<PositionTopic[]>([]);
  const [selectedPos, setSelectedPos] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [showTopicModal, setShowTopicModal] = useState(false);

  useEffect(() => {
    Promise.all([
      getTopics().then(setTopics),
      getPositions().then(setPositions),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedPos) { setMatrix([]); return; }
    setMatrixLoading(true);
    getMatrix(selectedPos)
      .then(setMatrix)
      .finally(() => setMatrixLoading(false));
  }, [selectedPos]);

  const handleCreateTopic = async (form: Record<string, string>) => {
    const payload: KnowledgeTopicCreate = {
      name: form.name,
      description: form.description || undefined,
      difficulty_level: (form.difficulty_level as KnowledgeTopicCreate["difficulty_level"]) || "basic",
      criticality: (form.criticality as KnowledgeTopicCreate["criticality"]) || "medium",
      required_knowledge_level: form.required_knowledge_level ? Number(form.required_knowledge_level) : 1,
    };
    const created = await createTopic(payload);
    setTopics((prev) => [...prev, created]);
    setShowTopicModal(false);
  };

  const handleDeleteTopic = async (id: string) => {
    if (!confirm("Удалить тему?")) return;
    await deleteTopic(id);
    setTopics((prev) => prev.filter((t) => t.id !== id));
    setMatrix((prev) => prev.filter((m) => m.topic_id !== id));
  };

  const handleAssign = async (topicId: string) => {
    if (!selectedPos) return;
    const link = await assignTopic(selectedPos, topicId);
    setMatrix((prev) => [...prev, link]);
  };

  const handleUnassign = async (linkId: string) => {
    await removeTopicFromMatrix(linkId);
    setMatrix((prev) => prev.filter((m) => m.id !== linkId));
  };

  const assignedTopicIds = new Set(matrix.map((m) => m.topic_id));

  const topicFields = [
    { name: "name", label: "Название темы *", required: true },
    { name: "description", label: "Описание" },
    {
      name: "difficulty_level", label: "Уровень сложности", type: "select",
      options: [
        { value: "basic", label: "Базовый" },
        { value: "intermediate", label: "Средний" },
        { value: "advanced", label: "Продвинутый" },
      ],
    },
    {
      name: "criticality", label: "Критичность", type: "select",
      options: [
        { value: "low", label: "Низкая" },
        { value: "medium", label: "Средняя" },
        { value: "high", label: "Высокая" },
        { value: "critical", label: "Критическая" },
      ],
    },
    {
      name: "required_knowledge_level", label: "Обязательный уровень знаний (1–5)", type: "select",
      options: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) })),
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Матрица знаний</h1>
          <p className={styles.subtitle}>{topics.length} тем в базе компании</p>
        </div>
        {canEdit && (
          <button className="btn-primary" onClick={() => setShowTopicModal(true)}>
            + Создать тему
          </button>
        )}
      </div>

      {/* Matrix section */}
      <div className={styles.matrixSection}>
        <h2 className={styles.sectionTitle}>Матрица по должности</h2>
        <select
          className={styles.filterSelect}
          value={selectedPos}
          onChange={(e) => setSelectedPos(e.target.value)}
          style={{ maxWidth: 320, marginBottom: "1.25rem" }}
        >
          <option value="">— выберите должность —</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {selectedPos && (
          matrixLoading ? (
            <div className={styles.loading}>Загрузка матрицы...</div>
          ) : (
            <div className={styles.tableWrap} style={{ marginBottom: "2rem" }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Тема</th>
                    <th>Сложность</th>
                    <th>Критичность</th>
                    <th>Уровень знаний</th>
                    <th>Обязательна</th>
                    {canEdit && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <span className={styles.nameCell}>{m.topic.name}</span>
                        {m.topic.description && (
                          <p className={styles.subtext}>{m.topic.description}</p>
                        )}
                      </td>
                      <td>{DIFFICULTY_LABELS[m.topic.difficulty_level]}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${styles[CRITICALITY_COLOR[m.topic.criticality] || "statusYellow"]}`}>
                          {CRITICALITY_LABELS[m.topic.criticality]}
                        </span>
                      </td>
                      <td>
                        <span className={styles.levelBadge}>{m.topic.required_knowledge_level}/5</span>
                      </td>
                      <td>{m.is_required ? "✅" : "—"}</td>
                      {canEdit && (
                        <td>
                          <button className="btn-danger" onClick={() => handleUnassign(m.id)}>
                            Убрать
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {matrix.length === 0 && (
                    <tr>
                      <td colSpan={6} className={styles.empty}>
                        Матрица пуста — добавьте темы ниже
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* All topics */}
      <h2 className={styles.sectionTitle}>Все темы знаний</h2>
      {loading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Тема</th>
                <th>Сложность</th>
                <th>Критичность</th>
                <th>Уровень</th>
                {selectedPos && canEdit && <th>Действие</th>}
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {topics.map((topic) => (
                <tr key={topic.id} className={assignedTopicIds.has(topic.id) ? styles.rowAssigned : ""}>
                  <td>
                    <span className={styles.nameCell}>{topic.name}</span>
                    {topic.description && (
                      <p className={styles.subtext}>{topic.description}</p>
                    )}
                  </td>
                  <td>{DIFFICULTY_LABELS[topic.difficulty_level]}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles[CRITICALITY_COLOR[topic.criticality] || "statusYellow"]}`}>
                      {CRITICALITY_LABELS[topic.criticality]}
                    </span>
                  </td>
                  <td>
                    <span className={styles.levelBadge}>{topic.required_knowledge_level}/5</span>
                  </td>
                  {selectedPos && canEdit && (
                    <td>
                      {assignedTopicIds.has(topic.id) ? (
                        <span className={styles.muted}>В матрице ✓</span>
                      ) : (
                        <button
                          className={styles.assignBtn}
                          onClick={() => handleAssign(topic.id)}
                        >
                          + В матрицу
                        </button>
                      )}
                    </td>
                  )}
                  {canEdit && (
                    <td>
                      <button className="btn-danger" onClick={() => handleDeleteTopic(topic.id)}>
                        Удалить
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {topics.length === 0 && (
            <div className={styles.empty}>Тем пока нет. Создайте первую тему.</div>
          )}
        </div>
      )}

      {showTopicModal && (
        <CreateModal
          title="Новая тема знаний"
          fields={topicFields}
          onClose={() => setShowTopicModal(false)}
          onCreate={handleCreateTopic}
        />
      )}
    </div>
  );
};

export default KnowledgePage;
