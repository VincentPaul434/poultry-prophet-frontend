// Shared axios instance for the Poultry Prophet backend.
// - Injects the access JWT from localStorage on every request.
// - Rotates the persisted refresh token once when an access token expires.
// - Normalises Spring's ApiError body into a thrown ApiError so React Query's
//   `error` is always a predictable shape.

import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import type { AuthResponse } from "./types";
import { clearSession, getRefreshToken, getToken, saveSession } from "./auth-storage";

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
  return error instanceof ApiError && (error.status === 0 || error.status >= 500);
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_PROXY_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _authRetry?: boolean;
};

// Several React Query requests can receive 401 at the same time when the PWA
// wakes. Share one refresh request so refresh-token rotation does not make the
// other requests look like token reuse.
let refreshPromise: Promise<string | null> | null = null;

function isAuthEndpoint(url?: string) {
  return Boolean(url && /\/auth\/(login|register|refresh|logout)(?:$|[/?])/.test(url));
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = axios
      .post<AuthResponse>(`${API_PROXY_BASE_URL}/auth/refresh`, { refreshToken }, {
        headers: { "Content-Type": "application/json" },
      })
      .then((response) => {
        saveSession(response.data);
        return response.data.token;
      })
      .catch((error: unknown) => {
        // Invalid or expired refresh credentials require a new login. A
        // network/server failure should leave the cached session intact so a
        // PWA can still use its offline data and retry later.
        if (axios.isAxiosError(error) && error.response && error.response.status < 500) {
          clearSession();
        }
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function redirectToLogin() {
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<SpringApiError>) => {
    const status = error.response?.status ?? 0;

    if (status === 401 && typeof window !== "undefined" && !isAuthEndpoint(error.config?.url)) {
      const requestConfig = error.config as RetriableRequestConfig | undefined;
      const currentToken = getToken();
      const requestAuthorization = error.config?.headers?.Authorization;
      const requestUsedCurrentSession =
        !currentToken || requestAuthorization === `Bearer ${currentToken}`;

      // An old in-flight request must not log out a newer session that was
      // established while it was still completing.
      if (requestUsedCurrentSession) {
        if (requestConfig && !requestConfig._authRetry && getRefreshToken()) {
          requestConfig._authRetry = true;
          const refreshedToken = await refreshAccessToken();
          if (refreshedToken) {
            requestConfig.headers.Authorization = `Bearer ${refreshedToken}`;
            return apiClient.request(requestConfig);
          }

          // Keep the cached session during a transient backend outage. If the
          // refresh credential was rejected, refreshAccessToken already
          // cleared it and the user should be sent back to login.
          if (getRefreshToken()) {
            const body = error.response?.data;
            return Promise.reject(new ApiError(
              body?.message || body?.error || error.message || "Authentication service unavailable.",
              status,
              body?.fieldErrors,
            ));
          }
        }

        clearSession();
        redirectToLogin();
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
