import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Check, Save, Pencil } from "lucide-react";
import { getEmployeeWorkspace, apiError, STAGES, type EmployeeWorkspace, type RoadmapStep } from "../api/workspace";
import { getLessons } from "../api/lessons";
import { createAssignment } from "../api/assignments";
import { useAuth } from "../context/AuthContext";
import { EMPLOYEE_STATUS_LABELS, ASSIGNMENT_STATUS_LABELS, type Lesson } from "../types";
import { PageHeading, Metrics, Empty, LoadState, Modal, ProgressBar, dateLabel } from "../components/AcademyUI";
import EmployeeEditModal from "../components/EmployeeEditModal";
import EmployeePhoto from "../components/EmployeePhoto";
import { EmployeeAccessPanel, canManageAccess } from "../components/AccessControls";

export default function EmployeeDetailPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const canAssign = ["company_admin", "hr", "super_admin"].includes(user?.role ?? "");
  const canSeeRecruitment = canAssign;
  const canAccess = canManageAccess(user?.role);
  const [data, setData] = useState<EmployeeWorkspace>();
  const [error, setError] = useState("");
  const [tab, setTab] = useState("roadmap");
  const [assign, setAssign] = useState(false);
  const [editing, setEditing] = useState(false);
  const reload = useCallback(async () => { setData(await getEmployeeWorkspace(id)); }, [id]);
  const load = useCallback(() => { setError(""); setData(undefined); reload().catch(e => setError(apiError(e))); }, [reload]);
  useEffect(load, [load]);
  const tabs = { roadmap: "Маршрут обучения", knowledge: "Знания и тесты", ...(canSeeRecruitment ? { recruitment: "История подбора" } : {}), profile: "Профиль", ...(canAccess ? { access: "Доступ в систему" } : {}) };
  function roadmap(steps: RoadmapStep[]) {
    return <ol className="academy-timeline">{steps.map((step, i) => <li key={step.id}><span className={`academy-step-number ${step.status}`}>{step.status === "completed" ? <Check size={16} /> : i + 1}</span><div className="academy-step-content"><h3>{step.title}</h3>{step.description && <p>{step.description}</p>}<div className="academy-actions"><span className={`academy-badge ${step.overdue ? "red" : step.status === "assigned" ? "gray" : ""}`}>{step.overdue ? "Просрочено" : ASSIGNMENT_STATUS_LABELS[step.status]}</span>{step.is_remediation && <span className="academy-badge amber">Назначено автоматически</span>}</div><p>{step.duration_minutes ? `${step.duration_minutes} мин · ` : ""}{step.status === "completed" ? `Завершен: ${dateLabel(step.completed_at)}` : `Срок: ${dateLabel(step.due_date)}`}</p><footer><Link className="academy-text-link" to={`/dashboard/lessons/${step.lesson_id}`}>{step.status === "completed" ? "Открыть урок" : "Перейти к уроку"}</Link></footer></div></li>)}</ol>;
  }
  return <div className="academy-page"><Link className="academy-back" to={user?.role === "employee" ? "/dashboard/my-lessons" : "/dashboard/employees"}><ArrowLeft size={14} />{user?.role === "employee" ? "Мое обучение" : "Сотрудники"}</Link>{!data ? <LoadState error={error} retry={load} /> : <><PageHeading title={data.employee.full_name} subtitle={`${data.employee.position_name ?? "Должность не указана"} · ${data.employee.department_name ?? "Отдел не указан"} · В компании с ${dateLabel(data.employee.hire_date)}`}>{canAssign && <button className="btn-primary" onClick={() => setAssign(true)}><Plus size={16} />Назначить обучение</button>}</PageHeading><div className="academy-tabs" role="tablist">{Object.entries(tabs).map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}</div><Metrics items={[{ label: "Обучение пройдено", value: data.lessons_total ? `${data.completion_percent}%` : "Не назначено", note: `${data.lessons_completed} из ${data.lessons_total} уроков` }, { label: "Уровень знаний", value: data.knowledge_percent === null ? "Нет данных" : `${data.knowledge_percent}%`, note: "Последние результаты тестов" }, { label: "Слабые темы", value: data.weak_areas.length, note: data.weak_areas.length ? "Требуют закрепления" : "Не выявлены", warning: data.weak_areas.length > 0 }, { label: "Просрочено", value: data.overdue_count, note: "Незавершенные уроки", warning: data.overdue_count > 0 }]} />
      {tab === "roadmap" && <div className="academy-columns"><section className="academy-section"><div className="academy-section-heading"><h2>Маршрут обучения</h2><span className="academy-badge gray">{EMPLOYEE_STATUS_LABELS[data.employee.status]}</span></div>{data.roadmap.length ? roadmap(data.roadmap) : <Empty>Обучение пока не назначено</Empty>}</section><section className="academy-section"><div className="academy-section-heading"><h2>Диагностика знаний</h2><button className="academy-text-link" style={{ background: "transparent" }} onClick={() => setTab("knowledge")}>Все результаты</button></div>{data.diagnostics.map(diagnostic => <article className="academy-diagnostic" key={diagnostic.test_id}><div><span>{diagnostic.topic}</span><strong className={diagnostic.passed ? "" : "academy-danger"}>{diagnostic.score}%</strong></div><ProgressBar value={diagnostic.score} danger={!diagnostic.passed} /><p>{diagnostic.passed ? "Подтверждено тестом" : `Ниже проходного балла ${diagnostic.passing_score}%`}</p></article>)}{!data.diagnostics.length && <Empty>Пройденных тестов пока нет</Empty>}<div className="academy-remediation"><h3>Закрепление слабых тем</h3>{data.roadmap.some(s => s.is_remediation) ? data.roadmap.filter(s => s.is_remediation).map(s => <div key={s.id} className="academy-diagnostic"><span className="academy-badge amber">Назначено автоматически</span><p><Link className="academy-text-link" to={`/dashboard/lessons/${s.lesson_id}`}>{s.title}</Link></p></div>) : <p style={{ color: "#717982", fontSize: 12 }}>{data.weak_areas.length ? "Проверьте связанные уроки и назначьте обучение." : "Дополнительное обучение не назначено."}</p>}</div></section></div>}
      {tab === "knowledge" && <section className="academy-section"><div className="academy-section-heading"><h2>Результаты тестов</h2>{user?.role === "employee" && <Link to="/dashboard/my-tests">Мои тесты</Link>}</div><div className="academy-table-wrap"><table className="academy-table"><thead><tr><th>Тест / тема</th><th>Последний результат</th><th>Проходной балл</th><th>Попытки</th><th>Дата</th><th>Статус</th></tr></thead><tbody>{data.diagnostics.map(d => <tr key={d.test_id}><td>{canAssign ? <Link to={`/dashboard/tests/${d.test_id}`}>{d.title}</Link> : d.title}<small>{d.topic}</small></td><td>{d.score}%</td><td>{d.passing_score}%</td><td>{d.attempts}</td><td>{dateLabel(d.completed_at)}</td><td><span className={`academy-badge ${d.passed ? "" : "red"}`}>{d.passed ? "Сдан" : "Не сдан"}</span></td></tr>)}</tbody></table></div>{!data.diagnostics.length && <Empty>Пройденных тестов пока нет</Empty>}</section>}
      {tab === "recruitment" && <section className="academy-section"><h2>История подбора</h2><ul className="academy-history">{data.recruitment_history.map((event, i) => <li key={i}>{STAGES[event.stage] ?? event.stage}<time>{dateLabel(event.at)}</time></li>)}</ul>{!data.recruitment_history.length && <Empty>Сотрудник добавлен вне воронки подбора</Empty>}</section>}
      {tab === "profile" && <section className="academy-section"><div className="academy-section-heading"><h2>Данные сотрудника</h2>{canAssign && <button type="button" className="btn-secondary" onClick={() => setEditing(true)}><Pencil size={16} aria-hidden="true" />Редактировать профиль</button>}</div><EmployeePhoto employee={data.employee} editable={canAssign} onUpdated={updated => setData(previous => previous ? { ...previous, employee: { ...previous.employee, photo_url: updated.photo_url } } : previous)} /><dl className="academy-profile"><dt>ФИО</dt><dd>{data.employee.full_name}</dd><dt>Email</dt><dd>{data.employee.email ?? "Не указан"}</dd><dt>Телефон</dt><dd>{data.employee.phone ?? "Не указан"}</dd><dt>Отдел</dt><dd>{data.employee.department_name ?? "Не указан"}</dd><dt>Должность</dt><dd>{data.employee.position_name ?? "Не указана"}</dd><dt>Статус</dt><dd>{EMPLOYEE_STATUS_LABELS[data.employee.status]}</dd><dt>Дата приема</dt><dd>{dateLabel(data.employee.hire_date)}</dd></dl></section>}
      {tab === "access" && canAccess && <EmployeeAccessPanel employee={data.employee} />}
      {assign && <AssignmentForm employeeId={id} assignedIds={data.roadmap.map(s => s.lesson_id)} onClose={() => setAssign(false)} onSaved={reload} />}
      {editing && <EmployeeEditModal employee={data.employee} onClose={() => setEditing(false)} onSaved={reload} />}
    </>}</div>;
}

function AssignmentForm({ employeeId, assignedIds, onClose, onSaved }: { employeeId: string; assignedIds: string[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { getLessons({ status_filter: "published" }).then(setLessons).catch(e => setError(apiError(e))).finally(() => setLoading(false)); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try { await createAssignment({ employee_id: employeeId, lesson_id: String(form.get("lesson_id")), due_date: String(form.get("due_date")) || undefined }); await onSaved(); onClose(); }
    catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }
  const available = lessons.filter(l => !assignedIds.includes(l.id) && l.status === "published");
  return <Modal title="Назначить обучение" onClose={onClose}>{loading ? <LoadState error="" retry={() => {}} /> : <form onSubmit={submit}><label htmlFor="assign-lesson">Урок</label><select id="assign-lesson" name="lesson_id" required defaultValue=""><option value="">Выберите урок</option>{available.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}</select><label htmlFor="assign-due">Срок выполнения</label><input id="assign-due" name="due_date" type="date" />{!available.length && <Empty>Все опубликованные уроки уже назначены или еще нет доступных уроков</Empty>}{error && <p className="error-msg" role="alert">{error}</p>}<div className="academy-dialog-actions"><button type="button" className="btn-secondary" onClick={onClose}>Отмена</button><button className="btn-primary" disabled={busy || !available.length}><Save size={16} />{busy ? "Сохранение..." : "Назначить"}</button></div></form>}</Modal>;
}
