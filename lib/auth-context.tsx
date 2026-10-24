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
import { ApiError } from "./api-client";
import {
  clearSession,
  getStoredUser,
  getRefreshToken,
  getToken,
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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  const router = useRouter();

  // Hydrate from localStorage once on mount (avoids SSR/client mismatch). If a
  // refresh token exists, rotate it before exposing the authenticated app so a
  // PWA opened after the access JWT expires can restore the session silently.
  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      const storedUser = getStoredUser();
      const refreshToken = getRefreshToken();

      if (!refreshToken) {
        if (active) {
          setUser(storedUser);
          setIsLoading(false);
        }
        return;
      }

      try {
        const auth = await authApi.refresh(refreshToken);
        if (active) setUser(saveSession(auth));
      } catch (error) {
        // Keep the cached profile for an offline/transient startup failure;
        // the API client can retry once the backend is reachable again. A
        // rejected 4xx refresh credential means the session really ended.
        const transient = error instanceof ApiError && (error.status === 0 || error.status >= 500);
        if (active) {
          if (transient) {
            setUser(storedUser);
          } else {
            clearSession();
            setUser(null);
          }
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void hydrate();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (body: LoginRequest) => {
    await queryClient.cancelQueries();
    const auth = await authApi.login(body);
    // Discard queries from any previous session before the new user's
    // farm-scoped requests start. Otherwise stale/in-flight queries can
    // surface 401/403 responses after the redirect to the dashboard.
    queryClient.clear();
    const stored = saveSession(auth);
    setUser(stored);
    return stored;
  }, [queryClient]);

  const register = useCallback(async (body: RegisterRequest) => {
    await queryClient.cancelQueries();
    const auth = await authApi.register(body);
    queryClient.clear();
    const stored = saveSession(auth);
    setUser(stored);
    return stored;
  }, [queryClient]);

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

  const logout = useCallback(async () => {
    try {
      // The endpoint can revoke one device session when given the refresh
      // token. If an older session has no refresh token, it still clears the
      // local state below without blocking sign-out.
      await authApi.logout(getRefreshToken() ?? undefined);
    } catch {
      // Sign-out is local-first: a failed network request must not leave the
      // user appearing logged in on this device.
    }
    clearSession();
    setUser(null);
    queryClient.clear();
    router.push("/login");
  }, [queryClient, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      // A cached profile without its token is not a valid session. This can
      // happen after storage is partially cleared or an old session expires.
      isAuthenticated: !!user && !!getToken(),
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
