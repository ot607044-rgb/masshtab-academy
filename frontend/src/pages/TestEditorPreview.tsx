import { useState } from "react";
import { ArrowLeft, ArrowRight, Eye } from "lucide-react";
import { choiceType, type EditorQuestion } from "./testEditorModel";
import styles from "./TestEditorPage.module.css";

export default function TestEditorPreview({ questions, onClose }: { questions: EditorQuestion[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [text, setText] = useState("");
  const [answered, setAnswered] = useState(false);
  const q = questions[index];
  const correct = q?.options.flatMap((o, i) => o.is_correct ? [i] : []);
  const passed = selected.length === correct?.length && selected.every(i => correct.includes(i));
  return <section className={styles.preview} aria-label="Предпросмотр теста">
    <div className={styles.sectionHead}><span className={styles.eyebrow}><Eye size={15} /> Глазами сотрудника</span><button className={styles.textButton} onClick={onClose}><ArrowLeft size={15} /> К редактору</button></div>
    <p className={styles.hint}>Предпросмотр не создаёт попытку и не влияет на результаты сотрудников.</p>
    {!q ? <div className={styles.paper}>Добавьте первый вопрос, чтобы посмотреть тест.</div> : <div className={styles.paper}>
      <p className={styles.hint}>Вопрос {index + 1} из {questions.length} · {q.points} б.</p>
      <h2 className={styles.previewTitle}>{q.text || "Новый вопрос"}</h2>
      {choiceType(q.question_type) ? q.options.map((o, i) => <label key={i} className={styles.previewOption}>
        <input type={q.question_type === "multiple" ? "checkbox" : "radio"} name="preview-answer" checked={selected.includes(i)} disabled={answered}
          onChange={e => setSelected(q.question_type === "multiple" ? e.target.checked ? [...selected, i] : selected.filter(v => v !== i) : [i])} />
        {o.text || `Вариант ${i + 1}`}
      </label>) : <label className={styles.field}><span>Ваш ответ</span><textarea rows={4} value={text} onChange={e => setText(e.target.value)} disabled={answered} /></label>}
      {answered && <div className={styles.feedback} role="status"><strong>{choiceType(q.question_type) ? passed ? "Верно" : "Неверно" : "Ответ принят"}</strong>{!choiceType(q.question_type) && <p>Открытые ответы требуют отдельной оценки.</p>}{q.explanation && <p>{q.explanation}</p>}</div>}
      <div className={styles.footer}>{!answered ? <button className={styles.primary} disabled={choiceType(q.question_type) ? !selected.length : !text.trim()} onClick={() => setAnswered(true)}>Ответить</button> : index < questions.length - 1 ? <button className={styles.primary} onClick={() => { setIndex(index + 1); setSelected([]); setText(""); setAnswered(false); }}>Следующий вопрос <ArrowRight size={16} /></button> : <button className={styles.primary} onClick={onClose}>Завершить предпросмотр</button>}</div>
    </div>}
  </section>;
}
