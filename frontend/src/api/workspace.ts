import client from "./client";
import type { Employee } from "../types";

export interface Vacancy {
  id: string; title: string; description: string | null;
  position_id: string | null; department_id: string | null;
  status: "request" | "open" | "paused" | "closed";
}
export interface StageEvent { stage: string; at: string }
export interface Candidate {
  id: string; full_name: string; vacancy_id: string | null; vacancy_title?: string;
  email: string | null; phone: string | null; source: string;
  stage: string; notes: string | null; history: StageEvent[];
  employee_id: string | null; created_at: string;
}
export interface Interview {
  id: string; candidate_id: string; candidate_name: string;
  title: string; starts_at: string; duration_minutes: number;
  meeting_url: string | null; notes: string | null;
}
export interface Progress {
  employee_id: string; full_name: string; department_name: string | null;
  position_name: string | null; lessons_completed: number; lessons_total: number;
  completion_percent: number; knowledge_percent: number | null; weak_areas: string[];
}
export interface Workspace {
  stats: { vacancies: number; candidates: number; onboarding: number; needs_attention: number };
  attention: { employee_id: string; full_name: string; kind: string; title: string; detail: string }[];
  meetings: Interview[]; employees: Progress[];
}
export interface RoadmapStep {
  id: string; lesson_id: string; title: string; description: string | null;
  status: "assigned" | "in_progress" | "completed"; duration_minutes: number | null;
  due_date: string | null; completed_at: string | null; created_at: string;
  is_remediation: boolean; overdue: boolean;
}
export interface Diagnostic {
  test_id: string; title: string; topic: string; score: number; passed: boolean;
  passing_score: number; attempts: number; completed_at: string | null;
  auto_assigned_lesson_id: string | null;
}
export interface EmployeeWorkspace extends Progress {
  employee: Employee & { department_name: string | null; position_name: string | null };
  overdue_count: number; roadmap: RoadmapStep[]; diagnostics: Diagnostic[];
  recruitment_history: StageEvent[];
}

export const getWorkspace = () => client.get<Workspace>("/api/v1/workspace/dashboard").then(r => r.data);
export const getEmployeeWorkspace = (id: string) => client.get<EmployeeWorkspace>(`/api/v1/workspace/employees/${id}`).then(r => r.data);
export const getVacancies = () => client.get<Vacancy[]>("/api/v1/recruitment/vacancies").then(r => r.data);
export const createVacancy = (data: Omit<Vacancy, "id">) => client.post<Vacancy>("/api/v1/recruitment/vacancies", data).then(r => r.data);
export const updateVacancy = (id: string, status: Vacancy["status"]) => client.patch<Vacancy>(`/api/v1/recruitment/vacancies/${id}`, { status }).then(r => r.data);
export const getCandidates = () => client.get<Candidate[]>("/api/v1/recruitment/candidates").then(r => r.data);
export const createCandidate = (data: { full_name: string; vacancy_id: string | null; email: string | null; phone: string | null; source: string; notes: string | null }) => client.post<Candidate>("/api/v1/recruitment/candidates", data).then(r => r.data);
export const updateCandidate = (id: string, data: { stage?: string; notes?: string | null }) => client.patch<Candidate>(`/api/v1/recruitment/candidates/${id}`, data).then(r => r.data);
export const hireCandidate = (id: string, hire_date: string) => client.post<{ employee_id: string }>(`/api/v1/recruitment/candidates/${id}/hire`, { hire_date }).then(r => r.data);
export const getInterviews = (start?: string, end?: string) => client.get<Interview[]>("/api/v1/recruitment/interviews", { params: { start, end } }).then(r => r.data);
export const createInterview = (data: Omit<Interview, "id" | "candidate_name">) => client.post<Interview>("/api/v1/recruitment/interviews", data).then(r => r.data);
export const cancelInterview = (id: string) => client.delete(`/api/v1/recruitment/interviews/${id}`);

export function apiError(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === "string" ? detail : "Не удалось сохранить или загрузить данные. Повторите попытку.";
}
export const STAGES: Record<string, string> = { new: "Новые отклики", review: "Рассмотрение", interview: "Собеседование", testing: "Тестирование", offer: "Оффер и выход", hired: "Оформлен сотрудником", rejected: "Отказ" };
export const VACANCY_STATUSES: Record<Vacancy["status"], string> = { request: "Заявка", open: "Открыта", paused: "Приостановлена", closed: "Закрыта" };
