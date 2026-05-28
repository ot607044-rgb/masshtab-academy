import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getUsers, createUser } from "../api/users";
import type { User, UserRole, CreateUserPayload } from "../types";
import { ROLE_LABELS } from "../types";
import styles from "./Dashboard.module.css";

const ASSIGNABLE_ROLES: UserRole[] = ["company_admin", "hr", "department_head", "methodologist", "employee"];

const defaultForm: CreateUserPayload = {
  email: "",
  password: "",
  full_name: "",
  role: "employee",
};

const CompanyAdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateUserPayload>(defaultForm);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    try {
      const created = await createUser(form);
      setUsers((prev) => [...prev, created]);
      setForm(defaultForm);
      setShowForm(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFormError(msg || "Ошибка создания пользователя");
    }
  };

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.brand}>Академия Масштаба</span>
          <span className={`${styles.badge} ${styles.adminBadge}`}>
            {user ? ROLE_LABELS[user.role] : ""}
          </span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.userName}>{user?.full_name}</span>
          <button onClick={logout} className={styles.logoutBtn}>Выйти</button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.sectionHeader}>
          <div>
            <h1 className={styles.pageTitle}>Сотрудники компании</h1>
            <p className={styles.pageSubtitle}>{users.length} пользователей</p>
          </div>
          {user?.role === "company_admin" && (
            <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
              {showForm ? "Отмена" : "+ Добавить сотрудника"}
            </button>
          )}
        </div>

        {showForm && (
          <div className={styles.inlineForm}>
            <h3>Новый пользователь</h3>
            <form onSubmit={handleCreate}>
              <div className={styles.formRow}>
                <div className="form-group">
                  <label>ФИО *</label>
                  <input value={form.full_name} required
                    onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input type="email" value={form.email} required
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Пароль *</label>
                  <input type="password" value={form.password} required minLength={8}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Роль</label>
                  <select value={form.role}
                    onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as UserRole }))}>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                </div>
              </div>
              {formError && <div className="error-msg">{formError}</div>}
              <button type="submit" className="btn-primary">Создать</button>
            </form>
          </div>
        )}

        {loading ? (
          <div className={styles.loading}>Загрузка...</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ФИО</th>
                  <th>Email</th>
                  <th>Роль</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.full_name}</td>
                    <td className={styles.emailCell}>{u.email}</td>
                    <td>
                      <span className={styles.roleBadge}>{ROLE_LABELS[u.role] || u.role}</span>
                    </td>
                    <td>
                      <span className={u.is_active ? styles.statusActive : styles.statusInactive}>
                        {u.is_active ? "Активен" : "Неактивен"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className={styles.empty}>Пользователи не найдены.</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default CompanyAdminDashboard;
