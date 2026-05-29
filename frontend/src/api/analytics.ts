import client from "./client";
import type {
  OverviewStats,
  DeptStat,
  WeakTopicStat,
  EmployeeProgress,
} from "../types";

export async function getOverview(): Promise<OverviewStats> {
  const res = await client.get<OverviewStats>("/api/v1/analytics/overview");
  return res.data;
}

export async function getByDepartment(): Promise<DeptStat[]> {
  const res = await client.get<DeptStat[]>("/api/v1/analytics/by-department");
  return res.data;
}

export async function getWeakTopics(): Promise<WeakTopicStat[]> {
  const res = await client.get<WeakTopicStat[]>("/api/v1/analytics/weak-topics");
  return res.data;
}

export async function getEmployeeProgress(
  departmentId?: string
): Promise<EmployeeProgress[]> {
  const res = await client.get<EmployeeProgress[]>(
    "/api/v1/analytics/employees",
    { params: departmentId ? { department_id: departmentId } : {} }
  );
  return res.data;
}

export async function getMyDepartment(): Promise<EmployeeProgress[]> {
  const res = await client.get<EmployeeProgress[]>(
    "/api/v1/analytics/my-department"
  );
  return res.data;
}
