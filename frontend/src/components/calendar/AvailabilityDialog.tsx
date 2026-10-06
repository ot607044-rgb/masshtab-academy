import { useState } from "react";
import { apiError, updateAvailabilityRules, deleteCalendarBlock, enablePublicCalendarLink, pausePublicCalendarLink, revokePublicCalendarLink, type AvailabilityState, type AvailabilityRule } from "../../api/workspace";
import { CalendarModal, clock } from "./CalendarModal";
import { Icon } from "./CalendarUI";

const DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const time = (minute: number) => `${String(Math.floor(minute / 60) % 24).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
type Rule = Omit<AvailabilityRule, "id">;

export function AvailabilityDialog({ state, onClose, onSaved, onBlock, onPreview }: { state: AvailabilityState; onClose: () => void; onSaved: () => Promise<void>; onBlock: () => void; onPreview: () => void }) {
  const [tab, setTab] = useState("schedule");
  const [rules, setRules] = useState<Rule[]>(state.rules.map(({ weekday, start_minute, end_minute, slot_minutes }) => ({ weekday, start_minute, end_minute, slot_minutes })));
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [zone, setZone] = useState(state.rules.length ? state.timezone : localZone);
  const [duration, setDuration] = useState(state.rules[0]?.slot_minutes ?? 30);
  const [buffer, setBuffer] = useState(state.buffer_minutes ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const zones = [...new Set([zone, localZone, "UTC", "Europe/Moscow", "Asia/Yekaterinburg", "Asia/Novosibirsk", "Europe/Berlin", "America/New_York"])];
  const url = state.public_link ? `${window.location.origin}/book/${state.public_link.token}` : "";

  async function action(run: () => Promise<unknown>, success = "Изменения сохранены") {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await run(); await onSaved(); setMessage(success); }
    catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }
  function change(index: number, field: "start_minute" | "end_minute", value: string) {
    const [hours, minutes] = value.split(":").map(Number);
    const minute = hours * 60 + minutes;
    setRules(current => current.map((r, i) => i === index ? { ...r, [field]: field === "end_minute" && minute === 0 ? 1440 : minute } : r));
  }
  function add(weekday: number) {
    const end = Math.max(0, ...rules.filter(r => r.weekday === weekday).map(r => r.end_minute));
    const start = end || 540;
    if (start >= 1440) return;
    setRules(current => [...current, { weekday, start_minute: start, end_minute: Math.min(1440, end ? end + 60 : 1080), slot_minutes: duration }]);
  }
  return <CalendarModal title="Настройка доступности" wide onClose={() => !busy && onClose()}>
    <div className="availability-tabs" role="tablist">{[["schedule", "Рабочие часы"], ["exceptions", "Исключения"], ["link", "Публичная ссылка"]].map(([key, name], i) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}><span>{i + 1}</span>{name}</button>)}</div>
    <div className="availability-body">
      {tab === "schedule" && <div className="availability-layout">
        <section><div className="panel-title"><div><b>Повторяющееся расписание</b><p>Один раз настройте обычную рабочую неделю.</p></div><label className="timezone"><Icon name="clock" size={14} /><select aria-label="Часовой пояс расписания" value={zone} onChange={e => setZone(e.target.value)}>{zones.map(z => <option key={z}>{z}</option>)}</select></label></div>
          <div className="week-editor">{DAYS.map((day, weekday) => {
            const indexes = rules.map((rule, index) => rule.weekday === weekday ? index : -1).filter(index => index >= 0);
            return <div key={day}>{(indexes.length ? indexes : [-1]).map((index, row) => <div className={`week-row ${index < 0 ? "disabled" : ""} ${row ? "extra" : ""}`} key={row}>
              {row === 0 ? <><button className={`toggle ${index >= 0 ? "on" : ""}`} role="switch" aria-checked={index >= 0} aria-label={`Доступность: ${day}`} onClick={() => index >= 0 ? setRules(current => current.filter(r => r.weekday !== weekday)) : add(weekday)}><i /></button><b>{day}</b></> : <><span /><span /></>}
              {index >= 0 ? <><input className="time-field" type="time" aria-label={`Начало: ${day}, окно ${row + 1}`} value={time(rules[index].start_minute)} onChange={e => change(index, "start_minute", e.target.value)} /><span>—</span><input className="time-field" type="time" aria-label={`Окончание: ${day}, окно ${row + 1}`} value={time(rules[index].end_minute)} onChange={e => change(index, "end_minute", e.target.value)} />
                {row === 0 ? <button className="row-plus" aria-label={`Добавить окно: ${day}`} onClick={() => add(weekday)}><Icon name="plus" size={15} /></button> : <button className="row-plus" aria-label={`Удалить окно: ${day}, окно ${row + 1}`} onClick={() => setRules(current => current.filter((_, i) => i !== index))}><Icon name="close" size={15} /></button>}
              </> : <span className="day-off">Недоступно</span>}
            </div>)}</div>;
          })}</div>
        </section>
        <aside className="settings-summary"><span className="summary-icon"><Icon name="calendar" /></span><b>Как формируются слоты</b><p>Показываем только свободное время внутри рабочих часов. Встречи и блокировки исключаются автоматически.</p><div className="formula"><span>Рабочие часы</span><i>−</i><span>Занято</span><i>=</i><strong>Свободные слоты</strong></div>
          <label className="compact-label"><span>Длительность встречи</span><select className="select-field" value={duration} onChange={e => setDuration(Number(e.target.value))}>{[15, 30, 45, 60, 90, 120].map(value => <option key={value} value={value}>{value} минут</option>)}</select></label>
          <label className="compact-label"><span>Перерыв между встречами</span><select className="select-field" value={buffer} onChange={e => setBuffer(Number(e.target.value))}>{[0, 5, 10, 15, 30, 60, 120].map(value => <option key={value} value={value}>{value} минут</option>)}</select></label>
        </aside>
      </div>}
      {tab === "exceptions" && <div className="exceptions-panel"><div className="panel-title"><div><b>Исключения из расписания</b><p>Отпуск, личные дела и другие изменения только для конкретных дат.</p></div><button className="availability-btn" onClick={onBlock}><Icon name="plus" size={15} />Добавить исключение</button></div>
        <div className="exception-list">{state.blocks.map(block => { const date = new Date(block.starts_at); return <div className="exception-row" key={block.id}><span className="exception-date"><b>{date.getDate()}</b><small>{date.toLocaleDateString("ru-RU", { month: "short" })}</small></span><span><b>{block.title || "Занято"}</b><small>{date.toLocaleDateString("ru-RU")} · {clock(block.starts_at)} — {clock(new Date(date.getTime() + block.duration_minutes * 60000))}</small></span><em>{block.duration_minutes >= 1380 ? "Весь день" : "Заблокировано"}</em><button className="more" aria-label={`Удалить исключение ${block.title || "Занято"}`} disabled={busy} onClick={() => void action(() => deleteCalendarBlock(block.id))}><Icon name="close" size={15} /></button></div>; })}
          {!state.blocks.length && <p className="calendar-state">Исключений пока нет.</p>}
        </div><div className="exceptions-note"><Icon name="sparkle" /><span><b>Создавать исключение для встреч не нужно</b><small>Все встречи из календаря уже исключены из свободного времени.</small></span></div>
      </div>}
      {tab === "link" && <div className="link-panel"><div className="link-status"><div><span className="summary-icon"><Icon name="check" /></span><span><b>Публичная запись</b><small>{state.public_link?.enabled ? "Ссылка активна — по ней можно записаться" : "Ссылка отключена"}</small></span></div><button className={`toggle ${state.public_link?.enabled ? "on" : ""}`} role="switch" aria-label="Публичная запись" aria-checked={Boolean(state.public_link?.enabled)} disabled={busy} onClick={() => void action(() => state.public_link?.enabled ? pausePublicCalendarLink(false) : enablePublicCalendarLink())}><i /></button></div>
        <div className="share-box"><label>Ваша ссылка</label><div><span>{url || "Включите публичную запись, чтобы создать ссылку"}</span><button disabled={!url || busy} onClick={() => { navigator.clipboard.writeText(url).then(() => setMessage("Ссылка скопирована")).catch(() => setError("Не удалось скопировать ссылку")); }}>Копировать</button></div><small>Посетители не увидят внутренние встречи, сотрудников или названия блокировок.</small></div>
        <div className="privacy-grid"><div><Icon name="check" /><span><b>Только свободные слоты</b><small>Занятое время полностью скрыто</small></span></div><div><Icon name="clock" /><span><b>Локальный часовой пояс</b><small>Время пересчитается автоматически</small></span></div><div><Icon name="calendar" /><span><b>Без двойных записей</b><small>Слот проверяется при подтверждении</small></span></div></div>
        <button className="preview-card" onClick={onPreview} disabled={!state.public_link?.enabled}><span className="preview-visual"><i /><i /><i /></span><span><b>Посмотреть глазами посетителя</b><small>Открыть предварительный просмотр страницы записи</small></span><Icon name="arrow" /></button>
        <button className="revoke-link" disabled={!url || busy} onClick={() => void action(() => revokePublicCalendarLink(), "Ссылка отозвана")}>Отозвать текущую ссылку</button>
      </div>}
      {error && <p role="alert" className="calendar-error">{error}</p>}
    </div>
    <div className="availability-footer"><span role="status">{message && <><Icon name="check" size={15} />{message}</>}</span><button className="plain-btn" onClick={onClose} disabled={busy}>Закрыть</button>{tab === "schedule" && <button className="primary-btn" disabled={busy} onClick={() => void action(() => updateAvailabilityRules(rules.map(r => ({ ...r, slot_minutes: duration })), zone, buffer))}>{busy ? "Сохраняем…" : "Сохранить настройки"}</button>}</div>
  </CalendarModal>;
}
