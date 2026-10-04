import client from "./client";
import type { LessonCreate, LessonUpdate, MaterialLinkCreate } from "../types";

export const getLessons = async (params?: {
  status_filter?: string;
  position_id?: string;
  topic_id?: string;
}) => {
  const { data } = await client.get("/api/v1/lessons/", { params });
  return data;
};

export const getLesson = async (id: string) => {
  const { data } = await client.get(`/api/v1/lessons/${id}`);
  return data;
};

export const createLesson = async (payload: LessonCreate) => {
  const { data } = await client.post("/api/v1/lessons/", payload);
  return data;
};

export const updateLesson = async (id: string, payload: LessonUpdate) => {
  const { data } = await client.patch(`/api/v1/lessons/${id}`, payload);
  return data;
};

/** Set the study order inside one block; topicId null is "Без блока". */
export const reorderLessons = async (topicId: string | null, ids: string[]) => {
  await client.post("/api/v1/lessons/reorder", { topic_id: topicId, ids });
};

export const publishLesson = async (id: string) => {
  const { data } = await client.post(`/api/v1/lessons/${id}/publish`);
  return data;
};

export const archiveLesson = async (id: string) => {
  const { data } = await client.post(`/api/v1/lessons/${id}/archive`);
  return data;
};

export const deleteLesson = async (id: string) => {
  await client.delete(`/api/v1/lessons/${id}`);
};

export const addMaterialLink = async (lessonId: string, payload: MaterialLinkCreate) => {
  const { data } = await client.post(`/api/v1/lessons/${lessonId}/materials`, payload);
  return data;
};

export const uploadFileMaterial = async (lessonId: string, file: File, title: string) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", title || file.name);
  const { data } = await client.post(`/api/v1/lessons/${lessonId}/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const deleteMaterial = async (lessonId: string, materialId: string) => {
  await client.delete(`/api/v1/lessons/${lessonId}/materials/${materialId}`);
};
