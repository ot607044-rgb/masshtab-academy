import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  getCustomSectionBySlug,
  getSectionRecords,
  createSectionRecord,
  deleteSectionRecord,
  type CustomSection,
  type CustomSectionRecord,
} from "../api/settings";
import CreateModal from "../components/CreateModal";
import styles from "./PageContent.module.css";

const CustomSectionPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const [section, setSection] = useState<CustomSection | null>(null);
  const [records, setRecords] = useState<CustomSectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!slug) return;

    setLoading(true);
    getCustomSectionBySlug(slug)
      .then((sec) => {
        if (!sec) {
          setNotFound(true);
          return;
        }
        setSection(sec);
        return getSectionRecords(sec.id).then(setRecords);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const handleCreate = async (form: Record<string, string>) => {
    if (!section) return;
    const created = await createSectionRecord(section.id, { title: form.title });
    setRecords((prev) => [created, ...prev]);
    setShowModal(false);
  };

  const handleDelete = async (recordId: string) => {
    if (!section) return;
    if (!confirm("Удалить запись?")) return;
    await deleteSectionRecord(section.id, recordId);
    setRecords((prev) => prev.filter((r) => r.id !== recordId));
  };

  if (loading) return <div className={styles.loading}>Загрузка...</div>;
  if (notFound || !section) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Раздел не найден</h1>
        <p className={styles.subtitle}>Раздел с идентификатором «{slug}» не существует.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>
            {section.icon && <span style={{ marginRight: "0.4rem" }}>{section.icon}</span>}
            {section.name}
          </h1>
          {section.description && (
            <p className={styles.subtitle}>{section.description}</p>
          )}
        </div>
        <div className={styles.headerActions}>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            + Создать запись
          </button>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Заголовок</th>
              <th>Дата создания</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td className={styles.nameCell}>{r.title}</td>
                <td className={styles.dateCell}>
                  {new Date(r.created_at).toLocaleDateString("ru-RU")}
                </td>
                <td>
                  <button className="btn-danger" onClick={() => handleDelete(r.id)}>
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.length === 0 && (
          <div className={styles.empty}>Записей нет. Создайте первую!</div>
        )}
      </div>

      {showModal && (
        <CreateModal
          title="Новая запись"
          fields={[{ name: "title", label: "Заголовок *", required: true }]}
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
};

export default CustomSectionPage;
