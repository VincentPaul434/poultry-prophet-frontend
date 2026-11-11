// Small wrapper around localStorage for the access token, refresh token, and
// cached auth profile. Centralised so the axios interceptor, auth context and
// route guards all agree on the same keys and stay SSR-safe.

import type { AuthResponse } from "./types";

const TOKEN_KEY = "pp_auth_token";
const REFRESH_TOKEN_KEY = "pp_auth_refresh_token";
const USER_KEY = "pp_auth_user";
export const AUTH_SESSION_KEY = "pp_auth_session";

export type StoredUser = Omit<AuthResponse, "token" | "refreshToken" | "refreshTokenExpiresAt">;

type StoredSession = {
  token: string;
  refreshToken: string | null;
  refreshTokenExpiresAt: string | null;
  user: StoredUser;
};

function getSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as StoredSession;
    return typeof session.token === "string" && session.user ? session : null;
  } catch {
    return null;
  }
}

export function isAuthStorageKey(key: string | null) {
  return key === null || key === AUTH_SESSION_KEY || key === TOKEN_KEY || key === REFRESH_TOKEN_KEY || key === USER_KEY;
}

export function hasCurrentAccessToken(token: string) {
  const payload = token.split(".")[1];
  if (!payload || typeof atob === "undefined") return true;
  try {
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return typeof claims.exp !== "number" || claims.exp * 1000 > Date.now() + 30_000;
  } catch {
    // Older or opaque tokens can still be verified by the API's 401 response.
    return true;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return getSession()?.token ?? window.localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return getSession()?.refreshToken ?? window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const sessionUser = getSession()?.user;
  if (sessionUser) return sessionUser;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function saveSession(auth: AuthResponse): StoredUser {
  const user: StoredUser = {
    userId: auth.userId,
    email: auth.email,
    fullName: auth.fullName,
    role: auth.role,
    farmId: auth.farmId,
  };
  if (typeof window !== "undefined") {
    // Publish the complete rotation in one storage write. Other tabs must
    // never observe a new access token paired with the old refresh token.
    window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
      token: auth.token,
      refreshToken: auth.refreshToken || null,
      refreshTokenExpiresAt: auth.refreshTokenExpiresAt || null,
      user,
    } satisfies StoredSession));
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  }
  return user;
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(AUTH_SESSION_KEY);
}
