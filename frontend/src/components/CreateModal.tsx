import React, { useState } from "react";
import styles from "./Modal.module.css";

interface FieldOption { value: string; label: string }

interface Field {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: FieldOption[];
}

interface Props {
  title: string;
  fields: Field[];
  onClose: () => void;
  onCreate: (form: Record<string, string>) => Promise<void>;
  extraContent?: React.ReactNode;
}

const CreateModal: React.FC<Props> = ({ title, fields, onClose, onCreate, extraContent }) => {
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, f.options?.[0]?.value ?? ""]))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onCreate(form);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Ошибка создания");
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>{title}</h2>
          <button onClick={onClose} className={styles.close}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          {fields.map((field) => (
            <div className="form-group" key={field.name}>
              <label>{field.label}</label>
              {field.type === "select" ? (
                <select
                  value={form[field.name] ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, [field.name]: e.target.value }))}
                >
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type ?? "text"}
                  value={form[field.name] ?? ""}
                  required={field.required}
                  onChange={(e) => setForm((p) => ({ ...p, [field.name]: e.target.value }))}
                />
              )}
            </div>
          ))}
          {extraContent}
          {error && <div className="error-msg">{error}</div>}
          <div className={styles.actions}>
            <button type="button" onClick={onClose} className="btn-secondary">Отмена</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Сохранение..." : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateModal;
