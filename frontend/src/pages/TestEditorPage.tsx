import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { ArrowLeft, ArrowRight, Check, CheckCheck, Copy, Eye, FileQuestion, Plus, Save, Trash2, Upload } from "lucide-react";
import { addQuestion, archiveTest, createTest, deleteQuestion, getTest, getTestResults, publishTest, updateQuestion, updateTest } from "../api/tests";
import { getPositions } from "../api/positions";
import { getTopics } from "../api/knowledge";
import { getLessons } from "../api/lessons";
import { useAuth } from "../context/AuthContext";
import { QUESTION_TYPE_LABELS, TEST_STATUS_LABELS, type AttemptSummary, type KnowledgeTopic, type Lesson, type Position, type QuestionType, type TestStatus } from "../types";
import TestDetailPage from "./TestDetailPage";
import TestEditorPreview from "./TestEditorPreview";
import { choiceType, defaultSettings, fromQuestion, newQuestion, questionIssue, questionPayload, questionSignature, settingsIssue, settingsOf, type EditorQuestion, type TestSettings } from "./testEditorModel";
import styles from "./TestEditorPage.module.css";

const errorMessage = (error: unknown) => isAxiosError(error) && typeof error.response?.data?.detail === "string" ? error.response.data.detail : "Не удалось сохранить изменения. Проверьте соединение и попробуйте ещё раз.";

export default function TestEditorPage() {
  const { id } = useParams();
  const { user } = useAuth();
  if (!["company_admin", "hr", "methodologist", "super_admin"].includes(user?.role ?? "")) return <TestDetailPage />;
  return <Editor key={id || "new"} id={id} />;
}

function Editor({ id }: { id?: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [settings, setSettings] = useState<TestSettings>({ ...defaultSettings });
  const [questions, setQuestions] = useState<EditorQuestion[]>(() => id ? [] : [newQuestion()]);
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState<TestStatus>("draft");
  const [tab, setTab] = useState<"questions" | "settings" | "results">("questions");
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [topics, setTopics] = useState<KnowledgeTopic[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [referencesError, setReferencesError] = useState("");
  const [results, setResults] = useState<AttemptSummary[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const serverId = useRef(id);
  const savedMeta = useRef("");
  const savedQuestions = useRef(new Map<string, { id: string; signature: string }>());
  const busy = useRef(false);
  const [, refreshSaved] = useState(0);
  const dirty = !loading && (JSON.stringify(settings) !== savedMeta.current || questions.length !== savedQuestions.current.size || questions.some(q => savedQuestions.current.get(q.key)?.signature !== questionSignature(q)));
  const current = questions[selected];

  useEffect(() => {
    let active = true;
    if (id) getTest(id).then(test => {
      if (!active) return;
      const meta = settingsOf(test);
      const rows = [...test.questions].sort((a, b) => a.order_index - b.order_index).map(fromQuestion);
      setSettings(meta); setQuestions(rows); setStatus(test.status);
      savedMeta.current = JSON.stringify(meta);
      savedQuestions.current = new Map(rows.map(q => [q.key, { id: q.serverId!, signature: questionSignature(q) }]));
    }).catch(() => { if (active) setLoadError("Не удалось загрузить тест. Проверьте доступ и обновите страницу."); }).finally(() => { if (active) setLoading(false); });
    Promise.all([getPositions(), getTopics(), getLessons({ status_filter: "published" })]).then(([p, t, l]) => {
      if (active) { setPositions(p); setTopics(t); setLessons(l); }
    }).catch(() => { if (active) setReferencesError("Списки должностей и материалов не загрузились. Текущие связи сохранены; обновите страницу, чтобы изменить их."); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!dirty && !saving) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const click = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (link && !event.ctrlKey && !event.metaKey && !confirm("Есть несохранённые изменения. Покинуть редактор?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", click, true); };
  }, [dirty, saving]);

  useEffect(() => {
    if (tab !== "results" || !serverId.current) return;
    let active = true;
    setResultsLoading(true); setError("");
    getTestResults(serverId.current).then(rows => { if (active) setResults(rows); }).catch(() => { if (active) setError("Не удалось загрузить результаты. Переключите вкладку, чтобы повторить."); }).finally(() => { if (active) setResultsLoading(false); });
    return () => { active = false; };
  }, [tab]);

  function editQuestion(patch: Partial<EditorQuestion>) {
    setQuestions(rows => rows.map((q, i) => i === selected ? { ...q, ...patch } : q)); setError("");
  }
  function changeType(type: QuestionType) {
    if (!current) return;
    const options = type === "yes_no" ? [{ text: "Да", is_correct: false, order_index: 0 }, { text: "Нет", is_correct: false, order_index: 1 }]
      : !choiceType(type) ? [] : current.options.length ? current.options.map(o => ({ ...o, is_correct: false })) : newQuestion().options;
    editQuestion({ question_type: type, options });
  }
  function add(duplicate = false) {
    const q = duplicate && current ? { ...current, key: crypto.randomUUID(), serverId: undefined, options: current.options.map(o => ({ ...o })) } : newQuestion();
    q.order_index = Math.max(-1, ...questions.map(row => row.order_index)) + 1;
    setQuestions([...questions, q]); setSelected(questions.length); setTab("questions"); setError("");
  }
  function remove() {
    if (!current || !confirm("Удалить вопрос? Изменение применится после сохранения теста.")) return;
    setQuestions(questions.filter(q => q.key !== current.key)); setSelected(Math.max(0, selected - 1)); setError("");
  }
  async function save(publish = false) {
    if (busy.current) return;
    const metaIssue = settingsIssue(settings);
    if (metaIssue) { setError(metaIssue); setTab("settings"); return; }
    const invalid = questions.findIndex(q => !Number.isInteger(q.points) || q.points < 1 || (publish && questionIssue(q)));
    if (invalid >= 0) { setError(`Вопрос ${invalid + 1}: ${questionIssue(questions[invalid]) || "проверьте баллы"}.`); setTab("questions"); setSelected(invalid); return; }
    if (publish && !questions.length) { setError("Добавьте хотя бы один вопрос перед публикацией."); return; }
    busy.current = true; setSaving(true); setError("");
    const pending = questions.map(q => ({ ...q, options: q.options.map(o => ({ ...o })) }));
    try {
      let testId = serverId.current;
      if (!testId) {
        const created = await createTest(settings);
        testId = created.id; serverId.current = testId; savedMeta.current = JSON.stringify(settings);
      } else if (savedMeta.current !== JSON.stringify(settings)) {
        await updateTest(testId, settings); savedMeta.current = JSON.stringify(settings);
      }
      for (const q of pending) {
        const saved = savedQuestions.current.get(q.key);
        if (saved?.signature === questionSignature(q)) continue;
        if (q.serverId) await updateQuestion(testId, q.serverId, questionPayload(q));
        else {
          const response = await addQuestion(testId, questionPayload(q));
          const known = new Set([...savedQuestions.current.values()].map(v => v.id));
          const created = response.questions.find(row => !known.has(row.id));
          if (!created) throw new Error("Missing created question");
          q.serverId = created.id;
        }
        savedQuestions.current.set(q.key, { id: q.serverId!, signature: questionSignature(q) });
      }
      for (const [key, saved] of savedQuestions.current) {
        if (!pending.some(q => q.key === key)) { await deleteQuestion(testId, saved.id); savedQuestions.current.delete(key); }
      }
      if (publish) { await publishTest(testId); setStatus("published"); }
      if (!id) navigate(`/dashboard/tests/${testId}`, { replace: true });
    } catch (e) { setError(errorMessage(e)); }
    finally { setQuestions(pending); setSaving(false); busy.current = false; refreshSaved(v => v + 1); }
  }
  async function archive() {
    if (!serverId.current || !confirm("Перевести тест в архив?")) return;
    setSaving(true); setError("");
    try { await archiveTest(serverId.current); setStatus("archived"); } catch (e) { setError(errorMessage(e)); } finally { setSaving(false); }
  }
  const settingsField = <K extends keyof TestSettings>(key: K, value: TestSettings[K]) => { setSettings(s => ({ ...s, [key]: value })); setError(""); };
  const back = () => { if (!dirty || confirm("Есть несохранённые изменения. Покинуть редактор?")) navigate("/dashboard/materials?tab=tests"); };
  if (loading) return <div className={styles.load}>Загрузка теста…</div>;
  if (loadError) return <div className={styles.load}><p role="alert">{loadError}</p><button onClick={() => window.location.reload()} className={styles.button}>Повторить</button></div>;

  return <div className={styles.editor}>
    <header className={styles.header}>
      <button className={styles.back} onClick={back} disabled={saving}><ArrowLeft size={15} /> Материалы и тесты</button>
      <div className={styles.titleRow}><div className={styles.titleBlock}>
        <input className={styles.titleInput} aria-label="Название теста" value={settings.title} placeholder="Название теста" onChange={e => settingsField("title", e.target.value)} disabled={saving} />
        <div className={styles.meta}><span className={styles.badge}>{TEST_STATUS_LABELS[status]}</span><span role="status">{saving ? "Сохраняем…" : dirty ? "Есть несохранённые изменения" : "Все изменения сохранены"}</span></div>
      </div><div className={styles.actions}>
        <button className={styles.button} onClick={() => setPreview(true)} disabled={saving}><Eye size={16} /> Предпросмотр</button>
        <button className={styles.button} onClick={() => void save()} disabled={saving || (!dirty && !!id)}><Save size={16} /> {status === "draft" ? "Сохранить черновик" : "Сохранить изменения"}</button>
        {status !== "published" ? <button className={styles.primary} onClick={() => void save(true)} disabled={saving}><Upload size={16} /> Опубликовать</button> : <button className={styles.button} onClick={() => void archive()} disabled={saving}>В архив</button>}
      </div></div>
      <div className={styles.tabs} role="tablist" aria-label="Редактор теста">
        {([['questions', `Вопросы · ${questions.length}`], ['settings', 'Настройки теста'], ...(id && user?.role !== "methodologist" ? [['results', 'Результаты']] : [])] as const).map(([key, label]) => <button key={key} id={`editor-tab-${key}`} role="tab" aria-selected={!preview && tab === key} aria-controls="editor-panel" onClick={() => { setTab(key as typeof tab); setPreview(false); }} disabled={saving}>{label}</button>)}
      </div>
    </header>
    {error && <div className={styles.error} role="alert">{error}</div>}
    {status === "published" && dirty && <p className={styles.warning}>Изменения затронут опубликованный тест. Сохраняйте их, когда сотрудники не проходят тест.</p>}
    {preview ? <TestEditorPreview questions={questions} onClose={() => setPreview(false)} /> : <fieldset className={styles.content} disabled={saving} id="editor-panel" role="tabpanel" aria-labelledby={`editor-tab-${tab}`}>
      {tab === "questions" && <div className={styles.workspace}>
        <aside className={styles.sidebar}><div className={styles.sideHeading}>Структура теста <span>{questions.length}</span></div>
          <div className={styles.questionList}>{questions.map((q, i) => <button key={q.key} className={`${styles.questionItem} ${i === selected ? styles.selected : ""}`} aria-pressed={i === selected} aria-label={`Вопрос ${i + 1}: ${q.text || "Новый вопрос"}`} onClick={() => setSelected(i)}>
            <span className={styles.number}>{i + 1}</span><span className={styles.questionText}><strong>{q.text || "Новый вопрос"}</strong><small>{QUESTION_TYPE_LABELS[q.question_type]} · {q.points || 0} б.</small></span>
          </button>)}</div>
          <button className={styles.addButton} onClick={() => add()}><Plus size={16} /> Добавить вопрос</button>
          <div className={styles.sideFooter}><CheckCheck size={16} /><span>Готово к публикации: {questions.filter(q => !questionIssue(q)).length} из {questions.length}</span></div>
        </aside>
        <main className={styles.main}>{current ? <>
          <div className={styles.sectionHead}><span className={styles.eyebrow}>Вопрос {selected + 1} из {questions.length}</span><div className={styles.actions}><button className={styles.textButton} onClick={() => add(true)}><Copy size={15} /> Дублировать</button><button className={styles.iconButton} aria-label="Удалить вопрос" onClick={remove}><Trash2 size={16} /></button></div></div>
          <div className={styles.paper}>
            <div className={styles.questionFields}><label className={styles.field}><span>Тип вопроса</span><select value={current.question_type} onChange={e => changeType(e.target.value as QuestionType)}>{Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className={styles.field}><span>Баллы за ответ</span><input type="number" min={1} step={1} value={Number.isNaN(current.points) ? "" : current.points} onChange={e => editQuestion({ points: e.target.valueAsNumber })} /></label></div>
            <label className={styles.field}><span>Вопрос</span><textarea aria-label="Вопрос" className={styles.questionInput} rows={3} value={current.text} onChange={e => editQuestion({ text: e.target.value })} placeholder="Например: с чего начать разговор с клиентом?" /></label>
            {choiceType(current.question_type) ? <div>
              <h2 className={styles.label}>Варианты ответа</h2><p className={styles.hint}>{current.question_type === "multiple" ? "Отметьте все правильные ответы слева." : "Отметьте один правильный ответ слева."}</p>
              {current.options.map((option, i) => <div key={i} className={`${styles.option} ${option.is_correct ? styles.correct : ""}`}>
                <input type={current.question_type === "multiple" ? "checkbox" : "radio"} name={`correct-${current.key}`} aria-label={`Правильный ответ ${i + 1}`} checked={option.is_correct} onChange={e => editQuestion({ options: current.options.map((o, j) => ({ ...o, is_correct: current.question_type === "multiple" ? j === i ? e.target.checked : o.is_correct : j === i })) })} />
                <input type="text" aria-label={`Вариант ответа ${i + 1}`} value={option.text} readOnly={current.question_type === "yes_no"} placeholder={`Вариант ${i + 1}`} onChange={e => editQuestion({ options: current.options.map((o, j) => j === i ? { ...o, text: e.target.value } : o) })} />
                {option.is_correct && <span className={styles.correctLabel}><Check size={14} /> Верный ответ</span>}
                {current.question_type !== "yes_no" && current.options.length > 2 && <button className={styles.iconButton} aria-label={`Удалить вариант ${i + 1}`} onClick={() => editQuestion({ options: current.options.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>}
              </div>)}
              {current.question_type !== "yes_no" && <button className={styles.textButton} onClick={() => editQuestion({ options: [...current.options, { text: "", is_correct: false, order_index: current.options.length }] })}><Plus size={15} /> Добавить вариант</button>}
            </div> : <p className={styles.openAnswer}>Сотрудник напишет развёрнутый ответ. Автоматическая проверка правильности для этого типа недоступна.</p>}
            <div className={styles.explanation}><label className={styles.field}><span>Пояснение после ответа <small>· необязательно</small></span><textarea rows={2} value={current.explanation ?? ""} onChange={e => editQuestion({ explanation: e.target.value })} placeholder="Помогите сотруднику разобраться в ответе" /></label></div>
          </div>
          <div className={styles.footer}><span className={questionIssue(current) ? styles.muted : styles.ready}>{questionIssue(current) ? "Заполните вопрос и отметьте правильный ответ" : <><Check size={15} /> Вопрос готов</>}</span>{selected < questions.length - 1 && <button className={styles.button} onClick={() => setSelected(selected + 1)}>Следующий вопрос <ArrowRight size={15} /></button>}</div>
        </> : <div className={styles.empty}><FileQuestion size={34} /><h2>Начните с первого вопроса</h2><p>Выберите тип, добавьте варианты и отметьте правильный ответ.</p><button className={styles.primary} onClick={() => add()}><Plus size={16} /> Добавить первый вопрос</button></div>}</main>
      </div>}
      {tab === "settings" && <div className={styles.settings}><div className={styles.paper}>
        <h2>О тесте</h2><label className={styles.field}><span>Описание</span><textarea rows={3} value={settings.description ?? ""} onChange={e => settingsField("description", e.target.value)} placeholder="Что проверяет тест и как подготовиться" /></label>
        <h2>Условия прохождения</h2><div className={styles.grid}>
          <label className={styles.field}><span>Проходной балл, %</span><input type="number" min={1} max={100} value={Number.isNaN(settings.passing_score) ? "" : settings.passing_score} onChange={e => settingsField("passing_score", e.target.valueAsNumber)} /></label>
          <label className={styles.field}><span>Количество попыток</span><input type="number" min={1} value={Number.isNaN(settings.max_attempts) ? "" : settings.max_attempts} onChange={e => settingsField("max_attempts", e.target.valueAsNumber)} /></label>
        </div><label className={styles.field}><span>Ограничение времени, мин</span><input type="number" min={1} value={settings.time_limit_minutes ?? ""} onChange={e => settingsField("time_limit_minutes", e.target.value ? e.target.valueAsNumber : null)} placeholder="Без ограничения" /></label>
        <h2>Связь с обучением</h2>{referencesError && <p className={styles.warning}>{referencesError}</p>}
        {([{ key: "position_id", label: "Должность", items: positions.map(p => ({ id: p.id, name: p.name })) }, { key: "topic_id", label: "Тема матрицы знаний", items: topics.map(t => ({ id: t.id, name: t.name })) }, { key: "lesson_id", label: "Урок при неуспешном прохождении", items: lessons.map(l => ({ id: l.id, name: l.title })) }] as const).map(({ key, label, items }) => <label className={styles.field} key={key}><span>{label}</span><select value={settings[key] ?? ""} disabled={!!referencesError} onChange={e => settingsField(key, e.target.value || null)}><option value="">Не выбрано</option>{settings[key] && !items.some(i => i.id === settings[key]) && <option value={settings[key]!}>Текущее значение (недоступно в списке)</option>}{items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>)}
      </div></div>}
      {tab === "results" && <div className={styles.results}><h2>Результаты прохождения</h2>{resultsLoading ? <p>Загрузка результатов…</p> : !results.length ? <p className={styles.hint}>Здесь появятся результаты, когда сотрудники пройдут тест.</p> : <div className={styles.tableScroll}><table><thead><tr><th>Сотрудник</th><th>Результат</th><th>Статус</th><th>Дата</th></tr></thead><tbody>{results.map(r => <tr key={r.id}><td>{r.employee_name ?? "—"}</td><td>{r.score != null ? `${r.score}%` : "—"}</td><td>{r.passed === null ? "Ожидает оценки" : r.passed ? "Сдал" : "Не сдал"}</td><td>{r.completed_at ? new Date(r.completed_at).toLocaleDateString("ru-RU") : "—"}</td></tr>)}</tbody></table></div>}</div>}
    </fieldset>}
    <div className={styles.summary}><CheckCheck size={16} /> Вопросов: {questions.length} · {settings.passing_score || 0}% для прохождения · {settings.time_limit_minutes ? `${settings.time_limit_minutes} мин` : "Без ограничения времени"}</div>
  </div>;
}
