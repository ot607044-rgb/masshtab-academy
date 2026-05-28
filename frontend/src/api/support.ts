import client from "./client";
import type { SupportRequest, SupportAccessLog } from "../types";

export const createSupportRequest = (data: {
  company_id: string;
  reason: string;
  duration_hours: number;
}): Promise<SupportRequest> =>
  client.post("/api/v1/support/request", data).then((r) => r.data);

export const getMyRequests = (): Promise<SupportRequest[]> =>
  client.get("/api/v1/support/my-requests").then((r) => r.data);

export const getPendingRequests = (): Promise<SupportRequest[]> =>
  client.get("/api/v1/support/pending").then((r) => r.data);

export const getSupportHistory = (): Promise<SupportRequest[]> =>
  client.get("/api/v1/support/history").then((r) => r.data);

export const approveRequest = (id: string, duration_hours: number): Promise<SupportRequest> =>
  client.post(`/api/v1/support/sessions/${id}/approve`, { duration_hours }).then((r) => r.data);

export const rejectRequest = (id: string, reason?: string): Promise<SupportRequest> =>
  client.post(`/api/v1/support/sessions/${id}/reject`, { reason }).then((r) => r.data);

export const revokeSession = (id: string): Promise<SupportRequest> =>
  client.post(`/api/v1/support/sessions/${id}/revoke`).then((r) => r.data);

export const getSessionLogs = (id: string): Promise<SupportAccessLog[]> =>
  client.get(`/api/v1/support/sessions/${id}/logs`).then((r) => r.data);

export const getPendingCount = (): Promise<{ count: number }> =>
  client.get("/api/v1/support/pending-count").then((r) => r.data);
