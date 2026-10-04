import React, { useState } from "react";
import CustomFieldsTab from "./settings/CustomFieldsTab";
import CustomSectionsTab from "./settings/CustomSectionsTab";
import StatusesTab from "./settings/StatusesTab";
import IntegrationsTab from "./settings/IntegrationsTab";
import UsersAccessTab from "./settings/UsersAccessTab";
import styles from "./PageContent.module.css";

type TabKey = "access" | "fields" | "sections" | "statuses" | "integrations";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "access", label: "Пользователи и доступ", icon: "🔐" },
  { key: "fields", label: "Пользовательские поля", icon: "🏷️" },
  { key: "sections", label: "Пользовательские разделы", icon: "📂" },
  { key: "statuses", label: "Статусы и воронки", icon: "🔄" },
  { key: "integrations", label: "Интеграции", icon: "🔗" },
];

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>(() => (new URLSearchParams(window.location.search).get("tab") as TabKey) || "access");

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Настройки</h1>
          <p className={styles.subtitle}>Управление конфигурацией компании</p>
        </div>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: "0.25rem",
          borderBottom: "2px solid #e5e7eb",
          marginBottom: "1.5rem",
          overflowX: "auto",
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "0.6rem 1.1rem",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontWeight: activeTab === tab.key ? 700 : 400,
              color: activeTab === tab.key ? "#6366f1" : "#374151",
              borderBottom: activeTab === tab.key ? "2px solid #6366f1" : "2px solid transparent",
              marginBottom: "-2px",
              whiteSpace: "nowrap",
              fontSize: "0.9rem",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              transition: "color 0.15s",
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "access" && <UsersAccessTab />}
      {activeTab === "fields" && <CustomFieldsTab />}
      {activeTab === "sections" && <CustomSectionsTab />}
      {activeTab === "statuses" && <StatusesTab />}
      {activeTab === "integrations" && <IntegrationsTab />}
    </div>
  );
};

export default SettingsPage;
