import React, { useId, useState } from "react";
import styles from "./Modal.module.css";

interface FieldOption { value: string; label: string }

interface Field {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: FieldOption[];
  maxLength?: number;
}

interface Props {
  title: string;
  fields: Field[];
  onClose: () => void;
  onCreate: (form: Record<string, string>) => Promise<void>;
  extraContent?: React.ReactNode;
  initialValues?: Record<string, string>;
  submitLabel?: string;
  errorMessage?: string;
}

const CreateModal: React.FC<Props> = ({ title, fields, onClose, onCreate, extraContent, initialValues, submitLabel = "Создать", errorMessage = "Ошибка создания" }) => {
  const formId = useId();
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, initialValues?.[f.name] ?? f.options?.[0]?.value ?? ""]))
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
      setError(typeof msg === "string" ? msg : errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={`${formId}-title`}>
        <div className={styles.header}>
          <h2 id={`${formId}-title`}>{title}</h2>
          <button onClick={onClose} disabled={loading} aria-label="Закрыть" className={styles.close}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          {fields.map((field) => (
            <div className="form-group" key={field.name}>
              <label htmlFor={`${formId}-${field.name}`}>{field.label}</label>
              {field.type === "select" ? (
                <select
                  id={`${formId}-${field.name}`}
                  value={form[field.name] ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, [field.name]: e.target.value }))}
                >
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  id={`${formId}-${field.name}`}
                  type={field.type ?? "text"}
                  value={form[field.name] ?? ""}
                  required={field.required}
                  maxLength={field.maxLength}
                  onChange={(e) => setForm((p) => ({ ...p, [field.name]: e.target.value }))}
                />
              )}
            </div>
          ))}
          {extraContent}
          {error && <div className="error-msg">{error}</div>}
          <div className={styles.actions}>
            <button type="button" onClick={onClose} disabled={loading} className="btn-secondary">Отмена</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Сохранение..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateModal;
