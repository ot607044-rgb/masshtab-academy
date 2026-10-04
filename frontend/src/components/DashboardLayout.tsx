import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import { LayoutDashboard, Users, BookOpen, BriefcaseBusiness, GraduationCap, CalendarDays, Settings, Layers, Library, Building2, Folder, LogOut, Menu, X, ShieldCheck, Search, Compass } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSupport } from "../context/SupportContext";
import { getPendingCount } from "../api/support";
import { getCustomSections, type CustomSection } from "../api/settings";
import NotificationBell from "./NotificationBell";
import { ROLE_LABELS } from "../types";
import styles from "./DashboardLayout.module.css";

const HR = ["company_admin", "hr", "super_admin"];
const CONTENT = [...HR, "methodologist"];
const MAIN_NAV = [
  { to: "start", label: "С чего начать", icon: Compass, roles: [...HR, "department_head", "methodologist", "employee"] },
  { to: "workspace", label: "Рабочий стол", icon: LayoutDashboard, roles: HR },
  { to: "recruitment", label: "Подбор", icon: BriefcaseBusiness, roles: HR },
  { to: "my-department", label: "Мой отдел", icon: Building2, roles: ["department_head"] },
  { to: "employees", label: "Сотрудники", icon: Users, roles: [...HR, "department_head"] },
  { to: "learning", label: "Обучение", icon: BookOpen, roles: [...CONTENT, "department_head", "employee"] },
  { to: "hr-dashboard", label: "Квалификация", icon: GraduationCap, roles: HR },
  { to: "my-tests", label: "Мои тесты", icon: GraduationCap, roles: ["employee"] },
  { to: "calendar", label: "Календарь", icon: CalendarDays, roles: HR },
];
const MANAGEMENT_NAV = [
  { to: "knowledge", label: "Программы по должностям", icon: Layers, roles: CONTENT },
  { to: "materials", label: "Материалы и тесты", icon: Library, roles: CONTENT },
  { to: "organization", label: "Структура компании", icon: Building2, roles: [...HR, "department_head"] },
  { to: "settings", label: "Доступ и настройки", icon: Settings, roles: ["company_admin", "super_admin"] },
  { to: "support-requests", label: "Запросы поддержки", icon: ShieldCheck, roles: ["company_admin"] },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { session, timeLeftLabel, exitSupportMode } = useSupport();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [sections, setSections] = useState<CustomSection[]>([]);
  const role = user?.role ?? "employee";
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (role === "company_admin") getPendingCount().then(r => setPendingCount(r.count)).catch(() => {});
    if ([...HR, "department_head"].includes(role)) getCustomSections().then(data => setSections(data.filter(s => s.is_active && (!s.allowed_roles?.length || s.allowed_roles.includes(role))))).catch(() => {});
  }, [role, session?.company_id]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  const items = [...MAIN_NAV, ...MANAGEMENT_NAV];
  const isTestEditor = location.pathname.startsWith("/dashboard/tests/") && !location.pathname.endsWith("/take");
  const title = isTestEditor ? "Материалы и тесты" : items.find(item => location.pathname.startsWith(`/dashboard/${item.to}`))?.label ?? "Академия";
  const renderNav = (list: typeof MAIN_NAV) => list.filter(item => item.roles.includes(role)).map(item => <NavLink key={item.to} to={`/dashboard/${item.to}`} className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ""}`}><item.icon size={17} strokeWidth={1.7} /><span>{item.label}</span>{item.to === "support-requests" && pendingCount > 0 && <small className={styles.count}>{pendingCount}</small>}</NavLink>);
  return <div className={styles.shell}>
    {open && <button className={styles.backdrop} aria-label="Закрыть меню" onClick={() => setOpen(false)} />}
    <aside className={`${styles.sidebar} ${open ? styles.open : ""}`} aria-label="Главная навигация">
      <Link className={styles.brand} to="/dashboard"><span>АКАДЕМИЯ</span><strong>МАСШТАБА</strong></Link>
      <div className={styles.workspace}><strong>{session?.company_name ?? "Академия Масштаба"}</strong><small>{HR.includes(role) ? "Рабочее пространство HR" : ROLE_LABELS[role]}</small></div>
      <nav className={styles.nav}>{renderNav(MAIN_NAV)}{MANAGEMENT_NAV.some(item => item.roles.includes(role)) && <><p className={styles.groupLabel}>Управление</p>{renderNav(MANAGEMENT_NAV)}</>}{sections.length > 0 && <><p className={styles.groupLabel}>Разделы компании</p>{sections.map(section => <NavLink key={section.id} to={`/dashboard/sections/${section.slug}`} className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ""}`}><Folder size={17} /><span>{section.name}</span></NavLink>)}</>}</nav>
      <footer className={styles.footer}><div><strong>{user?.full_name}</strong><small>{ROLE_LABELS[role]}</small></div><button className="academy-icon" title="Выйти" aria-label="Выйти" onClick={() => { exitSupportMode(); logout(); navigate("/login"); }}><LogOut size={18} /></button></footer>
    </aside>
    <main className={styles.content}>
      <header className={styles.topbar}><button className={`${styles.menuButton} academy-icon`} aria-label={open ? "Закрыть меню" : "Открыть меню"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={21} /> : <Menu size={21} />}</button><div className={styles.breadcrumb}>Академия <span>/</span> {title}</div>{HR.includes(role) && <form className={styles.search} onSubmit={e => { e.preventDefault(); navigate(`/dashboard/employees?q=${encodeURIComponent(search)}`); }}><Search size={16} /><input aria-label="Поиск сотрудников" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск сотрудников" /></form>}<div className={styles.topActions}><NotificationBell /><span>{user?.full_name.split(" ")[0]} · {role === "hr" ? "HR" : ROLE_LABELS[role]}</span></div></header>
      {session && <div className={styles.support}>Режим поддержки · {session.company_name} · {timeLeftLabel}<button onClick={() => { exitSupportMode(); navigate("/super-admin"); }}>Завершить</button></div>}
      {import.meta.env.VITE_UI_PREVIEW === "1" && <div className={styles.support}>Предварительная версия · тестовые данные · рабочая академия не изменена</div>}
      <Outlet />
    </main>
  </div>;
}
