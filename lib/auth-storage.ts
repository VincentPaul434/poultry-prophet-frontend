// Small wrapper around localStorage for the JWT and the cached auth profile.
// Centralised so the axios interceptor, auth context and route guards all agree
// on the same keys and stay SSR-safe.

import type { AuthResponse } from "./types";

const TOKEN_KEY = "pp_auth_token";
const USER_KEY = "pp_auth_user";

export type StoredUser = Omit<AuthResponse, "token">;

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
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
  const { token, ...user } = auth;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  return user;
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}
