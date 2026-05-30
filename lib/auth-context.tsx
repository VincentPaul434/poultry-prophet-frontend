"use client";

// Client-side auth state. Holds the decoded profile from the JWT login response
// in React state (hydrated from localStorage on mount) and exposes login /
// register / logout. On logout we also clear the React Query cache so a new user
// never sees the previous user's cached data.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { authApi } from "./api";
import {
  clearSession,
  getStoredUser,
  saveSession,
  type StoredUser,
} from "./auth-storage";
import type { LoginRequest, RegisterRequest } from "./types";

interface AuthContextValue {
  user: StoredUser | null;
  isAuthenticated: boolean;
  isManager: boolean;
  isLoading: boolean;
  login: (body: LoginRequest) => Promise<StoredUser>;
  register: (body: RegisterRequest) => Promise<StoredUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  const router = useRouter();

  // Hydrate from localStorage once on mount (avoids SSR/client mismatch).
  useEffect(() => {
    setUser(getStoredUser());
    setIsLoading(false);
  }, []);

  const login = useCallback(async (body: LoginRequest) => {
    const auth = await authApi.login(body);
    const stored = saveSession(auth);
    setUser(stored);
    return stored;
  }, []);

  const register = useCallback(async (body: RegisterRequest) => {
    const auth = await authApi.register(body);
    const stored = saveSession(auth);
    setUser(stored);
    return stored;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    queryClient.clear();
    router.push("/login");
  }, [queryClient, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isManager: user?.role === "MANAGER",
      isLoading,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
