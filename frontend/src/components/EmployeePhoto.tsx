import { useEffect, useRef, useState } from "react";
import { Camera, Trash2, User } from "lucide-react";
import type { Employee } from "../types";
import { deleteEmployeePhoto, getEmployeePhoto, uploadEmployeePhoto } from "../api/employees";
import { apiError } from "../api/workspace";
import styles from "./EmployeePhoto.module.css";

export function EmployeeAvatar({ employee, large = false }: { employee: Pick<Employee, "full_name" | "photo_url">; large?: boolean }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    setSrc("");
    if (employee.photo_url) getEmployeePhoto(employee.photo_url).then(blob => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    }).catch(() => setSrc(""));
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [employee.photo_url]);
  return <span className={`${styles.avatar} ${large ? styles.large : ""}`}>{src ? <img src={src} alt={`Фото ${employee.full_name}`} onError={() => setSrc("")} /> : <User size={large ? 72 : 18} aria-hidden="true" />}</span>;
}

export default function EmployeePhoto({ employee, editable, onUpdated }: { employee: Employee; editable: boolean; onUpdated: (employee: Employee) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    if (file.size > 5 * 1024 * 1024) { setError("Размер фотографии не должен превышать 5 МБ"); return; }
    setBusy(true);
    try { onUpdated(await uploadEmployeePhoto(employee.id, file)); }
    catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  }
  async function remove() {
    setError(""); setBusy(true);
    try { onUpdated(await deleteEmployeePhoto(employee.id)); }
    catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  }
  return <div className={styles.photo}><EmployeeAvatar employee={employee} large /><div>{editable && <><input ref={input} type="file" hidden aria-label="Загрузить фото сотрудника" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void upload(file); }} /><div className={styles.actions}><button type="button" className="btn-secondary" disabled={busy} onClick={() => input.current?.click()}><Camera size={16} aria-hidden="true" />{busy ? "Сохранение..." : employee.photo_url ? "Заменить фото" : "Загрузить фото"}</button>{employee.photo_url && <button type="button" className="btn-secondary" disabled={busy} aria-label="Удалить фото" title="Удалить фото" onClick={() => void remove()}><Trash2 size={16} aria-hidden="true" /></button>}</div></>}{error && <p className="error-msg" role="alert">{error}</p>}</div></div>;
}
