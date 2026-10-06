import { FormEvent, ReactNode, useState } from "react";

type IconName =
  | "academy"
  | "calendar"
  | "people"
  | "briefcase"
  | "book"
  | "chart"
  | "settings"
  | "search"
  | "bell"
  | "plus"
  | "chevron"
  | "clock"
  | "video"
  | "sparkle"
  | "check"
  | "grid"
  | "arrow"
  | "close";

const paths: Record<IconName, ReactNode> = {
  academy: <><path d="m4 9 8-5 8 5-8 5-8-5Z"/><path d="M8 12v5c2.6 2 5.4 2 8 0v-5"/><path d="M20 9v6"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></>,
  people: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Z"/><path d="M8 7h8M8 11h6"/></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1H3v-4h1a1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6V3h4v1a1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 .6 1h1v4h-1a1.7 1.7 0 0 0-.6 1Z"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  video: <><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/></>,
  sparkle: <><path d="m12 3 1.3 4.2L17 9l-3.7 1.8L12 15l-1.3-4.2L7 9l3.7-1.8L12 3Z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  arrow: <><path d="M5 12h14M14 7l5 5-5 5"/></>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const meetings = [
  { time: "09:30", name: "Анна Воробьёва", role: "Product designer", color: "violet", duration: "45 мин" },
  { time: "11:00", name: "Михаил Орлов", role: "Head of sales", color: "blue", duration: "60 мин" },
  { time: "14:30", name: "София Ким", role: "HR business partner", color: "mint", duration: "30 мин" },
];

function Avatar({ initials, tone = "violet" }: { initials: string; tone?: string }) {
  return <span className={`avatar ${tone}`}>{initials}</span>;
}

function Brand({ light = false }: { light?: boolean }) {
  return <div className={`brand ${light ? "light" : ""}`}><span className="brand-mark"><Icon name="academy" size={19}/></span><span><b>МАСШТАБ</b><small>корпоративная академия</small></span></div>;
}

function PrimaryButton({ onClick, children, dark = false }: { onClick?: () => void; children: ReactNode; dark?: boolean }) {
  return <button className={`primary-btn ${dark ? "dark" : ""}`} onClick={onClick}>{children}</button>;
}

function Sidebar({ active = "Календарь" }: { active?: string }) {
  const items: [IconName, string][] = [["grid", "Обзор"], ["briefcase", "Подбор"], ["people", "Сотрудники"], ["book", "Обучение"], ["chart", "Аналитика"], ["calendar", "Календарь"]];
  return <aside className="sidebar">
    <Brand light />
    <nav>{items.map(([icon, label]) => <button key={label} className={active === label ? "active" : ""}><Icon name={icon}/><span>{label}</span>{label === "Подбор" && <i>12</i>}</button>)}</nav>
    <div className="sidebar-bottom">
      <button><Icon name="settings"/><span>Настройки</span></button>
      <div className="user-card"><Avatar initials="АЮ" tone="orange"/><span><b>Анна Юнусова</b><small>Администратор</small></span><Icon name="chevron" size={15}/></div>
    </div>
  </aside>;
}

function CommandCenter({ onSchedule, onAvailability, onBlock, onPreview }: { onSchedule: () => void; onAvailability: () => void; onBlock: () => void; onPreview: () => void }) {
  const dates = [["Пн", "12"], ["Вт", "13"], ["Ср", "14"], ["Чт", "15"], ["Пт", "16"]];
  return <div className="concept command">
    <Sidebar />
    <main className="command-main">
      <header className="topbar">
        <div className="search"><Icon name="search"/><span>Найти сотрудника или кандидата</span><kbd>⌘ K</kbd></div>
        <div className="top-actions"><button className="availability-btn" onClick={onAvailability}><Icon name="clock" size={16}/> Доступность</button><button className="icon-btn"><Icon name="bell"/></button><PrimaryButton onClick={onSchedule}><Icon name="plus" size={17}/> Назначить встречу</PrimaryButton></div>
      </header>
      <div className="command-content">
        <div className="welcome-row">
          <div><span className="eyebrow">ПЛАНИРОВАНИЕ ВСТРЕЧ</span><div className="page-title">Календарь команды</div><p>Распределяйте собеседования и находите свободное время команды.</p></div>
          <div className="mini-stat"><Icon name="clock"/><span><b>11 слотов</b><small>доступно на этой неделе</small></span></div>
        </div>
        <section className="week-card">
          <div className="section-head"><div><b>12–16 октября</b><span>Неделя 42</span></div><div className="nav-buttons"><button><Icon name="chevron" size={16}/></button><button>Сегодня</button><button><Icon name="chevron" size={16}/></button></div></div>
          <div className="date-strip">{dates.map((date, i) => <button key={date[1]} className={i === 1 ? "active" : ""}><small>{date[0]}</small><b>{date[1]}</b><span className={`load l${i}`}></span></button>)}</div>
        </section>
        <div className="dashboard-grid">
          <section className="agenda-card">
            <div className="section-head"><div><b>Сегодня, 13 октября</b><span>3 встречи · 2 ч 15 мин</span></div><div className="agenda-actions"><button className="text-btn muted" onClick={onBlock}><Icon name="close" size={13}/> Заблокировать время</button><button className="text-btn">Открыть день <Icon name="arrow" size={15}/></button></div></div>
            <div className="agenda-list">{meetings.map((meeting) => <div className="agenda-item" key={meeting.time}>
              <div className="agenda-time"><b>{meeting.time}</b><small>{meeting.duration}</small></div>
              <div className={`agenda-line ${meeting.color}`}></div>
              <Avatar initials={meeting.name.split(" ").map(n => n[0]).join("")} tone={meeting.color}/>
              <div className="agenda-person"><b>{meeting.name}</b><span>{meeting.role}</span></div>
              <span className="meeting-type"><Icon name="video" size={14}/> Собеседование</span>
              <button className="more">•••</button>
            </div>)}</div>
          </section>
          <aside className="insights">
            <div className="insight-top"><span className="sparkle-box"><Icon name="calendar"/></span><span><b>Запись по ссылке</b><small><i className="status-dot"></i> Активна</small></span></div>
            <div className="booking-widget-copy"><b>Принимайте записи автоматически</b><p>Гости увидят только свободное время. Встречи и блокировки уже учтены.</p></div>
            <div className="metric"><span><Icon name="clock" size={14}/>Рабочие часы</span><b>Пн–Пт</b></div>
            <div className="metric"><span><Icon name="video" size={14}/>Длительность</span><b>30 мин</b></div>
            <button className="widget-primary" onClick={onAvailability}><Icon name="settings" size={15}/> Настроить доступность</button>
            <button className="widget-secondary" onClick={onPreview}>Посмотреть страницу <Icon name="arrow" size={14}/></button>
          </aside>
        </div>
      </div>
    </main>
  </div>;
}

const weekSchedule = [
  ["Понедельник", "09:00", "18:00", true],
  ["Вторник", "09:00", "18:00", true],
  ["Среда", "10:00", "18:00", true],
  ["Четверг", "09:00", "17:00", true],
  ["Пятница", "09:00", "16:00", true],
  ["Суббота", "", "", false],
  ["Воскресенье", "", "", false],
] as const;

function AvailabilityModal({ onClose, onPreview }: { onClose: () => void; onPreview: () => void }) {
  const [tab, setTab] = useState<"schedule" | "exceptions" | "link">("schedule");
  const [enabled, setEnabled] = useState(true);
  const [saved, setSaved] = useState(false);
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className="availability-modal" onMouseDown={event => event.stopPropagation()}>
      <div className="availability-head">
        <div><span className="eyebrow">ЗАПИСЬ ПО ССЫЛКЕ</span><div className="modal-title">Настройка доступности</div><p>Определите, когда внешние участники могут выбрать встречу.</p></div>
        <button className="icon-btn" onClick={onClose}><Icon name="close"/></button>
      </div>
      <div className="availability-tabs">
        <button className={tab === "schedule" ? "active" : ""} onClick={() => setTab("schedule")}><span>1</span> Рабочие часы</button>
        <button className={tab === "exceptions" ? "active" : ""} onClick={() => setTab("exceptions")}><span>2</span> Исключения</button>
        <button className={tab === "link" ? "active" : ""} onClick={() => setTab("link")}><span>3</span> Публичная ссылка</button>
      </div>
      <div className="availability-body">
        {tab === "schedule" && <div className="availability-layout">
          <section>
            <div className="panel-title"><div><b>Повторяющееся расписание</b><p>Один раз настройте обычную рабочую неделю.</p></div><span className="timezone"><Icon name="clock" size={14}/> Екатеринбург · UTC+5</span></div>
            <div className="week-editor">{weekSchedule.map(([day, start, end, active]) => <div className={`week-row ${active ? "" : "disabled"}`} key={day}>
              <button className={`toggle ${active ? "on" : ""}`} aria-label={`Доступность: ${day}`}><i></i></button>
              <b>{day}</b>
              {active ? <><button className="time-field">{start}</button><span>—</span><button className="time-field">{end}</button><button className="row-plus"><Icon name="plus" size={15}/></button></> : <span className="day-off">Недоступно</span>}
            </div>)}</div>
          </section>
          <aside className="settings-summary">
            <span className="summary-icon"><Icon name="calendar"/></span><b>Как формируются слоты</b>
            <p>Показываем только свободное время внутри рабочих часов. Встречи и блокировки исключаются автоматически.</p>
            <div className="formula"><span>Рабочие часы</span><i>−</i><span>Занято</span><i>=</i><strong>Свободные слоты</strong></div>
            <label className="compact-label"><span>Длительность встречи</span><button className="select-field">30 минут <Icon name="chevron" size={13}/></button></label>
            <label className="compact-label"><span>Перерыв между встречами</span><button className="select-field">15 минут <Icon name="chevron" size={13}/></button></label>
          </aside>
        </div>}
        {tab === "exceptions" && <div className="exceptions-panel">
          <div className="panel-title"><div><b>Исключения из расписания</b><p>Отпуск, личные дела и другие изменения только для конкретных дат.</p></div><button className="availability-btn"><Icon name="plus" size={15}/> Добавить исключение</button></div>
          <div className="exception-list">
            <div className="exception-row"><span className="exception-date"><b>15</b><small>ОКТ</small></span><span><b>Личная встреча</b><small>Недоступно с 12:00 до 15:00</small></span><em>Заблокировано</em><button className="more">•••</button></div>
            <div className="exception-row"><span className="exception-date"><b>23</b><small>ОКТ</small></span><span><b>Выходной</b><small>Весь день недоступен</small></span><em>Весь день</em><button className="more">•••</button></div>
          </div>
          <div className="exceptions-note"><Icon name="sparkle"/><span><b>Создавать исключение для встреч не нужно</b><small>Все встречи из календаря уже исключены из свободного времени.</small></span></div>
        </div>}
        {tab === "link" && <div className="link-panel">
          <div className="link-status">
            <div><span className="summary-icon"><Icon name="check"/></span><span><b>Публичная запись</b><small>{enabled ? "Ссылка активна — по ней можно записаться" : "Ссылка отключена"}</small></span></div>
            <button className={`toggle ${enabled ? "on" : ""}`} onClick={() => setEnabled(!enabled)}><i></i></button>
          </div>
          <div className="share-box"><label>Ваша ссылка</label><div><span>academy.ru/meet/anna-yunusova</span><button>Копировать</button></div><small>Посетители не увидят внутренние встречи, сотрудников или названия блокировок.</small></div>
          <div className="privacy-grid">
            <div><Icon name="check"/><span><b>Только свободные слоты</b><small>Занятое время полностью скрыто</small></span></div>
            <div><Icon name="clock"/><span><b>Локальный часовой пояс</b><small>Время пересчитается автоматически</small></span></div>
            <div><Icon name="calendar"/><span><b>Без двойных записей</b><small>Слот проверяется при подтверждении</small></span></div>
          </div>
          <button className="preview-card" onClick={onPreview}><span className="preview-visual"><i></i><i></i><i></i></span><span><b>Посмотреть глазами посетителя</b><small>Открыть предварительный просмотр страницы записи</small></span><Icon name="arrow"/></button>
          <button className="revoke-link">Отозвать текущую ссылку</button>
        </div>}
      </div>
      <div className="availability-footer"><span>{saved && <><Icon name="check" size={15}/> Изменения сохранены</>}</span><button className="plain-btn" onClick={onClose}>Отмена</button>{tab !== "link" && <button className="primary-btn" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}>Сохранить настройки</button>}</div>
    </div>
  </div>;
}

function BlockModal({ onClose }: { onClose: () => void }) {
  const [saved, setSaved] = useState(false);
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal block-modal" onMouseDown={event => event.stopPropagation()}>
    {saved ? <div className="success-state"><span className="success-icon"><Icon name="check" size={30}/></span><div className="modal-title">Время заблокировано</div><p>13 октября с 16:00 до 17:30 больше не показывается для записи.</p><PrimaryButton onClick={onClose}>Готово</PrimaryButton></div> : <>
      <div className="modal-head"><div><span className="eyebrow">ИСКЛЮЧЕНИЕ</span><div className="modal-title">Заблокировать время</div><p>Скроем интервал из доступных слотов, не создавая встречу.</p></div><button className="icon-btn" onClick={onClose}><Icon name="close"/></button></div>
      <div className="block-date"><span className="summary-icon"><Icon name="calendar"/></span><div><b>Вторник, 13 октября</b><small>Asia/Yekaterinburg · UTC+5</small></div></div>
      <div className="form-row"><label><span>Начало</span><div className="input"><Icon name="clock" size={17}/><span>16:00</span></div></label><label><span>Окончание</span><div className="input"><Icon name="clock" size={17}/><span>17:30</span></div></label></div>
      <label><span>Причина <i>видна только вам</i></span><textarea placeholder="Например, личные дела">Личные дела</textarea></label>
      <div className="modal-actions"><button className="plain-btn" onClick={onClose}>Отмена</button><PrimaryButton onClick={() => setSaved(true)}>Заблокировать</PrimaryButton></div>
    </>}
  </div></div>;
}

function ScheduleModal({ onClose }: { onClose: () => void }) {
  const [sent, setSent] = useState(false);
  function submit(event: FormEvent) { event.preventDefault(); setSent(true); }
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className="modal" onMouseDown={e => e.stopPropagation()}>
      {sent ? <div className="success-state"><span className="success-icon"><Icon name="check" size={30}/></span><div className="modal-title">Встреча назначена</div><p>Приглашение отправлено Михаилу и добавлено в календарь команды.</p><PrimaryButton onClick={onClose}>Вернуться в календарь</PrimaryButton></div> :
      <><div className="modal-head"><div><span className="eyebrow">НОВАЯ ВСТРЕЧА</span><div className="modal-title">Назначить собеседование</div><p>Добавьте кандидата и выберите удобное время.</p></div><button className="icon-btn" onClick={onClose}><Icon name="close"/></button></div>
      <form onSubmit={submit}>
        <label><span>Кандидат</span><div className="input person-input"><Avatar initials="МО" tone="blue"/><span><b>Михаил Орлов</b><small>Head of sales</small></span><Icon name="chevron" size={15}/></div></label>
        <div className="form-row"><label><span>Дата</span><div className="input"><Icon name="calendar" size={17}/><span>13 октября 2026</span></div></label><label><span>Время</span><div className="input"><Icon name="clock" size={17}/><span>16:00</span></div></label></div>
        <label><span>Формат и длительность</span><div className="input"><Icon name="video" size={17}/><span>Видеовстреча · 45 минут</span><Icon name="chevron" size={15}/></div></label>
        <label><span>Заметка <i>необязательно</i></span><textarea placeholder="Добавьте вопросы или контекст для коллеги"></textarea></label>
        <div className="modal-actions"><button type="button" className="plain-btn" onClick={onClose}>Отмена</button><PrimaryButton>Назначить встречу <Icon name="arrow" size={16}/></PrimaryButton></div>
      </form></>}
    </div>
  </div>;
}

function BookingPage({ onBack }: { onBack: () => void }) {
  const [date, setDate] = useState(0);
  const [time, setTime] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const dates = [["ВТ", "13", "окт", "5 слотов"], ["СР", "14", "окт", "6 слотов"], ["ЧТ", "15", "окт", "3 слота"], ["ПТ", "16", "окт", "4 слота"]];
  const slots = [["Утро", ["09:30", "10:15", "11:00"]], ["День", ["13:30", "14:15", "16:00"]]] as const;
  const endTime = time ? `${String(Number(time.slice(0, 2)) + (Number(time.slice(3)) >= 30 ? 1 : 0)).padStart(2, "0")}:${Number(time.slice(3)) >= 30 ? "00" : "45"}` : "";
  return <div className="booking-page">
    <header className="booking-header"><Brand/><button className="back-link" onClick={onBack}>Вернуться в Академию</button></header>
    <main className="booking-shell">
      {confirmed ? <div className="booking-success"><span className="success-icon"><Icon name="check" size={30}/></span><span className="eyebrow">ЗАПИСЬ ПОДТВЕРЖДЕНА</span><div className="booking-title">До встречи {dates[date][1]} октября</div><p>Приглашение на встречу отправлено на вашу почту.</p><div className="booking-receipt"><div><Icon name="calendar"/><span><b>{dates[date][0]}, {dates[date][1]} октября</b><small>{time}–{endTime} · 30 минут</small></span></div><div><Avatar initials="АЮ" tone="violet"/><span><b>Анна Юнусова</b><small>Академия Масштаба</small></span></div></div><button className="plain-btn" onClick={onBack}>Закрыть</button></div> :
      <><section className="booking-intro"><span className="eyebrow">30-МИНУТНАЯ ВСТРЕЧА</span><div className="booking-title">Выберите удобное время</div><p>Встреча с Анной Юнусовой · время показано для Екатеринбурга</p></section>
      <div className="booking-layout">
        <section className="slot-picker">
          <div className="booking-step"><span>1</span><div><b>Выберите день</b><small>Доступные даты на ближайшие две недели</small></div></div>
          <div className="booking-dates">{dates.map((item, index) => <button key={item[1]} className={date === index ? "active" : ""} onClick={() => { setDate(index); setTime(""); }}><small>{item[0]}</small><b>{item[1]}</b><span>{item[2]}</span><em>{item[3]}</em></button>)}</div>
          <div className="booking-step second"><span>2</span><div><b>Выберите время</b><small>Вторник, {dates[date][1]} октября</small></div></div>
          <div className="slot-groups">{slots.map(([period, values]) => <div key={period}><span>{period}</span><div>{values.map(value => <button key={value} className={time === value ? "active" : ""} onClick={() => setTime(value)}>{value}</button>)}</div></div>)}</div>
        </section>
        <aside className={`booking-details ${time ? "ready" : ""}`}>
          {!time ? <div className="choose-hint"><span className="summary-icon"><Icon name="clock"/></span><b>Сначала выберите время</b><p>После выбора здесь появится короткая форма подтверждения.</p></div> : <>
            <span className="eyebrow">ВАША ВСТРЕЧА</span><div className="selected-slot"><Icon name="calendar"/><span><b>Вторник, {dates[date][1]} октября</b><small>{time} · 30 минут</small></span></div>
            <label><span>Ваше имя</span><input placeholder="Как к вам обращаться"/></label>
            <label><span>Электронная почта</span><input type="email" placeholder="name@company.ru"/></label>
            <p className="booking-privacy">Мы отправим подтверждение и ссылку на встречу. Контакты не публикуются.</p>
            <PrimaryButton onClick={() => setConfirmed(true)}>Подтвердить запись <Icon name="arrow" size={16}/></PrimaryButton>
          </>}
        </aside>
      </div></>}
    </main>
  </div>;
}

export default function App() {
  const [modal, setModal] = useState<"schedule" | "availability" | "block" | null>(null);
  const [publicPreview, setPublicPreview] = useState(false);
  if (publicPreview) return <BookingPage onBack={() => setPublicPreview(false)}/>;
  return <div className="app">
    <CommandCenter onSchedule={() => setModal("schedule")} onAvailability={() => setModal("availability")} onBlock={() => setModal("block")} onPreview={() => setPublicPreview(true)}/>
    {modal === "schedule" && <ScheduleModal onClose={() => setModal(null)}/>}
    {modal === "availability" && <AvailabilityModal onClose={() => setModal(null)} onPreview={() => { setModal(null); setPublicPreview(true); }}/>}
    {modal === "block" && <BlockModal onClose={() => setModal(null)}/>}
  </div>;
}
