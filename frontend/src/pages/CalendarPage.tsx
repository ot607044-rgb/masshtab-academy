import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAvailability, getCandidates, getInterviewCalendar, getMeetingParticipants, apiError, type AvailabilityState, type CalendarParticipant, type CalendarSummary, type Candidate, type Interview } from "../api/workspace";
import { Icon, Avatar } from "../components/calendar/CalendarUI";
import { localDay, clock } from "../components/calendar/CalendarModal";
import { MeetingEditor, MeetingDetails, BlockEditor } from "../components/calendar/MeetingDialogs";
import { AvailabilityDialog } from "../components/calendar/AvailabilityDialog";
import "../components/calendar/CalendarDesign.css";
import "../components/calendar/CalendarControls.css";

const localIso = (date: Date) => {
  const offset = -date.getTimezoneOffset();
  const abs = Math.abs(offset);
  return `${new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19)}${offset >= 0 ? "+" : "-"}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
};

export default function CalendarPage() {
  const [date, setDate] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [summary, setSummary] = useState<CalendarSummary | null>(null);
  const [availability, setAvailability] = useState<AvailabilityState | null>(null);
  const [people, setPeople] = useState<CalendarParticipant[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [modal, setModal] = useState<"meeting" | "edit" | "availability" | "block" | null>(null);
  const [selected, setSelected] = useState<Interview | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const request = useRef(0);
  const start = useMemo(() => { const d = new Date(date); d.setDate(d.getDate() - (d.getDay() + 6) % 7); d.setHours(0, 0, 0, 0); return d; }, [date]);
  const end = useMemo(() => { const d = new Date(start); d.setDate(d.getDate() + 7); return d; }, [start]);
  const days = useMemo(() => Array.from({ length: 5 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; }), [start]);
  const reload = useCallback(async () => {
    const generation = ++request.current;
    const [calendar, state, participants, applicants] = await Promise.all([getInterviewCalendar(localIso(start), localIso(end), localIso(date)), getAvailability(), getMeetingParticipants(), getCandidates()]);
    if (generation !== request.current) return;
    setSummary(calendar); setAvailability(state); setPeople(participants); setCandidates(applicants);
  }, [date, start, end]);
  useEffect(() => { setLoading(true); setError(""); reload().catch(e => setError(apiError(e))).finally(() => setLoading(false)); return () => { request.current++; }; }, [reload]);
  function move(amount: number) { const d = new Date(date); d.setDate(d.getDate() + amount); setDate(d); }
  function preview() { if (availability?.public_link?.enabled) window.open(`/book/${availability.public_link.token}`, "_blank", "noopener,noreferrer"); }
  const allDay = (summary?.meetings ?? []).filter(m => localDay(new Date(m.starts_at)) === localDay(date));
  const meetings = allDay.filter(m => `${m.title} ${m.candidate_name ?? ""} ${m.participants?.map(p => p.full_name).join(" ") ?? ""}`.toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru")));
  const clampPercent = (v?: number) => Math.max(0, Math.min(100, Math.round(v ?? 0)));
  const dayLoad = clampPercent(summary?.day_load_percent);
  const weekLoad = clampPercent(summary?.week_load_percent);
  const dayRules = (availability?.rules ?? []).filter(r => r.weekday === (date.getDay() + 6) % 7);
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const workHours = dayRules.length ? `${hhmm(Math.min(...dayRules.map(r => r.start_minute)))}–${hhmm(Math.max(...dayRules.map(r => r.end_minute)))}` : "";
  return <div className="calendar-module concept command">
    <div className="command-main">
      <header className="topbar"><label className="search"><Icon name="search" /><input aria-label="Найти сотрудника или кандидата" placeholder="Найти сотрудника или кандидата" value={query} onChange={e => setQuery(e.target.value)} /></label><div className="top-actions"><button className="availability-btn" disabled={!availability} onClick={() => setModal("availability")}><Icon name="clock" size={16} />Доступность</button><button className="primary-btn" disabled={loading} onClick={() => setModal("meeting")}><Icon name="plus" size={17} />Назначить встречу</button></div></header>
      <div className="command-content"><div className="welcome-row"><div><span className="eyebrow">ПЛАНИРОВАНИЕ ВСТРЕЧ</span><h1 className="page-title">Календарь команды</h1><p>Распределяйте встречи и находите свободное время команды.</p></div><div className="mini-stat"><Icon name="clock" /><span><b>{summary?.week_slots_count ?? 0} слотов</b><small>доступно на этой неделе</small></span></div></div>
        <section className="week-card"><div className="section-head"><div><b>{start.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} — {days[4].toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</b><span>{Intl.DateTimeFormat().resolvedOptions().timeZone}</span></div><div className="nav-buttons"><button aria-label="Предыдущая неделя" onClick={() => move(-7)}><span style={{ transform: "rotate(180deg)", display: "flex" }}><Icon name="chevron" size={16} /></span></button><button onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setDate(d); }}>Сегодня</button><button aria-label="Следующая неделя" onClick={() => move(7)}><Icon name="chevron" size={16} /></button></div></div>
          <div className="date-strip">{days.map(d => <button key={localDay(d)} className={localDay(d) === localDay(date) ? "active" : ""} aria-pressed={localDay(d) === localDay(date)} onClick={() => setDate(d)}><small>{d.toLocaleDateString("ru-RU", { weekday: "short" })}</small><b>{d.getDate()}</b><span className="load" style={{ width: `${Math.min(80, (summary?.meetings ?? []).filter(m => localDay(new Date(m.starts_at)) === localDay(d)).length * 16)}%` }} /></button>)}</div>
        </section>
        <section className="stat-cards" aria-label="Сводка по календарю">
          <div className="stat-card mint"><span className="stat-icon"><Icon name="chart" size={20} /></span><small>Загрузка дня</small><b>{dayLoad}%</b><span className="stat-bar" aria-hidden="true"><i style={{ width: `${dayLoad}%` }} /></span><p>{workHours ? `Рабочее окно ${workHours}` : "По встречам выбранного дня"}</p></div>
          <div className="stat-card lilac"><span className="stat-icon"><Icon name="calendar" size={20} /></span><small>Загрузка недели</small><b>{weekLoad}%</b><span className="stat-bar" aria-hidden="true"><i style={{ width: `${weekLoad}%` }} /></span><p>По встречам системы</p></div>
          <div className="stat-card peach"><span className="stat-icon"><Icon name="clock" size={20} /></span><small>Свободных окон</small><b>{summary?.free_slots.length ?? 0}</b><p>Для выбранного дня</p></div>
          <div className="stat-card sky"><span className="stat-icon"><Icon name="sparkle" size={20} /></span><small>Лучший слот</small><b className="stat-slot">{summary?.best_slot ? `${clock(summary.best_slot.starts_at)}–${clock(summary.best_slot.ends_at)}` : "—"}</b><p>{summary?.best_slot ? `Самый длинный интервал · ${summary.best_slot.duration_minutes} мин` : "Свободных интервалов нет"}</p></div>
        </section>
        {error && <p className="calendar-error" role="alert">{error}</p>}
        <div className="dashboard-grid"><section className="agenda-card"><div className="section-head"><div><b>{date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</b><span>{allDay.length} встреч · {allDay.reduce((sum, m) => sum + m.duration_minutes, 0)} мин</span></div><div className="agenda-actions"><button className="text-btn muted" onClick={() => setModal("block")}><Icon name="close" size={13} />Заблокировать время</button><input className="calendar-day-input" type="date" aria-label="Открыть день" value={localDay(date)} onChange={e => { if (e.target.value) setDate(new Date(`${e.target.value}T00:00`)); }} /></div></div>
          <div className="agenda-list">{loading ? <p className="calendar-state" role="status">Загружаем календарь…</p> : meetings.length ? meetings.map((m, i) => { const name = m.candidate_name || m.title; return <button className="agenda-item" key={m.id} onClick={() => setSelected(m)}>
            <div className="agenda-time"><b>{clock(m.starts_at)}</b><small>{m.duration_minutes} мин</small></div><div className={`agenda-line ${i % 2 ? "blue" : ""}`} /><Avatar initials={name.split(" ").map(n => n[0]).slice(0, 2).join("")} tone={i % 2 ? "blue" : "violet"} /><div className="agenda-person"><b>{name}</b><span>{m.participants?.map(p => p.full_name).join(", ") || "Рабочая встреча"}</span></div><span className="meeting-type"><Icon name={m.meeting_url ? "video" : "people"} size={14} />{m.meeting_type === "interview" ? "Собеседование" : "Встреча"}</span><span className="more">•••</span>
          </button>; }) : <p className="calendar-state">{query ? "Встречи не найдены." : "На этот день встреч нет."}</p>}</div>
        </section><aside className="insights"><div className="insight-top"><span className="sparkle-box"><Icon name="calendar" /></span><span><b>Запись по ссылке</b><small><i className="status-dot" />{availability?.public_link?.enabled ? "Активна" : "Отключена"}</small></span></div><div className="free-time"><b><Icon name="clock" size={16} />Свободное время</b>{summary?.free_slots.length ? summary.free_slots.slice(0, 4).map(f => <span key={f.starts_at}><Icon name="check" size={14} />{clock(f.starts_at)}–{clock(f.ends_at)}<small>{f.duration_minutes} мин</small></span>) : <p>Свободных окон нет</p>}</div><div className="booking-widget-copy"><b>Принимайте записи автоматически</b><p>Гости увидят только свободное время. Встречи и блокировки уже учтены.</p></div><div className="metric"><span><Icon name="clock" size={14} />Рабочие часы</span><b>{availability?.rules.length ? `${new Set(availability.rules.map(r => r.weekday)).size} дней` : "Не заданы"}</b></div><div className="metric"><span><Icon name="video" size={14} />Длительность</span><b>{availability?.rules[0]?.slot_minutes ?? 30} мин</b></div><button className="widget-primary" disabled={!availability} onClick={() => setModal("availability")}><Icon name="settings" size={15} />Настроить доступность</button><button className="widget-secondary" onClick={preview} disabled={!availability?.public_link?.enabled}>Посмотреть страницу<Icon name="arrow" size={14} /></button></aside></div>
      </div>
    </div>
    {(modal === "meeting" || modal === "edit") && <MeetingEditor date={date} candidates={candidates} participants={people} meeting={modal === "edit" ? selected ?? undefined : undefined} onClose={() => { setModal(null); setSelected(null); }} onSaved={reload} />}
    {selected && !modal && <MeetingDetails meeting={selected} onClose={() => setSelected(null)} onEdit={() => setModal("edit")} onSaved={reload} />}
    {modal === "block" && <BlockEditor date={date} onClose={() => setModal(null)} onSaved={reload} />}
    {modal === "availability" && availability && <AvailabilityDialog state={availability} onClose={() => setModal(null)} onSaved={reload} onBlock={() => setModal("block")} onPreview={preview} />}
  </div>;
}
