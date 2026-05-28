import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getMyAssignments, updateAssignmentStatus } from "../api/assignments";
import type { LessonAssignment } from "../types";
import { ASSIGNMENT_STATUS_LABELS, DIFFICULTY_LABELS, LESSON_STATUS_LABELS } from "../types";
import styles from "./PageContent.module.css";
import ls from "./LessonsPage.module.css";

const ASSIGN_COLOR: Record<string, string> = {
  assigned: "statusBlue",
  in_progress: "statusYellow",
  completed: "statusGreen",
};

const MyLessonsPage: React.FC = () => {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<LessonAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    getMyAssignments()
      .then(setAssignments)
      .finally(() => setLoading(false));
  }, []);

  const handleStatus = async (
    id: string,
    newStatus: "assigned" | "in_progress" | "completed",
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const updated = await updateAssignmentStatus(id, newStatus);
    setAssignments((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
  };

  const filtered = filter ? assignments.filter((a) => a.status === filter) : assignments;
  const done = assignments.filter((a) => a.status === "completed").length;
  const total = assignments.length;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Мои уроки</h1>
          <p className={styles.subtitle}>
            {done} из {total} завершено
          </p>
        </div>
        <select
          className={styles.filterSelect}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Все</option>
          <option value="assigned">Назначены</option>
          <option value="in_progress">В процессе</option>
          <option value="completed">Завершены</option>
        </select>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ background: "#e5e7eb", borderRadius: "999px", height: "8px", overflow: "hidden" }}>
            <div
              style={{
                width: `${(done / total) * 100}%`,
                background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
                height: "100%",
                borderRadius: "999px",
                transition: "width 0.4s",
              }}
            />
          </div>
          <p style={{ fontSize: "0.78rem", color: "#9ca3af", marginTop: "0.375rem" }}>
            {Math.round((done / total) * 100)}% выполнено
          </p>
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyWide}>
          {total === 0
            ? "Вам пока не назначено ни одного урока."
            : "Нет уроков с выбранным статусом."}
        </div>
      ) : (
        <div className={ls.grid}>
          {filtered.map((a) => (
            <div
              key={a.id}
              className={ls.card}
              onClick={() => navigate(`/dashboard/lessons/${a.lesson_id}`)}
            >
              <div className={ls.cardTop}>
                <span className={`${styles.statusBadge} ${styles[ASSIGN_COLOR[a.status] || "statusBlue"]}`}>
                  {ASSIGNMENT_STATUS_LABELS[a.status]}
                </span>
                {a.lesson.difficulty_level && (
                  <span className={ls.diffBadge}>
                    {DIFFICULTY_LABELS[a.lesson.difficulty_level as keyof typeof DIFFICULTY_LABELS] ?? a.lesson.difficulty_level}
                  </span>
                )}
              </div>

              <h3 className={ls.cardTitle}>{a.lesson.title}</h3>
              {a.lesson.description && (
                <p className={ls.cardDesc}>{a.lesson.description}</p>
              )}

              <div className={ls.cardMeta}>
                {a.lesson.duration_minutes && <span>⏱ {a.lesson.duration_minutes} мин</span>}
                {a.lesson.video_url && <span>🎬 Видео</span>}
                {a.due_date && (
                  <span>📅 Срок: {new Date(a.due_date).toLocaleDateString("ru-RU")}</span>
                )}
                {a.completed_at && (
                  <span>✅ {new Date(a.completed_at).toLocaleDateString("ru-RU")}</span>
                )}
              </div>

              <div
                className={ls.cardActions}
                onClick={(e) => e.stopPropagation()}
              >
                {a.status === "assigned" && (
                  <button
                    className="btn-secondary"
                    style={{ fontSize: "0.78rem" }}
                    onClick={(e) => handleStatus(a.id, "in_progress", e)}
                  >
                    Начать
                  </button>
                )}
                {a.status === "in_progress" && (
                  <button
                    className="btn-primary"
                    style={{ fontSize: "0.78rem", padding: "0.3rem 0.7rem" }}
                    onClick={(e) => handleStatus(a.id, "completed", e)}
                  >
                    Завершить ✓
                  </button>
                )}
                {a.status === "completed" && (
                  <span style={{ fontSize: "0.78rem", color: "#16a34a" }}>✅ Выполнен</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyLessonsPage;
