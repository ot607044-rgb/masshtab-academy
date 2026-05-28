import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useSupport } from "../context/SupportContext";
import { getCompanies, createCompany, deleteCompany, deactivateCompany } from "../api/companies";
import { getMyRequests, createSupportRequest, revokeSession } from "../api/support";
import type { Company, CreateCompanyPayload, SupportRequest } from "../types";
import CreateCompanyModal from "../components/CreateCompanyModal";
import styles from "./Dashboard.module.css";

type Tab = "companies" | "support";

const SuperAdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { session: supportSession, enterSupportMode, exitSupportMode, timeLeftLabel } = useSupport();
  const [tab, setTab] = useState<Tab>("companies");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Request form state
  const [reqCompanyId, setReqCompanyId] = useState("");
  const [reqReason, setReqReason] = useState("");
  const [reqHours, setReqHours] = useState(8);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([getCompanies(), getMyRequests()]);
      setCompanies(c);
      setRequests(r);
    } catch {
      setError("Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = async (payload: CreateCompanyPayload) => {
    await createCompany(payload);
    await fetchAll();
    setShowModal(false);
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("Деактивировать компанию?")) return;
    await deactivateCompany(id);
    setCompanies((prev) => prev.map((c) => c.id === id ? { ...c, is_active: false } : c));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить компанию навсегда? Это действие нельзя отменить.")) return;
    await deleteCompany(id);
    setCompanies((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqCompanyId || !reqReason.trim()) return;
    setReqLoading(true);
    setReqError("");
    try {
      await createSupportRequest({ company_id: reqCompanyId, reason: reqReason, duration_hours: reqHours });
      setReqReason("");
      setReqCompanyId("");
      setReqHours(8);
      await fetchAll();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setReqError(msg || "Ошибка отправки запроса");
    } finally {
      setReqLoading(false);
    }
  };

  const handleEnterSupport = (req: SupportRequest) => {
    if (!req.expires_at || !req.company_name) return;
    enterSupportMode({
      id: req.id,
      company_id: req.company_id,
      company_name: req.company_name,
      expires_at: req.expires_at,
      reason: req.reason,
    });
  };

  const handleRevokeOwn = async (id: string) => {
    if (!confirm("Завершить сессию?")) return;
    await revokeSession(id);
    if (supportSession?.id === id) exitSupportMode();
    await fetchAll();
  };

  const isExpired = (req: SupportRequest) =>
    req.expires_at && new Date(req.expires_at) < new Date();

  const isActive = (req: SupportRequest) =>
    req.status === "approved" && !isExpired(req);

  const formatDate = (s: string) =>
    new Date(s).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.brand}>Академия Масштаба</span>
          <span className={`${styles.badge} ${styles.superBadge}`}>Super Admin</span>
        </div>

        {/* Support mode banner */}
        {supportSession && (
          <div style={{
            display: "flex", alignItems: "center", gap: "0.75rem",
            background: "#fef3c7", border: "1.5px solid #fcd34d",
            borderRadius: "8px", padding: "0.4rem 0.875rem", fontSize: "0.8rem",
          }}>
            <span>🛠 Режим поддержки: <strong>{supportSession.company_name}</strong></span>
            <span style={{ color: "#92400e" }}>Осталось: {timeLeftLabel}</span>
            <button
              onClick={exitSupportMode}
              style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontWeight: 600 }}
            >
              ✕ Выйти
            </button>
          </div>
        )}

        <div className={styles.headerRight}>
          <span className={styles.userName}>{user?.full_name}</span>
          <button onClick={logout} className={styles.logoutBtn}>Выйти</button>
        </div>
      </header>

      <main className={styles.main}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.75rem" }}>
          {(["companies", "support"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "0.5rem 1.25rem",
                border: "1.5px solid",
                borderColor: tab === t ? "#6366f1" : "#e5e7eb",
                borderRadius: "8px",
                background: tab === t ? "#ede9fe" : "#fff",
                color: tab === t ? "#4f46e5" : "#6b7280",
                fontWeight: tab === t ? 600 : 400,
                cursor: "pointer",
                fontSize: "0.875rem",
                position: "relative",
              }}
            >
              {t === "companies" ? "Компании" : "Техподдержка"}
              {t === "support" && pendingCount > 0 && (
                <span style={{
                  position: "absolute", top: "-6px", right: "-6px",
                  background: "#ef4444", color: "#fff", borderRadius: "999px",
                  fontSize: "0.65rem", fontWeight: 700, padding: "0.1rem 0.35rem",
                }}>
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {error && <div className="error-msg">{error}</div>}

        {loading ? (
          <div className={styles.loading}>Загрузка...</div>
        ) : tab === "companies" ? (
          <>
            <div className={styles.sectionHeader}>
              <div>
                <h1 className={styles.pageTitle}>Управление компаниями</h1>
                <p className={styles.pageSubtitle}>
                  {companies.length} компани{companies.length === 1 ? "я" : companies.length < 5 ? "и" : "й"} в системе
                </p>
              </div>
              <button onClick={() => setShowModal(true)} className="btn-primary">
                + Создать компанию
              </button>
            </div>

            {companies.length === 0 ? (
              <div className={styles.empty}><p>Компаний пока нет. Создайте первую компанию.</p></div>
            ) : (
              <div className={styles.grid}>
                {companies.map((company) => (
                  <div key={company.id} className={`${styles.card} ${!company.is_active ? styles.cardInactive : ""}`}>
                    <div className={styles.cardTop}>
                      <h3 className={styles.companyName}>{company.name}</h3>
                      <span className={company.is_active ? styles.statusActive : styles.statusInactive}>
                        {company.is_active ? "Активна" : "Неактивна"}
                      </span>
                    </div>
                    <p className={styles.slug}>/{company.slug}</p>
                    {company.description && <p className={styles.desc}>{company.description}</p>}
                    <p className={styles.date}>
                      Создана: {new Date(company.created_at).toLocaleDateString("ru-RU")}
                    </p>
                    <div className={styles.cardActions}>
                      {company.is_active && (
                        <button onClick={() => handleDeactivate(company.id)} className="btn-warn">
                          Деактивировать
                        </button>
                      )}
                      <button onClick={() => handleDelete(company.id)} className="btn-danger">
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Support Tab */
          <div>
            <div className={styles.sectionHeader}>
              <div>
                <h1 className={styles.pageTitle}>Режим техподдержки</h1>
                <p className={styles.pageSubtitle}>
                  Для просмотра данных компании требуется разрешение её администратора
                </p>
              </div>
            </div>

            {/* Request form */}
            <div style={{
              background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: "14px",
              padding: "1.5rem", marginBottom: "1.75rem",
            }}>
              <h3 style={{ fontWeight: 600, color: "#111827", marginBottom: "1rem" }}>
                Запросить доступ к компании
              </h3>
              <form onSubmit={handleSendRequest}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "1rem", alignItems: "flex-end" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Компания *</label>
                    <select value={reqCompanyId} onChange={(e) => setReqCompanyId(e.target.value)} required>
                      <option value="">— выбрать —</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Длительность (ч) *</label>
                    <input type="number" min={1} max={72} value={reqHours}
                      onChange={(e) => setReqHours(Number(e.target.value))} required />
                  </div>
                  <button type="submit" className="btn-primary" disabled={reqLoading}>
                    {reqLoading ? "..." : "Отправить"}
                  </button>
                </div>
                <div className="form-group" style={{ marginTop: "0.875rem", marginBottom: 0 }}>
                  <label>Причина обращения *</label>
                  <textarea rows={2} value={reqReason}
                    onChange={(e) => setReqReason(e.target.value)}
                    placeholder="Опишите техническую причину необходимости доступа..."
                    required style={{ resize: "vertical" }} />
                </div>
                {reqError && <p style={{ color: "#dc2626", fontSize: "0.875rem", marginTop: "0.5rem" }}>{reqError}</p>}
              </form>
            </div>

            {/* My requests */}
            <h3 style={{ fontWeight: 600, color: "#374151", marginBottom: "1rem" }}>
              Мои запросы
            </h3>
            {requests.length === 0 ? (
              <div style={{ color: "#9ca3af", textAlign: "center", padding: "2rem" }}>Запросов пока нет</div>
            ) : (
              requests.map((req) => (
                <div key={req.id} style={{
                  background: "#fff", border: `1.5px solid ${isActive(req) ? "#a5b4fc" : "#e5e7eb"}`,
                  borderRadius: "12px", padding: "1.25rem", marginBottom: "0.75rem",
                  ...(isActive(req) ? { boxShadow: "0 0 0 3px rgba(99,102,241,0.1)" } : {}),
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <span style={{ fontWeight: 600, color: "#111827" }}>{req.company_name}</span>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      {isExpired(req) && req.status === "approved" ? (
                        <span style={{ background: "#f3f4f6", color: "#6b7280", padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.75rem" }}>
                          Истёк
                        </span>
                      ) : (
                        <span style={{
                          padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 500,
                          background: req.status === "approved" ? "#dcfce7" : req.status === "pending" ? "#fef9c3" : "#fee2e2",
                          color: req.status === "approved" ? "#16a34a" : req.status === "pending" ? "#a16207" : "#dc2626",
                        }}>
                          {req.status === "pending" ? "Ожидает" : req.status === "approved" ? "Одобрен" : req.status === "rejected" ? "Отклонён" : "Отозван"}
                        </span>
                      )}
                    </div>
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: "0.375rem" }}>
                    {req.reason}
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                    Запрошено: {formatDate(req.requested_at)} · {req.duration_hours}ч
                    {req.expires_at && ` · Истекает: ${formatDate(req.expires_at)}`}
                    {req.reject_reason && ` · Причина отказа: ${req.reject_reason}`}
                  </p>

                  {isActive(req) && (
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.875rem" }}>
                      {supportSession?.id !== req.id ? (
                        <button className="btn-primary" style={{ fontSize: "0.78rem" }}
                          onClick={() => handleEnterSupport(req)}>
                          🛠 Войти в режим поддержки
                        </button>
                      ) : (
                        <button className="btn-secondary" style={{ fontSize: "0.78rem" }}
                          onClick={exitSupportMode}>
                          ✓ Активен — выйти из режима
                        </button>
                      )}
                      <button className="btn-danger" style={{ fontSize: "0.78rem" }}
                        onClick={() => handleRevokeOwn(req.id)}>
                        Завершить сессию
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {showModal && (
        <CreateCompanyModal onClose={() => setShowModal(false)} onCreate={handleCreate} />
      )}
    </div>
  );
};

export default SuperAdminDashboard;
