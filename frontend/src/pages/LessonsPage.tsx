import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Archive, ArrowDown, ArrowUp, FileText, Folder, FolderInput, Inbox, Pencil, Plus, Send, Trash2, Video,
} from "lucide-react";
import {
  getLessons, createLesson, updateLesson, reorderLessons, publishLesson, archiveLesson, deleteLesson,
} from "../api/lessons";
import { getPositions } from "../api/positions";
import { getTopics, createTopic, updateTopic, deleteTopic, reorderTopics, getTopicPositions } from "../api/knowledge";
import type { Lesson, Position, KnowledgeTopic, TopicPositionLink, MaterialType } from "../types";
import { LESSON_STATUS_LABELS, MATERIAL_TYPE_LABELS } from "../types";
import { useAuth } from "../context/AuthContext";
import { Modal, LoadState } from "../components/AcademyUI";
import styles from "./LessonLibrary.module.css";

/** Pseudo-block that collects lessons without a topic. */
const UNASSIGNED = "unassigned";

const STATUS_CLASS: Record<string, string> = { draft: styles.draft, published: styles.published, archived: styles.archived };

const errorText = (error: unknown) =>
  (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Не удалось сохранить изменения";

function lessonWord(count: number) {
  const mod10 = count % 10, mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "урок";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "урока";
  return "уроков";
}

/** "Видеоурок · PDF ×2 · Чек-лист" */
function materialSummary(lesson: Lesson): string {
  const parts: string[] = lesson.video_url ? ["Видеоурок"] : [];
  const counts = new Map<MaterialType, number>();
  for (const type of lesson.material_types ?? []) counts.set(type, (counts.get(type) ?? 0) + 1);
  counts.forEach((count, type) => parts.push(count > 1 ? `${MATERIAL_TYPE_LABELS[type]} ×${count}` : MATERIAL_TYPE_LABELS[type]));
  return parts.join(" · ");
}

function move<T>(items: T[], index: number, delta: number): T[] {
  const next = [...items];
  [next[index], next[index + delta]] = [next[index + delta], next[index]];
  return next;
}

const LessonsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = ["company_admin", "hr", "methodologist", "super_admin"].includes(user?.role ?? "");

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [topics, setTopics] = useState<KnowledgeTopic[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [programs, setPrograms] = useState<TopicPositionLink[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [blockDialog, setBlockDialog] = useState<"create" | "edit" | null>(null);
  const [lessonDialog, setLessonDialog] = useState(false);
  const [moving, setMoving] = useState<Lesson | null>(null);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const [l, t, p, links] = await Promise.all([
        getLessons(), getTopics(), canEdit ? getPositions() : Promise.resolve([]), getTopicPositions(),
      ]);
      setLessons(l);
      setTopics(t);
      setPositions(p);
      setPrograms(links);
      setSelected(current => current && (current === UNASSIGNED || t.some((topic: KnowledgeTopic) => topic.id === current))
        ? current : t[0]?.id ?? UNASSIGNED);
    } catch {
      setLoadError("Не удалось загрузить базу знаний");
    } finally {
      setLoading(false);
    }
  }, [canEdit]);

  useEffect(() => { load(); }, [load]);

  const byBlock = useMemo(() => {
    const map = new Map<string, Lesson[]>();
    for (const lesson of lessons) {
      const key = lesson.topic_id && topics.some(t => t.id === lesson.topic_id) ? lesson.topic_id : UNASSIGNED;
      map.set(key, [...(map.get(key) ?? []), lesson]);
    }
    return map;
  }, [lessons, topics]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(errorText(e));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const topicIndex = topics.findIndex(t => t.id === selected);
  const topic = topicIndex >= 0 ? topics[topicIndex] : null;
  const blockLessons = byBlock.get(selected) ?? [];
  const blockPrograms = programs.filter(link => link.topic_id === selected);
  const unassignedCount = byBlock.get(UNASSIGNED)?.length ?? 0;

  const moveBlock = (delta: number) => run(async () => {
    const next = move(topics, topicIndex, delta);
    setTopics(next);
    await reorderTopics(next.map(t => t.id));
  });

  const moveLesson = (index: number, delta: number) => run(async () => {
    const next = move(blockLessons, index, delta);
    const order = new Map(next.map((lesson, i) => [lesson.id, i + 1]));
    setLessons(current => current.map(l => order.has(l.id) ? { ...l, sort_order: order.get(l.id)! } : l)
      .sort((a, b) => a.sort_order - b.sort_order));
    await reorderLessons(topic ? topic.id : null, next.map(l => l.id));
  });

  const saveBlock = (form: { name: string; description: string }) => run(async () => {
    const payload = { name: form.name.trim(), description: form.description.trim() || undefined };
    if (blockDialog === "edit" && topic) {
      const saved = await updateTopic(topic.id, { ...payload, description: form.description.trim() });
      setTopics(current => current.map(t => t.id === saved.id ? saved : t));
    } else {
      const created: KnowledgeTopic = await createTopic(payload);
      setTopics(current => [...current, created]);
      setSelected(created.id);
    }
    setBlockDialog(null);
  });

  const removeBlock = () => {
    if (!topic) return;
    const note = blockLessons.length ? ` ${blockLessons.length} ${lessonWord(blockLessons.length)} перейдут в «Без блока».` : "";
    if (!confirm(`Удалить блок «${topic.name}»?${note}`)) return;
    run(async () => {
      await deleteTopic(topic.id);
      setBlockDialog(null);
      setSelected(UNASSIGNED);
      await load();
    });
  };

  const addLesson = (form: Record<string, string>) => run(async () => {
    await createLesson({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      topic_id: topic?.id,
      position_id: form.position_id || undefined,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
      video_url: form.video_url.trim() || undefined,
    });
    setLessonDialog(false);
    setLessons(await getLessons());
  });

  const transferLesson = (lesson: Lesson, target: string) => run(async () => {
    await updateLesson(lesson.id, { topic_id: target === UNASSIGNED ? null : target });
    setMoving(null);
    setLessons(await getLessons());
  });

  const setStatus = (lesson: Lesson, action: "publish" | "archive" | "delete") => {
    if (action === "archive" && !confirm(`Перевести урок «${lesson.title}» в архив?`)) return;
    if (action === "delete" && !confirm(`Удалить урок «${lesson.title}»? Материалы урока тоже будут удалены.`)) return;
    run(async () => {
      if (action === "delete") {
        await deleteLesson(lesson.id);
        setLessons(current => current.filter(l => l.id !== lesson.id));
        return;
      }
      const saved = action === "publish" ? await publishLesson(lesson.id) : await archiveLesson(lesson.id);
      setLessons(current => current.map(l => l.id === saved.id ? { ...l, status: saved.status } : l));
    });
  };

  if (loading || loadError) return <div className={styles.library}><LoadState error={loadError} retry={load} /></div>;

  const blockButton = (id: string, name: string, count: number, icon: React.ReactNode) => (
    <li key={id}>
      <button className={`${styles.block} ${selected === id ? styles.blockActive : ""}`} aria-current={selected === id} onClick={() => setSelected(id)}>
        {icon}<span className={styles.blockName}>{name}</span><span className={styles.count}>{count}</span>
      </button>
    </li>
  );

  return (
    <div className={styles.library}>
      <aside className={styles.sidebar} aria-label="Блоки базы знаний">
        <div className={styles.sideHeading}><span>Блоки</span><span>{topics.length}</span></div>
        <ul className={styles.blocks}>
          {topics.map(t => blockButton(t.id, t.name, byBlock.get(t.id)?.length ?? 0, <Folder size={18} />))}
          {(canEdit || unassignedCount > 0) && blockButton(UNASSIGNED, "Без блока", unassignedCount, <Inbox size={18} />)}
        </ul>
        {canEdit && <button className={styles.dashed} onClick={() => setBlockDialog("create")}><Plus size={16} />Создать блок</button>}
      </aside>

      <section className={styles.main}>
        <header className={styles.head}>
          <div className={styles.headText}>
            <p className={styles.eyebrow}>База знаний</p>
            <h1>{topic ? topic.name : "Без блока"}</h1>
            <p className={styles.description}>
              {topic ? topic.description || (canEdit ? "Добавьте описание: чему научит этот блок" : "")
                : "Уроки, которые ещё не распределили по блокам. Перенесите их в подходящий блок."}
            </p>
          </div>
          {canEdit && topic && (
            <div className={styles.headActions}>
              <button className={styles.icon} title="Переименовать блок" aria-label="Переименовать блок" onClick={() => setBlockDialog("edit")} disabled={busy}><Pencil size={17} /></button>
              <button className={styles.icon} title="Выше в списке" aria-label="Переместить блок выше" onClick={() => moveBlock(-1)} disabled={busy || topicIndex === 0}><ArrowUp size={17} /></button>
              <button className={styles.icon} title="Ниже в списке" aria-label="Переместить блок ниже" onClick={() => moveBlock(1)} disabled={busy || topicIndex === topics.length - 1}><ArrowDown size={17} /></button>
            </div>
          )}
        </header>

        {topic && (
          <p className={styles.programs}>
            {blockPrograms.length ? <>Входит в программы обучения: {blockPrograms.map(link => (
              <span key={link.position_id} className={styles.chip}>{link.position_name}{link.is_required ? "" : " · дополнительно"}</span>
            ))}</> : "Блок пока не входит в программы обучения должностей — привязать его можно в матрице знаний."}
          </p>
        )}

        {error && <div className={styles.error} role="alert">{error}</div>}

        <div className={styles.listHead}><span>Уроков: {blockLessons.length}</span><span>В порядке изучения</span></div>

        {blockLessons.length ? (
          <ol className={styles.lessons}>
            {blockLessons.map((lesson, index) => {
              const summary = materialSummary(lesson);
              return (
                <li key={lesson.id} className={styles.lesson}>
                  <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.kind} aria-hidden="true">{lesson.video_url ? <Video size={18} /> : <FileText size={18} />}</span>
                  <div className={styles.lessonText}>
                    <button className={styles.lessonTitle} onClick={() => navigate(`/dashboard/lessons/${lesson.id}`)}>{lesson.title}</button>
                    {lesson.description && <p>{lesson.description}</p>}
                    <small>
                      {lesson.duration_minutes ? <span>{lesson.duration_minutes} мин</span> : null}
                      <span className={summary ? "" : styles.missing}>{summary || "Материалы не добавлены"}</span>
                    </small>
                  </div>
                  <span className={`${styles.status} ${STATUS_CLASS[lesson.status] ?? ""}`}>{LESSON_STATUS_LABELS[lesson.status]}</span>
                  {canEdit && (
                    <div className={styles.rowActions}>
                      <button className={styles.icon} title="Раньше" aria-label={`Переместить «${lesson.title}» выше`} onClick={() => moveLesson(index, -1)} disabled={busy || index === 0}><ArrowUp size={16} /></button>
                      <button className={styles.icon} title="Позже" aria-label={`Переместить «${lesson.title}» ниже`} onClick={() => moveLesson(index, 1)} disabled={busy || index === blockLessons.length - 1}><ArrowDown size={16} /></button>
                      <button className={styles.icon} title="Перенести в другой блок" aria-label={`Перенести «${lesson.title}» в другой блок`} onClick={() => setMoving(lesson)} disabled={busy}><FolderInput size={16} /></button>
                      {lesson.status === "draft" && <button className={styles.icon} title="Опубликовать" aria-label={`Опубликовать «${lesson.title}»`} onClick={() => setStatus(lesson, "publish")} disabled={busy}><Send size={16} /></button>}
                      {lesson.status === "published" && <button className={styles.icon} title="В архив" aria-label={`Перевести «${lesson.title}» в архив`} onClick={() => setStatus(lesson, "archive")} disabled={busy}><Archive size={16} /></button>}
                      <button className={`${styles.icon} ${styles.danger}`} title="Удалить" aria-label={`Удалить «${lesson.title}»`} onClick={() => setStatus(lesson, "delete")} disabled={busy}><Trash2 size={16} /></button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <div className={styles.empty}>
            <Inbox size={26} strokeWidth={1.5} />
            <p>{topic ? "В блоке пока нет уроков." : "Все уроки распределены по блокам."}</p>
          </div>
        )}

        {canEdit && topic && <button className={`${styles.dashed} ${styles.addLesson}`} onClick={() => setLessonDialog(true)}><Plus size={16} />Добавить урок</button>}
        {canEdit && !topic && topics.length === 0 && <p className={styles.hint}>Создайте первый блок, например «Знакомство с компанией», «Работа с клиентами» или «Работа в CRM».</p>}
      </section>

      {blockDialog && (
        <BlockDialog
          topic={blockDialog === "edit" ? topic : null}
          busy={busy}
          onClose={() => setBlockDialog(null)}
          onSave={saveBlock}
          onDelete={removeBlock}
        />
      )}
      {lessonDialog && topic && (
        <LessonDialog blockName={topic.name} positions={positions} busy={busy} onClose={() => setLessonDialog(false)} onSave={addLesson} />
      )}
      {moving && (
        <Modal title="Перенести урок" onClose={() => setMoving(null)}>
          <p className={styles.dialogNote}>«{moving.title}» окажется в конце выбранного блока.</p>
          <div className={styles.targets}>
            {[...topics.map(t => ({ id: t.id, name: t.name })), { id: UNASSIGNED, name: "Без блока" }].map(target => {
              const current = (moving.topic_id ?? UNASSIGNED) === target.id;
              return (
                <button key={target.id} className={styles.target} disabled={busy || current} onClick={() => transferLesson(moving, target.id)}>
                  {target.id === UNASSIGNED ? <Inbox size={17} /> : <Folder size={17} />}
                  <span>{target.name}</span>{current && <small>сейчас здесь</small>}
                </button>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
};

/** Modal's showModal() moves focus to the close button; focus the first field afterwards. */
function useInitialFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => ref.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  return ref;
}

function BlockDialog({ topic, busy, onClose, onSave, onDelete }: {
  topic: KnowledgeTopic | null; busy: boolean; onClose: () => void;
  onSave: (form: { name: string; description: string }) => void; onDelete: () => void;
}) {
  const [name, setName] = useState(topic?.name ?? "");
  const [description, setDescription] = useState(topic?.description ?? "");
  const nameRef = useInitialFocus<HTMLInputElement>();
  return (
    <Modal title={topic ? "Блок" : "Новый блок"} onClose={onClose}>
      <form className={styles.form} onSubmit={e => { e.preventDefault(); onSave({ name, description }); }}>
        <label>Название<input ref={nameRef} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Например, Работа с клиентами" required maxLength={255} /></label>
        <label>Описание<textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Первый контакт, выявление потребности, возражения" /></label>
        <div className={styles.formActions}>
          {topic && <button type="button" className={styles.deleteButton} onClick={onDelete} disabled={busy}><Trash2 size={15} />Удалить блок</button>}
          <button type="button" className="btn-secondary" onClick={onClose}>Отмена</button>
          <button type="submit" className={styles.primary} disabled={busy || !name.trim()}>{topic ? "Сохранить" : "Создать блок"}</button>
        </div>
      </form>
    </Modal>
  );
}

function LessonDialog({ blockName, positions, busy, onClose, onSave }: {
  blockName: string; positions: Position[]; busy: boolean; onClose: () => void; onSave: (form: Record<string, string>) => void;
}) {
  const [form, setForm] = useState({ title: "", description: "", duration_minutes: "", position_id: "", video_url: "" });
  const titleRef = useInitialFocus<HTMLInputElement>();
  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [field]: e.target.value });
  return (
    <Modal title="Новый урок" onClose={onClose}>
      <p className={styles.dialogNote}>Урок появится в конце блока «{blockName}» как черновик. Материалы можно добавить на странице урока.</p>
      <form className={styles.form} onSubmit={e => { e.preventDefault(); onSave(form); }}>
        <label>Название<input ref={titleRef} type="text" value={form.title} onChange={set("title")} required maxLength={500} /></label>
        <label>Краткое описание<input type="text" value={form.description} onChange={set("description")} /></label>
        <div className={styles.formRow}>
          <label>Длительность, мин<input type="number" min={1} value={form.duration_minutes} onChange={set("duration_minutes")} /></label>
          <label>Для должности<select value={form.position_id} onChange={set("position_id")}>
            <option value="">Для всех</option>
            {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
        </div>
        <label>Ссылка на видео<input type="url" value={form.video_url} onChange={set("video_url")} placeholder="YouTube, Rutube и др." /></label>
        <div className={styles.formActions}>
          <button type="button" className="btn-secondary" onClick={onClose}>Отмена</button>
          <button type="submit" className={styles.primary} disabled={busy || !form.title.trim()}>Добавить урок</button>
        </div>
      </form>
    </Modal>
  );
}

export default LessonsPage;
