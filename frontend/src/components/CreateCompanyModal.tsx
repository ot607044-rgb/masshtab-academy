import React, { useState } from "react";
import type { CreateCompanyPayload } from "../types";
import styles from "./Modal.module.css";

interface Props {
  onClose: () => void;
  onCreate: (payload: CreateCompanyPayload) => Promise<void>;
}

const CreateCompanyModal: React.FC<Props> = ({ onClose, onCreate }) => {
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    admin_email: "",
    admin_password: "",
    admin_full_name: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === "name") {
      const autoSlug = value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      setForm((prev) => ({ ...prev, name: value, slug: autoSlug }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onCreate({
        company: {
          name: form.name,
          slug: form.slug,
          description: form.description || undefined,
        },
        admin_email: form.admin_email,
        admin_password: form.admin_password,
        admin_full_name: form.admin_full_name,
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Ошибка создания компании");
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Создать компанию</h2>
          <button onClick={onClose} className={styles.close}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <p className={styles.sectionTitle}>Данные компании</p>
          <div className="form-group">
            <label>Название компании *</label>
            <input name="name" value={form.name} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Slug (URL) *</label>
            <input name="slug" value={form.slug} onChange={handleChange} required pattern="[a-z0-9-]+"
              title="Только строчные буквы, цифры и дефисы" />
          </div>
          <div className="form-group">
            <label>Описание</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={2} />
          </div>

          <p className={styles.sectionTitle}>Администратор компании</p>
          <div className="form-group">
            <label>ФИО *</label>
            <input name="admin_full_name" value={form.admin_full_name} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Email *</label>
            <input name="admin_email" type="email" value={form.admin_email} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Пароль * (минимум 8 символов)</label>
            <input name="admin_password" type="password" value={form.admin_password}
              onChange={handleChange} required minLength={8} />
          </div>

          {error && <div className="error-msg">{error}</div>}
          <div className={styles.actions}>
            <button type="button" onClick={onClose} className="btn-secondary">Отмена</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Создание..." : "Создать компанию"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCompanyModal;
