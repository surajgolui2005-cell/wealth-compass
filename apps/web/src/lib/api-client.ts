import axios, { AxiosError } from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  withCredentials: true, // sends HTTP-only cookie for auth
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

// ── Response interceptor: unwrap success envelope & handle 401 ──────────────
apiClient.interceptors.response.use(
  (response) => {
    // Unwrap { success: true, data: T } → T
    if (response.data?.success === true) {
      return { ...response, data: response.data.data, meta: response.data.meta };
    }
    return response;
  },
  async (error: AxiosError) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    // Re-shape error for consumers
    const apiError = (error.response?.data as any)?.error;
    return Promise.reject(
      apiError
        ? new ApiError(apiError.code, apiError.message, apiError.details)
        : error,
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
    this.name = 'ApiError';
  }
}

// ── Typed helpers ────────────────────────────────────────────────────────────
export type PaginatedResponse<T> = {
  data: T[];
  meta: { timestamp: string; pagination: { page: number; limit: number; total: number; totalPages: number } };
};
