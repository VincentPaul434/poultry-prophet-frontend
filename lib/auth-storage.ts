// Small wrapper around localStorage for the access token, refresh token, and
// cached auth profile. Centralised so the axios interceptor, auth context and
// route guards all agree on the same keys and stay SSR-safe.

import type { AuthResponse } from "./types";

const TOKEN_KEY = "pp_auth_token";
const REFRESH_TOKEN_KEY = "pp_auth_refresh_token";
const USER_KEY = "pp_auth_user";

export type StoredUser = Omit<AuthResponse, "token" | "refreshToken" | "refreshTokenExpiresAt">;

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
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
    window.localStorage.setItem(TOKEN_KEY, auth.token);
    if (auth.refreshToken) {
      window.localStorage.setItem(REFRESH_TOKEN_KEY, auth.refreshToken);
    } else {
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  return user;
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}
