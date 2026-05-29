import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getPendingCount } from "../api/support";
import NotificationBell from "./NotificationBell";
import styles from "./DashboardLayout.module.css";

const BASE_NAV = [
  { to: "hr-dashboard",    label: "Аналитика HR",       icon: "📊", roles: ["company_admin", "hr"] },
  { to: "my-department",   label: "Мой отдел",          icon: "📈", roles: ["department_head"] },
  { to: "employees",       label: "Сотрудники",         icon: "👤", roles: ["company_admin", "hr", "department_head", "methodologist", "employee"] },
  { to: "departments",     label: "Отделы",             icon: "🏢", roles: ["company_admin", "hr", "department_head"] },
  { to: "positions",       label: "Должности",          icon: "💼", roles: ["company_admin", "hr", "department_head"] },
  { to: "knowledge",       label: "Матрица знаний",     icon: "📚", roles: ["company_admin", "hr", "methodologist"] },
  { to: "lessons",         label: "База знаний",        icon: "📖", roles: ["company_admin", "hr", "department_head", "methodologist", "employee"] },
  { to: "tests",           label: "Тесты",              icon: "🧪", roles: ["company_admin", "hr", "methodologist", "employee"] },
  { to: "my-lessons",      label: "Мои уроки",          icon: "🎓", roles: ["employee"] },
  { to: "my-tests",        label: "Мои тесты",          icon: "✅", roles: ["employee"] },
  { to: "support-requests", label: "Запросы поддержки", icon: "🛡", roles: ["company_admin"] },
];

const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (user?.role === "company_admin") {
      getPendingCount().then((r) => setPendingCount(r.count)).catch(() => {});
    }
  }, [user?.role]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const role = user?.role ?? "";
  const navItems = BASE_NAV.filter((item) => item.roles.includes(role));

  const roleLabel =
    role === "company_admin" ? "Администратор" :
    role === "hr" ? "HR" :
    role === "department_head" ? "Рук. отдела" :
    role === "methodologist" ? "Методолог" :
    "Сотрудник";

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandLogo}>АМ</span>
          <span className={styles.brandText}>Академия Масштаба</span>
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={`/dashboard/${item.to}`}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ""}`
              }
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
              {item.to === "support-requests" && pendingCount > 0 && (
                <span style={{
                  marginLeft: "auto",
                  background: "#ef4444", color: "#fff",
                  borderRadius: "999px", fontSize: "0.65rem",
                  fontWeight: 700, padding: "0.1rem 0.4rem",
                }}>
                  {pendingCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.full_name}</span>
            <span className={styles.userRole}>{roleLabel}</span>
          </div>
          <button onClick={handleLogout} className={styles.logoutBtn} title="Выйти">
            ⇥
          </button>
        </div>
      </aside>

      <main className={styles.content}>
        {/* Top bar with notification bell */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "0.75rem 1.5rem 0",
          }}
        >
          <NotificationBell />
        </div>
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
