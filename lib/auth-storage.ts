// Only the non-secret profile and session identifier persist across tabs.
import type { AuthResponse } from "./types";

export const AUTH_SESSION_KEY = "pp_auth_session";
export const AUTH_STATE_EVENT = "poultry-auth-state";
const REVISION_KEY = "pp_auth_revision";
const LEGACY_KEYS = ["pp_auth_token", "pp_auth_refresh_token", "pp_auth_user"];
export type StoredUser = Omit<AuthResponse, "token" | "refreshToken" | "refreshTokenExpiresAt">;
export type ClientAuthResponse = StoredUser & { token: string };
type StoredSession = { sessionId: string; user: StoredUser; refreshUncertain?: boolean; authRequired?: boolean };
let accessToken: string | null = null;
let tokenSessionId: string | null = null;

function session(): StoredSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    // Never migrate legacy bearer credentials into the new session.
    if (typeof value.sessionId !== "string" || !value.user || "token" in value || "refreshToken" in value) {
      window.localStorage.removeItem(AUTH_SESSION_KEY);
      return null;
    }
    return value as StoredSession;
  } catch { window.localStorage.removeItem(AUTH_SESSION_KEY); return null; }
}

export function purgeLegacyCredentials() {
  if (typeof window === "undefined") return;
  for (const key of LEGACY_KEYS) window.localStorage.removeItem(key);
  session();
}
export function getSessionScope(): string | null {
  const current = session();
  return current ? JSON.stringify([current.sessionId, current.user.userId, current.user.farmId]) : null;
}
export function isAuthStorageKey(key: string | null) { return key === null || key === AUTH_SESSION_KEY || LEGACY_KEYS.includes(key); }
export function getToken(): string | null {
  const current = session();
  return !current?.authRequired && current?.sessionId === tokenSessionId ? accessToken : null;
}
export function getStoredUser(): StoredUser | null { return session()?.user ?? null; }
export function isAuthRequired() { return !!session()?.authRequired; }
export function markAuthRequired() {
  const current = session();
  accessToken = null;
  tokenSessionId = null;
  if (!current) return;
  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ sessionId: current.sessionId, user: current.user, authRequired: true }));
  if (typeof window.dispatchEvent === "function") window.dispatchEvent(new Event(AUTH_STATE_EVENT));
}
export function isRefreshUncertain() { return !!session()?.refreshUncertain; }
export function markRefreshUncertain() {
  const current = session();
  if (current) window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ ...current, refreshUncertain: true }));
}
export function getAuthRevision() { return typeof window === "undefined" ? null : window.localStorage.getItem(REVISION_KEY); }
export function saveSession(auth: ClientAuthResponse, preserveSession = false): StoredUser {
  const user: StoredUser = { userId: auth.userId, email: auth.email, fullName: auth.fullName, role: auth.role, farmId: auth.farmId };
  const previous = preserveSession ? session() : null;
  const sessionId = previous?.sessionId ?? crypto.randomUUID();
  if (typeof window !== "undefined") {
    purgeLegacyCredentials();
    if (!preserveSession) window.localStorage.setItem(REVISION_KEY, crypto.randomUUID());
    window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ sessionId, user }));
  }
  accessToken = auth.token;
  tokenSessionId = sessionId;
  return user;
}
export function clearSession() {
  accessToken = null;
  tokenSessionId = null;
  if (typeof window === "undefined") return;
  for (const key of LEGACY_KEYS) window.localStorage.removeItem(key);
  window.localStorage.setItem(REVISION_KEY, crypto.randomUUID());
  window.localStorage.removeItem(AUTH_SESSION_KEY);
}
