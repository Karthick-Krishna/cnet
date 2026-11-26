import { handleSandboxRequest } from './sandboxAdapter';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let sessionExpiredHandler: (() => void) | null = null;
export function onSessionExpired(cb: () => void) {
  sessionExpiredHandler = cb;
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem('meridian_access_token');
}

export function setAccessToken(token: string | null) {
  if (token) {
    sessionStorage.setItem('meridian_access_token', token);
  } else {
    sessionStorage.removeItem('meridian_access_token');
  }
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit & { skipAuthHandling?: boolean } = {}
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      // Static Vercel deployment rewrite returned index.html instead of API JSON
      if (!API_BASE) {
        return (await handleSandboxRequest(path, options)) as T;
      }
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if ((res.status === 401 || res.status === 403) && !options.skipAuthHandling && token && path !== '/api/auth/login') {
        if (data?.error?.toLowerCase().includes('expired') || data?.error?.toLowerCase().includes('invalid token')) {
          sessionExpiredHandler?.();
        }
      }
      throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data?.code);
    }

    return data as T;
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    // Network error when no external API_BASE configured -> fallback to Vercel static sandbox adapter
    if (!API_BASE && typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      return (await handleSandboxRequest(path, options)) as T;
    }
    throw err;
  }
}

export function generateIdempotencyKey(prefix = 'idemp'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
