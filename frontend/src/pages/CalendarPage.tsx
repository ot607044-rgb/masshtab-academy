import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, ExternalLink, Trash2 } from "lucide-react";
import { PageHeading, Empty, LoadState, dateLabel } from "../components/AcademyUI";
import { getCandidates, getInterviews, cancelInterview, apiError, type Candidate, type Interview } from "../api/workspace";
import { InterviewForm } from "./RecruitmentForms";

const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export default function CalendarPage() {
  const [date, setDate] = useState(() => new Date());
  const [meetings, setMeetings] = useState<Interview[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(false);
  const [busy, setBusy] = useState<string>();
  const start = new Date(date); start.setDate(start.getDate() - (start.getDay() + 6) % 7); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 7);
  const startISO = start.toISOString(), endISO = end.toISOString();
  const reload = useCallback(async () => { const [events, people] = await Promise.all([getInterviews(startISO, endISO), getCandidates()]); setMeetings(events); setCandidates(people); }, [startISO, endISO]);
  const load = useCallback(() => { setLoading(true); setError(""); reload().catch(e => setError(apiError(e))).finally(() => setLoading(false)); }, [reload]);
  useEffect(load, [load]);
  function move(days: number) { const next = new Date(date); next.setDate(next.getDate() + days); setDate(next); }
  async function cancel(id: string) { if (!confirm("Отменить собеседование?")) return; setBusy(id); try { await cancelInterview(id); await reload(); } catch (e) { setError(apiError(e)); } finally { setBusy(undefined); } }
  const days = Array.from({ length: 7 }, (_, i) => { const next = new Date(start); next.setDate(next.getDate() + i); return next; });
  const events = meetings.filter(m => key(new Date(m.starts_at)) === key(date));
  return <div className="academy-page"><PageHeading title="Календарь" subtitle={`Собеседования · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`}><button className="btn-primary" onClick={() => setForm(true)}><CalendarPlus size={16} />Назначить встречу</button></PageHeading><div className="academy-filters"><button className="academy-icon" title="Предыдущая неделя" aria-label="Предыдущая неделя" onClick={() => move(-7)}><ChevronLeft size={20} /></button><strong style={{ fontSize: 13 }}>{dateLabel(startISO)} — {dateLabel(new Date(end.getTime() - 1).toISOString())}</strong><button className="academy-icon" title="Следующая неделя" aria-label="Следующая неделя" onClick={() => move(7)}><ChevronRight size={20} /></button><button className="btn-secondary" onClick={() => setDate(new Date())}>Сегодня</button></div><div className="academy-calendar-days">{days.map(day => <button key={key(day)} className={key(day) === key(date) ? "active" : ""} aria-pressed={key(day) === key(date)} onClick={() => setDate(day)}>{day.toLocaleDateString("ru-RU", { weekday: "short" })}<strong>{day.getDate()}</strong></button>)}</div><section className="academy-section"><div className="academy-section-heading"><h2>{date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" })}</h2><span className="academy-badge gray">Встреч: {events.length}</span></div>{loading ? <LoadState error="" retry={load} /> : error ? <LoadState error={error} retry={load} /> : <>{events.map(meeting => <article className="academy-meeting" key={meeting.id}><time>{new Date(meeting.starts_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</time><div className="academy-section-heading" style={{ marginBottom: 0 }}><div><strong>{meeting.title}</strong><small>{meeting.candidate_name} · {meeting.duration_minutes} мин</small>{meeting.notes && <small>{meeting.notes}</small>}</div><div className="academy-actions">{meeting.meeting_url && <a className="btn-secondary" href={meeting.meeting_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} />Подключиться</a>}<button className="academy-icon" title="Отменить встречу" aria-label="Отменить встречу" disabled={busy === meeting.id} onClick={() => cancel(meeting.id)}><Trash2 size={17} /></button></div></div></article>)}{!events.length && <Empty>На этот день встреч нет</Empty>}</>}</section>{form && <InterviewForm candidates={candidates} onClose={() => setForm(false)} onSaved={reload} />}</div>;
}
