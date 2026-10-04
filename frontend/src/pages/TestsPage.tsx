import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { listTests, archiveTest, deleteTest } from "../api/tests";
import type { Test } from "../types";
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
  const canEdit = ["company_admin", "hr", "methodologist", "super_admin"].includes(user?.role ?? "");

  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");

  const reload = async () => {
    const data = await listTests(filterStatus || undefined);
    setTests(data);
  };

  useEffect(() => { reload().finally(() => setLoading(false)); }, [filterStatus]);

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
            <button className="btn-primary" onClick={() => navigate("/dashboard/tests/new")}>
              + Создать тест
            </button>
          )}
        </div>
      </div>

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
                      onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/tests/${test.id}`); }}>
                      Открыть редактор
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
