import client from "./client";
import type { EmployeeStatus, UserRole } from "../types";

export type AccessStatus = "invited" | "invite_expired" | "active" | "blocked";
export interface AccessUser {
  id: string; email: string; full_name: string; role: UserRole; status: AccessStatus;
  employee_id: string | null; employee_name: string | null; employee_status: EmployeeStatus | null;
  invitation_expires_at: string | null; last_login_at: string | null; created_at: string;
}
export interface InvitationIssued { user: AccessUser; invite_path: string; invite_expires_at: string; email_sent: boolean }
export interface InvitationInfo { email: string; full_name: string; company_name: string | null; expires_at: string }

export const ACCESS_STATUS_LABELS: Record<AccessStatus, string> = {
  invited: "Приглашён", invite_expired: "Приглашение истекло", active: "Подключён", blocked: "Вход заблокирован",
};
export const ACCESS_STATUS_TONE: Record<AccessStatus, string> = { invited: "amber", invite_expired: "red", active: "", blocked: "gray" };
// Роли, которые администратор может выдать в компании, с описанием прав
export const COMPANY_ROLES: { value: UserRole; label: string; hint: string }[] = [
  { value: "employee", label: "Сотрудник", hint: "Свой профиль, назначенные уроки, тесты и свои результаты" },
  { value: "department_head", label: "Руководитель", hint: "Свой кабинет и сотрудники своего отдела" },
  { value: "hr", label: "HR", hint: "Подбор, сотрудники, назначения и результаты компании" },
  { value: "methodologist", label: "Методолог", hint: "Материалы, программы и конструктор тестов" },
  { value: "company_admin", label: "Администратор", hint: "Все разделы компании и управление доступом" },
];

export const inviteUrl = (path: string) => `${window.location.origin}${path}`;

export const getAccessUsers = () => client.get<AccessUser[]>("/api/v1/access/users").then(r => r.data);
export const getEmployeeAccess = (employeeId: string) => client.get<AccessUser | null>(`/api/v1/access/employees/${employeeId}`).then(r => r.data);
export const grantAccess = (employeeId: string, payload: { email: string; role: UserRole }) =>
  client.post<InvitationIssued>(`/api/v1/access/employees/${employeeId}`, payload).then(r => r.data);
export const resendInvitation = (userId: string) => client.post<InvitationIssued>(`/api/v1/access/users/${userId}/invitation`).then(r => r.data);
export const updateAccess = (userId: string, payload: { role?: UserRole; is_active?: boolean }) =>
  client.patch<AccessUser>(`/api/v1/access/users/${userId}`, payload).then(r => r.data);

export const getInvitation = (token: string) => client.get<InvitationInfo>(`/api/v1/auth/invitations/${token}`).then(r => r.data);
export const acceptInvitation = (token: string, password: string) =>
  client.post<{ access_token: string }>(`/api/v1/auth/invitations/${token}/accept`, { password }).then(r => r.data);
