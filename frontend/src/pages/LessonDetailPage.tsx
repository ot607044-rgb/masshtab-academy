import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getLesson, addMaterialLink, uploadFileMaterial, deleteMaterial, publishLesson, archiveLesson } from "../api/lessons";
import { getEmployees } from "../api/employees";
import { createAssignment } from "../api/assignments";
import type { LessonDetail, LessonMaterial, Employee } from "../types";
import { LESSON_STATUS_LABELS, DIFFICULTY_LABELS, MATERIAL_TYPE_LABELS, MATERIAL_TYPE_ICONS } from "../types";
import { useAuth } from "../context/AuthContext";
import styles from "./PageContent.module.css";
import ls from "./LessonsPage.module.css";

const BACKEND = "http://localhost:8000";

function getVideoEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const rt = url.match(/rutube\.ru\/video\/([^/?#]+)/);
  if (rt) return `https://rutube.ru/play/embed/${rt[1]}`;
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

const LessonDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = ["company_admin", "hr", "methodologist"].includes(user?.role ?? "");
  const canAssign = ["company_admin", "hr"].includes(user?.role ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add link form
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkType, setLinkType] = useState<string>("external_link");

  // Assign form
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignEmployee, setAssignEmployee] = useState("");
  const [assignDue, setAssignDue] = useState("");
  const [assignMsg, setAssignMsg] = useState("");

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getLesson(id).then(setLesson),
      canAssign ? getEmployees().then(setEmployees) : Promise.resolve(),
    ])
      .catch(() => setError("Урок не найден или доступ запрещён"))
      .finally(() => setLoading(false));
  }, [id]);

  const reload = async () => {
    if (!id) return;
    const updated = await getLesson(id);
    setLesson(updated);
  };

  const handlePublish = async () => {
    if (!id) return;
    await publishLesson(id);
    await reload();
  };

  const handleArchive = async () => {
    if (!id || !confirm("Перевести в архив?")) return;
    await archiveLesson(id);
    await reload();
  };

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !linkUrl || !linkTitle) return;
    await addMaterialLink(id, { title: linkTitle, material_type: linkType as never, url: linkUrl });
    setLinkTitle(""); setLinkUrl(""); setShowLinkForm(false);
    await reload();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    await uploadFileMaterial(id, file, file.name);
    await reload();
    e.target.value = "";
  };

  const handleDeleteMaterial = async (matId: string) => {
    if (!id || !confirm("Удалить материал?")) return;
    await deleteMaterial(id, matId);
    await reload();
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !assignEmployee) return;
    try {
      await createAssignment({ lesson_id: id, employee_id: assignEmployee, due_date: assignDue || undefined });
      setAssignMsg("✅ Урок успешно назначен");
      setAssignEmployee(""); setAssignDue("");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setAssignMsg(`❌ ${msg || "Ошибка назначения"}`);
    }
  };

  if (loading) return <div className={styles.page}><div className={styles.loading}>Загрузка...</div></div>;
  if (error || !lesson) return <div className={styles.page}><div className="error-msg">{error || "Урок не найден"}</div></div>;

  const embedUrl = lesson.video_url ? getVideoEmbedUrl(lesson.video_url) : null;
  const STATUS_COLOR: Record<string, string> = { draft: "statusYellow", published: "statusGreen", archived: "statusRed" };

  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate(-1)}>← Назад</button>

      {/* Header */}
      <div className={ls.detailHeader}>
        <div className={ls.detailMeta}>
          <span className={`${styles.statusBadge} ${styles[STATUS_COLOR[lesson.status] || "statusYellow"]}`}>
            {LESSON_STATUS_LABELS[lesson.status]}
          </span>
          {lesson.difficulty_level && (
            <span>{DIFFICULTY_LABELS[lesson.difficulty_level as keyof typeof DIFFICULTY_LABELS] ?? lesson.difficulty_level}</span>
          )}
          {lesson.duration_minutes && <span>⏱ {lesson.duration_minutes} мин</span>}
        </div>

        <h1 className={ls.detailTitle}>{lesson.title}</h1>
        {lesson.description && <p className={ls.detailDesc}>{lesson.description}</p>}

        {canEdit && (
          <div className={ls.detailActions}>
            {lesson.status === "draft" && (
              <button className="btn-primary" onClick={handlePublish}>Опубликовать</button>
            )}
            {lesson.status === "published" && (
              <button className="btn-warn" onClick={handleArchive}>В архив</button>
            )}
          </div>
        )}
      </div>

      {/* Video */}
      {lesson.video_url && (
        <div className={ls.videoWrap}>
          <h2>🎬 Видео</h2>
          {embedUrl ? (
            <div className={ls.videoEmbed}>
              <iframe src={embedUrl} allowFullScreen title="lesson-video" />
            </div>
          ) : (
            <a href={lesson.video_url} target="_blank" rel="noreferrer" className={ls.videoLink}>
              🔗 Открыть видео
            </a>
          )}
        </div>
      )}

      {/* Text content */}
      {lesson.text_content && (
        <div className={ls.contentSection}>
          <h2>📝 Текст урока</h2>
          <div className={ls.textContent}>{lesson.text_content}</div>
        </div>
      )}

      {/* External links */}
      {lesson.external_links && lesson.external_links.length > 0 && (
        <div className={ls.contentSection}>
          <h2>🔗 Внешние ссылки</h2>
          {lesson.external_links.map((lnk, i) => (
            <div key={i} className={ls.materialItem}>
              <span className={ls.materialIcon}>🔗</span>
              <div className={ls.materialInfo}>
                <div className={ls.materialTitle}>{lnk.title}</div>
                <a href={lnk.url} target="_blank" rel="noreferrer" className={ls.materialLink}>
                  {lnk.url}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Materials */}
      <div className={ls.contentSection}>
        <h2>📎 Материалы ({lesson.materials.length})</h2>

        {lesson.materials.map((mat) => (
          <div key={mat.id} className={ls.materialItem}>
            <span className={ls.materialIcon}>{MATERIAL_TYPE_ICONS[mat.material_type]}</span>
            <div className={ls.materialInfo}>
              <div className={ls.materialTitle}>{mat.title}</div>
              <div className={ls.materialMeta}>
                {MATERIAL_TYPE_LABELS[mat.material_type]}
                {mat.file_size ? ` · ${formatBytes(mat.file_size)}` : ""}
              </div>
            </div>
            {mat.url && (
              <a
                href={mat.url.startsWith("/uploads/") ? `${BACKEND}${mat.url}` : mat.url}
                target="_blank"
                rel="noreferrer"
                className={ls.materialLink}
                onClick={(e) => e.stopPropagation()}
              >
                Открыть
              </a>
            )}
            {canEdit && (
              <button className="btn-danger" style={{ fontSize: "0.75rem" }}
                onClick={() => handleDeleteMaterial(mat.id)}>
                ✕
              </button>
            )}
          </div>
        ))}

        {canEdit && (
          <>
            {/* Add link */}
            {showLinkForm ? (
              <form onSubmit={handleAddLink} style={{ marginTop: "1rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="form-group">
                    <label>Название *</label>
                    <input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Тип материала</label>
                    <select value={linkType} onChange={(e) => setLinkType(e.target.value)}>
                      <option value="external_link">Внешняя ссылка</option>
                      <option value="video_link">Видео</option>
                      <option value="checklist">Чек-лист</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>URL *</label>
                  <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} required placeholder="https://..." />
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button type="submit" className="btn-primary">Добавить</button>
                  <button type="button" className="btn-secondary" onClick={() => setShowLinkForm(false)}>Отмена</button>
                </div>
              </form>
            ) : (
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                <button className="btn-secondary" onClick={() => setShowLinkForm(true)}>
                  + Добавить ссылку
                </button>
                <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
                  + Загрузить файл
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: "none" }}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.ppt,.pptx,.txt"
                  onChange={handleFileUpload}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Assign lesson */}
      {canAssign && lesson.status === "published" && (
        <div className={ls.contentSection}>
          <h2>📋 Назначить урок сотруднику</h2>
          <form onSubmit={handleAssign}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "1rem", alignItems: "flex-end" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Сотрудник *</label>
                <select value={assignEmployee} onChange={(e) => setAssignEmployee(e.target.value)} required>
                  <option value="">— выбрать —</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Срок выполнения</label>
                <input type="date" value={assignDue} onChange={(e) => setAssignDue(e.target.value)} />
              </div>
              <button type="submit" className="btn-primary">Назначить</button>
            </div>
          </form>
          {assignMsg && <p style={{ marginTop: "0.75rem", fontSize: "0.875rem" }}>{assignMsg}</p>}
        </div>
      )}
    </div>
  );
};

export default LessonDetailPage;
