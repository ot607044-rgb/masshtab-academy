import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { CalendarCheck, Clock } from "lucide-react";
import { bookPublicSlot, getPublicSlots, type FreeSlot } from "../api/workspace";
import { Empty, LoadState } from "../components/AcademyUI";

const timeLabel = (value: string) => new Date(value).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export default function PublicBookingPage() {
  const { token = "" } = useParams();
  const [slots, setSlots] = useState<FreeSlot[]>([]);
  const [selected, setSelected] = useState<FreeSlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const start = new Date();
    const end = new Date(); end.setDate(end.getDate() + 14);
    try {
      const result = await getPublicSlots(token, start.toISOString(), end.toISOString());
      setSlots(result.slots);
      setSelected(result.slots[0] ?? null);
    } catch {
      setError("Ссылка недоступна или запись отключена.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      await bookPublicSlot(token, { starts_at: selected.starts_at, duration_minutes: selected.duration_minutes, visitor_name: String(form.get("name")), visitor_contact: String(form.get("contact")), notes: String(form.get("notes")) || null });
      setDone(true);
      await load();
    } catch {
      setError("Этот слот уже занят. Выберите другое время.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return <main className="public-booking">
    <section className="public-booking-panel">
      <h1>Запись на встречу</h1>
      <p>Время показано в вашем часовом поясе: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
      {loading ? <LoadState error="" retry={load} /> : error && !slots.length ? <LoadState error={error} retry={load} /> : done ? <div className="public-booking-done"><CalendarCheck size={28} /><strong>Запись подтверждена</strong><span>Встреча появилась в календаре.</span></div> : <>
        <div className="public-slot-list">
          {slots.map(slot => <button key={`${slot.starts_at}-${slot.ends_at}`} className={selected?.starts_at === slot.starts_at ? "active" : ""} onClick={() => setSelected(slot)}><Clock size={16} />{timeLabel(slot.starts_at)}<small>{slot.duration_minutes} мин</small></button>)}
          {!slots.length && <Empty>Свободных слотов пока нет</Empty>}
        </div>
        {selected && <form onSubmit={submit} className="public-booking-form">
          <label htmlFor="visitor-name">Имя</label>
          <input id="visitor-name" name="name" required maxLength={255} />
          <label htmlFor="visitor-contact">Контакты</label>
          <input id="visitor-contact" name="contact" required maxLength={255} placeholder="Email или телефон" />
          <label htmlFor="visitor-notes">Комментарий</label>
          <textarea id="visitor-notes" name="notes" maxLength={10000} />
          {error && <p className="error-msg" role="alert">{error}</p>}
          <button className="btn-primary" disabled={busy}>{busy ? "Бронируем..." : "Подтвердить запись"}</button>
        </form>}
      </>}
    </section>
  </main>;
}
