import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Copy, KeyRound, Lock, LockOpen, Send } from "lucide-react";
import {
  ACCESS_STATUS_LABELS, ACCESS_STATUS_TONE, COMPANY_ROLES, getEmployeeAccess, grantAccess, inviteUrl, resendInvitation, updateAccess,
  type AccessUser, type InvitationIssued,
} from "../api/access";
import { apiError } from "../api/workspace";
import { useAuth } from "../context/AuthContext";
import type { Employee, UserRole } from "../types";
import { Modal, dateLabel } from "./AcademyUI";

export const canManageAccess = (role?: string) => role === "company_admin" || role === "super_admin";

export function AccessBadge({ user }: { user: AccessUser }) {
  return <span className={`academy-badge ${ACCESS_STATUS_TONE[user.status]}`}>{ACCESS_STATUS_LABELS[user.status]}</span>;
}

export function InviteLinkModal({ issued, onClose }: { issued: InvitationIssued; onClose: () => void }) {
  const url = inviteUrl(issued.invite_path);
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); }
  }
  return <Modal title="Приглашение готово" onClose={onClose}>
    <p style={{ fontSize: 13, lineHeight: 1.5 }}>
      {issued.email_sent
        ? <>Письмо со ссылкой отправлено на <strong>{issued.user.email}</strong>. Если оно не дойдёт, передайте ссылку сотруднику любым удобным способом.</>
        : <>Передайте ссылку сотруднику <strong>{issued.user.full_name}</strong> ({issued.user.email}). По ней он задаст свой пароль и войдёт в систему.</>}
    </p>
    <label htmlFor="invite-url">Ссылка для входа · действует до {dateLabel(issued.invite_expires_at)}</label>
    <input id="invite-url" readOnly value={url} style={{ width: "100%" }} onFocus={e => e.currentTarget.select()} />
    <p style={{ fontSize: 12, color: "#717982", marginTop: 8 }}>Ссылка одноразовая. Новая ссылка отменяет предыдущую.</p>
    <div className="academy-dialog-actions">
      <button type="button" className="btn-secondary" onClick={onClose}>Готово</button>
      <button type="button" className="btn-primary" onClick={copy}><Copy size={16} />{copied ? "Скопировано" : "Скопировать ссылку"}</button>
    </div>
  </Modal>;
}

export function RoleSelect({ id, value, onChange, disabled }: { id?: string; value: UserRole; onChange: (role: UserRole) => void; disabled?: boolean }) {
  return <select id={id} value={value} disabled={disabled} style={{ minWidth: 150 }} onChange={e => onChange(e.target.value as UserRole)}>
    {COMPANY_ROLES.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
  </select>;
}

export function GrantAccessModal({ employee, onClose, onIssued }: { employee: Employee; onClose: () => void; onIssued: (issued: InvitationIssued) => void }) {
  const [email, setEmail] = useState(employee.email ?? "");
  const [role, setRole] = useState<UserRole>("employee");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { onIssued(await grantAccess(employee.id, { email: email.trim(), role })); }
    catch (e) { setError(apiError(e)); setBusy(false); }
  }
  return <Modal title="Предоставить доступ" onClose={onClose}>
    <form onSubmit={submit}>
      <p style={{ fontSize: 13 }}>Сотрудник <strong>{employee.full_name}</strong> получит личную учётную запись и ссылку, чтобы задать пароль.</p>
      <label htmlFor="grant-email">Email для входа</label>
      <input id="grant-email" type="email" required data-autofocus value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.ru" />
      <label htmlFor="grant-role">Роль</label>
      <RoleSelect id="grant-role" value={role} onChange={setRole} />
      <p style={{ fontSize: 12, color: "#717982", marginTop: 8 }}>{COMPANY_ROLES.find(r => r.value === role)?.hint}</p>
      {error && <p className="error-msg" role="alert">{error}</p>}
      <div className="academy-dialog-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>Отмена</button>
        <button className="btn-primary" disabled={busy}><Send size={16} />{busy ? "Создание..." : "Пригласить"}</button>
      </div>
    </form>
  </Modal>;
}

/** «Доступ в систему» в карточке сотрудника — только для администратора. */
export function EmployeeAccessPanel({ employee }: { employee: Employee }) {
  const { user: me } = useAuth();
  const [account, setAccount] = useState<AccessUser | null>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [granting, setGranting] = useState(false);
  const [issued, setIssued] = useState<InvitationIssued>();
  const load = useCallback(() => { setError(""); getEmployeeAccess(employee.id).then(setAccount).catch(e => setError(apiError(e))); }, [employee.id]);
  useEffect(load, [load, employee.status]);
  async function run(action: () => Promise<AccessUser | InvitationIssued>) {
    setBusy(true); setError("");
    try {
      const result = await action();
      if ("invite_path" in result) { setIssued(result); setAccount(result.user); } else setAccount(result);
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }
  const fired = employee.status === "fired";
  const self = account?.id === me?.id;
  return <section className="academy-section">
    <div className="academy-section-heading"><h2>Доступ в систему</h2>{account && <AccessBadge user={account} />}</div>
    {account === undefined && !error && <p style={{ fontSize: 13, color: "#717982" }}>Загрузка...</p>}
    {account === null && <>
      <p style={{ fontSize: 13, color: "#717982", marginBottom: 14 }}>{fired ? "Сотрудник уволен — вход в систему не предоставляется." : "У сотрудника нет учётной записи. Карточка сама по себе не даёт входа в систему."}</p>
      {!fired && <button type="button" className="btn-primary" onClick={() => setGranting(true)}><KeyRound size={16} />Предоставить доступ</button>}
    </>}
    {account && <>
      <dl className="academy-profile">
        <dt>Логин</dt><dd>{account.email}</dd>
        <dt>Роль</dt><dd><RoleSelect value={account.role} disabled={busy || self} onChange={role => run(() => updateAccess(account.id, { role }))} /></dd>
        <dt>Последний вход</dt><dd>{account.last_login_at ? dateLabel(account.last_login_at) : "Ещё не входил"}</dd>
        {account.invitation_expires_at && <><dt>Приглашение</dt><dd>до {dateLabel(account.invitation_expires_at)}</dd></>}
      </dl>
      <div className="academy-actions" style={{ marginTop: 14 }}>
        {(account.status === "invited" || account.status === "invite_expired") && <button type="button" className="btn-secondary" disabled={busy} onClick={() => run(() => resendInvitation(account.id))}><Send size={16} />Новая ссылка-приглашение</button>}
        {!self && (account.status === "blocked"
          ? !fired && <button type="button" className="btn-secondary" disabled={busy} onClick={() => run(() => updateAccess(account.id, { is_active: true }))}><LockOpen size={16} />Разблокировать вход</button>
          : <button type="button" className="btn-secondary" disabled={busy} onClick={() => confirm(`Заблокировать вход для ${account.full_name}? История обучения сохранится.`) && run(() => updateAccess(account.id, { is_active: false }))}><Lock size={16} />Заблокировать вход</button>)}
      </div>
      {fired && <p style={{ fontSize: 12, color: "#717982", marginTop: 10 }}>Сотрудник уволен — вход отключён автоматически, история сохранена.</p>}
    </>}
    {error && <p className="error-msg" role="alert">{error}</p>}
    {granting && <GrantAccessModal employee={employee} onClose={() => setGranting(false)} onIssued={result => { setGranting(false); setIssued(result); setAccount(result.user); }} />}
    {issued && <InviteLinkModal issued={issued} onClose={() => setIssued(undefined)} />}
  </section>;
}
