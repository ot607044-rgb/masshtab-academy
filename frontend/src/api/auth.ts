import client from "./client";

export const login = async (email: string, password: string) => {
  const { data } = await client.post("/api/v1/auth/login", { email, password });
  return data;
};

export const getMe = async () => {
  const { data } = await client.get("/api/v1/auth/me");
  return data;
};
