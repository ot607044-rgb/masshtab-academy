import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getTest, updateTest, publishTest, archiveTest,
  addQuestion, updateQuestion, deleteQuestion,
  getTestResults,
} from "../api/tests";
import type { TestDetail, QuestionFull, QuestionCreate, AttemptSummary } from "../types";
import { QUESTION_TYPE_LABELS } from "../types";
import { useAuth } from "../context/AuthContext";
import styles from "./PageContent.module.css";
import ls from "./LessonsPage.module.css";

type QForm = {
  question_type: string;
  text: string;
  explanation: string;
  points: string;
  options: { text: string; is_correct: boolean }[];
};

const emptyForm = (): QForm => ({
  question_type: "single",
  text: "",
  explanation: "",
  points: "1",
  options: [
    { text: "", is_correct: false },
    { text: "", is_correct: false },
  ],
});

const YES_NO_OPTIONS = [
  { text: "Да", is_correct: true, order_index: 0 },
  { text: "Нет", is_correct: false, order_index: 1 },
];

const TestDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = ["company_admin", "hr", "methodologist"].includes(user?.role ?? "");

  const [test, setTest] = useState<TestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"questions" | "results">("questions");
  const [results, setResults] = useState<AttemptSummary[]>([]);
  const [resultsLoaded, setResultsLoaded] = useState(false);

  // Question form
  const [showAddQ, setShowAddQ] = useState(false);
  const [editingQ, setEditingQ] = useState<string | null>(null);
  const [qForm, setQForm] = useState<QForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getTest(id)
      .then(setTest)
      .catch(() => setError("Тест не найден"))
      .finally(() => setLoading(false));
  }, [id]);

  const reload = async () => {
    if (!id) return;
    const updated = await getTest(id);
    setTest(updated);
  };

  const handlePublish = async () => {
    if (!id) return;
    await publishTest(id);
    await reload();
  };

  const handleArchive = async () => {
    if (!id || !confirm("Перевести в архив?")) return;
    await archiveTest(id);
    await reload();
  };

  const loadResults = async () => {
    if (!id || resultsLoaded) return;
    const data = await getTestResults(id);
    setResults(data);
    setResultsLoaded(true);
  };

  useEffect(() => {
    if (tab === "results") loadResults();
  }, [tab]); // eslint-disable-line

  const startEdit = (q: QuestionFull) => {
    setEditingQ(q.id);
    setShowAddQ(false);
    setQForm({
      question_type: q.question_type,
      text: q.text,
      explanation: q.explanation ?? "",
      points: String(q.points),
      options: q.options.map((o) => ({ text: o.text, is_correct: o.is_correct })),
    });
  };

  const handleSaveQuestion = async () => {
    if (!id || !qForm.text.trim()) return;
    setSaving(true);
    const options = qForm.question_type === "yes_no"
      ? YES_NO_OPTIONS
      : qForm.question_type === "text" || qForm.question_type === "case"
      ? []
      : qForm.options.filter((o) => o.text.trim()).map((o, i) => ({ ...o, order_index: i }));

    const payload: QuestionCreate = {
      question_type: qForm.question_type as QuestionCreate["question_type"],
      text: qForm.text,
      explanation: qForm.explanation || undefined,
      points: Number(qForm.points) || 1,
      order_index: editingQ
        ? (test?.questions.find((q) => q.id === editingQ)?.order_index ?? 0)
        : (test?.questions.length ?? 0),
      options,
    };

    try {
      if (editingQ) {
        const updated = await updateQuestion(id, editingQ, payload);
        setTest(updated);
      } else {
        const updated = await addQuestion(id, payload);
        setTest(updated);
      }
      setShowAddQ(false);
      setEditingQ(null);
      setQForm(emptyForm());
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQ = async (qId: string) => {
    if (!id || !confirm("Удалить вопрос?")) return;
    const updated = await deleteQuestion(id, qId);
    setTest(updated);
  };

  const setCorrect = (idx: number, multi: boolean) => {
    setQForm((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => ({
        ...o,
        is_correct: multi ? (i === idx ? !o.is_correct : o.is_correct) : i === idx,
      })),
    }));
  };

  if (loading) return <div className={styles.page}><div className={styles.loading}>Загрузка...</div></div>;
  if (error || !test) return <div className={styles.page}><div className="error-msg">{error || "Не найдено"}</div></div>;

  const STATUS_COLOR: Record<string, string> = { draft: "statusYellow", published: "statusGreen", archived: "statusRed" };

  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate(-1)}>← Назад</button>

      {/* Header */}
      <div className={ls.detailHeader}>
        <div className={ls.detailMeta}>
          <span className={`${styles.statusBadge} ${styles[STATUS_COLOR[test.status] || "statusYellow"]}`}>
            {test.status === "draft" ? "Черновик" : test.status === "published" ? "Опубликован" : "Архив"}
          </span>
          <span>🎯 {test.passing_score}% проходной</span>
          <span>🔁 {test.max_attempts} поп.</span>
          {test.time_limit_minutes && <span>⏱ {test.time_limit_minutes} мин</span>}
        </div>
        <h1 className={ls.detailTitle}>{test.title}</h1>
        {test.description && <p className={ls.detailDesc}>{test.description}</p>}

        {canEdit && (
          <div className={ls.detailActions}>
            {test.status === "draft" && (
              <button className="btn-primary" onClick={handlePublish}>Опубликовать</button>
            )}
            {test.status === "published" && (
              <button className="btn-warn" onClick={handleArchive}>В архив</button>
            )}
            {test.status === "published" && (
              <button className="btn-secondary" onClick={() => navigate(`/dashboard/tests/${test.id}/take`)}>
                Предпросмотр теста
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      {canEdit && (
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
          {(["questions", "results"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "0.5rem 1.25rem",
              border: "1.5px solid",
              borderColor: tab === t ? "#6366f1" : "#e5e7eb",
              borderRadius: "8px",
              background: tab === t ? "#ede9fe" : "#fff",
              color: tab === t ? "#4f46e5" : "#6b7280",
              fontWeight: tab === t ? 600 : 400,
              cursor: "pointer", fontSize: "0.875rem",
            }}>
              {t === "questions" ? `Вопросы (${test.questions.length})` : `Результаты (${results.length})`}
            </button>
          ))}
        </div>
      )}

      {tab === "questions" && (
        <div className={ls.contentSection}>
          <h2>📋 Вопросы</h2>

          {test.questions.length === 0 && (
            <p style={{ color: "#9ca3af", fontSize: "0.875rem", marginBottom: "1rem" }}>
              Вопросов пока нет. Добавьте первый.
            </p>
          )}

          {test.questions.map((q, idx) => (
            <div key={q.id} style={{
              border: editingQ === q.id ? "1.5px solid #a5b4fc" : "1.5px solid #f3f4f6",
              borderRadius: "10px", padding: "1rem", marginBottom: "0.75rem",
            }}>
              {editingQ === q.id ? (
                <QuestionForm
                  form={qForm} setForm={setQForm}
                  saving={saving}
                  onSave={handleSaveQuestion}
                  onCancel={() => { setEditingQ(null); setQForm(emptyForm()); }}
                  setCorrect={setCorrect}
                />
              ) : (
                <div style={{ display: "flex", gap: "0.875rem", alignItems: "flex-start" }}>
                  <span style={{ color: "#9ca3af", fontSize: "0.8rem", minWidth: "24px" }}>{idx + 1}.</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <span style={{ fontWeight: 500, color: "#111827", fontSize: "0.9rem" }}>{q.text}</span>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <span style={{ fontSize: "0.75rem", color: "#6b7280", background: "#f3f4f6", padding: "0.15rem 0.5rem", borderRadius: "999px" }}>
                          {QUESTION_TYPE_LABELS[q.question_type as keyof typeof QUESTION_TYPE_LABELS]}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "#6366f1" }}>{q.points} б.</span>
                        {canEdit && (
                          <>
                            <button className="btn-secondary" style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem" }}
                              onClick={() => startEdit(q)}>✏️</button>
                            <button className="btn-danger" style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem" }}
                              onClick={() => handleDeleteQ(q.id)}>✕</button>
                          </>
                        )}
                      </div>
                    </div>
                    {q.options.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        {q.options.sort((a, b) => a.order_index - b.order_index).map((o) => (
                          <div key={o.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem" }}>
                            <span style={{
                              width: "16px", height: "16px", borderRadius: q.question_type === "multiple" ? "3px" : "50%",
                              border: `2px solid ${o.is_correct ? "#16a34a" : "#d1d5db"}`,
                              background: o.is_correct ? "#dcfce7" : "transparent",
                              flexShrink: 0,
                            }} />
                            <span style={{ color: o.is_correct ? "#15803d" : "#374151" }}>{o.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {q.explanation && (
                      <p style={{ fontSize: "0.78rem", color: "#9ca3af", marginTop: "0.5rem" }}>💡 {q.explanation}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {canEdit && !editingQ && (
            showAddQ ? (
              <QuestionForm
                form={qForm} setForm={setQForm}
                saving={saving}
                onSave={handleSaveQuestion}
                onCancel={() => { setShowAddQ(false); setQForm(emptyForm()); }}
                setCorrect={setCorrect}
              />
            ) : (
              <button className="btn-secondary" style={{ marginTop: "0.5rem" }}
                onClick={() => { setShowAddQ(true); setEditingQ(null); setQForm(emptyForm()); }}>
                + Добавить вопрос
              </button>
            )
          )}
        </div>
      )}

      {tab === "results" && canEdit && (
        <div className={ls.contentSection}>
          <h2>📊 Результаты прохождения</h2>
          {results.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>Никто ещё не проходил этот тест.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Сотрудник</th>
                    <th>Результат</th>
                    <th>Статус</th>
                    <th>Дата</th>
                    <th>Время</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.id}>
                      <td className={styles.nameCell}>{r.employee_name ?? "—"}</td>
                      <td>
                        <strong style={{ color: r.passed ? "#16a34a" : "#dc2626" }}>
                          {r.score != null ? `${r.score}%` : "—"}
                        </strong>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${r.passed ? styles.statusGreen : styles.statusRed}`}>
                          {r.passed ? "Сдал" : "Не сдал"}
                        </span>
                      </td>
                      <td className={styles.dateCell}>
                        {r.completed_at ? new Date(r.completed_at).toLocaleDateString("ru-RU") : "—"}
                      </td>
                      <td className={styles.dateCell}>
                        {r.time_spent_seconds ? `${Math.round(r.time_spent_seconds / 60)} мин` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Question form sub-component ─────────────────────────────────────────────

interface QFormProps {
  form: QForm;
  setForm: React.Dispatch<React.SetStateAction<QForm>>;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  setCorrect: (idx: number, multi: boolean) => void;
}

const QuestionForm: React.FC<QFormProps> = ({ form, setForm, saving, onSave, onCancel, setCorrect }) => {
  const isObjective = ["single", "multiple", "yes_no"].includes(form.question_type);
  const isMulti = form.question_type === "multiple";
  const isYesNo = form.question_type === "yes_no";

  return (
    <div style={{ background: "#f9fafb", borderRadius: "10px", padding: "1.25rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Тип вопроса *</label>
          <select value={form.question_type} onChange={(e) => setForm({ ...form, question_type: e.target.value, options: [{ text: "", is_correct: false }, { text: "", is_correct: false }] })}>
            <option value="single">Один вариант</option>
            <option value="multiple">Несколько вариантов</option>
            <option value="yes_no">Да / Нет</option>
            <option value="text">Текстовый ответ</option>
            <option value="case">Практический кейс</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Баллы *</label>
          <input type="number" min={1} value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: "0.75rem" }}>
        <label>Текст вопроса *</label>
        <textarea rows={2} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })}
          placeholder="Введите текст вопроса..." style={{ resize: "vertical" }} />
      </div>

      {isObjective && !isYesNo && (
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: "0.5rem", display: "block" }}>
            Варианты ответов {isMulti ? "(отметьте все правильные)" : "(отметьте один правильный)"}
          </label>
          {form.options.map((opt, i) => (
            <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.375rem" }}>
              <button
                type="button"
                onClick={() => setCorrect(i, isMulti)}
                style={{
                  width: "20px", height: "20px", flexShrink: 0,
                  borderRadius: isMulti ? "4px" : "50%",
                  border: `2px solid ${opt.is_correct ? "#16a34a" : "#d1d5db"}`,
                  background: opt.is_correct ? "#dcfce7" : "transparent",
                  cursor: "pointer",
                }}
              />
              <input
                placeholder={`Вариант ${i + 1}`}
                value={opt.text}
                onChange={(e) => setForm((prev) => ({
                  ...prev,
                  options: prev.options.map((o, j) => j === i ? { ...o, text: e.target.value } : o),
                }))}
                style={{ flex: 1 }}
              />
              {form.options.length > 2 && (
                <button type="button" onClick={() => setForm((prev) => ({ ...prev, options: prev.options.filter((_, j) => j !== i) }))}
                  style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer" }}>✕</button>
              )}
            </div>
          ))}
          <button type="button" className="btn-secondary" style={{ fontSize: "0.78rem", marginTop: "0.25rem" }}
            onClick={() => setForm((prev) => ({ ...prev, options: [...prev.options, { text: "", is_correct: false }] }))}>
            + Добавить вариант
          </button>
        </div>
      )}

      {isYesNo && (
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem" }}>
          {YES_NO_OPTIONS.map((o, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.375rem", cursor: "pointer" }}
              onClick={() => setCorrect(i, false)}>
              <div style={{
                width: "18px", height: "18px", borderRadius: "50%",
                border: `2px solid ${(form.options[i]?.is_correct ?? false) || (i === 0 && !form.options.length) ? "#16a34a" : "#d1d5db"}`,
                background: form.options[i]?.is_correct ? "#dcfce7" : "transparent",
              }} />
              <span style={{ fontSize: "0.875rem" }}>{o.text}</span>
            </div>
          ))}
        </div>
      )}

      <div className="form-group" style={{ marginBottom: "0.75rem" }}>
        <label>Пояснение (показывается после ответа)</label>
        <input value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })}
          placeholder="Необязательно..." />
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button className="btn-primary" style={{ fontSize: "0.875rem" }} onClick={onSave} disabled={saving}>
          {saving ? "..." : "Сохранить вопрос"}
        </button>
        <button className="btn-secondary" style={{ fontSize: "0.875rem" }} onClick={onCancel}>Отмена</button>
      </div>
    </div>
  );
};

export default TestDetailPage;
