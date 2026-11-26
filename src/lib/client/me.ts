"use client";

import { createContext, useContext } from "react";

export type Role = "student" | "staff" | "security" | "admin" | "sysadmin";

export interface Me {
  id: string;
  name: string;
  email: string;
  role: Role;
  department?: string;
}

export interface MeState {
  user: Me | null;
  loading: boolean;
  refresh: () => void;
  logout: () => Promise<void>;
}

export const MeContext = createContext<MeState>({
  user: null,
  loading: true,
  refresh: () => {},
  logout: async () => {},
});

export function useMe(): MeState {
  return useContext(MeContext);
}

export function isModeratorRole(role?: Role | null): boolean {
  return role === "security" || role === "admin" || role === "sysadmin";
}

export function isConfigRole(role?: Role | null): boolean {
  return role === "admin" || role === "sysadmin";
}
