import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, restoreSession, setToken, setUnauthorizedHandler } from "../api/client";
import type { AuthResponse, MeUser, Role } from "../api/types";

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role?: Extract<Role, "student" | "staff">;
  department?: string;
}

interface AuthContextValue {
  user: MeUser | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<MeUser>;
  register: (input: RegisterInput) => Promise<MeUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MeUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  const refresh = useCallback(async () => {
    const { user: me } = await api.get<{ user: MeUser | null }>("/api/auth/me");
    setUser(me);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      void setToken(null);
    });

    (async () => {
      try {
        const stored = await restoreSession();
        if (stored) await refresh();
      } catch {
        await setToken(null);
      } finally {
        setInitializing(false);
      }
    })();

    return () => setUnauthorizedHandler(null);
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<AuthResponse>("/api/auth/login", { email, password });
    if (result.token) await setToken(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const result = await api.post<AuthResponse>("/api/auth/register", input);
    if (result.token) await setToken(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    await api.post("/api/auth/logout", {}).catch(() => undefined);
    await setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, initializing, login, register, logout, refresh }),
    [user, initializing, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
