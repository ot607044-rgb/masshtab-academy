import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { CalendarClock, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, Clock, ExternalLink, MoreHorizontal, Pencil, Trash2, Users } from "lucide-react";
import { PageHeading, Empty, LoadState, Modal, dateLabel } from "../components/AcademyUI";
import { createCalendarBlock, deleteCalendarBlock, getAvailability, getCandidates, getInterviewCalendar, getMeetingParticipants, updateAvailabilityRules, enablePublicCalendarLink, revokePublicCalendarLink, createInterview, updateInterview, cancelInterview, apiError, type AvailabilityState, type CalendarParticipant, type CalendarSummary, type Candidate, type FreeSlot, type Interview } from "../api/workspace";

const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const minutes = (date: Date) => date.getHours() * 60 + date.getMinutes();
const timeLabel = (value: string | Date) => new Date(value).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
const localInputValue = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const MEETING_TYPES: Record<Interview["meeting_type"], string> = { interview: "Собеседование", work: "Рабочая встреча", planning: "Планёрка", other: "Другое" };
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function weekStart(date: Date) {
  const start = new Date(date);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  start.setHours(0, 0, 0, 0);
  return start;
}

function metric(label: string, value: string, note: string) {
  return <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function slotLabel(slot: FreeSlot | null) {
  return slot ? `${timeLabel(slot.starts_at)}-${timeLabel(slot.ends_at)}` : "Нет слота";
}

function MeetingForm({ candidates, participants, meeting, initialDate, onClose, onSaved }: { candidates: Candidate[]; participants: CalendarParticipant[]; meeting?: Interview; initialDate: Date; onClose: () => void; onSaved: () => Promise<void> }) {
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(meeting?.participant_ids ?? []);
  const [meetingType, setMeetingType] = useState<Interview["meeting_type"]>(meeting?.meeting_type ?? "work");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const start = meeting ? new Date(meeting.starts_at) : new Date(initialDate);
  if (!meeting && start.getHours() === 0) start.setHours(10, 0, 0, 0);

  function toggleParticipant(id: string) {
    setSelectedParticipants(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      meeting_type: meetingType,
      candidate_id: meetingType === "interview" ? String(form.get("candidate_id")) || null : null,
      title: String(form.get("title")),
      starts_at: new Date(String(form.get("starts_at"))).toISOString(),
      duration_minutes: Number(form.get("duration_minutes")),
      participant_ids: selectedParticipants,
      meeting_url: String(form.get("meeting_url")) || null,
      notes: String(form.get("notes")) || null,
    };
    try {
      if (meeting) await updateInterview(meeting.id, payload);
      else await createInterview(payload);
      await onSaved();
      onClose();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  return <Modal title={meeting ? "Редактировать встречу" : "Назначить встречу"} onClose={onClose}>
    <form onSubmit={submit} className="academy-calendar-form">
      <label htmlFor="calendar-title">Название встречи</label>
      <input id="calendar-title" name="title" required maxLength={300} defaultValue={meeting?.title ?? "Рабочая встреча"} autoFocus />
      <label htmlFor="calendar-type">Тип встречи</label>
      <select id="calendar-type" value={meetingType} onChange={event => setMeetingType(event.target.value as Interview["meeting_type"])}>
        {Object.entries(MEETING_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      {meetingType === "interview" && <><label htmlFor="calendar-candidate">Кандидат из подбора</label><select id="calendar-candidate" name="candidate_id" defaultValue={meeting?.candidate_id ?? ""}>
        <option value="">Без кандидата</option>
        {candidates.filter(c => meeting?.candidate_id === c.id || !["hired", "rejected"].includes(c.stage)).map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
      </select></>}
      <div className="academy-calendar-form-grid">
        <div><label htmlFor="calendar-start">Дата и время · {Intl.DateTimeFormat().resolvedOptions().timeZone}</label><input id="calendar-start" name="starts_at" type="datetime-local" required defaultValue={localInputValue(start)} /></div>
        <div><label htmlFor="calendar-duration">Длительность</label><select id="calendar-duration" name="duration_minutes" defaultValue={meeting?.duration_minutes ?? 30}><option value="15">15 минут</option><option value="30">30 минут</option><option value="45">45 минут</option><option value="60">1 час</option><option value="90">1,5 часа</option><option value="120">2 часа</option></select></div>
      </div>
      <label>Участники</label>
      <div className="academy-participant-picker">
        {participants.map(person => <button type="button" key={person.id} className={selectedParticipants.includes(person.id) ? "active" : ""} onClick={() => toggleParticipant(person.id)}><Users size={14} />{person.full_name}</button>)}
        {!participants.length && <small>Нет доступных участников</small>}
      </div>
      <label htmlFor="calendar-url">Ссылка на встречу</label>
      <input id="calendar-url" name="meeting_url" type="url" placeholder="https://" defaultValue={meeting?.meeting_url ?? ""} />
      <label htmlFor="calendar-notes">Описание</label>
      <textarea id="calendar-notes" name="notes" maxLength={10000} defaultValue={meeting?.notes ?? ""} />
      {error && <p className="error-msg" role="alert">{error}</p>}
      <div className="academy-dialog-actions"><button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Отмена</button><button className="btn-primary" disabled={busy}><CalendarPlus size={16} />{busy ? "Проверяем занятость..." : meeting ? "Сохранить" : "Назначить"}</button></div>
    </form>
  </Modal>;
}

function MeetingDetails({ meeting, onEdit, onDelete, onClose, busy }: { meeting: Interview; onEdit: () => void; onDelete: () => void; onClose: () => void; busy: boolean }) {
  return <Modal title={meeting.title} onClose={onClose}>
    <div className="academy-meeting-detail">
      <p><Clock size={16} />{dateLabel(meeting.starts_at)} · {timeLabel(meeting.starts_at)} · {meeting.duration_minutes} мин</p>
      <p><CalendarClock size={16} />{MEETING_TYPES[meeting.meeting_type] ?? "Встреча"}{meeting.candidate_name ? ` · ${meeting.candidate_name}` : ""}</p>
      <p><Users size={16} />{meeting.participants?.length ? meeting.participants.map(item => item.full_name).join(", ") : "Участники не выбраны"}</p>
      {meeting.notes && <p className="academy-meeting-notes">{meeting.notes}</p>}
      <div className="academy-actions">
        {meeting.meeting_url && <a className="btn-secondary" href={meeting.meeting_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} />Подключиться</a>}
        <button className="btn-secondary" onClick={onEdit}><Pencil size={15} />Редактировать</button>
        <button className="btn-secondary" onClick={onDelete} disabled={busy}><Trash2 size={15} />{busy ? "Удаление..." : "Отменить"}</button>
      </div>
    </div>
  </Modal>;
}

function AvailabilityPanel({ availability, onSaved }: { availability: AvailabilityState | null; onSaved: () => Promise<void> }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const publicUrl = availability?.public_link ? `${window.location.origin}/book/${availability.public_link.token}` : "";

  async function saveRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const toMinute = (value: string) => {
      const [hours, mins] = value.split(":").map(Number);
      return hours * 60 + mins;
    };
    try {
      const existing = (availability?.rules ?? []).map(({ weekday, start_minute, end_minute, slot_minutes }) => ({ weekday, start_minute, end_minute, slot_minutes }));
      await updateAvailabilityRules([...existing, { weekday: Number(form.get("weekday")), start_minute: toMinute(String(form.get("start"))), end_minute: toMinute(String(form.get("end"))), slot_minutes: Number(form.get("slot")) }]);
      await onSaved();
      event.currentTarget.reset();
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }

  async function removeRule(index: number) {
    setBusy(true); setError("");
    try {
      await updateAvailabilityRules((availability?.rules ?? []).filter((_, i) => i !== index).map(({ weekday, start_minute, end_minute, slot_minutes }) => ({ weekday, start_minute, end_minute, slot_minutes })));
      await onSaved();
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }

  async function saveBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      await createCalendarBlock({ starts_at: new Date(String(form.get("starts_at"))).toISOString(), duration_minutes: Number(form.get("duration")), title: String(form.get("title")) || null });
      await onSaved();
      event.currentTarget.reset();
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }

  async function removeBlock(id: string) {
    setBusy(true); setError("");
    try {
      await deleteCalendarBlock(id);
      await onSaved();
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }

  async function toggleLink(enable: boolean) {
    setBusy(true); setError("");
    try {
      if (enable) await enablePublicCalendarLink();
      else await revokePublicCalendarLink();
      await onSaved();
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }

  return <section className="academy-section academy-availability">
    <div className="academy-section-heading"><h2>Запись по ссылке</h2></div>
    <form onSubmit={saveRule} className="academy-compact-form">
      <select name="weekday" defaultValue={0}>{WEEKDAYS.map((day, i) => <option key={day} value={i}>{day}</option>)}</select>
      <input name="start" type="time" defaultValue="10:00" required />
      <input name="end" type="time" defaultValue="18:00" required />
      <select name="slot" defaultValue={30}><option value="15">15 мин</option><option value="30">30 мин</option><option value="60">60 мин</option></select>
      <button className="btn-secondary" disabled={busy}>Добавить окно</button>
    </form>
    <div className="academy-rule-list">
      {(availability?.rules ?? []).map((rule, index) => <button key={rule.id ?? index} onClick={() => removeRule(index)} disabled={busy}>{WEEKDAYS[rule.weekday]} · {String(Math.floor(rule.start_minute / 60)).padStart(2, "0")}:{String(rule.start_minute % 60).padStart(2, "0")}-{String(Math.floor(rule.end_minute / 60)).padStart(2, "0")}:{String(rule.end_minute % 60).padStart(2, "0")} · {rule.slot_minutes} мин</button>)}
      {!(availability?.rules?.length) && <small>Открытые окна не заданы</small>}
    </div>
    <form onSubmit={saveBlock} className="academy-compact-form">
      <input name="starts_at" type="datetime-local" required />
      <select name="duration" defaultValue={30}><option value="15">15 мин</option><option value="30">30 мин</option><option value="60">60 мин</option></select>
      <input name="title" placeholder="Занято" maxLength={300} />
      <button className="btn-secondary" disabled={busy}>Заблокировать</button>
    </form>
    <div className="academy-rule-list">
      {(availability?.blocks ?? []).map(block => <button key={block.id} onClick={() => removeBlock(block.id)} disabled={busy}>{timeLabel(block.starts_at)} · {block.duration_minutes} мин</button>)}
    </div>
    <div className="academy-public-link">
      {publicUrl ? <><input readOnly value={publicUrl} /><button className="btn-secondary" onClick={() => navigator.clipboard?.writeText(publicUrl)} type="button">Копировать</button><button className="btn-secondary" onClick={() => toggleLink(false)} disabled={busy} type="button">Отозвать</button></> : <button className="btn-secondary" onClick={() => toggleLink(true)} disabled={busy} type="button">Включить ссылку</button>}
    </div>
    {error && <p className="error-msg" role="alert">{error}</p>}
  </section>;
}

export default function CalendarPage() {
  const [date, setDate] = useState(() => new Date());
  const [summary, setSummary] = useState<CalendarSummary | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [participants, setParticipants] = useState<CalendarParticipant[]>([]);
  const [availability, setAvailability] = useState<AvailabilityState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<"new" | "edit" | null>(null);
  const [selected, setSelected] = useState<Interview | null>(null);
  const [busy, setBusy] = useState<string>();

  const start = useMemo(() => weekStart(date), [date]);
  const end = useMemo(() => { const next = new Date(start); next.setDate(next.getDate() + 7); return next; }, [start]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const next = new Date(start); next.setDate(next.getDate() + i); return next; }), [start]);

  const reload = useCallback(async () => {
    const [calendar, people, participantList, availabilityState] = await Promise.all([getInterviewCalendar(start.toISOString(), end.toISOString(), date.toISOString()), getCandidates(), getMeetingParticipants(), getAvailability()]);
    setSummary(calendar);
    setCandidates(people);
    setParticipants(participantList);
    setAvailability(availabilityState);
  }, [date, end, start]);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    reload().catch(e => setError(apiError(e))).finally(() => setLoading(false));
  }, [reload]);

  useEffect(load, [load]);

  function move(daysCount: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + daysCount);
    setDate(next);
  }

  async function remove(meeting: Interview) {
    if (!confirm("Отменить встречу?")) return;
    setBusy(meeting.id);
    try {
      await cancelInterview(meeting.id);
      setSelected(null);
      await reload();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(undefined);
    }
  }

  const sortedMeetings = [...(summary?.meetings ?? []).filter(meeting => dayKey(new Date(meeting.starts_at)) === dayKey(date))].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  return <div className="academy-page academy-calendar-page">
    <PageHeading title="Календарь" subtitle={`Командный центр встреч · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`}>
      <button className="btn-primary" onClick={() => setForm("new")}><CalendarPlus size={16} />Назначить встречу</button>
    </PageHeading>
    <div className="academy-calendar-shell">
      <section className="academy-calendar-main">
        <div className="academy-calendar-toolbar">
          <div className="academy-actions">
            <button className="academy-icon" title="Предыдущая неделя" aria-label="Предыдущая неделя" onClick={() => move(-7)}><ChevronLeft size={20} /></button>
            <strong>{dateLabel(start.toISOString())} — {dateLabel(new Date(end.getTime() - 1).toISOString())}</strong>
            <button className="academy-icon" title="Следующая неделя" aria-label="Следующая неделя" onClick={() => move(7)}><ChevronRight size={20} /></button>
          </div>
          <button className="btn-secondary" onClick={() => setDate(new Date())}>Сегодня</button>
        </div>
        <div className="academy-calendar-days">
          {days.map(day => {
            const count = (summary?.meetings ?? []).filter(meeting => dayKey(new Date(meeting.starts_at)) === dayKey(day)).length;
            return <button key={dayKey(day)} className={dayKey(day) === dayKey(date) ? "active" : ""} aria-pressed={dayKey(day) === dayKey(date)} onClick={() => setDate(day)}>{day.toLocaleDateString("ru-RU", { weekday: "short" })}<strong>{day.getDate()}</strong><span>{count} встреч</span></button>;
          })}
        </div>
        <div className="academy-metrics academy-calendar-metrics">
          {metric("Загрузка дня", `${summary?.day_load_percent ?? 0}%`, "Рабочее окно 09:00-18:00")}
          {metric("Загрузка недели", `${summary?.week_load_percent ?? 0}%`, "По встречам системы")}
          {metric("Свободных окон", String(summary?.free_slots?.length ?? 0), "Для выбранного дня")}
          {metric("Лучший слот", slotLabel(summary?.best_slot ?? null), "Самый длинный интервал")}
        </div>
        <section className="academy-section academy-calendar-board">
          <div className="academy-section-heading"><h2>{date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" })}</h2><span className="academy-badge gray">Встреч: {sortedMeetings.length}</span></div>
          {loading ? <LoadState error="" retry={load} /> : error ? <LoadState error={error} retry={load} /> : sortedMeetings.length ? <div className="academy-day-track">
            {sortedMeetings.map(meeting => {
              const top = Math.max(0, minutes(new Date(meeting.starts_at)) - 9 * 60);
              const height = Math.max(46, meeting.duration_minutes);
              const subtitle = meeting.candidate_name ?? meeting.participants?.map(item => item.full_name).join(", ") ?? MEETING_TYPES[meeting.meeting_type] ?? "Встреча";
              return <button key={meeting.id} className="academy-calendar-event" style={{ "--event-top": `${top}px`, "--event-height": `${height}px` } as CSSProperties} onClick={() => setSelected(meeting)}><time>{timeLabel(meeting.starts_at)}</time><strong>{meeting.title}</strong><span>{subtitle} · {meeting.duration_minutes} мин</span><MoreHorizontal size={16} /></button>;
            })}
          </div> : <Empty>На этот день встреч нет. Свободные слоты доступны справа.</Empty>}
        </section>
      </section>
      <aside className="academy-calendar-side">
        <section className="academy-section">
          <div className="academy-section-heading"><h2>Свободное время</h2><Clock size={18} /></div>
          <div className="academy-free-slots">
            {summary?.free_slots?.map(slot => <button key={`${slot.starts_at}-${slot.ends_at}`} onClick={() => { setDate(new Date(slot.starts_at)); setForm("new"); }}><CheckCircle2 size={16} /><span>{slotLabel(slot)}</span><small>{slot.duration_minutes} мин</small></button>)}
            {!summary?.free_slots?.length && <Empty>Свободных окон нет</Empty>}
          </div>
        </section>
        <AvailabilityPanel availability={availability} onSaved={reload} />
        <section className="academy-section">
          <div className="academy-section-heading"><h2>Лучший слот</h2><CalendarClock size={18} /></div>
          {summary?.best_slot ? <button className="academy-best-slot" onClick={() => { setDate(new Date(summary.best_slot!.starts_at)); setForm("new"); }}><strong>{slotLabel(summary.best_slot)}</strong><span>{summary.best_slot.duration_minutes} минут свободно</span></button> : <Empty>Подходящего слота нет</Empty>}
        </section>
      </aside>
    </div>
    {form === "new" && <MeetingForm candidates={candidates} participants={participants} initialDate={date} onClose={() => setForm(null)} onSaved={reload} />}
    {form === "edit" && selected && <MeetingForm candidates={candidates} participants={participants} meeting={selected} initialDate={date} onClose={() => setForm(null)} onSaved={async () => { await reload(); setSelected(null); }} />}
    {selected && form !== "edit" && <MeetingDetails meeting={selected} onClose={() => setSelected(null)} onEdit={() => setForm("edit")} onDelete={() => remove(selected)} busy={busy === selected.id} />}
  </div>;
}
