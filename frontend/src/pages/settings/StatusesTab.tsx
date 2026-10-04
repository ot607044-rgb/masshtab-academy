import React, { useState, useEffect } from "react";
import {
  getStatuses,
  createStatus,
  deleteStatus,
  type Status,
} from "../../api/settings";
import CreateModal from "../../components/CreateModal";
import styles from "../PageContent.module.css";

const StatusesTab: React.FC = () => {
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = () => {
    setLoading(true);
    getStatuses()
      .then(setStatuses)
      .finally(() => setLoading(false));
  };

  const handleCreate = async (form: Record<string, string>) => {
    await createStatus({
      name: form.name,
      color: form.color || "#6366f1",
      is_final: form.is_final === "true",
      is_positive: form.is_positive === "" ? null : form.is_positive === "true",
      order_index: form.order_index ? parseInt(form.order_index, 10) : 0,
    });
    setShowModal(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить статус?")) return;
    await deleteStatus(id);
    setStatuses((prev) => prev.filter((s) => s.id !== id));
  };

  const modalFields = [
    { name: "name", label: "Название *", required: true },
    { name: "color", label: "Цвет (HEX, напр. #6366f1)" },
    { name: "order_index", label: "Порядок", type: "number" },
    {
      name: "is_final",
      label: "Финальный статус",
      type: "select",
      options: [
        { value: "false", label: "Нет" },
        { value: "true", label: "Да" },
      ],
    },
    {
      name: "is_positive",
      label: "Позитивный исход",
      type: "select",
      options: [
        { value: "", label: "Не задано" },
        { value: "true", label: "Да" },
        { value: "false", label: "Нет" },
      ],
    },
  ];

  return (
    <div>
      <div className={styles.pageHeader} style={{ marginBottom: "1rem" }}>
        <div>
          <h2 className={styles.title} style={{ fontSize: "1.2rem" }}>Статусы и воронки</h2>
        </div>
        <div className={styles.headerActions}>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            + Создать статус
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
                <th>Цвет</th>
                <th>Название</th>
                <th>Финальный</th>
                <th>Позитивный</th>
                <th>Порядок</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {statuses.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span
                      style={{
                        display: "inline-block",
                        width: "1.25rem",
                        height: "1.25rem",
                        borderRadius: "50%",
                        background: s.color ?? "#6366f1",
                        border: "1px solid rgba(0,0,0,.1)",
                        verticalAlign: "middle",
                      }}
                    />
                  </td>
                  <td className={styles.nameCell}>{s.name}</td>
                  <td>{s.is_final ? "Да" : "Нет"}</td>
                  <td>
                    {s.is_positive === null
                      ? "—"
                      : s.is_positive
                      ? "Да"
                      : "Нет"}
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
          {statuses.length === 0 && (
            <div className={styles.empty}>Статусы не созданы</div>
          )}
        </div>
      )}

      {showModal && (
        <CreateModal
          title="Новый статус"
          fields={modalFields}
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
};

export default StatusesTab;
