import React, { useState, useEffect } from "react";
import {
  getOverview,
  getByDepartment,
  getWeakTopics,
  getEmployeeProgress,
} from "../api/analytics";
import type {
  OverviewStats,
  DeptStat,
  WeakTopicStat,
  EmployeeProgress,
} from "../types";
import styles from "./PageContent.module.css";

// ── Small stat card ──────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color = "#6366f1" }) => (
  <div
    style={{
      background: "#fff",
      borderRadius: "12px",
      border: "1px solid #e5e7eb",
      padding: "1.25rem 1.5rem",
      display: "flex",
      alignItems: "center",
      gap: "1rem",
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    }}
  >
    <div
      style={{
        width: "48px",
        height: "48px",
        borderRadius: "12px",
        background: color + "18",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "1.5rem",
        flexShrink: 0,
      }}
    >
      {icon}
    </div>
    <div>
      <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#111827", lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: "0.78rem", color: "#6b7280", marginTop: "4px" }}>{label}</div>
    </div>
  </div>
);

// ── Simple horizontal bar ────────────────────────────────────────────────────

const Bar: React.FC<{ value: number; max: number; color?: string }> = ({
  value,
  max,
  color = "#6366f1",
}) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      style={{
        background: "#f3f4f6",
        borderRadius: "999px",
        height: "8px",
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

// ── Main page ────────────────────────────────────────────────────────────────

const HRDashboardPage: React.FC = () => {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [deptStats, setDeptStats] = useState<DeptStat[]>([]);
  const [weakTopics, setWeakTopics] = useState<WeakTopicStat[]>([]);
  const [employees, setEmployees] = useState<EmployeeProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      getOverview(),
      getByDepartment(),
      getWeakTopics(),
      getEmployeeProgress(),
    ])
      .then(([ov, dept, wt, emp]) => {
        setOverview(ov);
        setDeptStats(dept);
        setWeakTopics(wt);
        setEmployees(emp);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Загрузка аналитики...</div>
      </div>
    );
  }

  const filteredEmployees = search
    ? employees.filter((e) =>
        e.full_name.toLowerCase().includes(search.toLowerCase())
      )
    : employees;

  const maxWeak = weakTopics[0]?.count ?? 1;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Аналитика HR</h1>
          <p className={styles.subtitle}>Общая картина обучения в компании</p>
        </div>
      </div>

      {/* Overview cards */}
      {overview && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <StatCard label="Всего сотрудников" value={overview.total_employees} icon="👥" color="#6366f1" />
          <StatCard label="Активных" value={overview.active_employees} icon="✅" color="#10b981" />
          <StatCard label="Уроков завершено" value={overview.lessons_completed} icon="📖" color="#3b82f6" />
          <StatCard label="Уроков просрочено" value={overview.lessons_overdue} icon="⚠️" color="#ef4444" />
          <StatCard label="Тестов сдано" value={overview.tests_passed} icon="🏆" color="#f59e0b" />
          <StatCard
            label="Средний балл тестов"
            value={overview.avg_test_score !== null ? `${overview.avg_test_score}%` : "—"}
            icon="📊"
            color="#8b5cf6"
          />
          <StatCard
            label="Процент выполнения"
            value={`${overview.completion_rate}%`}
            icon="🎯"
            color="#06b6d4"
          />
        </div>
      )}

      {/* Two-column block: department stats + weak topics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        {/* Department stats */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "1.25rem 1.5rem",
          }}
        >
          <h2
            style={{
              fontSize: "0.95rem",
              fontWeight: 600,
              color: "#374151",
              marginBottom: "1rem",
            }}
          >
            📊 По отделам
          </h2>
          {deptStats.length === 0 ? (
            <p style={{ fontSize: "0.82rem", color: "#9ca3af" }}>Нет данных</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              {deptStats.map((d) => (
                <div key={d.department_id}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.8rem",
                      marginBottom: "4px",
                    }}
                  >
                    <span style={{ fontWeight: 500, color: "#374151" }}>{d.department_name}</span>
                    <span style={{ color: "#6b7280" }}>
                      {d.lessons_completed}/{d.lessons_assigned} урок
                      {d.avg_score !== null && (
                        <span style={{ marginLeft: "8px", color: "#6366f1" }}>
                          {d.avg_score}% тест
                        </span>
                      )}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Bar
                      value={d.lessons_completed}
                      max={d.lessons_assigned || 1}
                      color="#6366f1"
                    />
                    <span style={{ fontSize: "0.72rem", color: "#9ca3af", width: "36px", textAlign: "right" }}>
                      {d.completion_rate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weak topics */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "1.25rem 1.5rem",
          }}
        >
          <h2
            style={{
              fontSize: "0.95rem",
              fontWeight: 600,
              color: "#374151",
              marginBottom: "1rem",
            }}
          >
            🔴 Слабые темы
          </h2>
          {weakTopics.length === 0 ? (
            <p style={{ fontSize: "0.82rem", color: "#9ca3af" }}>
              Нет данных — результаты тестов ещё не накоплены.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {weakTopics.slice(0, 10).map((wt) => (
                <div key={wt.topic}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.8rem",
                      marginBottom: "4px",
                    }}
                  >
                    <span style={{ color: "#374151", fontWeight: 500 }}>{wt.topic}</span>
                    <span style={{ color: "#ef4444", fontWeight: 600 }}>{wt.count} чел.</span>
                  </div>
                  <Bar value={wt.count} max={maxWeak} color="#ef4444" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Employees table */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          padding: "1.25rem 1.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <h2 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#374151" }}>
            👤 Прогресс сотрудников
          </h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени..."
            style={{
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              padding: "0.35rem 0.75rem",
              fontSize: "0.82rem",
              outline: "none",
              width: "200px",
            }}
          />
        </div>

        {filteredEmployees.length === 0 ? (
          <p style={{ fontSize: "0.82rem", color: "#9ca3af" }}>Нет сотрудников</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #f3f4f6" }}>
                  <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", color: "#6b7280", fontWeight: 600 }}>Сотрудник</th>
                  <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", color: "#6b7280", fontWeight: 600 }}>Отдел</th>
                  <th style={{ textAlign: "center", padding: "0.5rem 0.75rem", color: "#6b7280", fontWeight: 600 }}>Уроки</th>
                  <th style={{ textAlign: "center", padding: "0.5rem 0.75rem", color: "#6b7280", fontWeight: 600 }}>Тесты</th>
                  <th style={{ textAlign: "center", padding: "0.5rem 0.75rem", color: "#6b7280", fontWeight: 600 }}>Лучший балл</th>
                  <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", color: "#6b7280", fontWeight: 600 }}>Слабые темы</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr
                    key={emp.employee_id}
                    style={{ borderBottom: "1px solid #f9fafb" }}
                  >
                    <td style={{ padding: "0.6rem 0.75rem", fontWeight: 500, color: "#111827" }}>
                      {emp.full_name}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", color: "#6b7280" }}>
                      {emp.department_name ?? "—"}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                      <span
                        style={{
                          color: emp.lessons_completed === emp.lessons_total && emp.lessons_total > 0
                            ? "#16a34a"
                            : "#374151",
                          fontWeight: 500,
                        }}
                      >
                        {emp.lessons_completed}/{emp.lessons_total}
                      </span>
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                      <span style={{ color: "#374151", fontWeight: 500 }}>
                        {emp.tests_passed}/{emp.tests_total}
                      </span>
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                      {emp.best_score !== null ? (
                        <span
                          style={{
                            color: emp.best_score >= 70 ? "#16a34a" : "#ef4444",
                            fontWeight: 600,
                          }}
                        >
                          {emp.best_score}%
                        </span>
                      ) : (
                        <span style={{ color: "#9ca3af" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>
                      {emp.weak_areas.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          {emp.weak_areas.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              style={{
                                background: "#fef2f2",
                                color: "#ef4444",
                                borderRadius: "6px",
                                padding: "1px 6px",
                                fontSize: "0.7rem",
                                fontWeight: 500,
                              }}
                            >
                              {t}
                            </span>
                          ))}
                          {emp.weak_areas.length > 3 && (
                            <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>
                              +{emp.weak_areas.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "#9ca3af", fontSize: "0.75rem" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HRDashboardPage;
