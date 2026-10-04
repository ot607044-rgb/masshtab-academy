import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, Lock, LockOpen, Send } from "lucide-react";
import { ACCESS_STATUS_LABELS, COMPANY_ROLES, getAccessUsers, resendInvitation, updateAccess, type AccessStatus, type AccessUser, type InvitationIssued } from "../../api/access";
import { getEmployees } from "../../api/employees";
import { apiError } from "../../api/workspace";
import { useAuth } from "../../context/AuthContext";
import { AccessBadge, GrantAccessModal, InviteLinkModal, RoleSelect } from "../../components/AccessControls";
import { Empty, LoadState, Metrics, dateLabel } from "../../components/AcademyUI";
import type { Employee } from "../../types";

type Filter = "all" | AccessStatus | "without";

export default function UsersAccessTab() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AccessUser[]>();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState<string>();
  const [filter, setFilter] = useState<Filter>("all");
  const [granting, setGranting] = useState<Employee>();
  const [issued, setIssued] = useState<InvitationIssued>();

  const load = useCallback(() => {
    setError("");
    Promise.all([getAccessUsers(), getEmployees()]).then(([accounts, staff]) => { setUsers(accounts); setEmployees(staff); }).catch(e => setError(apiError(e)));
  }, []);
  useEffect(load, [load]);

  const withoutAccess = useMemo(() => {
    const linked = new Set((users ?? []).map(u => u.employee_id));
    return employees.filter(e => e.status !== "fired" && !linked.has(e.id));
  }, [users, employees]);

  if (!users) return <LoadState error={error} retry={load} />;

  const replace = (updated: AccessUser) => setUsers(list => list?.map(u => u.id === updated.id ? updated : u));
  async function run(id: string, action: () => Promise<AccessUser | InvitationIssued>) {
    setBusy(id); setActionError("");
    try {
      const result = await action();
      if ("invite_path" in result) { setIssued(result); replace(result.user); } else replace(result);
    } catch (e) { setActionError(apiError(e)); } finally { setBusy(undefined); }
  }
  const count = (status: AccessStatus) => users.filter(u => u.status === status).length;
  const filters: [Filter, string][] = [["all", `Все · ${users.length}`], ["active", `${ACCESS_STATUS_LABELS.active} · ${count("active")}`], ["invited", `${ACCESS_STATUS_LABELS.invited} · ${count("invited") + count("invite_expired")}`], ["blocked", `${ACCESS_STATUS_LABELS.blocked} · ${count("blocked")}`], ["without", `Без доступа · ${withoutAccess.length}`]];
  const shown = users.filter(u => filter === "all" || u.status === filter || (filter === "invited" && u.status === "invite_expired"));

  return <div>
    <Metrics items={[
      { label: "Подключены", value: count("active"), note: "Входили по своему паролю" },
      { label: "Приглашены", value: count("invited") + count("invite_expired"), note: count("invite_expired") ? `Истекло: ${count("invite_expired")}` : "Ждут, когда зададут пароль", warning: count("invite_expired") > 0 },
      { label: "Заблокированы", value: count("blocked"), note: "Вход отключён, история сохранена" },
      { label: "Без доступа", value: withoutAccess.length, note: "Карточки без учётной записи" },
    ]} />
    <details style={{ margin: "16px 0", fontSize: 13 }}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>Что видит каждая роль</summary>
      <dl className="academy-profile" style={{ marginTop: 10 }}>{COMPANY_ROLES.map(r => <Fragment key={r.value}><dt>{r.label}</dt><dd>{r.hint}</dd></Fragment>)}</dl>
    </details>
    <div className="academy-tabs" role="tablist">{filters.map(([key, label]) => <button key={key} role="tab" aria-selected={filter === key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label}</button>)}</div>
    {actionError && <p className="error-msg" role="alert">{actionError}</p>}

    {filter === "without" ? <section className="academy-section">
      {withoutAccess.length ? <div className="academy-table-wrap"><table className="academy-table"><thead><tr><th>Сотрудник</th><th>Email в карточке</th><th></th></tr></thead><tbody>
        {withoutAccess.map(e => <tr key={e.id}><td><Link to={`/dashboard/employees/${e.id}`}>{e.full_name}</Link></td><td>{e.email ?? "Не указан"}</td><td style={{ textAlign: "right" }}><button type="button" className="btn-secondary" onClick={() => setGranting(e)}><KeyRound size={16} />Предоставить доступ</button></td></tr>)}
      </tbody></table></div> : <Empty>У всех действующих сотрудников есть учётная запись</Empty>}
    </section> : <section className="academy-section">
      {shown.length ? <div className="academy-table-wrap"><table className="academy-table"><thead><tr><th>Пользователь</th><th>Роль</th><th>Статус</th><th>Последний вход</th><th></th></tr></thead><tbody>
        {shown.map(u => {
          const self = u.id === me?.id;
          const fired = u.employee_status === "fired";
          return <tr key={u.id}>
            <td>{u.employee_id ? <Link to={`/dashboard/employees/${u.employee_id}`}>{u.full_name}</Link> : u.full_name}<small>{u.email}{!u.employee_id && " · без карточки сотрудника"}{fired && " · уволен"}</small></td>
            <td><RoleSelect value={u.role} disabled={self || busy === u.id} onChange={role => run(u.id, () => updateAccess(u.id, { role }))} /></td>
            <td><AccessBadge user={u} />{u.invitation_expires_at && <small>до {dateLabel(u.invitation_expires_at)}</small>}</td>
            <td>{u.last_login_at ? dateLabel(u.last_login_at) : "—"}</td>
            <td><div className="academy-actions" style={{ justifyContent: "flex-end" }}>
              {(u.status === "invited" || u.status === "invite_expired") && <button type="button" className="btn-secondary" title="Создать новую ссылку-приглашение" disabled={busy === u.id} onClick={() => run(u.id, () => resendInvitation(u.id))}><Send size={16} />Ссылка</button>}
              {!self && (u.status === "blocked"
                ? !fired && <button type="button" className="btn-secondary" disabled={busy === u.id} onClick={() => run(u.id, () => updateAccess(u.id, { is_active: true }))}><LockOpen size={16} />Разблокировать</button>
                : <button type="button" className="btn-secondary" disabled={busy === u.id} onClick={() => confirm(`Заблокировать вход для ${u.full_name}? История сохранится.`) && run(u.id, () => updateAccess(u.id, { is_active: false }))}><Lock size={16} />Заблокировать</button>)}
            </div></td>
          </tr>;
        })}
      </tbody></table></div> : <Empty>В этой группе пока никого нет</Empty>}
    </section>}

    {granting && <GrantAccessModal employee={granting} onClose={() => setGranting(undefined)} onIssued={result => { setGranting(undefined); setIssued(result); setUsers(list => [...(list ?? []), result.user]); }} />}
    {issued && <InviteLinkModal issued={issued} onClose={() => setIssued(undefined)} />}
  </div>;
}
