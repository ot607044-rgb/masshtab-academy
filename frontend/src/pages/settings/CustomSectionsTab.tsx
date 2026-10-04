import React, { useState, useEffect } from "react";
import {
  getCustomSections,
  createCustomSection,
  deleteCustomSection,
  type CustomSection,
} from "../../api/settings";
import CreateModal from "../../components/CreateModal";
import styles from "../PageContent.module.css";

const CustomSectionsTab: React.FC = () => {
  const [sections, setSections] = useState<CustomSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = () => {
    setLoading(true);
    getCustomSections()
      .then(setSections)
      .finally(() => setLoading(false));
  };

  const handleCreate = async (form: Record<string, string>) => {
    await createCustomSection({
      name: form.name,
      slug: form.slug,
      icon: form.icon || null,
      description: form.description || null,
    });
    setShowModal(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить раздел? Все записи будут также удалены.")) return;
    await deleteCustomSection(id);
    setSections((prev) => prev.filter((s) => s.id !== id));
  };

  const modalFields = [
    { name: "name", label: "Название *", required: true },
    { name: "slug", label: "Slug (URL-идентификатор) *", required: true },
    { name: "icon", label: "Иконка (эмодзи)" },
    { name: "description", label: "Описание" },
  ];

  return (
    <div>
      <div className={styles.pageHeader} style={{ marginBottom: "1rem" }}>
        <div>
          <h2 className={styles.title} style={{ fontSize: "1.2rem" }}>Пользовательские разделы</h2>
        </div>
        <div className={styles.headerActions}>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            + Создать раздел
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Иконка</th>
                <th>Название</th>
                <th>Slug</th>
                <th>Статус</th>
                <th>Порядок</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sections.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontSize: "1.4rem", textAlign: "center" }}>{s.icon ?? "📁"}</td>
                  <td className={styles.nameCell}>{s.name}</td>
                  <td><code>{s.slug}</code></td>
                  <td>
                    <span
                      className={styles.statusBadge}
                      style={{
                        background: s.is_active ? "#dcfce7" : "#f3f4f6",
                        color: s.is_active ? "#166534" : "#6b7280",
                        borderRadius: "999px",
                        padding: "0.15rem 0.6rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      {s.is_active ? "Активен" : "Скрыт"}
                    </span>
                  </td>
                  <td>{s.order_index}</td>
                  <td>
                    <button className="btn-danger" onClick={() => handleDelete(s.id)}>
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sections.length === 0 && (
            <div className={styles.empty}>Разделы не созданы</div>
          )}
        </div>
      )}

      {showModal && (
        <CreateModal
          title="Новый раздел"
          fields={modalFields}
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
};

export default CustomSectionsTab;
