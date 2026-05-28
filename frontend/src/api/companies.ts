import client from "./client";
import type { CreateCompanyPayload } from "../types";

export const getCompanies = async () => {
  const { data } = await client.get("/api/v1/companies/");
  return data;
};

export const getCompany = async (id: string) => {
  const { data } = await client.get(`/api/v1/companies/${id}`);
  return data;
};

export const createCompany = async (payload: CreateCompanyPayload) => {
  const { data } = await client.post("/api/v1/companies/", payload);
  return data;
};

export const deactivateCompany = async (id: string) => {
  const { data } = await client.patch(`/api/v1/companies/${id}/deactivate`);
  return data;
};

export const deleteCompany = async (id: string) => {
  await client.delete(`/api/v1/companies/${id}`);
};
