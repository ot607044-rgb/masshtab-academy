import client from "./client";
import type { PositionCreate } from "../types";

export const getPositions = async (departmentId?: string) => {
  const params = departmentId ? { department_id: departmentId } : {};
  const { data } = await client.get("/api/v1/positions/", { params });
  return data;
};

export const createPosition = async (payload: PositionCreate) => {
  const { data } = await client.post("/api/v1/positions/", payload);
  return data;
};

export const updatePosition = async (id: string, payload: Partial<PositionCreate>) => {
  const { data } = await client.patch(`/api/v1/positions/${id}`, payload);
  return data;
};

export const deletePosition = async (id: string) => {
  await client.delete(`/api/v1/positions/${id}`);
};
