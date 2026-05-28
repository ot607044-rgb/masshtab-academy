import React, { useState, useEffect } from "react";
import {
  getPendingRequests, getSupportHistory,
  approveRequest, rejectRequest, revokeSession,
  getSessionLogs,
} from "../api/support";
import type { SupportRequest, SupportAccessLog } from "../types";
import { SUPPORT_STATUS_LABELS, SUPPORT_STATUS_COLORS } from "../types";
import styles from "./PageContent.module.css";

const SupportRequestsPage: React.FC = () => {
  const [pending, setPending] = useState<SupportRequest[]>([]);
  const [history, setHistory] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [logsMap, setLogsMap] = useState<Record<string, SupportAccessLog[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const reload = async () => {
    const [p, h] = await Promise.all([getPendingRequests(), getSupportHistory()]);
    setPending(p);
    setHistory(h);
  };

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  const handleApprove = async (id: string, hours: number) => {
    await approveRequest(id, hours);
    await reload();
  };

  const handleReject = async () => {
    if (!rejectId) return;
    await rejectRequest(rejectId, rejectReason || undefined);
    setRejectId(null);
    setRejectReason("");
    await reload();
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Отозвать доступ сейчас?")) return;
    await revokeSession(id);
    await reload();
  };

  const toggleLogs = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    if (!logsMap[id]) {
      const logs = await getSessionLogs(id);
      setLogsMap((prev) => ({ ...prev, [id]: logs }));
    }
    setExpandedId(id);
  };

  const formatDate = (s: string) =>
    new Date(s).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const isExpired = (req: SupportRequest) =>
    req.expires_at && new Date(req.expires_at) < new Date();

  const RequestCard: React.FC<{ req: SupportRequest }> = ({ req }) => {
    const [approveHours, setApproveHours] = useState(req.duration_hours);
    const statusKey = isExpired(req) && req.status === "approved" ? "revoked" : req.status;

    return (
      <div style={{
        background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: "12px",
        padding: "1.25rem", marginBottom: "0.875rem",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
          <div>
            <span style={{ fontWeight: 600, color: "#111827" }}>{req.super_admin_name ?? "Super Admin"}</span>
            <span style={{ color: "#9ca3af", fontSize: "0.8rem", marginLeft: "0.5rem" }}>
              {formatDate(req.requested_at)}
            </span>
          </div>
          <span className={`${styles.statusBadge} ${styles[SUPPORT_STATUS_COLORS[statusKey as keyof typeof SUPPORT_STATUS_COLORS] ?? "statusYellow"]}`}>
            {isExpired(req) && req.status === "approved" ? "Истёк" : SUPPORT_STATUS_LABELS[req.status]}
          </span>
        </div>

        <p style={{ fontSize: "0.875rem", color: "#374151", marginBottom: "0.5rem" }}>
          <strong>Причина:</strong> {req.reason}
        </p>
        <p style={{ fontSize: "0.8rem", color: "#6b7280" }}>
          Запрошено: {req.duration_hours}ч
          {req.expires_at && ` · Истекает: ${formatDate(req.expires_at)}`}
          {req.reject_reason && ` · Причина отказа: ${req.reject_reason}`}
        </p>

        {req.status === "pending" && (
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", alignItems: "center" }}>
            <label style={{ fontSize: "0.8rem", color: "#6b7280" }}>Длительность (ч):</label>
            <input
              type="number" min={1} max={72} value={approveHours}
              onChange={(e) => setApproveHours(Number(e.target.value))}
              style={{ width: "60px", padding: "0.3rem 0.5rem", border: "1.5px solid #d1d5db", borderRadius: "6px", fontSize: "0.875rem" }}
            />
            <button className="btn-primary" style={{ fontSize: "0.78rem" }}
              onClick={() => handleApprove(req.id, approveHours)}>
              Одобрить
            </button>
            <button className="btn-danger" style={{ fontSize: "0.78rem" }}
              onClick={() => setRejectId(req.id)}>
              Отклонить
            </button>
          </div>
        )}

        {req.status === "approved" && !isExpired(req) && (
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <button className="btn-warn" style={{ fontSize: "0.78rem" }}
              onClick={() => handleRevoke(req.id)}>
              Отозвать доступ
            </button>
            <button className="btn-secondary" style={{ fontSize: "0.78rem" }}
              onClick={() => toggleLogs(req.id)}>
              {expandedId === req.id ? "Скрыть журнал" : `Журнал (${req.logs_count})`}
            </button>
          </div>
        )}

        {req.status !== "pending" && req.status !== "approved" && (
          <button className="btn-secondary" style={{ fontSize: "0.78rem", marginTop: "0.75rem" }}
            onClick={() => toggleLogs(req.id)}>
            {expandedId === req.id ? "Скрыть журнал" : `Журнал (${req.logs_count})`}
          </button>
        )}

        {expandedId === req.id && logsMap[req.id] && (
          <div style={{
            marginTop: "0.875rem", background: "#f9fafb", borderRadius: "8px",
            padding: "0.875rem", maxHeight: "240px", overflowY: "auto",
          }}>
            {logsMap[req.id].length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: "0.8rem" }}>Обращений не зафиксировано</p>
            ) : logsMap[req.id].map((log) => (
              <div key={log.id} style={{ display: "flex", gap: "1rem", fontSize: "0.78rem", color: "#374151", marginBottom: "0.375rem" }}>
                <span style={{ color: "#9ca3af", whiteSpace: "nowrap" }}>{formatDate(log.accessed_at)}</span>
                <span style={{ fontFamily: "monospace", color: "#6366f1" }}>{log.method}</span>
                <span style={{ fontFamily: "monospace" }}>{log.endpoint}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Запросы техподдержки</h1>
      <p className={styles.subtitle}>
        Управление доступом Super Admin к данным вашей компании
      </p>

      <div style={{
        background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: "10px",
        padding: "0.875rem 1.25rem", marginBottom: "1.5rem", fontSize: "0.875rem", color: "#92400e",
      }}>
        ⚠️ Одобряя запрос, вы разрешаете администратору платформы временный доступ к данным вашей компании.
        Все действия фиксируются в журнале. Вы можете отозвать доступ в любой момент.
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {(["pending", "history"] as const).map((t) => (
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
            }}
          >
            {t === "pending" ? `Ожидают ответа (${pending.length})` : "История"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : tab === "pending" ? (
        pending.length === 0 ? (
          <div className={styles.emptyWide}>Нет ожидающих запросов</div>
        ) : (
          pending.map((req) => <RequestCard key={req.id} req={req} />)
        )
      ) : (
        history.length === 0 ? (
          <div className={styles.emptyWide}>Запросов ещё не было</div>
        ) : (
          history.map((req) => <RequestCard key={req.id} req={req} />)
        )
      )}

      {/* Reject modal */}
      {rejectId && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div style={{ background: "#fff", borderRadius: "14px", padding: "2rem", width: "420px" }}>
            <h3 style={{ marginBottom: "1rem", color: "#111827" }}>Отклонить запрос</h3>
            <div className="form-group">
              <label>Причина отказа (необязательно)</label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Укажите причину..."
                style={{ resize: "vertical" }}
              />
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1rem" }}>
              <button className="btn-secondary" onClick={() => { setRejectId(null); setRejectReason(""); }}>
                Отмена
              </button>
              <button className="btn-danger" onClick={handleReject}>
                Отклонить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportRequestsPage;
