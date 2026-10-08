import client from "./client";

export type RegulationStatus = "active" | "draft";

export interface Regulation {
  id: string;
  company_id: string;
  position_id: string;
  name: string;
  summary: string | null;
  status: RegulationStatus;
  goal: string | null;
  duties: string[];
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegulationAssignment {
  id: string;
  employee_id: string;
  regulation_id: string;
  require_ack: boolean;
  acknowledged_at: string | null;
  assigned_at: string;
  notified?: boolean;
}

export interface MyRegulation {
  assignment: RegulationAssignment;
  regulation: Regulation;
  position_name: string | null;
}

export type RegulationPayload = Partial<Pick<Regulation, "name" | "summary" | "status" | "goal" | "duties">>;

const base = "/api/v1/regulations";

export const getRegulations = () => client.get<Regulation[]>(`${base}/`).then((r) => r.data);
export const createRegulation = (payload: RegulationPayload & { position_id: string; name: string }) => client.post<Regulation>(`${base}/`, payload).then((r) => r.data);
export const updateRegulation = (id: string, payload: RegulationPayload) => client.patch<Regulation>(`${base}/${id}`, payload).then((r) => r.data);
export const deleteRegulation = (id: string) => client.delete(`${base}/${id}`);

export const getRegulationAssignments = () => client.get<RegulationAssignment[]>(`${base}/assignments`).then((r) => r.data);
export const assignRegulation = (payload: { employee_id: string; regulation_id: string; require_ack: boolean }) => client.post<RegulationAssignment>(`${base}/assignments`, payload).then((r) => r.data);
export const removeRegulationAssignment = (id: string) => client.delete(`${base}/assignments/${id}`);

export const getMyRegulation = () => client.get<MyRegulation | null>(`${base}/my`).then((r) => r.data);
export const acknowledgeMyRegulation = () => client.post<RegulationAssignment>(`${base}/my/acknowledge`).then((r) => r.data);
