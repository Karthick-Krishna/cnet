const API_BASE = (import.meta as any).env?.VITE_API_URL || '';

export function getAdminToken(): string | null {
  return sessionStorage.getItem('meridian_admin_token');
}

export function setAdminToken(token: string | null) {
  if (token) sessionStorage.setItem('meridian_admin_token', token);
  else sessionStorage.removeItem('meridian_admin_token');
}

export async function adminRequest<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Admin request failed (${res.status})`);
  }
  return data as T;
}
