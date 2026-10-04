import client from "./client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CustomField {
  id: string;
  company_id: string;
  name: string;
  field_type: string;
  entity_type: string;
  section_id: string | null;
  options: unknown;
  is_required: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface CustomFieldCreate {
  name: string;
  field_type: string;
  entity_type: string;
  section_id?: string | null;
  options?: unknown;
  is_required?: boolean;
  order_index?: number;
}

export interface CustomSection {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  is_active: boolean;
  order_index: number;
  allowed_roles: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface CustomSectionCreate {
  name: string;
  slug: string;
  icon?: string | null;
  description?: string | null;
  is_active?: boolean;
  order_index?: number;
  allowed_roles?: string[] | null;
}

export interface CustomSectionRecord {
  id: string;
  section_id: string;
  company_id: string;
  title: string;
  data: Record<string, unknown> | null;
  status_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomSectionRecordCreate {
  title: string;
  data?: Record<string, unknown> | null;
  status_id?: string | null;
}

export interface Status {
  id: string;
  company_id: string;
  funnel_id: string | null;
  name: string;
  color: string | null;
  order_index: number;
  is_final: boolean;
  is_positive: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface StatusCreate {
  name: string;
  funnel_id?: string | null;
  color?: string;
  order_index?: number;
  is_final?: boolean;
  is_positive?: boolean | null;
}

export interface Funnel {
  id: string;
  company_id: string;
  name: string;
  entity_type: string;
  created_at: string;
  updated_at: string;
}

export interface FunnelCreate {
  name: string;
  entity_type: string;
}

export interface Integration {
  id: string;
  company_id: string;
  provider: string;
  expires_at: string | null;
  status: string;
  settings_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationCreate {
  provider: string;
  status?: string;
  settings_data?: Record<string, unknown> | null;
}

// ── Custom Fields API ─────────────────────────────────────────────────────────

export const getCustomFields = async (params?: { entity_type?: string; section_id?: string }) => {
  const { data } = await client.get<CustomField[]>("/api/v1/custom-fields/", { params });
  return data;
};

export const createCustomField = async (payload: CustomFieldCreate) => {
  const { data } = await client.post<CustomField>("/api/v1/custom-fields/", payload);
  return data;
};

export const updateCustomField = async (id: string, payload: Partial<CustomFieldCreate>) => {
  const { data } = await client.patch<CustomField>(`/api/v1/custom-fields/${id}`, payload);
  return data;
};

export const deleteCustomField = async (id: string) => {
  await client.delete(`/api/v1/custom-fields/${id}`);
};

// ── Custom Sections API ───────────────────────────────────────────────────────

export const getCustomSections = async () => {
  const { data } = await client.get<CustomSection[]>("/api/v1/custom-sections/");
  return data;
};

export const getCustomSectionBySlug = async (slug: string) => {
  const sections = await getCustomSections();
  return sections.find((s) => s.slug === slug) ?? null;
};

export const createCustomSection = async (payload: CustomSectionCreate) => {
  const { data } = await client.post<CustomSection>("/api/v1/custom-sections/", payload);
  return data;
};

export const updateCustomSection = async (id: string, payload: Partial<CustomSectionCreate>) => {
  const { data } = await client.patch<CustomSection>(`/api/v1/custom-sections/${id}`, payload);
  return data;
};

export const deleteCustomSection = async (id: string) => {
  await client.delete(`/api/v1/custom-sections/${id}`);
};

export const getSectionRecords = async (sectionId: string) => {
  const { data } = await client.get<CustomSectionRecord[]>(`/api/v1/custom-sections/${sectionId}/records`);
  return data;
};

export const createSectionRecord = async (sectionId: string, payload: CustomSectionRecordCreate) => {
  const { data } = await client.post<CustomSectionRecord>(
    `/api/v1/custom-sections/${sectionId}/records`,
    payload,
  );
  return data;
};

export const updateSectionRecord = async (
  sectionId: string,
  recordId: string,
  payload: Partial<CustomSectionRecordCreate>,
) => {
  const { data } = await client.patch<CustomSectionRecord>(
    `/api/v1/custom-sections/${sectionId}/records/${recordId}`,
    payload,
  );
  return data;
};

export const deleteSectionRecord = async (sectionId: string, recordId: string) => {
  await client.delete(`/api/v1/custom-sections/${sectionId}/records/${recordId}`);
};

// ── Statuses API ──────────────────────────────────────────────────────────────

export const getStatuses = async () => {
  const { data } = await client.get<Status[]>("/api/v1/statuses/");
  return data;
};

export const createStatus = async (payload: StatusCreate) => {
  const { data } = await client.post<Status>("/api/v1/statuses/", payload);
  return data;
};

export const updateStatus = async (id: string, payload: Partial<StatusCreate>) => {
  const { data } = await client.patch<Status>(`/api/v1/statuses/${id}`, payload);
  return data;
};

export const deleteStatus = async (id: string) => {
  await client.delete(`/api/v1/statuses/${id}`);
};

// ── Funnels API ───────────────────────────────────────────────────────────────

export const getFunnels = async () => {
  const { data } = await client.get<Funnel[]>("/api/v1/statuses/funnels/");
  return data;
};

export const createFunnel = async (payload: FunnelCreate) => {
  const { data } = await client.post<Funnel>("/api/v1/statuses/funnels/", payload);
  return data;
};

export const deleteFunnel = async (id: string) => {
  await client.delete(`/api/v1/statuses/funnels/${id}`);
};

// ── Integrations API ──────────────────────────────────────────────────────────

export const getIntegrations = async () => {
  const { data } = await client.get<Integration[]>("/api/v1/integrations/");
  return data;
};

export const createIntegration = async (payload: IntegrationCreate) => {
  const { data } = await client.post<Integration>("/api/v1/integrations/", payload);
  return data;
};

export const deleteIntegration = async (id: string) => {
  await client.delete(`/api/v1/integrations/${id}`);
};
