import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getWorkspace, apiError, type Workspace } from "../api/workspace";
import { PageHeading, Metrics, LoadState, Empty, ProgressBar } from "../components/AcademyUI";

export default function QualificationPage() {
  const [data, setData] = useState<Workspace>();
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [weakOnly, setWeakOnly] = useState(false);
  const load = useCallback(() => { setError(""); getWorkspace().then(setData).catch(e => setError(apiError(e))); }, []);
  useEffect(load, [load]);
  const tested = data?.employees.filter(e => e.knowledge_percent !== null) ?? [];
  const rows = data?.employees.filter(e => e.full_name.toLowerCase().includes(search.toLowerCase()) && (!weakOnly || e.weak_areas.length)) ?? [];
  return <div className="academy-page"><PageHeading title="Квалификация" subtitle="Диагностика знаний и результаты обучения" />{!data ? <LoadState error={error} retry={load} /> : <><Metrics items={[{ label: "Сотрудники", value: data.employees.length }, { label: "Прошли диагностику", value: tested.length }, { label: "Средний результат", value: tested.length ? `${Math.round(tested.reduce((sum, e) => sum + (e.knowledge_percent ?? 0), 0) / tested.length)}%` : "Нет данных" }, { label: "Есть слабые темы", value: data.employees.filter(e => e.weak_areas.length).length, warning: true }]} /><div className="academy-filters"><input type="search" aria-label="Поиск сотрудников" placeholder="Поиск сотрудника" value={search} onChange={e => setSearch(e.target.value)} /><label style={{ fontSize: 12 }}><input type="checkbox" checked={weakOnly} onChange={e => setWeakOnly(e.target.checked)} /> Только со слабыми темами</label></div><section className="academy-section"><div className="academy-table-wrap"><table className="academy-table"><thead><tr><th>Сотрудник</th><th>Знания</th><th>Обучение</th><th>Слабые темы</th></tr></thead><tbody>{rows.map(e => <tr key={e.employee_id}><td><Link to={`/dashboard/employees/${e.employee_id}`}>{e.full_name}</Link><small>{e.position_name ?? "Должность не указана"}</small></td><td>{e.knowledge_percent === null ? "Нет результатов" : `${e.knowledge_percent}%`}{e.knowledge_percent !== null && <ProgressBar value={e.knowledge_percent} danger={e.weak_areas.length > 0} />}</td><td>{e.lessons_completed} из {e.lessons_total}</td><td>{e.weak_areas.length ? <span className="academy-badge amber">{e.weak_areas.join(", ")}</span> : "Не выявлены"}</td></tr>)}</tbody></table></div>{!rows.length && <Empty>Сотрудники не найдены</Empty>}</section></>}</div>;
}
