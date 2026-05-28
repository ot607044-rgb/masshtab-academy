import client from "./client";

export const getAssignments = async (employeeId?: string) => {
  const params = employeeId ? { employee_id: employeeId } : {};
  const { data } = await client.get("/api/v1/assignments/", { params });
  return data;
};

export const getMyAssignments = async () => {
  const { data } = await client.get("/api/v1/assignments/my");
  return data;
};

export const createAssignment = async (payload: {
  lesson_id: string;
  employee_id: string;
  due_date?: string;
}) => {
  const { data } = await client.post("/api/v1/assignments/", payload);
  return data;
};

export const updateAssignmentStatus = async (
  id: string,
  status: "assigned" | "in_progress" | "completed"
) => {
  const { data } = await client.patch(`/api/v1/assignments/${id}/status`, { status });
  return data;
};

export const deleteAssignment = async (id: string) => {
  await client.delete(`/api/v1/assignments/${id}`);
};
