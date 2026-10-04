import type { QuestionCreate, QuestionFull, QuestionType, Test } from "../types";

export type EditorQuestion = QuestionCreate & { key: string; serverId?: string };
export type TestSettings = Pick<Test, "title" | "description" | "passing_score" | "max_attempts" | "time_limit_minutes" | "position_id" | "topic_id" | "lesson_id">;
export const defaultSettings: TestSettings = { title: "Новый тест", description: "", passing_score: 70, max_attempts: 3, time_limit_minutes: null, position_id: null, topic_id: null, lesson_id: null };
export const settingsOf = (t: Test): TestSettings => ({ title: t.title, description: t.description ?? "", passing_score: t.passing_score, max_attempts: t.max_attempts, time_limit_minutes: t.time_limit_minutes, position_id: t.position_id, topic_id: t.topic_id, lesson_id: t.lesson_id });
export const choiceType = (type: QuestionType) => ["single", "multiple", "yes_no"].includes(type);
export function newQuestion(): EditorQuestion {
  return { key: crypto.randomUUID(), question_type: "single", text: "", explanation: "", points: 1, order_index: 0, options: [{ text: "", is_correct: false, order_index: 0 }, { text: "", is_correct: false, order_index: 1 }] };
}
export function fromQuestion(q: QuestionFull): EditorQuestion {
  return { ...q, key: q.id, serverId: q.id, explanation: q.explanation ?? "", options: [...q.options].sort((a, b) => a.order_index - b.order_index).map(({ text, is_correct }, order_index) => ({ text, is_correct, order_index })) };
}
export function questionPayload(q: EditorQuestion): QuestionCreate {
  return { text: q.text, explanation: q.explanation ?? "", question_type: q.question_type, points: q.points, order_index: q.order_index, options: choiceType(q.question_type) ? q.options.map((o, order_index) => ({ text: o.text, is_correct: o.is_correct, order_index })) : [] };
}
export const questionSignature = (q: EditorQuestion) => JSON.stringify(questionPayload(q));
export function questionIssue(q: EditorQuestion): string | null {
  if (!q.text.trim()) return "введите формулировку";
  if (!Number.isInteger(q.points) || q.points < 1) return "укажите положительное целое число баллов";
  if (choiceType(q.question_type)) {
    if (q.options.length < 2 || q.options.some(o => !o.text.trim())) return "заполните минимум два варианта ответа";
    const correct = q.options.filter(o => o.is_correct).length;
    if (!correct) return "отметьте правильный ответ";
    if (q.question_type !== "multiple" && correct !== 1) return "отметьте только один правильный ответ";
  }
  return null;
}
export function settingsIssue(s: TestSettings): string | null {
  if (!s.title.trim()) return "Укажите название теста.";
  if (!Number.isInteger(s.passing_score) || s.passing_score < 1 || s.passing_score > 100) return "Проходной балл должен быть целым числом от 1 до 100.";
  if (!Number.isInteger(s.max_attempts) || s.max_attempts < 1) return "Укажите положительное целое количество попыток.";
  if (s.time_limit_minutes !== null && (!Number.isInteger(s.time_limit_minutes) || s.time_limit_minutes < 1)) return "Укажите положительное целое время или оставьте поле пустым.";
  return null;
}
