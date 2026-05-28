import client from "./client";
import type { DepartmentCreate } from "../types";

export const getDepartments = async () => {
  const { data } = await client.get("/api/v1/departments/");
  return data;
};

export const createDepartment = async (payload: DepartmentCreate) => {
  const { data } = await client.post("/api/v1/departments/", payload);
  return data;
};

export const updateDepartment = async (id: string, payload: Partial<DepartmentCreate>) => {
  const { data } = await client.patch(`/api/v1/departments/${id}`, payload);
  return data;
};

export const deleteDepartment = async (id: string) => {
  await client.delete(`/api/v1/departments/${id}`);
};
