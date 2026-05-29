import React, { useState, useEffect } from "react";
import { getMyDepartment } from "../api/analytics";
import type { EmployeeProgress } from "../types";
import styles from "./PageContent.module.css";

const Bar: React.FC<{ value: number; max: number }> = ({ value, max }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color =
    pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div
      style={{
        background: "#f3f4f6",
        borderRadius: "999px",
        height: "6px",
        overflow: "hidden",
        flexGrow: 1,
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          background: color,
          height: "100%",
          borderRadius: "999px",
          transition: "width 0.5s",
        }}
      />
    </div>
  );
};

const ManagerDashboardPage: React.FC = () => {
  const [team, setTeam] = useState<EmployeeProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyDepartment()
      .then(setTeam)
      .catch(() => setError("Не удалось загрузить данные отдела."))
      .finally(() => setLoading(false));
  }, []);

  const avgCompletion =
    team.length > 0
      ? Math.round(
          team.reduce(
            (acc, e) =>
              acc +
              (e.lessons_total > 0
                ? (e.lessons_completed / e.lessons_total) * 100
                : 0),
            0
          ) / team.length
        )
      : 0;

  const avgScore =
    team.filter((e) => e.best_score !== null).length > 0
      ? Math.round(
          team
            .filter((e) => e.best_score !== null)
            .reduce((acc, e) => acc + (e.best_score ?? 0), 0) /
            team.filter((e) => e.best_score !== null).length
        )
      : null;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Мой отдел</h1>
          <p className={styles.subtitle}>
            Прогресс обучения сотрудников в вашем отделе
          </p>
        </div>
      </div>

      {/* Summary */}
      {!loading && !error && team.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: "1rem",
            marginBottom: "1.75rem",
          }}
        >
          {[
            { label: "Сотрудников", value: team.length, icon: "👥", color: "#6366f1" },
            {
              label: "Среднее выполнение",
              value: `${avgCompletion}%`,
              icon: "📈",
              color: "#10b981",
            },
            {
              label: "Средний балл",
              value: avgScore !== null ? `${avgScore}%` : "—",
              icon: "🏆",
              color: "#f59e0b",
            },
            {
              label: "С слабыми темами",
              value: team.filter((e) => e.weak_areas.length > 0).length,
              icon: "🔴",
              color: "#ef4444",
            },
          ].map((card) => (
            <div
              key={card.label}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "1rem 1.25rem",
                display: "flex",
                alignItems: "center",
                gap: "0.875rem",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: card.color + "18",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.2rem",
                  flexShrink: 0,
                }}
              >
                {card.icon}
              </div>
              <div>
                <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#111827", lineHeight: 1 }}>
                  {card.value}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: "3px" }}>
                  {card.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>Загрузка данных отдела...</div>
      ) : error ? (
        <div className={styles.emptyWide} style={{ color: "#ef4444" }}>
          {error}
        </div>
      ) : team.length === 0 ? (
        <div className={styles.emptyWide}>
          Сотрудники отдела не найдены. Убедитесь, что ваш профиль сотрудника
          привязан к отделу.
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.875rem",
          }}
        >
          {team.map((emp) => {
            const lessonPct =
              emp.lessons_total > 0
                ? Math.round((emp.lessons_completed / emp.lessons_total) * 100)
                : 0;
            const testPct =
              emp.tests_total > 0
                ? Math.round((emp.tests_passed / emp.tests_total) * 100)
                : 0;

            return (
              <div
                key={emp.employee_id}
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px",
                  padding: "1rem 1.25rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "0.75rem",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#111827" }}>
                      {emp.full_name}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      {emp.department_name ?? "Без отдела"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {emp.best_score !== null && (
                      <span
                        style={{
                          background: emp.best_score >= 70 ? "#f0fdf4" : "#fef2f2",
                          color: emp.best_score >= 70 ? "#16a34a" : "#ef4444",
                          border: `1px solid ${emp.best_score >= 70 ? "#bbf7d0" : "#fecaca"}`,
                          borderRadius: "8px",
                          padding: "2px 8px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}
                      >
                        {emp.best_score}% тест
                      </span>
                    )}
                    {emp.weak_areas.length > 0 && (
                      <span
                        style={{
                          background: "#fef9c3",
                          color: "#854d0e",
                          border: "1px solid #fef08a",
                          borderRadius: "8px",
                          padding: "2px 8px",
                          fontSize: "0.72rem",
                          fontWeight: 500,
                        }}
                      >
                        ⚠️ {emp.weak_areas.length} слаб. тем
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {/* Lessons */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ fontSize: "0.75rem", color: "#6b7280", width: "120px", flexShrink: 0 }}>
                      📖 Уроки {emp.lessons_completed}/{emp.lessons_total}
                    </span>
                    <Bar value={emp.lessons_completed} max={emp.lessons_total || 1} />
                    <span style={{ fontSize: "0.72rem", color: "#9ca3af", width: "36px", textAlign: "right" }}>
                      {lessonPct}%
                    </span>
                  </div>

                  {/* Tests */}
                  {emp.tests_total > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span style={{ fontSize: "0.75rem", color: "#6b7280", width: "120px", flexShrink: 0 }}>
                        🧪 Тесты {emp.tests_passed}/{emp.tests_total}
                      </span>
                      <Bar value={emp.tests_passed} max={emp.tests_total} />
                      <span style={{ fontSize: "0.72rem", color: "#9ca3af", width: "36px", textAlign: "right" }}>
                        {testPct}%
                      </span>
                    </div>
                  )}
                </div>

                {emp.weak_areas.length > 0 && (
                  <div style={{ marginTop: "0.625rem", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {emp.weak_areas.map((t) => (
                      <span
                        key={t}
                        style={{
                          background: "#fef2f2",
                          color: "#ef4444",
                          borderRadius: "6px",
                          padding: "1px 7px",
                          fontSize: "0.7rem",
                          fontWeight: 500,
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ManagerDashboardPage;
