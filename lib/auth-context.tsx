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
import { refreshAccessToken } from "./api-client";
import {
  AUTH_SESSION_KEY,
  clearSession,
  getStoredUser,
  getRefreshToken,
  getToken,
  hasCurrentAccessToken,
  isAuthStorageKey,
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

  // Hydrate from localStorage once on mount. A still-current access token can
  // be reused by a new tab; rotating on every mount races single-use refresh
  // tokens across tabs and can revoke the whole session.
  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      const storedUser = getStoredUser();
      const token = getToken();
      const refreshToken = getRefreshToken();

      if (!storedUser || (!token && !refreshToken)) {
        clearSession();
        if (active) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      if (token && hasCurrentAccessToken(token)) {
        if (active) {
          setUser(storedUser);
          setIsLoading(false);
        }
        return;
      }

      if (!refreshToken) {
        clearSession();
        if (active) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      const refreshedToken = await refreshAccessToken();
      if (active) {
        // A transient refresh failure keeps the cached profile for offline
        // access; an invalid refresh token was cleared by the API client.
        setUser(refreshedToken ? getStoredUser() : getRefreshToken() ? storedUser : null);
        setIsLoading(false);
      }
    };

    void hydrate();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const syncSession = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage || !isAuthStorageKey(event.key)) return;
      // Legacy keys are observed only until the atomic session is migrated.
      if (event.key !== AUTH_SESSION_KEY && window.localStorage.getItem(AUTH_SESSION_KEY)) return;
      queryClient.clear();
      setUser(getToken() ? getStoredUser() : null);
    };
    window.addEventListener("storage", syncSession);
    return () => window.removeEventListener("storage", syncSession);
  }, [queryClient]);

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
