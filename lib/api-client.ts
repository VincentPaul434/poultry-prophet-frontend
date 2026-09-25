// Shared axios instance for the Poultry Prophet backend.
// - Injects the JWT from localStorage on every request.
// - Normalises Spring's ApiError body into a thrown ApiError so React Query's
//   `error` is always a predictable shape.
// - On 401 it clears the session and bounces to /login (handles expired tokens).

import axios, { AxiosError, type AxiosInstance } from "axios";
import { clearSession, getToken } from "./auth-storage";

// Browser requests stay on this origin. The Next.js route handler forwards
// them to the server-side API URL, keeping the upstream host out of the client
// bundle and browser network requests.
const API_PROXY_BASE_URL = "/api/backend";

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

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_PROXY_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<SpringApiError>) => {
    const status = error.response?.status ?? 0;

    if (status === 401 && typeof window !== "undefined") {
      const currentToken = getToken();
      const requestAuthorization = error.config?.headers?.Authorization;
      const requestUsedCurrentSession =
        !currentToken || requestAuthorization === `Bearer ${currentToken}`;

      // An old in-flight request must not log out a newer session that was
      // established while it was still completing.
      if (requestUsedCurrentSession) {
        clearSession();
        // Avoid redirect loops if we are already on an auth screen.
        if (!window.location.pathname.startsWith("/login")) {
          window.location.href = "/login";
        }
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
