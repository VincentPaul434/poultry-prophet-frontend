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
import { accountApi, authApi, inviteApi } from "./api";
import {
  clearSession,
  getStoredUser,
  saveSession,
  type StoredUser,
} from "./auth-storage";
import type { LoginRequest, RegisterRequest, UpdateProfileRequest } from "./types";

interface AuthContextValue {
  user: StoredUser | null;
  isAuthenticated: boolean;
  isManager: boolean;
  isLoading: boolean;
  login: (body: LoginRequest) => Promise<StoredUser>;
  register: (body: RegisterRequest) => Promise<StoredUser>;
  acceptInvite: (token: string) => Promise<StoredUser>;
  updateProfile: (body: UpdateProfileRequest) => Promise<StoredUser>;
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

  const acceptInvite = useCallback(
    async (token: string) => {
      // Accepting assigns the handler to the farm and returns a fresh token
      // reflecting the new farmId, so we re-save the session like a re-login.
      const auth = await inviteApi.accept(token);
      const stored = saveSession(auth);
      setUser(stored);
      // The user now belongs to a farm; drop any cached (empty) farm data so
      // every query refetches against the new scope.
      queryClient.clear();
      return stored;
    },
    [queryClient]
  );

  const updateProfile = useCallback(async (body: UpdateProfileRequest) => {
    // Returns a fresh token (email is the JWT subject), so re-save the session.
    const auth = await accountApi.updateProfile(body);
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
      acceptInvite,
      updateProfile,
      logout,
    }),
    [user, isLoading, login, register, acceptInvite, updateProfile, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
