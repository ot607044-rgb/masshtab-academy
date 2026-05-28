import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getLessons, createLesson, publishLesson, archiveLesson, deleteLesson } from "../api/lessons";
import { getPositions } from "../api/positions";
import { getTopics } from "../api/knowledge";
import type { Lesson, LessonCreate, Position, KnowledgeTopic } from "../types";
import { LESSON_STATUS_LABELS, DIFFICULTY_LABELS } from "../types";
import { useAuth } from "../context/AuthContext";
import CreateModal from "../components/CreateModal";
import styles from "./PageContent.module.css";
import lessStyles from "./LessonsPage.module.css";

const STATUS_COLOR: Record<string, string> = {
  draft: "statusYellow",
  published: "statusGreen",
  archived: "statusRed",
};

const LessonsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = ["company_admin", "hr", "methodologist"].includes(user?.role ?? "");

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [topics, setTopics] = useState<KnowledgeTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    Promise.all([
      getLessons().then(setLessons),
      getPositions().then(setPositions),
      getTopics().then(setTopics),
    ]).finally(() => setLoading(false));
  }, []);

  const reload = () =>
    getLessons(filterStatus ? { status_filter: filterStatus } : {}).then(setLessons);

  useEffect(() => { reload(); }, [filterStatus]); // eslint-disable-line

  const handleCreate = async (form: Record<string, string>) => {
    const payload: LessonCreate = {
      title: form.title,
      description: form.description || undefined,
      position_id: form.position_id || undefined,
      topic_id: form.topic_id || undefined,
      difficulty_level: form.difficulty_level || "basic",
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
      video_url: form.video_url || undefined,
    };
    await createLesson(payload);
    await reload();
    setShowModal(false);
  };

  const handlePublish = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await publishLesson(id);
    await reload();
  };

  const handleArchive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Перевести урок в архив?")) return;
    await archiveLesson(id);
    await reload();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Удалить урок?")) return;
    await deleteLesson(id);
    setLessons((p) => p.filter((l) => l.id !== id));
  };

  const posName = (id: string | null) =>
    id ? (positions.find((p) => p.id === id)?.name ?? "—") : "—";
  const topicName = (id: string | null) =>
    id ? (topics.find((t) => t.id === id)?.name ?? "—") : "—";

  const fields = [
    { name: "title", label: "Название урока *", required: true },
    { name: "description", label: "Краткое описание" },
    {
      name: "difficulty_level", label: "Уровень сложности", type: "select" as const,
      options: [
        { value: "basic", label: "Базовый" },
        { value: "intermediate", label: "Средний" },
        { value: "advanced", label: "Продвинутый" },
      ],
    },
    {
      name: "position_id", label: "Должность", type: "select" as const,
      options: [
        { value: "", label: "— не выбрана —" },
        ...positions.map((p) => ({ value: p.id, label: p.name })),
      ],
    },
    {
      name: "topic_id", label: "Тема матрицы знаний", type: "select" as const,
      options: [
        { value: "", label: "— не выбрана —" },
        ...topics.map((t) => ({ value: t.id, label: t.name })),
      ],
    },
    { name: "duration_minutes", label: "Длительность (мин)" },
    { name: "video_url", label: "Ссылка на видео (YouTube, Rutube, и др.)" },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>База знаний</h1>
          <p className={styles.subtitle}>{lessons.length} уроков</p>
        </div>
        <div className={styles.headerActions}>
          <select
            className={styles.filterSelect}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Все статусы</option>
            <option value="draft">Черновики</option>
            <option value="published">Опубликованные</option>
            <option value="archived">Архив</option>
          </select>
          {canEdit && (
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              + Создать урок
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : (
        <div className={lessStyles.grid}>
          {lessons.map((lesson) => (
            <div
              key={lesson.id}
              className={lessStyles.card}
              onClick={() => navigate(`/dashboard/lessons/${lesson.id}`)}
            >
              <div className={lessStyles.cardTop}>
                <span className={`${styles.statusBadge} ${styles[STATUS_COLOR[lesson.status] || "statusYellow"]}`}>
                  {LESSON_STATUS_LABELS[lesson.status]}
                </span>
                {lesson.difficulty_level && (
                  <span className={lessStyles.diffBadge}>
                    {DIFFICULTY_LABELS[lesson.difficulty_level as keyof typeof DIFFICULTY_LABELS] ?? lesson.difficulty_level}
                  </span>
                )}
              </div>

              <h3 className={lessStyles.cardTitle}>{lesson.title}</h3>
              {lesson.description && (
                <p className={lessStyles.cardDesc}>{lesson.description}</p>
              )}

              <div className={lessStyles.cardMeta}>
                {lesson.position_id && <span>💼 {posName(lesson.position_id)}</span>}
                {lesson.topic_id && <span>📚 {topicName(lesson.topic_id)}</span>}
                {lesson.duration_minutes && <span>⏱ {lesson.duration_minutes} мин</span>}
                {lesson.video_url && <span>🎬 Видео</span>}
              </div>

              {canEdit && (
                <div className={lessStyles.cardActions} onClick={(e) => e.stopPropagation()}>
                  {lesson.status === "draft" && (
                    <button className="btn-primary" style={{ fontSize: "0.78rem", padding: "0.3rem 0.7rem" }}
                      onClick={(e) => handlePublish(lesson.id, e)}>
                      Опубликовать
                    </button>
                  )}
                  {lesson.status === "published" && (
                    <button className="btn-warn" onClick={(e) => handleArchive(lesson.id, e)}>
                      В архив
                    </button>
                  )}
                  <button className="btn-danger" onClick={(e) => handleDelete(lesson.id, e)}>
                    Удалить
                  </button>
                </div>
              )}
            </div>
          ))}
          {lessons.length === 0 && (
            <div className={styles.emptyWide}>
              {canEdit ? "Уроков пока нет. Создайте первый." : "Опубликованных уроков нет."}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <CreateModal
          title="Новый урок"
          fields={fields}
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
};

export default LessonsPage;
