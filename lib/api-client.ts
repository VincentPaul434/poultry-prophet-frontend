// Shared axios instance for the Poultry Prophet backend.
// - Injects the in-memory access JWT on every request.
// - Rotates the HttpOnly refresh cookie when an access token expires.
// - Normalises Spring's ApiError body into a thrown ApiError so React Query's
//   `error` is always a predictable shape.

import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { getAuthRevision, getSessionScope, getToken, getStoredUser as getStoredIdentity, isAuthRequired, isRefreshUncertain, markAuthRequired, markRefreshUncertain, saveSession, type ClientAuthResponse } from "./auth-storage";
import { AuthLockError, withIndexedDbAuthLock } from "./auth-lock";

// Browser requests stay on this origin. The Next.js route handler forwards
// them to the server-side API URL, keeping the upstream host out of the client
// bundle and browser network requests.
const API_PROXY_BASE_URL = "/api/backend";
export const API_BASE_URL = API_PROXY_BASE_URL;

// Shape Spring's GlobalExceptionHandler returns.
interface SpringApiError {
  status?: number;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;

  constructor(message: string, status: number, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/** Use cached data only when a request could not reach a healthy API. A 4xx
 * response still carries important auth, permission, or validation state. */
export function shouldUseOfflineSnapshot(error: unknown) {
  return error instanceof ApiError && (error.status === 0 || error.status >= 500 || (error.status === 401 && isAuthRequired()));
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_PROXY_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _authRetry?: boolean;
  _sessionScope?: string | null;
};

// Several React Query requests can receive 401 at the same time when the PWA
// wakes. Share one refresh request so refresh-token rotation does not make the
// other requests look like token reuse.
let refreshPromise: Promise<string | null> | null = null;

function isAuthEndpoint(url?: string) {
  return Boolean(url && /\/auth\/(login|register|refresh|logout)(?:$|[/?])|\/invites\/[^/]+\/accept(?:$|[/?])|\/account\/profile(?:$|[/?])/.test(url));
}

// Every tab uses IndexedDB, even when Web Locks are available, so mixed
// browser capabilities cannot create independent credential locks.
export async function withAuthLock<T>(operation: () => Promise<T>): Promise<T> {
  const coordinated = () => withIndexedDbAuthLock(operation);
  try {
    if (typeof navigator !== "undefined" && typeof navigator.locks?.request === "function") return await navigator.locks.request("poultry-prophet-auth-refresh", coordinated);
    return await coordinated();
  } catch (error) {
    if (error instanceof AuthLockError) throw new ApiError(error.message, 503);
    throw error;
  }
}

export function logoutIfCurrent(revision: string | null, logout: () => Promise<unknown>) {
  return withAuthLock(async () => {
    if (getAuthRevision() !== revision || getSessionScope()) return;
    await logout();
  });
}

export async function refreshAccessToken() {
  const scope = getSessionScope();
  if (!scope) return null;
  if (!refreshPromise) {
    const rotate = async () => {
      if (getSessionScope() !== scope || isAuthRequired() || isRefreshUncertain() || navigator.onLine === false) return null;
      // Persist intent before sending: if this tab closes mid-rotation, another
      // tab must not replay a cookie the backend may already have consumed.
      markRefreshUncertain();
      try {
        const response = await axios.post<ClientAuthResponse>(
          `${API_PROXY_BASE_URL}/auth/refresh`, {}, { headers: { "Content-Type": "application/json" } },
        );
        if (getSessionScope() !== scope) return null;
        if (response.data.userId !== getStoredIdentity()?.userId || response.data.farmId !== getStoredIdentity()?.farmId) {
          markAuthRequired();
          return null;
        }
        saveSession(response.data, true);
        return response.data.token;
      } catch (error) {
        if (getSessionScope() !== scope) return null;
        if (axios.isAxiosError(error) && (error.response?.status === 400 || error.response?.status === 401)) markAuthRequired();
        return null;
      }
    };
    refreshPromise = withAuthLock(rotate).catch(() => null).finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

function redirectToLogin() {
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}

apiClient.interceptors.request.use((config) => {
  const request = config as RetriableRequestConfig;
  const scope = getSessionScope();
  if (isAuthRequired() && !/\/auth\/(login|register|logout)(?:$|[/?])/.test(config.url ?? "")) {
    throw new ApiError("Sign in again to sync your records.", 401);
  }
  if (request._authRetry && request._sessionScope !== scope) {
    throw new ApiError("Your session changed. Please try again.", 401);
  }
  if (!request._authRetry) request._sessionScope = scope;
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<SpringApiError> | ApiError) => {
    if (error instanceof ApiError) return Promise.reject(error);
    const status = error.response?.status ?? 0;

    if (status === 401 && typeof window !== "undefined" && !isAuthEndpoint(error.config?.url)) {
      const requestConfig = error.config as RetriableRequestConfig | undefined;
      if (!requestConfig || !requestConfig._sessionScope || requestConfig._sessionScope !== getSessionScope()) {
        return Promise.reject(new ApiError("Your session changed. Please try again.", 401));
      }
      const currentToken = getToken();
      const requestAuthorization = error.config?.headers?.Authorization;
      const requestUsedCurrentSession =
        !currentToken || requestAuthorization === `Bearer ${currentToken}`;

      if (requestConfig && !requestConfig._authRetry && currentToken && !requestUsedCurrentSession) {
        // A different tab already refreshed after this request was sent.
        requestConfig._authRetry = true;
        requestConfig.headers.Authorization = `Bearer ${currentToken}`;
        return apiClient.request(requestConfig);
      }

      // An old in-flight request must not log out a newer session that was
      // established while it was still completing.
      if (requestUsedCurrentSession) {
        if (requestConfig && !requestConfig._authRetry && getSessionScope()) {
          requestConfig._authRetry = true;
          const refreshedToken = await refreshAccessToken();
          if (refreshedToken && requestConfig._sessionScope === getSessionScope()) {
            requestConfig.headers.Authorization = `Bearer ${refreshedToken}`;
            return apiClient.request(requestConfig);
          }

          // Keep the cached session during a transient backend outage. If the
          // refresh credential was rejected, refreshAccessToken already
          // cleared it and the user should be sent back to login.
          if (requestConfig._sessionScope !== getSessionScope()) {
            if (!getSessionScope()) redirectToLogin();
            return Promise.reject(new ApiError("Your session changed. Please try again.", 401));
          }
          if (isAuthRequired()) return Promise.reject(new ApiError("Sign in again to sync your records.", 401));
          if (getSessionScope()) {
            return Promise.reject(new ApiError("Authentication service unavailable. Please sign in again if the problem persists.", 503));
          }
        }

        markAuthRequired();
        return Promise.reject(new ApiError("Sign in again to sync your records.", 401));
      }
    }

    const body = error.response?.data;
    const message =
      body?.message ||
      body?.error ||
      error.message ||
      "Something went wrong talking to the server.";

    return Promise.reject(new ApiError(message, status, body?.fieldErrors));
  }
);
