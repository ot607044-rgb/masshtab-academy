import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { listTests, createTest, publishTest, archiveTest, deleteTest } from "../api/tests";
import { getPositions } from "../api/positions";
import { getTopics } from "../api/knowledge";
import { getLessons } from "../api/lessons";
import type { Test, Position, KnowledgeTopic, Lesson } from "../types";
import { TEST_STATUS_LABELS } from "../types";
import { useAuth } from "../context/AuthContext";
import styles from "./PageContent.module.css";
import ls from "./LessonsPage.module.css";

const STATUS_COLOR: Record<string, string> = {
  draft: "statusYellow",
  published: "statusGreen",
  archived: "statusRed",
};

const TestsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = ["company_admin", "hr", "methodologist"].includes(user?.role ?? "");

  const [tests, setTests] = useState<Test[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [topics, setTopics] = useState<KnowledgeTopic[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({
    title: "", description: "", passing_score: "70",
    max_attempts: "3", time_limit_minutes: "",
    position_id: "", topic_id: "", lesson_id: "",
  });
  const [creating, setCreating] = useState(false);

  const reload = async () => {
    const data = await listTests(filterStatus || undefined);
    setTests(data);
  };

  useEffect(() => {
    Promise.all([
      reload(),
      getPositions().then(setPositions),
      getTopics().then(setTopics),
      getLessons({ status_filter: "published" }).then(setLessons),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [filterStatus]); // eslint-disable-line

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createTest({
        title: form.title,
        description: form.description || undefined,
        passing_score: Number(form.passing_score),
        max_attempts: Number(form.max_attempts),
        time_limit_minutes: form.time_limit_minutes ? Number(form.time_limit_minutes) : undefined,
        position_id: form.position_id || undefined,
        topic_id: form.topic_id || undefined,
        lesson_id: form.lesson_id || undefined,
      });
      await reload();
      setShowCreate(false);
      setForm({ title: "", description: "", passing_score: "70", max_attempts: "3", time_limit_minutes: "", position_id: "", topic_id: "", lesson_id: "" });
    } finally {
      setCreating(false);
    }
  };

  const handlePublish = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await publishTest(id);
    await reload();
  };

  const handleArchive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Перевести тест в архив?")) return;
    await archiveTest(id);
    await reload();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Удалить тест?")) return;
    await deleteTest(id);
    setTests((p) => p.filter((t) => t.id !== id));
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Тесты</h1>
          <p className={styles.subtitle}>{tests.length} тест{tests.length === 1 ? "" : tests.length < 5 ? "а" : "ов"}</p>
        </div>
        <div className={styles.headerActions}>
          {canEdit && (
            <select className={styles.filterSelect} value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">Все статусы</option>
              <option value="draft">Черновики</option>
              <option value="published">Опубликованные</option>
              <option value="archived">Архив</option>
            </select>
          )}
          {canEdit && (
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              + Создать тест
            </button>
          )}
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: "14px", padding: "1.5rem", marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "1rem", color: "#111827" }}>Новый тест</h3>
          <form onSubmit={handleCreate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>Название *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>Описание</label>
                <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ resize: "vertical" }} />
              </div>
              <div className="form-group">
                <label>Проходной балл (%) *</label>
                <input type="number" min={1} max={100} value={form.passing_score} onChange={(e) => setForm({ ...form, passing_score: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Макс. попыток</label>
                <input type="number" min={1} value={form.max_attempts} onChange={(e) => setForm({ ...form, max_attempts: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Ограничение времени (мин)</label>
                <input type="number" min={1} value={form.time_limit_minutes} onChange={(e) => setForm({ ...form, time_limit_minutes: e.target.value })} placeholder="без ограничения" />
              </div>
              <div className="form-group">
                <label>Должность</label>
                <select value={form.position_id} onChange={(e) => setForm({ ...form, position_id: e.target.value })}>
                  <option value="">— не выбрана —</option>
                  {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Тема матрицы знаний</label>
                <select value={form.topic_id} onChange={(e) => setForm({ ...form, topic_id: e.target.value })}>
                  <option value="">— не выбрана —</option>
                  {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Урок для назначения при провале</label>
                <select value={form.lesson_id} onChange={(e) => setForm({ ...form, lesson_id: e.target.value })}>
                  <option value="">— не выбран —</option>
                  {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
              <button type="submit" className="btn-primary" disabled={creating}>{creating ? "..." : "Создать"}</button>
              <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Отмена</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : (
        <div className={ls.grid}>
          {tests.map((test) => (
            <div
              key={test.id}
              className={ls.card}
              onClick={() => navigate(canEdit ? `/dashboard/tests/${test.id}` : `/dashboard/tests/${test.id}/take`)}
            >
              <div className={ls.cardTop}>
                <span className={`${styles.statusBadge} ${styles[STATUS_COLOR[test.status] || "statusYellow"]}`}>
                  {TEST_STATUS_LABELS[test.status]}
                </span>
                <span className={ls.diffBadge}>{test.passing_score}% проходной</span>
              </div>

              <h3 className={ls.cardTitle}>{test.title}</h3>
              {test.description && <p className={ls.cardDesc}>{test.description}</p>}

              <div className={ls.cardMeta}>
                {test.time_limit_minutes && <span>⏱ {test.time_limit_minutes} мин</span>}
                <span>🔁 до {test.max_attempts} поп.</span>
              </div>

              {canEdit && (
                <div className={ls.cardActions} onClick={(e) => e.stopPropagation()}>
                  {test.status === "draft" && (
                    <button className="btn-primary" style={{ fontSize: "0.78rem", padding: "0.3rem 0.7rem" }}
                      onClick={(e) => handlePublish(test.id, e)}>
                      Опубликовать
                    </button>
                  )}
                  {test.status === "published" && (
                    <button className="btn-warn" onClick={(e) => handleArchive(test.id, e)}>В архив</button>
                  )}
                  <button className="btn-danger" onClick={(e) => handleDelete(test.id, e)}>Удалить</button>
                </div>
              )}

              {!canEdit && test.status === "published" && (
                <div className={ls.cardActions}>
                  <button className="btn-primary" style={{ fontSize: "0.78rem", padding: "0.3rem 0.7rem" }}
                    onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/tests/${test.id}/take`); }}>
                    Пройти тест
                  </button>
                </div>
              )}
            </div>
          ))}
          {tests.length === 0 && (
            <div className={styles.emptyWide}>
              {canEdit ? "Тестов пока нет. Создайте первый." : "Опубликованных тестов нет."}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TestsPage;
