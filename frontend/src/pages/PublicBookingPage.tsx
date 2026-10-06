import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { bookPublicSlot, getPublicSlots, apiError, type FreeSlot } from "../api/workspace";
import { Brand, Icon } from "../components/calendar/CalendarUI";
import "../components/calendar/CalendarDesign.css";
import "../components/calendar/CalendarControls.css";

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
const clock = (value: string) => new Date(value).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
const preciseClock = (value: string) => new Date(value).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZoneName: "shortOffset" });
const dateLabel = (value: string) => new Date(value).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });

export default function PublicBookingPage() {
  const { token = "" } = useParams();
  const [slots, setSlots] = useState<FreeSlot[]>([]);
  const [day, setDay] = useState("");
  const [selected, setSelected] = useState<FreeSlot | null>(null);
  const [receipt, setReceipt] = useState<FreeSlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const days = useMemo(() => [...new Set(slots.map(slot => dayKey(new Date(slot.starts_at))))], [slots]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date();
      const end = new Date(start); end.setDate(end.getDate() + 14);
      const result = await getPublicSlots(token, start.toISOString(), end.toISOString());
      setSlots(result.slots);
    } catch {
      setSlots([]);
      setError("Ссылка недоступна или запись отключена.");
    } finally { setLoading(false); }
  }, [token]);
  useEffect(() => { setDay(""); setSelected(null); setReceipt(null); setError(""); void load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy) return;
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      await bookPublicSlot(token, { starts_at: selected.starts_at, duration_minutes: selected.duration_minutes, visitor_name: String(form.get("name")), visitor_contact: String(form.get("contact")), notes: null });
      setReceipt(selected);
    } catch (e) {
      setError(apiError(e));
      setSelected(null);
      await load();
    } finally { setBusy(false); }
  }

  const daySlots = slots.filter(slot => dayKey(new Date(slot.starts_at)) === day);
  const groups = ["Утро", "День", "Вечер"];
  return <div className="calendar-module booking-page">
    <header className="booking-header"><Brand /><a className="back-link" href="/">Вернуться в Академию</a></header>
    <main className="booking-shell">
      {receipt ? <div className="booking-success" role="status">
        <span className="success-icon"><Icon name="check" size={30} /></span><span className="eyebrow">ЗАПИСЬ ПОДТВЕРЖДЕНА</span>
        <h1 className="booking-title">До встречи {new Date(receipt.starts_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</h1>
        <p>Встреча добавлена в календарь. Сохраните дату и время.</p>
        <div className="booking-receipt"><div><Icon name="calendar" /><span><b>{dateLabel(receipt.starts_at)}</b><small>{preciseClock(receipt.starts_at)}–{preciseClock(receipt.ends_at)} · {receipt.duration_minutes} минут</small><small>{zone}</small></span></div></div>
        <a className="plain-btn" href="/">Закрыть</a>
      </div> : <>
        <section className="booking-intro"><span className="eyebrow">ЗАПИСЬ НА ВСТРЕЧУ</span><h1 className="booking-title">Выберите удобное время</h1><p>Время показано в вашем часовом поясе · {zone}</p></section>
        {error && <p className="calendar-error" role="alert">{error}</p>}
        {loading ? <p className="calendar-state" role="status">Загружаем свободное время…</p> : <div className="booking-layout">
          <section className="slot-picker">
            <div className="booking-step"><span>1</span><div><b>Выберите день</b><small>Доступные даты на ближайшие две недели</small></div></div>
            <div className="booking-dates">{days.map(key => {
              const available = slots.filter(slot => dayKey(new Date(slot.starts_at)) === key);
              const date = new Date(available[0].starts_at);
              return <button key={key} className={day === key ? "active" : ""} aria-pressed={day === key} onClick={() => { setDay(key); setSelected(null); }}>
                <small>{date.toLocaleDateString("ru-RU", { weekday: "short" })}</small><b>{date.getDate()}</b><span>{date.toLocaleDateString("ru-RU", { month: "short" })}</span><em>{available.length} слотов</em>
              </button>;
            })}</div>
            {!days.length && <p className="calendar-state">Свободных слотов пока нет.</p>}
            {day && <><div className="booking-step second"><span>2</span><div><b>Выберите время</b><small>{daySlots[0] ? dateLabel(daySlots[0].starts_at) : "На этот день больше нет свободного времени"}</small></div></div>
              <div className="slot-groups">{groups.map((period, index) => {
                const values = daySlots.filter(slot => { const hour = new Date(slot.starts_at).getHours(); return (hour < 12 ? 0 : hour < 18 ? 1 : 2) === index; });
                return values.length ? <div key={period}><span>{period}</span><div>{values.map(slot => <button key={slot.starts_at} className={selected?.starts_at === slot.starts_at ? "active" : ""} aria-pressed={selected?.starts_at === slot.starts_at} onClick={() => setSelected(slot)}>{values.filter(s => clock(s.starts_at) === clock(slot.starts_at)).length > 1 ? preciseClock(slot.starts_at) : clock(slot.starts_at)}</button>)}</div></div> : null;
              })}</div>
            </>}
          </section>
          <aside className={`booking-details ${selected ? "ready" : ""}`}>
            {!selected ? <div className="choose-hint"><span className="summary-icon"><Icon name="clock" /></span><b>Сначала выберите время</b><p>После выбора здесь появится короткая форма подтверждения.</p></div> : <form onSubmit={submit}>
              <span className="eyebrow">ВАША ВСТРЕЧА</span><div className="selected-slot"><Icon name="calendar" /><span><b>{dateLabel(selected.starts_at)}</b><small>{clock(selected.starts_at)}–{clock(selected.ends_at)} · {selected.duration_minutes} минут</small></span></div>
              <label><span>Ваше имя</span><input name="name" required maxLength={255} placeholder="Как к вам обращаться" autoComplete="name" /></label>
              <label><span>Электронная почта</span><input name="contact" type="email" required maxLength={255} placeholder="name@company.ru" autoComplete="email" /></label>
              <p className="booking-privacy">Контакты видны только организатору встречи и не публикуются.</p>
              <button className="primary-btn" disabled={busy}>{busy ? "Бронируем…" : "Подтвердить запись"}<Icon name="arrow" size={16} /></button>
            </form>}
          </aside>
        </div>}
      </>}
    </main>
  </div>;
}
