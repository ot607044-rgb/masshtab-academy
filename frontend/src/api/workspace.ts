import client from "./client";
import axios from "axios";
const publicCalendarClient = axios.create({ baseURL: "", headers: { "Content-Type": "application/json" } });
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
  id: string; candidate_id: string | null; candidate_name: string | null;
  meeting_type: "interview" | "work" | "planning" | "other";
  title: string; starts_at: string; duration_minutes: number;
  participant_ids: string[]; participants?: CalendarParticipant[];
  meeting_url: string | null; notes: string | null;
  external_name?: string | null; external_contact?: string | null;
}
export interface CalendarParticipant { id: string; full_name: string; email: string; role: string }
export interface FreeSlot { starts_at: string; ends_at: string; duration_minutes: number }
export interface CalendarSummary {
  meetings: Interview[];
  day_load_percent: number;
  week_load_percent: number;
  free_slots: FreeSlot[];
  best_slot: FreeSlot | null;
  week_slots_count?: number;
}
export interface AvailabilityRule { id: string; weekday: number; start_minute: number; end_minute: number; slot_minutes: number }
export interface CalendarBlock { id: string; starts_at: string; duration_minutes: number; title: string | null }
export interface AvailabilityState { rules: AvailabilityRule[]; timezone: string; buffer_minutes: number; blocks: CalendarBlock[]; public_link: { token: string; enabled: boolean } | null }
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
export const getInterviewCalendar = (start: string, end: string, day: string) => client.get<CalendarSummary>("/api/v1/recruitment/interviews/calendar", { params: { start, end, day } }).then(r => r.data);
export const getMeetingParticipants = () => client.get<CalendarParticipant[]>("/api/v1/recruitment/participants").then(r => r.data);
export const createInterview = (data: Omit<Interview, "id" | "candidate_name" | "participants">) => client.post<Interview>("/api/v1/recruitment/interviews", data).then(r => r.data);
export const updateInterview = (id: string, data: Partial<Omit<Interview, "id" | "candidate_name" | "participants">>) => client.patch<Interview>(`/api/v1/recruitment/interviews/${id}`, data).then(r => r.data);
export const cancelInterview = (id: string) => client.delete(`/api/v1/recruitment/interviews/${id}`);
export const getAvailability = () => client.get<AvailabilityState>("/api/v1/recruitment/availability").then(r => r.data);
export const updateAvailabilityRules = (rules: Omit<AvailabilityRule, "id">[], timezone = Intl.DateTimeFormat().resolvedOptions().timeZone, buffer_minutes = 0) => client.put<{ rules: AvailabilityRule[] }>("/api/v1/recruitment/availability/rules", { rules, timezone, buffer_minutes }).then(r => r.data);
export const createCalendarBlock = (data: { starts_at: string; duration_minutes: number; title: string | null }) => client.post<CalendarBlock>("/api/v1/recruitment/availability/blocks", data).then(r => r.data);
export const deleteCalendarBlock = (id: string) => client.delete(`/api/v1/recruitment/availability/blocks/${id}`);
export const enablePublicCalendarLink = () => client.post<{ token: string; enabled: boolean }>("/api/v1/recruitment/public-link").then(r => r.data);
export const revokePublicCalendarLink = () => client.delete("/api/v1/recruitment/public-link");
export const pausePublicCalendarLink = (enabled: boolean) => client.patch("/api/v1/recruitment/public-link", { enabled }).then(r => r.data);
export const getPublicSlots = (token: string, start: string, end: string) => publicCalendarClient.get<{ slots: FreeSlot[] }>(`/api/v1/public-calendar/${encodeURIComponent(token)}/slots`, { params: { start, end } }).then(r => r.data);
export const bookPublicSlot = (token: string, data: { starts_at: string; duration_minutes: number; visitor_name: string; visitor_contact: string; notes: string | null }) => publicCalendarClient.post(`/api/v1/public-calendar/${encodeURIComponent(token)}/book`, data).then(r => r.data);

export function apiError(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === "string" ? detail : "Не удалось сохранить или загрузить данные. Повторите попытку.";
}
export const STAGES: Record<string, string> = { new: "Новые отклики", review: "Рассмотрение", interview: "Собеседование", testing: "Тестирование", offer: "Оффер и выход", hired: "Оформлен сотрудником", rejected: "Отказ" };
export const VACANCY_STATUSES: Record<Vacancy["status"], string> = { request: "Заявка", open: "Открыта", paused: "Приостановлена", closed: "Закрыта" };
