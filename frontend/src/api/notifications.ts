import client from "./client";
import type { Notification, NotificationUnreadCount } from "../types";

export async function getNotifications(limit = 50): Promise<Notification[]> {
  const res = await client.get<Notification[]>("/api/v1/notifications/", {
    params: { limit },
  });
  return res.data;
}

export async function getUnreadCount(): Promise<NotificationUnreadCount> {
  const res = await client.get<NotificationUnreadCount>(
    "/api/v1/notifications/unread-count"
  );
  return res.data;
}

export async function markRead(id: string): Promise<Notification> {
  const res = await client.post<Notification>(
    `/api/v1/notifications/${id}/read`
  );
  return res.data;
}

export async function markAllRead(): Promise<void> {
  await client.post("/api/v1/notifications/read-all");
}
