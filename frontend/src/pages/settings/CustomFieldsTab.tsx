import React, { useState, useEffect } from "react";
import {
  getCustomFields,
  createCustomField,
  deleteCustomField,
  type CustomField,
} from "../../api/settings";
import CreateModal from "../../components/CreateModal";
import styles from "../PageContent.module.css";

const ENTITY_TYPES = [
  { value: "", label: "Все типы" },
  { value: "employee", label: "Сотрудник" },
  { value: "vacancy", label: "Вакансия" },
  { value: "candidate", label: "Кандидат" },
  { value: "response", label: "Отклик" },
  { value: "lesson", label: "Урок" },
  { value: "test", label: "Тест" },
  { value: "custom_section", label: "Пользовательский раздел" },
];

const FIELD_TYPES = [
  { value: "string", label: "Строка" },
  { value: "text", label: "Текст" },
  { value: "number", label: "Число" },
  { value: "date", label: "Дата" },
  { value: "list", label: "Список" },
  { value: "multi_list", label: "Множественный список" },
  { value: "checkbox", label: "Чекбокс" },
  { value: "file", label: "Файл" },
  { value: "link", label: "Ссылка" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Телефон" },
  { value: "status", label: "Статус" },
  { value: "user", label: "Пользователь" },
];

const CustomFieldsTab: React.FC = () => {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterEntity, setFilterEntity] = useState("");

  useEffect(() => {
    load();
  }, []);

  const load = () => {
    setLoading(true);
    getCustomFields()
      .then(setFields)
      .finally(() => setLoading(false));
  };

  const handleCreate = async (form: Record<string, string>) => {
    await createCustomField({
      name: form.name,
      field_type: form.field_type,
      entity_type: form.entity_type,
      is_required: form.is_required === "true",
    });
    setShowModal(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить поле?")) return;
    await deleteCustomField(id);
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const filtered = filterEntity ? fields.filter((f) => f.entity_type === filterEntity) : fields;

  const entityLabel = (v: string) =>
    ENTITY_TYPES.find((e) => e.value === v)?.label ?? v;
  const fieldTypeLabel = (v: string) =>
    FIELD_TYPES.find((t) => t.value === v)?.label ?? v;

  const modalFields = [
    { name: "name", label: "Название *", required: true },
    {
      name: "field_type",
      label: "Тип поля",
      type: "select",
      options: FIELD_TYPES,
    },
    {
      name: "entity_type",
      label: "Тип сущности",
      type: "select",
      options: ENTITY_TYPES.filter((e) => e.value),
    },
    {
      name: "is_required",
      label: "Обязательное",
      type: "select",
      options: [
        { value: "false", label: "Нет" },
        { value: "true", label: "Да" },
      ],
    },
  ];

  return (
    <div>
      <div className={styles.pageHeader} style={{ marginBottom: "1rem" }}>
        <div>
          <h2 className={styles.title} style={{ fontSize: "1.2rem" }}>Пользовательские поля</h2>
        </div>
        <div className={styles.headerActions}>
          <select
            className={styles.filterSelect}
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
          >
            {ENTITY_TYPES.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            + Добавить поле
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
                <th>Название</th>
                <th>Тип поля</th>
                <th>Тип сущности</th>
                <th>Обязательное</th>
                <th>Порядок</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.id}>
                  <td className={styles.nameCell}>{f.name}</td>
                  <td>{fieldTypeLabel(f.field_type)}</td>
                  <td>{entityLabel(f.entity_type)}</td>
                  <td>{f.is_required ? "Да" : "Нет"}</td>
                  <td>{f.order_index}</td>
                  <td>
                    <button className="btn-danger" onClick={() => handleDelete(f.id)}>
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className={styles.empty}>Поля не найдены</div>
          )}
        </div>
      )}

      {showModal && (
        <CreateModal
          title="Новое поле"
          fields={modalFields}
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
};

export default CustomFieldsTab;
