import client from "./client";
import type { Employee, EmployeeCreate, EmployeeUpdate } from "../types";

export const getEmployeePhoto = (url: string) => client.get<Blob>(url, { responseType: "blob" }).then(r => r.data);
export const uploadEmployeePhoto = (id: string, file: File) => {
  const body = new FormData();
  body.append("file", file);
  return client.post<Employee>(`/api/v1/employees/${id}/photo`, body, { headers: { "Content-Type": "multipart/form-data" } }).then(r => r.data);
};
export const deleteEmployeePhoto = (id: string) => client.delete<Employee>(`/api/v1/employees/${id}/photo`).then(r => r.data);

export const getEmployees = async (params?: { department_id?: string; position_id?: string }) => {
  const { data } = await client.get("/api/v1/employees/", { params });
  return data;
};

export const createEmployee = async (payload: EmployeeCreate) => {
  const { data } = await client.post("/api/v1/employees/", payload);
  return data;
};

export const updateEmployee = async (id: string, payload: EmployeeUpdate & Record<string, unknown>) => {
  const { data } = await client.patch(`/api/v1/employees/${id}`, payload);
  return data;
};

export const deleteEmployee = async (id: string) => {
  await client.delete(`/api/v1/employees/${id}`);
};
