import client from "./client";
import type {
  Test, TestDetail, TestForTaking,
  QuestionCreate, AttemptSubmit, AttemptResult,
  AttemptSummary, MyTestOverview,
} from "../types";

export const listTests = (statusFilter?: string): Promise<Test[]> =>
  client.get("/api/v1/tests/", { params: statusFilter ? { status_filter: statusFilter } : {} }).then((r) => r.data);

export const createTest = (data: Partial<Test>): Promise<TestDetail> =>
  client.post("/api/v1/tests/", data).then((r) => r.data);

export const getTest = (id: string): Promise<TestDetail> =>
  client.get(`/api/v1/tests/${id}`).then((r) => r.data);

export const updateTest = (id: string, data: Partial<Test>): Promise<TestDetail> =>
  client.patch(`/api/v1/tests/${id}`, data).then((r) => r.data);

export const publishTest = (id: string): Promise<Test> =>
  client.post(`/api/v1/tests/${id}/publish`).then((r) => r.data);

export const archiveTest = (id: string): Promise<Test> =>
  client.post(`/api/v1/tests/${id}/archive`).then((r) => r.data);

export const deleteTest = (id: string): Promise<void> =>
  client.delete(`/api/v1/tests/${id}`).then(() => undefined);

export const addQuestion = (testId: string, data: QuestionCreate): Promise<TestDetail> =>
  client.post(`/api/v1/tests/${testId}/questions`, data).then((r) => r.data);

export const updateQuestion = (testId: string, qId: string, data: Partial<QuestionCreate>): Promise<TestDetail> =>
  client.patch(`/api/v1/tests/${testId}/questions/${qId}`, data).then((r) => r.data);

export const deleteQuestion = (testId: string, qId: string): Promise<TestDetail> =>
  client.delete(`/api/v1/tests/${testId}/questions/${qId}`).then((r) => r.data);

export const startTest = (id: string): Promise<TestForTaking> =>
  client.post(`/api/v1/tests/${id}/start`).then((r) => r.data);

export const submitTest = (id: string, data: AttemptSubmit): Promise<AttemptResult> =>
  client.post(`/api/v1/tests/${id}/submit`, data).then((r) => r.data);

export const getMyAttempts = (testId: string): Promise<AttemptSummary[]> =>
  client.get(`/api/v1/tests/${testId}/my-attempts`).then((r) => r.data);

export const getTestResults = (testId: string): Promise<AttemptSummary[]> =>
  client.get(`/api/v1/tests/${testId}/results`).then((r) => r.data);

export const getMyTestsOverview = (): Promise<MyTestOverview[]> =>
  client.get("/api/v1/tests/my/overview").then((r) => r.data);
