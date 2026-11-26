"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

type AuthContext = {
  user: User | null;
  ready: boolean; // false until the first /auth/me check finishes
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api<User>("/auth/me")
      .then(setUser, () => setUser(null))
      .finally(() => setReady(true));
  }, []);

  const submit = useCallback(async (path: string, email: string, password: string) => {
    const res = await api<{ user: User }>(path, { method: "POST", body: JSON.stringify({ email, password }) });
    setUser(res.user);
  }, []);

  const value = useMemo<AuthContext>(
    () => ({
      user,
      ready,
      login: (e, p) => submit("/auth/login", e, p),
      register: (e, p) => submit("/auth/register", e, p),
      logout: async () => {
        await api("/auth/logout", { method: "POST" });
        setUser(null);
      },
    }),
    [user, ready, submit],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
