import client from "./client";
import type { KnowledgeTopicCreate } from "../types";

export const getTopics = async () => {
  const { data } = await client.get("/api/v1/knowledge/topics");
  return data;
};

export const createTopic = async (payload: KnowledgeTopicCreate) => {
  const { data } = await client.post("/api/v1/knowledge/topics", payload);
  return data;
};

export const deleteTopic = async (id: string) => {
  await client.delete(`/api/v1/knowledge/topics/${id}`);
};

export const getMatrix = async (positionId: string) => {
  const { data } = await client.get("/api/v1/knowledge/matrix", {
    params: { position_id: positionId },
  });
  return data;
};

export const assignTopic = async (positionId: string, topicId: string, isRequired = true) => {
  const { data } = await client.post("/api/v1/knowledge/matrix", {
    position_id: positionId,
    topic_id: topicId,
    is_required: isRequired,
  });
  return data;
};

export const removeTopicFromMatrix = async (linkId: string) => {
  await client.delete(`/api/v1/knowledge/matrix/${linkId}`);
};
