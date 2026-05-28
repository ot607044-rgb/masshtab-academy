import client from "./client";
import type { EmployeeCreate } from "../types";

export const getEmployees = async (params?: { department_id?: string; position_id?: string }) => {
  const { data } = await client.get("/api/v1/employees/", { params });
  return data;
};

export const createEmployee = async (payload: EmployeeCreate) => {
  const { data } = await client.post("/api/v1/employees/", payload);
  return data;
};

export const updateEmployee = async (id: string, payload: Partial<EmployeeCreate> & Record<string, unknown>) => {
  const { data } = await client.patch(`/api/v1/employees/${id}`, payload);
  return data;
};

export const deleteEmployee = async (id: string) => {
  await client.delete(`/api/v1/employees/${id}`);
};
