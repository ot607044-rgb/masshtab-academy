import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, UserPlus, Search } from "lucide-react";
import { PageHeading, Empty, LoadState } from "../components/AcademyUI";
import { getVacancies, getCandidates, updateVacancy, apiError, STAGES, VACANCY_STATUSES, type Vacancy, type Candidate } from "../api/workspace";
import { getDepartments } from "../api/departments";
import { getPositions } from "../api/positions";
import type { Department, Position } from "../types";
import { CandidateDetail, CandidateForm, InterviewForm, VacancyForm } from "./RecruitmentForms";

const TABS = { candidates: "Кандидаты", vacancies: "Вакансии", requests: "Заявки на подбор", offers: "Офферы и выход", archive: "Архив" };
const SOURCE: Record<string, string> = { manual: "Вручную", recommendation: "Рекомендация", hh_manual: "HH · вручную", website: "Сайт" };
export default function RecruitmentPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "candidates";
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [vacancyFilter, setVacancyFilter] = useState("");
  const [form, setForm] = useState<"candidate" | "vacancy" | "request" | "interview" | null>(params.get("new") === "request" ? "request" : null);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [meetingCandidate, setMeetingCandidate] = useState<string>();
  const [saving, setSaving] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const [v, c, d, p] = await Promise.all([getVacancies(), getCandidates(), getDepartments(), getPositions()]);
    setVacancies(v); setCandidates(c); setDepartments(d); setPositions(p);
  }, []);
  const load = useCallback(() => { setLoading(true); setError(""); reload().catch(e => setError(apiError(e))).finally(() => setLoading(false)); }, [reload]);
  useEffect(load, [load]);
  function closeForm() { setForm(null); if (params.has("new")) { const next = new URLSearchParams(params); next.delete("new"); setParams(next, { replace: true }); } }
  async function changeStatus(id: string, status: Vacancy["status"]) { setSaving(id); setError(""); try { await updateVacancy(id, status); await reload(); } catch (e) { setError(apiError(e)); } finally { setSaving(null); } }
  const filtered = candidates.filter(c => (!vacancyFilter || c.vacancy_id === vacancyFilter) && `${c.full_name} ${c.email ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const card = (candidate: Candidate) => <article className="academy-candidate" key={candidate.id}><button onClick={() => setSelected(candidate)}>{candidate.full_name}</button><p>{candidate.vacancy_title ?? "Без вакансии"}</p><footer><span className="academy-badge gray">{SOURCE[candidate.source] ?? candidate.source}</span><small>{new Date(candidate.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</small></footer></article>;
  return <div className="academy-page"><PageHeading title="Подбор" subtitle="От заявки на подбор до выхода сотрудника"><button className="btn-secondary" onClick={() => setForm("request")}><Plus size={16} />Заявка на подбор</button><button className="btn-primary" onClick={() => setForm("candidate")}><UserPlus size={16} />Добавить кандидата</button></PageHeading><div className="academy-tabs" role="tablist">{Object.entries(TABS).map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setParams({ tab: key })}>{label}{key === "candidates" ? ` · ${candidates.filter(c => !["hired", "rejected"].includes(c.stage)).length}` : ""}</button>)}</div>
    {loading ? <LoadState error="" retry={load} /> : error && vacancies.length === 0 ? <LoadState error={error} retry={load} /> : <>{error && <p className="error-msg" role="alert">{error}</p>}{["candidates", "offers", "archive"].includes(tab) ? <><div className="academy-filters"><Search size={16} color="#717982" /><input type="search" aria-label="Поиск кандидатов" placeholder="Имя или email" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="Фильтр вакансии" value={vacancyFilter} onChange={e => setVacancyFilter(e.target.value)}><option value="">Все вакансии</option>{vacancies.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}</select><span className="academy-badge gray">Ручной подбор</span></div>{tab === "candidates" ? <div className="academy-kanban-scroll"><div className="academy-kanban">{Object.entries(STAGES).slice(0, 5).map(([key, label]) => <section key={key} className="academy-column" data-stage={key}><h2>{label}<span>{filtered.filter(c => c.stage === key).length}</span></h2>{filtered.filter(c => c.stage === key).map(card)}{!filtered.some(c => c.stage === key) && <Empty>Нет кандидатов</Empty>}</section>)}</div></div> : <section className="academy-section"><div className="academy-section-heading"><h2>{tab === "offers" ? "Офферы и выход" : "Завершенный подбор"}</h2></div><div className="academy-card-grid">{filtered.filter(c => tab === "offers" ? ["offer", "hired"].includes(c.stage) : ["rejected", "hired"].includes(c.stage)).map(card)}</div>{!filtered.some(c => tab === "offers" ? ["offer", "hired"].includes(c.stage) : ["rejected", "hired"].includes(c.stage)) && <Empty>Кандидатов пока нет</Empty>}</section>}</> : <section className="academy-section"><div className="academy-section-heading"><h2>{tab === "requests" ? "Заявки на подбор" : "Вакансии"}</h2><button className="btn-secondary" onClick={() => setForm(tab === "requests" ? "request" : "vacancy")}><Plus size={16} />{tab === "requests" ? "Новая заявка" : "Новая вакансия"}</button></div><div className="academy-table-wrap"><table className="academy-table"><thead><tr><th>Название</th><th>Должность</th><th>Кандидаты</th><th>Статус</th></tr></thead><tbody>{vacancies.filter(v => tab !== "requests" || v.status === "request").map(v => <tr key={v.id}><td><strong>{v.title}</strong><small>{v.description}</small></td><td>{positions.find(p => p.id === v.position_id)?.name ?? "Не указана"}</td><td>{candidates.filter(c => c.vacancy_id === v.id && !["hired", "rejected"].includes(c.stage)).length}</td><td><select aria-label={`Статус ${v.title}`} value={v.status} disabled={saving === v.id} onChange={e => changeStatus(v.id, e.target.value as Vacancy["status"])}>{Object.entries(VACANCY_STATUSES).map(([key, value]) => <option value={key} key={key}>{value}</option>)}</select></td></tr>)}</tbody></table></div>{!vacancies.some(v => tab !== "requests" || v.status === "request") && <Empty>{tab === "requests" ? "Заявок пока нет" : "Вакансий пока нет"}</Empty>}</section>}</>}
    {(form === "vacancy" || form === "request") && <VacancyForm request={form === "request"} departments={departments} positions={positions} onClose={closeForm} onSaved={reload} />}{form === "candidate" && <CandidateForm vacancies={vacancies} onClose={closeForm} onSaved={reload} />}{selected && <CandidateDetail key={selected.id} candidate={selected} onClose={() => setSelected(null)} onSaved={reload} onInterview={() => { setMeetingCandidate(selected.id); setSelected(null); setForm("interview"); }} />}{form === "interview" && <InterviewForm candidates={candidates} candidateId={meetingCandidate} onClose={closeForm} onSaved={reload} />}
  </div>;
}
