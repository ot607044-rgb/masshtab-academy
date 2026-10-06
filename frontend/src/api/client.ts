import axios from "axios";

const SUPPORT_SESSION_KEY = "support_session";

export function getActiveSupportSession() {
  const raw = localStorage.getItem(SUPPORT_SESSION_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (s.expires_at && new Date(s.expires_at) < new Date()) {
      localStorage.removeItem(SUPPORT_SESSION_KEY);
      return null;
    }
    return s as { id: string; company_id: string; company_name: string; expires_at: string; reason: string };
  } catch {
    return null;
  }
}

export function setActiveSupportSession(session: {
  id: string;
  company_id: string;
  company_name: string;
  expires_at: string;
  reason: string;
} | null) {
  if (session) {
    localStorage.setItem(SUPPORT_SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SUPPORT_SESSION_KEY);
  }
}

// В продакшне nginx проксирует /api/* → backend, поэтому baseURL = ""
// В dev-режиме Vite proxy тоже перехватывает /api/*, поэтому работает одинаково
const client = axios.create({
  baseURL: "",
  headers: { "Content-Type": "application/json" },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const session = getActiveSupportSession();
  if (session) {
    config.headers["X-Support-Session"] = session.id;
  }

  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("access_token");
    if (!window.location.pathname.startsWith("/book/")) window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default client;
