import { useState, type FormEvent } from "react";
import { apiError, createInterview, updateInterview, cancelInterview, createCalendarBlock, type Candidate, type CalendarParticipant, type Interview } from "../../api/workspace";
import { CalendarModal, localInput, localDay, clock } from "./CalendarModal";
import { Icon } from "./CalendarUI";

const TYPES = { interview: "Собеседование", work: "Рабочая встреча", planning: "Планёрка", other: "Другое" };

function localInstants(value: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return [];
  const instants: Date[] = [];
  for (let offset = -180; offset <= 180; offset++) {
    const candidate = new Date(parsed.getTime() + offset * 60000);
    if (localInput(candidate) === value) instants.push(candidate);
  }
  return instants;
}
const offsetLabel = (date: Date) => new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZoneName: "shortOffset" }).format(date);

export function MeetingEditor({ candidates, participants, meeting, date, onClose, onSaved }: { candidates: Candidate[]; participants: CalendarParticipant[]; meeting?: Interview; date: Date; onClose: () => void; onSaved: () => Promise<void> }) {
  const [ids, setIds] = useState(meeting?.participant_ids ?? []);
  const [type, setType] = useState<Interview["meeting_type"]>(meeting?.meeting_type ?? "work");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const start = meeting ? new Date(meeting.starts_at) : new Date(date);
  if (!meeting && start.getHours() === 0) start.setHours(10, 0);
  const [startText, setStartText] = useState(localInput(start));
  const [instant, setInstant] = useState(start.toISOString());
  const choices = localInstants(startText);
  const durations = [...new Set([5, 15, 30, 45, 60, 90, 120, 180, 240, 360, 480, meeting?.duration_minutes ?? 30])].sort((a, b) => a - b);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      if (!choices.length) { setError("Это местное время отсутствует при переходе часового пояса. Выберите другое время."); return; }
      const preservedStart = meeting && startText === localInput(start) && instant === start.toISOString() ? meeting.starts_at : instant;
      const payload = { title: String(form.get("title")), meeting_type: type, candidate_id: type === "interview" ? String(form.get("candidate")) || null : null, starts_at: preservedStart, duration_minutes: Number(form.get("duration")), participant_ids: ids, meeting_url: String(form.get("url")) || null, notes: String(form.get("notes")) || null };
      if (meeting) await updateInterview(meeting.id, payload); else await createInterview(payload);
      await onSaved(); onClose();
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }
  return <CalendarModal title={meeting ? "Редактировать встречу" : "Назначить встречу"} onClose={() => !busy && onClose()}>
    <form onSubmit={submit}>
      <label><span>Название встречи</span><input name="title" required maxLength={300} defaultValue={meeting?.title ?? "Рабочая встреча"} autoFocus /></label>
      <label><span>Тип встречи</span><select value={type} onChange={e => setType(e.target.value as Interview["meeting_type"])}>{Object.entries(TYPES).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
      {type === "interview" && <label><span>Кандидат</span><select name="candidate" defaultValue={meeting?.candidate_id ?? ""}><option value="">Без кандидата</option>{candidates.filter(c => c.id === meeting?.candidate_id || !["hired", "rejected"].includes(c.stage)).map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}</select></label>}
      <div className="form-row"><label><span>Дата и время · {Intl.DateTimeFormat().resolvedOptions().timeZone}</span><input name="start" type="datetime-local" required value={startText} onChange={e => { setStartText(e.target.value); setInstant(localInstants(e.target.value)[0]?.toISOString() ?? ""); }} /></label><label><span>Длительность</span><select name="duration" defaultValue={meeting?.duration_minutes ?? 30}>{durations.map(value => <option key={value} value={value}>{value} минут</option>)}</select></label></div>
      {choices.length > 1 && <label><span>Смещение часового пояса</span><select value={Math.floor(new Date(instant).getTime() / 60000) * 60000} onChange={e => setInstant(new Date(Number(e.target.value)).toISOString())}>{choices.map(value => <option key={value.toISOString()} value={value.getTime()}>{offsetLabel(value)}</option>)}</select></label>}
      <label><span>Участники из CRM</span></label><div className="calendar-participants">{participants.map(p => <button type="button" key={p.id} className={ids.includes(p.id) ? "active" : ""} aria-pressed={ids.includes(p.id)} onClick={() => setIds(current => current.includes(p.id) ? current.filter(id => id !== p.id) : [...current, p.id])}>{p.full_name}</button>)}</div>
      <label><span>Ссылка на встречу</span><input name="url" type="url" defaultValue={meeting?.meeting_url ?? ""} placeholder="https://" /></label>
      <label><span>Заметка <i>необязательно</i></span><textarea name="notes" maxLength={10000} defaultValue={meeting?.notes ?? ""} /></label>
      {error && <p role="alert" className="calendar-error">{error}</p>}
      <div className="modal-actions"><button type="button" className="plain-btn" onClick={onClose} disabled={busy}>Отмена</button><button className="primary-btn" disabled={busy}>{busy ? "Сохраняем…" : meeting ? "Сохранить" : "Назначить встречу"}<Icon name="arrow" size={16} /></button></div>
    </form>
  </CalendarModal>;
}

export function MeetingDetails({ meeting, onClose, onEdit, onSaved }: { meeting: Interview; onClose: () => void; onEdit: () => void; onSaved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  async function cancel() {
    setBusy(true); setError("");
    try { await cancelInterview(meeting.id); await onSaved(); onClose(); }
    catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }
  return <CalendarModal title={meeting.title} onClose={() => !busy && onClose()}>
    <div className="selected-slot"><Icon name="calendar" /><span><b>{new Date(meeting.starts_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</b><small>{clock(meeting.starts_at)} · {meeting.duration_minutes} минут · {Intl.DateTimeFormat().resolvedOptions().timeZone}</small></span></div>
    <p>{TYPES[meeting.meeting_type]}{meeting.candidate_name ? ` · ${meeting.candidate_name}` : ""}</p><p>{meeting.participants?.map(p => p.full_name).join(", ")}</p><p>{meeting.notes}</p>
    {meeting.external_name && <p>Посетитель: {meeting.external_name}</p>}
    {meeting.external_contact && <p>{meeting.external_contact}</p>}
    {meeting.meeting_url && <a className="text-btn" href={meeting.meeting_url} target="_blank" rel="noopener noreferrer">Подключиться к встрече</a>}
    {error && <p className="calendar-error" role="alert">{error}</p>}
    {confirming && <p>Отменить эту встречу для всех участников?</p>}
    <div className="modal-actions"><button className="plain-btn" onClick={() => confirming ? void cancel() : setConfirming(true)} disabled={busy}>{busy ? "Отменяем…" : confirming ? "Подтвердить отмену" : "Отменить встречу"}</button><button className="primary-btn" onClick={onEdit} disabled={busy}>Редактировать</button></div>
  </CalendarModal>;
}

export function BlockEditor({ date, onClose, onSaved }: { date: Date; onClose: () => void; onSaved: () => Promise<void> }) {
  const [allDay, setAllDay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const day = String(form.get("date"));
      const start = new Date(`${day}T${allDay ? "00:00" : form.get("start")}`);
      const end = new Date(`${day}T${allDay ? "00:00" : form.get("end")}`);
      if (allDay) end.setDate(end.getDate() + 1);
      await createCalendarBlock({ starts_at: start.toISOString(), duration_minutes: Math.round((end.getTime() - start.getTime()) / 60000), title: String(form.get("title")) || null });
      await onSaved(); onClose();
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }
  return <CalendarModal title="Заблокировать время" onClose={() => !busy && onClose()}>
    <form onSubmit={submit}><p>Скроем интервал из доступных слотов, не создавая встречу.</p>
      <label><span>Дата · {Intl.DateTimeFormat().resolvedOptions().timeZone}</span><input name="date" type="date" required defaultValue={localDay(date)} /></label>
      <label className="calendar-form-row"><input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} /><span>Весь день недоступен</span></label>
      {!allDay && <div className="form-row"><label><span>Начало</span><input name="start" type="time" required defaultValue="16:00" /></label><label><span>Окончание</span><input name="end" type="time" required defaultValue="17:30" /></label></div>}
      <label><span>Причина <i>видна только вам</i></span><textarea name="title" maxLength={300} placeholder="Например, личные дела" /></label>
      {error && <p className="calendar-error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="plain-btn" onClick={onClose} disabled={busy}>Отмена</button><button className="primary-btn" disabled={busy}>{busy ? "Сохраняем…" : "Заблокировать"}</button></div>
    </form>
  </CalendarModal>;
}
