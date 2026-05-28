// ── Auth / Users ─────────────────────────────────────────────────────────────

export type UserRole =
  | "super_admin"
  | "company_admin"
  | "hr"
  | "department_head"
  | "methodologist"
  | "employee";

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  company_admin: "Администратор компании",
  hr: "HR",
  department_head: "Руководитель отдела",
  methodologist: "Методолог",
  employee: "Сотрудник",
};

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  company_id: string | null;
}

// ── Company ───────────────────────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CreateCompanyPayload {
  company: { name: string; slug: string; description?: string };
  admin_email: string;
  admin_password: string;
  admin_full_name: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  company_id?: string;
}

// ── Department ────────────────────────────────────────────────────────────────

export interface Department {
  id: string;
  name: string;
  description: string | null;
  company_id: string;
  head_id: string | null;
  created_at: string;
}

export interface DepartmentCreate {
  name: string;
  description?: string;
  head_id?: string;
}

// ── Position ──────────────────────────────────────────────────────────────────

export interface Position {
  id: string;
  name: string;
  description: string | null;
  company_id: string;
  department_id: string | null;
  required_skills: string[] | null;
  created_at: string;
}

export interface PositionCreate {
  name: string;
  description?: string;
  department_id?: string;
  required_skills?: string[];
}

// ── Employee ──────────────────────────────────────────────────────────────────

export type EmployeeStatus = "active" | "probation" | "vacation" | "fired";

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: "Активен",
  probation: "Испытательный срок",
  vacation: "Отпуск",
  fired: "Уволен",
};

export interface Employee {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company_id: string;
  department_id: string | null;
  position_id: string | null;
  manager_id: string | null;
  user_id: string | null;
  status: EmployeeStatus;
  hire_date: string | null;
  weak_areas: string[] | null;
  learning_history: unknown[] | null;
  test_results: Record<string, unknown> | null;
  created_at: string;
}

export interface EmployeeCreate {
  full_name: string;
  email?: string;
  phone?: string;
  department_id?: string;
  position_id?: string;
  manager_id?: string;
  status?: EmployeeStatus;
  hire_date?: string;
}

// ── Knowledge ─────────────────────────────────────────────────────────────────

export type DifficultyLevel = "basic" | "intermediate" | "advanced";
export type Criticality = "low" | "medium" | "high" | "critical";

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  basic: "Базовый",
  intermediate: "Средний",
  advanced: "Продвинутый",
};

export const CRITICALITY_LABELS: Record<Criticality, string> = {
  low: "Низкая",
  medium: "Средняя",
  high: "Высокая",
  critical: "Критическая",
};

export interface KnowledgeTopic {
  id: string;
  name: string;
  description: string | null;
  company_id: string;
  difficulty_level: DifficultyLevel;
  criticality: Criticality;
  required_knowledge_level: number;
  related_lessons: string[] | null;
  related_tests: string[] | null;
  created_at: string;
}

export interface KnowledgeTopicCreate {
  name: string;
  description?: string;
  difficulty_level?: DifficultyLevel;
  criticality?: Criticality;
  required_knowledge_level?: number;
}

export interface PositionTopic {
  id: string;
  position_id: string;
  topic_id: string;
  company_id: string;
  is_required: boolean;
  topic: KnowledgeTopic;
}

// ── Lessons ───────────────────────────────────────────────────────────────────

export type LessonStatus = "draft" | "published" | "archived";
export type MaterialType =
  | "text" | "pdf" | "doc" | "xls" | "image"
  | "presentation" | "checklist" | "external_link" | "video_link";

export const LESSON_STATUS_LABELS: Record<LessonStatus, string> = {
  draft: "Черновик",
  published: "Опубликован",
  archived: "Архив",
};

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  text: "Текст",
  pdf: "PDF",
  doc: "Word",
  xls: "Excel",
  image: "Изображение",
  presentation: "Презентация",
  checklist: "Чек-лист",
  external_link: "Внешняя ссылка",
  video_link: "Видео",
};

export const MATERIAL_TYPE_ICONS: Record<MaterialType, string> = {
  text: "📝",
  pdf: "📄",
  doc: "📝",
  xls: "📊",
  image: "🖼️",
  presentation: "📊",
  checklist: "✅",
  external_link: "🔗",
  video_link: "🎬",
};

export interface LessonMaterial {
  id: string;
  lesson_id: string;
  title: string;
  material_type: MaterialType;
  url: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
}

export interface Lesson {
  id: string;
  title: string;
  description: string | null;
  company_id: string;
  position_id: string | null;
  topic_id: string | null;
  author_id: string | null;
  difficulty_level: DifficultyLevel | null;
  duration_minutes: number | null;
  video_url: string | null;
  status: LessonStatus;
  created_at: string;
  updated_at: string;
}

export interface LessonDetail extends Lesson {
  text_content: string | null;
  external_links: Array<{ title: string; url: string }> | null;
  materials: LessonMaterial[];
}

export interface LessonCreate {
  title: string;
  description?: string;
  text_content?: string;
  position_id?: string;
  topic_id?: string;
  difficulty_level?: string;
  duration_minutes?: number;
  video_url?: string;
  external_links?: Array<{ title: string; url: string }>;
}

export interface LessonUpdate extends Partial<LessonCreate> {
  status?: LessonStatus;
}

export interface MaterialLinkCreate {
  title: string;
  material_type: MaterialType;
  url: string;
}

// ── Assignments ───────────────────────────────────────────────────────────────

export type AssignmentStatus = "assigned" | "in_progress" | "completed";

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  assigned: "Назначен",
  in_progress: "В процессе",
  completed: "Завершён",
};

export interface LessonAssignment {
  id: string;
  lesson_id: string;
  employee_id: string;
  company_id: string;
  assigned_by: string | null;
  status: AssignmentStatus;
  due_date: string | null;
  completed_at: string | null;
  lesson: Lesson;
  created_at: string;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

export type TestStatus = "draft" | "published" | "archived";
export type QuestionType = "single" | "multiple" | "text" | "yes_no" | "case";

export const TEST_STATUS_LABELS: Record<TestStatus, string> = {
  draft: "Черновик",
  published: "Опубликован",
  archived: "Архив",
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: "Один вариант",
  multiple: "Несколько вариантов",
  text: "Текстовый ответ",
  yes_no: "Да / Нет",
  case: "Практический кейс",
};

export interface AnswerOption {
  id: string;
  text: string;
  order_index: number;
}

export interface AnswerOptionFull extends AnswerOption {
  is_correct: boolean;
}

export interface Question {
  id: string;
  question_type: QuestionType;
  text: string;
  explanation: string | null;
  points: number;
  order_index: number;
  options: AnswerOption[];
}

export interface QuestionFull extends Omit<Question, "options"> {
  options: AnswerOptionFull[];
}

export interface QuestionCreate {
  question_type: QuestionType;
  text: string;
  explanation?: string;
  points: number;
  order_index: number;
  options: { text: string; is_correct: boolean; order_index: number }[];
}

export interface Test {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  position_id: string | null;
  topic_id: string | null;
  lesson_id: string | null;
  author_id: string | null;
  passing_score: number;
  max_attempts: number;
  time_limit_minutes: number | null;
  status: TestStatus;
  created_at: string;
  updated_at: string;
}

export interface TestDetail extends Test {
  questions: QuestionFull[];
}

export interface TestForTaking extends Test {
  questions: Question[];
}

export interface AnswerSubmitItem {
  question_id: string;
  selected_option_ids?: string[] | null;
  text_answer?: string | null;
}

export interface AttemptSubmit {
  answers: AnswerSubmitItem[];
  time_spent_seconds?: number | null;
}

export interface QuestionResultItem {
  question_id: string;
  question_text: string;
  question_type: QuestionType;
  is_correct: boolean | null;
  points_earned: number;
  max_points: number;
  correct_option_ids: string[];
  selected_option_ids: string[] | null;
  text_answer: string | null;
  explanation: string | null;
}

export interface AttemptResult {
  attempt_id: string;
  score: number;
  passed: boolean;
  knowledge_percent: number;
  strong_topics: string[];
  weak_topics: string[];
  employee_level: "basic" | "intermediate" | "advanced";
  total_points: number;
  earned_points: number;
  passing_score: number;
  question_results: QuestionResultItem[];
  auto_assigned_lesson: { id: string; title: string } | null;
  weak_topic_added: boolean;
  repeat_test_assigned: boolean;
}

export interface AttemptSummary {
  id: string;
  test_id: string;
  employee_id: string;
  status: string;
  score: number | null;
  passed: boolean | null;
  started_at: string;
  completed_at: string | null;
  time_spent_seconds: number | null;
  auto_assigned_lesson_id: string | null;
  employee_name?: string | null;
}

export interface MyTestOverview {
  id: string;
  title: string;
  description: string | null;
  passing_score: number;
  max_attempts: number;
  time_limit_minutes: number | null;
  attempts_used: number;
  best_score: number | null;
  passed: boolean;
  in_progress: boolean;
  can_attempt: boolean;
}

// ── Support Access ─────────────────────────────────────────────────────────────

export type SupportRequestStatus = "pending" | "approved" | "rejected" | "revoked";

export const SUPPORT_STATUS_LABELS: Record<SupportRequestStatus, string> = {
  pending: "Ожидает",
  approved: "Одобрен",
  rejected: "Отклонён",
  revoked: "Отозван",
};

export const SUPPORT_STATUS_COLORS: Record<SupportRequestStatus, string> = {
  pending: "statusYellow",
  approved: "statusGreen",
  rejected: "statusRed",
  revoked: "statusOrange",
};

export interface SupportRequest {
  id: string;
  super_admin_id: string;
  company_id: string;
  reason: string;
  status: SupportRequestStatus;
  duration_hours: number;
  requested_at: string;
  approved_at: string | null;
  approved_by_id: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by_id: string | null;
  reject_reason: string | null;
  super_admin_name: string | null;
  company_name: string | null;
  logs_count: number;
}

export interface SupportAccessLog {
  id: string;
  session_id: string;
  super_admin_id: string;
  company_id: string;
  endpoint: string | null;
  method: string | null;
  accessed_at: string;
}

export interface ActiveSupportSession {
  id: string;
  company_id: string;
  company_name: string;
  expires_at: string;
  reason: string;
}
