import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getActiveSupportSession, setActiveSupportSession } from "../api/client";
import type { ActiveSupportSession } from "../types";

interface SupportContextType {
  session: ActiveSupportSession | null;
  enterSupportMode: (session: ActiveSupportSession) => void;
  exitSupportMode: () => void;
  timeLeftLabel: string;
}

const SupportContext = createContext<SupportContextType>({
  session: null,
  enterSupportMode: () => {},
  exitSupportMode: () => {},
  timeLeftLabel: "",
});

export const SupportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<ActiveSupportSession | null>(() =>
    getActiveSupportSession()
  );
  const [timeLeftLabel, setTimeLeftLabel] = useState("");

  const enterSupportMode = useCallback((s: ActiveSupportSession) => {
    setActiveSupportSession(s);
    setSession(s);
  }, []);

  const exitSupportMode = useCallback(() => {
    setActiveSupportSession(null);
    setSession(null);
    setTimeLeftLabel("");
  }, []);

  // Countdown ticker
  useEffect(() => {
    if (!session) return;
    const tick = () => {
      const diff = new Date(session.expires_at).getTime() - Date.now();
      if (diff <= 0) {
        exitSupportMode();
        return;
      }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setTimeLeftLabel(h > 0 ? `${h}ч ${m}м` : `${m}м`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [session, exitSupportMode]);

  return (
    <SupportContext.Provider value={{ session, enterSupportMode, exitSupportMode, timeLeftLabel }}>
      {children}
    </SupportContext.Provider>
  );
};

export const useSupport = () => useContext(SupportContext);
