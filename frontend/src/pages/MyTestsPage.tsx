import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getMyTestsOverview } from "../api/tests";
import type { MyTestOverview } from "../types";
import styles from "./PageContent.module.css";
import ls from "./LessonsPage.module.css";

const MyTestsPage: React.FC = () => {
  const navigate = useNavigate();
  const [tests, setTests] = useState<MyTestOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "passed" | "failed" | "new">("all");

  useEffect(() => {
    getMyTestsOverview()
      .then(setTests)
      .finally(() => setLoading(false));
  }, []);

  const filtered = tests.filter((t) => {
    if (filter === "passed") return t.passed;
    if (filter === "failed") return t.attempts_used > 0 && !t.passed;
    if (filter === "new") return t.attempts_used === 0;
    return true;
  });

  const passedCount = tests.filter((t) => t.passed).length;
  const total = tests.length;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Мои тесты</h1>
          <p className={styles.subtitle}>
            {passedCount} из {total} сдано
          </p>
        </div>
        <select className={styles.filterSelect} value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">Все</option>
          <option value="new">Не пройденные</option>
          <option value="passed">Сданные</option>
          <option value="failed">Не сданные</option>
        </select>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ background: "#e5e7eb", borderRadius: "999px", height: "8px", overflow: "hidden" }}>
            <div style={{
              width: `${(passedCount / total) * 100}%`,
              background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
              height: "100%", borderRadius: "999px", transition: "width 0.4s",
            }} />
          </div>
          <p style={{ fontSize: "0.78rem", color: "#9ca3af", marginTop: "0.375rem" }}>
            {Math.round((passedCount / total) * 100)}% тестов сдано
          </p>
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyWide}>
          {total === 0 ? "Нет доступных тестов." : "Нет тестов с выбранным фильтром."}
        </div>
      ) : (
        <div className={ls.grid}>
          {filtered.map((t) => {
            const statusColor = t.passed ? "#16a34a" : t.attempts_used > 0 ? "#dc2626" : "#6366f1";
            const statusBg = t.passed ? "#dcfce7" : t.attempts_used > 0 ? "#fee2e2" : "#ede9fe";
            const statusLabel = t.passed ? "Сдан" : t.attempts_used > 0 ? "Не сдан" : "Не пройден";

            return (
              <div
                key={t.id}
                className={ls.card}
                onClick={() => navigate(`/dashboard/tests/${t.id}/take`)}
              >
                <div className={ls.cardTop}>
                  <span style={{
                    background: statusBg, color: statusColor,
                    padding: "0.2rem 0.625rem", borderRadius: "999px",
                    fontSize: "0.75rem", fontWeight: 500,
                  }}>
                    {statusLabel}
                  </span>
                  <span className={ls.diffBadge}>{t.passing_score}% проходной</span>
                </div>

                <h3 className={ls.cardTitle}>{t.title}</h3>
                {t.description && <p className={ls.cardDesc}>{t.description}</p>}

                <div className={ls.cardMeta}>
                  {t.time_limit_minutes && <span>⏱ {t.time_limit_minutes} мин</span>}
                  <span>🔁 {t.attempts_used}/{t.max_attempts} поп.</span>
                  {t.best_score !== null && (
                    <span style={{ color: t.passed ? "#16a34a" : "#dc2626" }}>
                      {t.passed ? "✅" : "❌"} {t.best_score}%
                    </span>
                  )}
                </div>

                <div className={ls.cardActions} onClick={(e) => e.stopPropagation()}>
                  {t.can_attempt ? (
                    <button className="btn-primary" style={{ fontSize: "0.78rem", padding: "0.3rem 0.7rem" }}
                      onClick={() => navigate(`/dashboard/tests/${t.id}/take`)}>
                      {t.in_progress ? "Продолжить" : t.attempts_used > 0 ? "Повторить" : "Начать"}
                    </button>
                  ) : (
                    <span style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
                      Попытки исчерпаны
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyTestsPage;
