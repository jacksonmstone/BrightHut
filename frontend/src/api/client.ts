/** Override with VITE_API_BASE_URL in `.env.local` when using a local API (e.g. https://localhost:7287). */
const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  "https://brighthut-befxhqfdabcpfscu.centralus-01.azurewebsites.net";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `API error ${res.status}: ${path}`);
  }
  return res.json();
}

function parseApiError(b: unknown, status: number, path: string): string {
  if (b && typeof b === 'object') {
    const o = b as Record<string, unknown>
    if (typeof o.error === 'string') return o.error
    if (typeof o.detail === 'string') return o.detail
    if (typeof o.title === 'string') return o.title
  }
  return `API error ${status}: ${path}`
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(parseApiError(b, res.status, path));
  }
  return res.json();
}

export async function apiPut(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(parseApiError(b, res.status, path));
  }
}
