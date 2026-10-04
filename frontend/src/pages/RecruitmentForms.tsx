import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarPlus, UserCheck, Save } from "lucide-react";
import { Modal, dateLabel } from "../components/AcademyUI";
import { apiError, createVacancy, createCandidate, createInterview, updateCandidate, hireCandidate, STAGES, type Vacancy, type Candidate } from "../api/workspace";
import type { Department, Position } from "../types";

export function VacancyForm({ request = false, departments, positions, onClose, onSaved }: { request?: boolean; departments: Department[]; positions: Position[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [department, setDepartment] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      await createVacancy({ title: String(data.get("title")), description: String(data.get("description")) || null, department_id: department || null, position_id: String(data.get("position_id")) || null, status: request ? "request" : "open" });
      await onSaved(); onClose();
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }
  return <Modal title={request ? "Заявка на подбор" : "Новая вакансия"} onClose={onClose}><form onSubmit={submit}><label htmlFor="vacancy-title">Название</label><input id="vacancy-title" name="title" required maxLength={300} autoFocus /><label htmlFor="vacancy-department">Отдел</label><select id="vacancy-department" name="department_id" value={department} onChange={e => setDepartment(e.target.value)}><option value="">Не выбран</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select><label htmlFor="vacancy-position">Должность</label><select key={department} id="vacancy-position" name="position_id"><option value="">Не выбрана</option>{positions.filter(p => !department || !p.department_id || p.department_id === department).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><label htmlFor="vacancy-description">Требования и условия</label><textarea id="vacancy-description" name="description" maxLength={10000} />{error && <p className="error-msg" role="alert">{error}</p>}<div className="academy-dialog-actions"><button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Отмена</button><button className="btn-primary" disabled={busy}><Save size={16} />{busy ? "Сохранение..." : "Создать"}</button></div></form></Modal>;
}

export function CandidateForm({ vacancies, onClose, onSaved }: { vacancies: Vacancy[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      await createCandidate({ full_name: String(form.get("full_name")), vacancy_id: String(form.get("vacancy_id")) || null, email: String(form.get("email")) || null, phone: String(form.get("phone")) || null, source: String(form.get("source")) || "manual", notes: String(form.get("notes")) || null });
      await onSaved(); onClose();
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }
  return <Modal title="Новый кандидат" onClose={onClose}><form onSubmit={submit}><label htmlFor="candidate-name">ФИО</label><input id="candidate-name" name="full_name" required maxLength={255} autoFocus /><label htmlFor="candidate-vacancy">Вакансия</label><select id="candidate-vacancy" name="vacancy_id"><option value="">Без вакансии</option>{vacancies.filter(v => v.status === "open").map(v => <option key={v.id} value={v.id}>{v.title}</option>)}</select><label htmlFor="candidate-email">Email</label><input id="candidate-email" name="email" type="email" /><label htmlFor="candidate-phone">Телефон</label><input id="candidate-phone" name="phone" type="text" maxLength={50} /><label htmlFor="candidate-source">Источник</label><select id="candidate-source" name="source"><option value="manual">Ручное добавление</option><option value="recommendation">Рекомендация</option><option value="hh_manual">HH · вручную</option><option value="website">Сайт</option></select><label htmlFor="candidate-notes">Заметки</label><textarea id="candidate-notes" name="notes" maxLength={10000} />{error && <p className="error-msg" role="alert">{error}</p>}<div className="academy-dialog-actions"><button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Отмена</button><button className="btn-primary" disabled={busy}><Save size={16} />{busy ? "Сохранение..." : "Добавить"}</button></div></form></Modal>;
}

export function InterviewForm({ candidates, candidateId, onClose, onSaved }: { candidates: Candidate[]; candidateId?: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      await createInterview({ candidate_id: String(form.get("candidate_id")), title: String(form.get("title")), starts_at: new Date(String(form.get("starts_at"))).toISOString(), duration_minutes: Number(form.get("duration")), meeting_url: String(form.get("meeting_url")) || null, notes: String(form.get("notes")) || null });
      await onSaved(); onClose();
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }
  return <Modal title="Назначить собеседование" onClose={onClose}><form onSubmit={submit}><label htmlFor="meeting-candidate">Кандидат</label><select id="meeting-candidate" name="candidate_id" required defaultValue={candidateId ?? ""}><option value="">Выберите кандидата</option>{candidates.filter(c => !["hired", "rejected"].includes(c.stage)).map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}</select><label htmlFor="meeting-title">Название встречи</label><input id="meeting-title" name="title" required defaultValue="Собеседование" maxLength={300} /><label htmlFor="meeting-date">Дата и время · {Intl.DateTimeFormat().resolvedOptions().timeZone}</label><input id="meeting-date" name="starts_at" type="datetime-local" required /><label htmlFor="meeting-duration">Длительность, минут</label><input id="meeting-duration" name="duration" type="number" min={5} max={480} defaultValue={30} required /><label htmlFor="meeting-url">Ссылка на встречу</label><input id="meeting-url" name="meeting_url" type="url" placeholder="https://" /><label htmlFor="meeting-notes">Заметки</label><textarea id="meeting-notes" name="notes" maxLength={10000} />{error && <p className="error-msg" role="alert">{error}</p>}<div className="academy-dialog-actions"><button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Отмена</button><button className="btn-primary" disabled={busy}><CalendarPlus size={16} />{busy ? "Сохранение..." : "Назначить"}</button></div></form></Modal>;
}

export function CandidateDetail({ candidate, onClose, onSaved, onInterview }: { candidate: Candidate; onClose: () => void; onSaved: () => Promise<void>; onInterview: () => void }) {
  const [stage, setStage] = useState(candidate.stage);
  const [notes, setNotes] = useState(candidate.notes ?? "");
  const [hiring, setHiring] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { await updateCandidate(candidate.id, { ...(candidate.employee_id ? {} : { stage }), notes }); await onSaved(); onClose(); }
    catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }
  async function hire(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try { const result = await hireCandidate(candidate.id, String(form.get("hire_date"))); onClose(); navigate(`/dashboard/employees/${result.employee_id}`); }
    catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }
  return <Modal title={candidate.full_name} onClose={onClose}>{hiring ? <form onSubmit={hire}><label htmlFor="hire-date">Дата выхода</label><input type="date" id="hire-date" name="hire_date" required /><p style={{ fontSize: 12, marginTop: 14 }}>Сотрудник будет создан в Академии Масштаба.</p>{error && <p className="error-msg" role="alert">{error}</p>}<div className="academy-dialog-actions"><button className="btn-secondary" type="button" onClick={() => setHiring(false)}>Назад</button><button className="btn-primary" disabled={busy}><UserCheck size={16} />Оформить</button></div></form> : <><p style={{ fontSize: 13, color: "#717982" }}>{candidate.vacancy_title ?? "Без вакансии"} · {candidate.email ?? candidate.phone ?? "Контакты не указаны"}</p><form onSubmit={save}><label htmlFor="candidate-stage">Этап подбора</label><select id="candidate-stage" value={stage} onChange={e => setStage(e.target.value)} disabled={!!candidate.employee_id}>{Object.entries(STAGES).filter(([key]) => key !== "hired" || candidate.stage === "hired").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><label htmlFor="candidate-detail-notes">Заметки</label><textarea id="candidate-detail-notes" value={notes} onChange={e => setNotes(e.target.value)} maxLength={10000} />{error && <p className="error-msg" role="alert">{error}</p>}<div className="academy-dialog-actions"><button className="btn-primary" disabled={busy}><Save size={16} />{busy ? "Сохранение..." : "Сохранить"}</button></div></form><div className="academy-actions" style={{ marginTop: 18 }}>{!["hired", "rejected"].includes(candidate.stage) && <button className="btn-secondary" onClick={onInterview}><CalendarPlus size={16} />Собеседование</button>}{candidate.stage === "offer" && <button className="btn-secondary" onClick={() => setHiring(true)}><UserCheck size={16} />Оформить сотрудника</button>}{candidate.employee_id && <Link to={`/dashboard/employees/${candidate.employee_id}`} className="btn-secondary">Карточка сотрудника</Link>}</div><h3>История подбора</h3><ul className="academy-history">{candidate.history.map((event, i) => <li key={i}>{STAGES[event.stage] ?? event.stage}<time>{dateLabel(event.at)}</time></li>)}</ul></>}</Modal>;
}
