import React, { useState, useEffect } from "react";
import { getIntegrations, type Integration } from "../../api/settings";
import styles from "../PageContent.module.css";

interface IntegrationCard {
  provider: string;
  label: string;
  icon: string;
  description: string;
}

const KNOWN_INTEGRATIONS: IntegrationCard[] = [
  {
    provider: "hh.ru",
    label: "hh.ru",
    icon: "🔴",
    description: "Синхронизация вакансий и кандидатов из HeadHunter",
  },
];

const IntegrationsTab: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getIntegrations()
      .then(setIntegrations)
      .finally(() => setLoading(false));
  }, []);

  const findActive = (provider: string) =>
    integrations.find((i) => i.provider === provider);

  const statusLabel = (status: string) => {
    if (status === "active") return "Подключено";
    if (status === "error") return "Ошибка";
    return "Не подключено";
  };

  const statusColor = (status: string) => {
    if (status === "active") return { background: "#dcfce7", color: "#166534" };
    if (status === "error") return { background: "#fee2e2", color: "#991b1b" };
    return { background: "#f3f4f6", color: "#6b7280" };
  };

  return (
    <div>
      <div className={styles.pageHeader} style={{ marginBottom: "1.5rem" }}>
        <div>
          <h2 className={styles.title} style={{ fontSize: "1.2rem" }}>Интеграции</h2>
          <p className={styles.subtitle}>Подключите внешние сервисы для автоматической синхронизации данных</p>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1rem",
          }}
        >
          {KNOWN_INTEGRATIONS.map((card) => {
            const active = findActive(card.provider);
            const currentStatus = active?.status ?? "inactive";

            return (
              <div
                key={card.provider}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.75rem",
                  padding: "1.25rem",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,.06)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ fontSize: "2rem" }}>{card.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "1rem" }}>{card.label}</div>
                    <span
                      style={{
                        ...statusColor(currentStatus),
                        borderRadius: "999px",
                        padding: "0.1rem 0.5rem",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                      }}
                    >
                      {statusLabel(currentStatus)}
                    </span>
                  </div>
                </div>

                <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: 0 }}>
                  {card.description}
                </p>

                <div title="OAuth-интеграция с hh.ru будет доступна в следующем обновлении">
                  <button
                    className="btn-secondary"
                    disabled
                    style={{ width: "100%", opacity: 0.6, cursor: "not-allowed" }}
                  >
                    Настроить (скоро)
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default IntegrationsTab;
