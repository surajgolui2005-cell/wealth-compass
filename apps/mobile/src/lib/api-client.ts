import axios, { AxiosError } from "axios";
import Constants from "expo-constants";

// Auto-detect host IP so physical phones running Expo Go on the same Wi-Fi can connect to PC backend
const hostUri = Constants.expoConfig?.hostUri;
const hostIp = hostUri ? hostUri.split(":")[0] : "localhost";
const configuredBase = Constants.expoConfig?.extra?.apiBaseUrl as string;
const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  (configuredBase ? configuredBase.replace("localhost", hostIp) : `http://${hostIp}:3000`);

export const apiClient = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

// Navigation callback — set by root navigator on mount
let _onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  _onUnauthorized = fn;
}

// Response interceptor: unwrap success envelope & handle 401
apiClient.interceptors.response.use(
  (response) => {
    if (response.data?.success === true) {
      return { ...response, data: response.data.data, meta: response.data.meta };
    }
    return response;
  },
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      _onUnauthorized?.();
    }
    const apiError = (error.response?.data as any)?.error;
    return Promise.reject(
      apiError ? new ApiError(apiError.code, apiError.message, apiError.details) : error,
    );
  },
);

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: any,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
