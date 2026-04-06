/** Override with VITE_API_BASE_URL in `.env.local` when using a local API (e.g. https://localhost:7287). */
const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  "https://brighthut-befxhqfdabcpfscu.centralus-01.azurewebsites.net";

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `API error ${res.status}: ${path}`);
  }
  return res.json();
}
