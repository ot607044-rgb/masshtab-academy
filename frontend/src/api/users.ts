import client from "./client";
import type { CreateUserPayload } from "../types";

export const getUsers = async () => {
  const { data } = await client.get("/api/v1/users/");
  return data;
};

export const createUser = async (payload: CreateUserPayload) => {
  const { data } = await client.post("/api/v1/users/", payload);
  return data;
};

export const updateUser = async (id: string, payload: Partial<{ full_name: string; role: string; is_active: boolean }>) => {
  const { data } = await client.patch(`/api/v1/users/${id}`, payload);
  return data;
};
