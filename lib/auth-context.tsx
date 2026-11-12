"use client";

// Client-side auth state. Holds the decoded profile from the JWT login response
// in React state (restored through the refresh cookie on mount) and exposes login /
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
import { ApiError, logoutIfCurrent, refreshAccessToken, withAuthLock } from "./api-client";
import {
  AUTH_SESSION_KEY,
  AUTH_STATE_EVENT,
  clearSession,
  getStoredUser,
  getAuthRevision,
  getSessionScope,
  purgeLegacyCredentials,
  getToken,
  isAuthStorageKey,
  isAuthRequired,
  saveSession,
  type StoredUser,
} from "./auth-storage";
import type { LoginRequest, RegisterRequest, UpdateProfileRequest } from "./types";

interface AuthContextValue {
  user: StoredUser | null;
  isAuthenticated: boolean;
  isManager: boolean;
  isLoading: boolean;
  authRequired: boolean;
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
  const [authRequired, setAuthRequired] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  // The cached profile enables offline work; credentials are restored only
  // through the same-origin refresh route and remain in memory.
  useEffect(() => {
    let active = true;
    purgeLegacyCredentials();
    const hydrate = async () => {
      if (getStoredUser() && !getToken()) await refreshAccessToken();
      if (active) { setUser(getStoredUser()); setAuthRequired(isAuthRequired()); setIsLoading(false); }
    };
    void hydrate();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const syncSession = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage || !isAuthStorageKey(event.key)) return;
      if (event.key !== AUTH_SESSION_KEY && window.localStorage.getItem(AUTH_SESSION_KEY)) return;
      queryClient.clear();
      const nextUser = getStoredUser();
      setUser(nextUser);
      setAuthRequired(isAuthRequired());
      if (nextUser && !getToken() && !isAuthRequired()) {
        void refreshAccessToken().then(() => { setUser(getStoredUser()); setAuthRequired(isAuthRequired()); });
      }
    };
    const syncLocalState = () => { setUser(getStoredUser()); setAuthRequired(isAuthRequired()); };
    window.addEventListener("storage", syncSession);
    window.addEventListener(AUTH_STATE_EVENT, syncLocalState);
    return () => { window.removeEventListener("storage", syncSession); window.removeEventListener(AUTH_STATE_EVENT, syncLocalState); };
  }, [queryClient]);

  const establish = useCallback(async (request: () => Promise<import("./auth-storage").ClientAuthResponse>, preserveScope = false) => {
    const revision = getAuthRevision();
    const scope = getSessionScope();
    await queryClient.cancelQueries();
    const run = () => withAuthLock(async () => {
      if (getAuthRevision() !== revision || (preserveScope && getSessionScope() !== scope)) throw new Error("Your session changed. Please try again.");
      const auth = await request();
      if (getAuthRevision() !== revision || (preserveScope && getSessionScope() !== scope)) throw new Error("Your session changed. Please try again.");
      queryClient.clear();
      const stored = saveSession(auth);
      setUser(stored);
      setAuthRequired(false);
      return stored;
    });
    try {
      return await run();
    } catch (error) {
      // Credential-changing requests cannot refresh while holding the lock.
      if (!preserveScope || !(error instanceof ApiError) || error.status !== 401 || !await refreshAccessToken()) throw error;
      return run();
    }
  }, [queryClient]);

  const login = useCallback((body: LoginRequest) => establish(() => authApi.login(body)), [establish]);
  const register = useCallback((body: RegisterRequest) => establish(() => authApi.register(body)), [establish]);
  const acceptInvite = useCallback((token: string) => establish(() => inviteApi.accept(token), true), [establish]);
  const updateProfile = useCallback((body: UpdateProfileRequest) => establish(() => accountApi.updateProfile(body), true), [establish]);

  const logout = useCallback(async () => {
    clearSession();
    const revision = getAuthRevision();
    setUser(null);
    setAuthRequired(false);
    queryClient.clear();
    router.push("/login");
    try {
      await logoutIfCurrent(revision, () => authApi.logout());
    } catch {
      // The local session stays signed out even when revocation is unavailable.
    }
  }, [queryClient, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      // The cached profile retains the offline queue scope during an outage.
      isAuthenticated: !!user && !!getSessionScope(),
      isManager: user?.role === "MANAGER",
      isLoading,
      authRequired,
      login,
      register,
      acceptInvite,
      updateProfile,
      logout,
    }),
    [user, isLoading, authRequired, login, register, acceptInvite, updateProfile, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
