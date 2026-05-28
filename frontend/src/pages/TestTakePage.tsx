import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { startTest, submitTest, getMyAttempts } from "../api/tests";
import type { TestForTaking, Question, AttemptResult, AttemptSummary, AnswerSubmitItem } from "../types";
import styles from "./PageContent.module.css";
import ls from "./LessonsPage.module.css";

const TestTakePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<"loading" | "intro" | "taking" | "result" | "history" | "error">("loading");
  const [test, setTest] = useState<TestForTaking | null>(null);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [error, setError] = useState("");

  // Answers keyed by question_id
  const [answers, setAnswers] = useState<Record<string, AnswerSubmitItem>>({});

  // Timer
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      startTest(id),
      getMyAttempts(id),
    ]).then(([t, att]) => {
      setTest(t);
      setAttempts(att.filter((a) => a.status === "completed"));
      setPhase("intro");
    }).catch((err) => {
      const msg = err?.response?.data?.detail;
      setError(msg || "Не удалось загрузить тест");
      setPhase("error");
    });
  }, [id]);

  const startTaking = () => {
    if (!test) return;
    startTimeRef.current = Date.now();
    setPhase("taking");
    if (test.time_limit_minutes) {
      setSecondsLeft(test.time_limit_minutes * 60);
      timerRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timerRef.current!);
            handleSubmit(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const setAnswer = (question: Question, selectedIds?: string[], textAnswer?: string) => {
    setAnswers((prev) => ({
      ...prev,
      [question.id]: {
        question_id: question.id,
        selected_option_ids: selectedIds ?? null,
        text_answer: textAnswer ?? null,
      },
    }));
  };

  const handleSubmit = async (auto = false) => {
    if (!id || submitting) return;
    if (!auto && !confirm("Завершить тест и отправить ответы?")) return;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);
    const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
    try {
      const res = await submitTest(id, {
        answers: Object.values(answers),
        time_spent_seconds: timeSpent,
      });
      setResult(res);
      setPhase("result");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Ошибка отправки");
      setPhase("error");
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (phase === "loading") return <div className={styles.page}><div className={styles.loading}>Загрузка...</div></div>;
  if (phase === "error") return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate(-1)}>← Назад</button>
      <div className="error-msg">{error}</div>
    </div>
  );

  if (!test) return null;

  // ── Intro ──────────────────────────────────────────────────────────────────
  if (phase === "intro") return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate(-1)}>← Назад</button>
      <div className={ls.detailHeader}>
        <h1 className={ls.detailTitle}>{test.title}</h1>
        {test.description && <p className={ls.detailDesc}>{test.description}</p>}
        <div className={ls.detailMeta}>
          <span>📋 {test.questions.length} вопросов</span>
          <span>🎯 Проходной балл: {test.passing_score}%</span>
          {test.time_limit_minutes && <span>⏱ Ограничение: {test.time_limit_minutes} мин</span>}
          <span>🔁 Попыток: {attempts.length} из {test.max_attempts}</span>
        </div>

        {attempts.length > 0 && (
          <div style={{ marginTop: "1rem" }}>
            <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "0.5rem" }}>Предыдущие попытки:</p>
            {attempts.map((a) => (
              <div key={a.id} style={{ display: "flex", gap: "1rem", fontSize: "0.8rem", color: "#374151", marginBottom: "0.25rem" }}>
                <span>{a.completed_at ? new Date(a.completed_at).toLocaleDateString("ru-RU") : "—"}</span>
                <strong style={{ color: a.passed ? "#16a34a" : "#dc2626" }}>{a.score}%</strong>
                <span>{a.passed ? "✅ Сдал" : "❌ Не сдал"}</span>
              </div>
            ))}
          </div>
        )}

        <div className={ls.detailActions}>
          <button className="btn-primary" onClick={startTaking}>
            {attempts.length > 0 ? "Пройти ещё раз" : "Начать тест"}
          </button>
          {attempts.length > 0 && (
            <button className="btn-secondary" onClick={() => setPhase("history")}>
              История попыток
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // ── Taking ─────────────────────────────────────────────────────────────────
  if (phase === "taking") return (
    <div className={styles.page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h2 style={{ fontWeight: 700, color: "#111827" }}>{test.title}</h2>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
            {Object.keys(answers).length} / {test.questions.length} отвечено
          </span>
          {secondsLeft !== null && (
            <span style={{
              fontFamily: "monospace", fontWeight: 700, fontSize: "1rem",
              color: secondsLeft < 60 ? "#dc2626" : "#374151",
            }}>
              ⏱ {formatTime(secondsLeft)}
            </span>
          )}
        </div>
      </div>

      {test.questions.sort((a, b) => a.order_index - b.order_index).map((q, idx) => {
        const ans = answers[q.id];
        return (
          <div key={q.id} className={ls.contentSection} style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <p style={{ fontWeight: 500, color: "#111827", fontSize: "0.95rem" }}>
                {idx + 1}. {q.text}
              </p>
              <span style={{ fontSize: "0.75rem", color: "#6b7280", whiteSpace: "nowrap", marginLeft: "1rem" }}>
                {q.points} б.
              </span>
            </div>

            {(q.question_type === "single" || q.question_type === "yes_no") && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {q.options.sort((a, b) => a.order_index - b.order_index).map((opt) => {
                  const selected = ans?.selected_option_ids?.includes(opt.id);
                  return (
                    <label key={opt.id} style={{ display: "flex", alignItems: "center", gap: "0.625rem", cursor: "pointer" }}>
                      <input type="radio"
                        name={`q-${q.id}`}
                        checked={!!selected}
                        onChange={() => setAnswer(q, [opt.id])}
                      />
                      <span style={{ fontSize: "0.875rem", color: "#374151" }}>{opt.text}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {q.question_type === "multiple" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {q.options.sort((a, b) => a.order_index - b.order_index).map((opt) => {
                  const selected = (ans?.selected_option_ids ?? []).includes(opt.id);
                  return (
                    <label key={opt.id} style={{ display: "flex", alignItems: "center", gap: "0.625rem", cursor: "pointer" }}>
                      <input type="checkbox"
                        checked={selected}
                        onChange={() => {
                          const cur = ans?.selected_option_ids ?? [];
                          const next = selected ? cur.filter((x) => x !== opt.id) : [...cur, opt.id];
                          setAnswer(q, next);
                        }}
                      />
                      <span style={{ fontSize: "0.875rem", color: "#374151" }}>{opt.text}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {(q.question_type === "text" || q.question_type === "case") && (
              <textarea
                rows={3}
                value={ans?.text_answer ?? ""}
                onChange={(e) => setAnswer(q, undefined, e.target.value)}
                placeholder={q.question_type === "case" ? "Опишите ваше решение..." : "Введите ответ..."}
                style={{ width: "100%", resize: "vertical" }}
              />
            )}
          </div>
        );
      })}

      <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
        <button className="btn-primary" onClick={() => handleSubmit()} disabled={submitting}>
          {submitting ? "Отправка..." : "Отправить ответы ✓"}
        </button>
      </div>
    </div>
  );

  // ── Result ─────────────────────────────────────────────────────────────────
  if (phase === "result" && result) return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate(-1)}>← Назад</button>

      {/* Score banner */}
      <div style={{
        background: result.passed ? "#f0fdf4" : "#fef2f2",
        border: `2px solid ${result.passed ? "#86efac" : "#fca5a5"}`,
        borderRadius: "14px", padding: "2rem", textAlign: "center", marginBottom: "1.5rem",
      }}>
        <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>{result.passed ? "🎉" : "😔"}</div>
        <div style={{ fontSize: "2.5rem", fontWeight: 800, color: result.passed ? "#16a34a" : "#dc2626" }}>
          {result.score}%
        </div>
        <div style={{ fontSize: "1rem", color: result.passed ? "#15803d" : "#b91c1c", marginTop: "0.25rem" }}>
          {result.passed ? "Тест пройден!" : "Тест не пройден"}
        </div>
        <div style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "0.5rem" }}>
          {result.earned_points} из {result.total_points} баллов · проходной: {result.passing_score}%
        </div>
      </div>

      {/* Auto-assignment notice */}
      {result.auto_assigned_lesson && (
        <div style={{
          background: "#eff6ff", border: "1.5px solid #93c5fd",
          borderRadius: "10px", padding: "1rem", marginBottom: "1.25rem",
        }}>
          📚 Вам автоматически назначен урок:{" "}
          <strong>{result.auto_assigned_lesson.title}</strong>
          <p style={{ fontSize: "0.8rem", color: "#3b82f6", marginTop: "0.25rem" }}>
            Перейдите в раздел «Мои уроки», чтобы изучить материал.
          </p>
        </div>
      )}

      {result.weak_topic_added && (
        <div style={{
          background: "#fffbeb", border: "1.5px solid #fcd34d",
          borderRadius: "10px", padding: "1rem", marginBottom: "1.25rem",
          fontSize: "0.875rem", color: "#92400e",
        }}>
          ⚠️ Тема добавлена в ваши слабые зоны. HR увидит это при анализе вашего профиля.
        </div>
      )}

      {/* Per-question breakdown */}
      <div className={ls.contentSection}>
        <h2>Разбор ответов</h2>
        {result.question_results.map((qr, idx) => (
          <div key={qr.question_id} style={{
            border: `1.5px solid ${qr.is_correct === true ? "#86efac" : qr.is_correct === false ? "#fca5a5" : "#e5e7eb"}`,
            borderRadius: "8px", padding: "0.875rem", marginBottom: "0.75rem",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <span style={{ fontWeight: 500, fontSize: "0.875rem", color: "#111827" }}>
                {idx + 1}. {qr.question_text}
              </span>
              <span style={{ fontSize: "0.75rem", color: qr.is_correct === true ? "#16a34a" : qr.is_correct === false ? "#dc2626" : "#6b7280", whiteSpace: "nowrap", marginLeft: "1rem" }}>
                {qr.is_correct === true ? "✓" : qr.is_correct === false ? "✗" : "—"} {qr.points_earned}/{qr.max_points} б.
              </span>
            </div>

            {qr.correct_option_ids.length > 0 && (
              <p style={{ fontSize: "0.78rem", color: "#6b7280" }}>
                ✅ Правильно: выделено зелёным
              </p>
            )}
            {qr.text_answer && (
              <p style={{ fontSize: "0.8rem", color: "#374151", background: "#f9fafb", borderRadius: "6px", padding: "0.4rem 0.75rem" }}>
                Ваш ответ: {qr.text_answer}
              </p>
            )}
            {qr.explanation && (
              <p style={{ fontSize: "0.78rem", color: "#7c3aed", marginTop: "0.375rem" }}>
                💡 {qr.explanation}
              </p>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button className="btn-secondary" onClick={() => navigate("/dashboard/my-tests")}>
          Мои тесты
        </button>
        <button className="btn-secondary" onClick={() => navigate("/dashboard/my-lessons")}>
          Мои уроки
        </button>
      </div>
    </div>
  );

  return null;
};

export default TestTakePage;
