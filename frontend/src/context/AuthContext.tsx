import React, { createContext, useContext, useState, useEffect } from "react";
import { login as apiLogin, getMe } from "../api/auth";
import type { User } from "../types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signInWithToken: (token: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem("access_token");
      if (token) {
        try {
          const me = await getMe();
          setUser(me);
        } catch {
          localStorage.removeItem("access_token");
        }
      }
      setIsLoading(false);
    };
    init();
  }, []);

  const signInWithToken = async (token: string) => {
    localStorage.setItem("access_token", token);
    setUser(await getMe());
  };

  const login = async (email: string, password: string) => {
    const data = await apiLogin(email, password);
    await signInWithToken(data.access_token);
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signInWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
