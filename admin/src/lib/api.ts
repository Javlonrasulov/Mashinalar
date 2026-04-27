export const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:3000';

export function getToken(): string | null {
  return localStorage.getItem('mashinalar_token');
}

export function setToken(token: string) {
  localStorage.setItem('mashinalar_token', token);
}

export function clearToken() {
  localStorage.removeItem('mashinalar_token');
}

export function apiUrl(path: string) {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

function formatNestErrorMessage(j: { message?: unknown; error?: string }): string {
  const m = j.message;
  if (Array.isArray(m)) {
    return m
      .map((x) => {
        if (typeof x === 'string') return x;
        if (x && typeof x === 'object' && 'constraints' in x) {
          const c = (x as { constraints?: Record<string, string> }).constraints;
          if (c && typeof c === 'object') return Object.values(c).join(', ');
        }
        try {
          return JSON.stringify(x);
        } catch {
          return String(x);
        }
      })
      .filter(Boolean)
      .join('; ');
  }
  if (typeof m === 'string') return m;
  if (m != null) return String(m);
  return j.error || JSON.stringify(j);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(apiUrl(path), { ...init, headers });
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new Event('mashinalar:auth'));
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = (await res.json()) as { message?: unknown; error?: string };
      msg = formatNestErrorMessage(j);
    } catch {
      try {
        msg = await res.text();
      } catch {
        /* ignore */
      }
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
