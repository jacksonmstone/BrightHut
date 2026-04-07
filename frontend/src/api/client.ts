/** Override with VITE_API_BASE_URL in `.env.local` when using a local API. */
const CONFIGURED_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined

const DEFAULT_CLOUD_BASE_URL =
  'https://brighthut-befxhqfdabcpfscu.centralus-01.azurewebsites.net'

function getCandidateBaseUrls(): string[] {
  const configured = CONFIGURED_BASE_URL?.trim()
  const isLocalPage =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

  const candidates = new Set<string>()

  // In local/dev, prefer same-origin requests so Vite proxy can forward `/api`.
  if (isLocalPage) {
    candidates.add('')
  }

  if (configured) candidates.add(configured)

  if (isLocalPage) {
    candidates.add('http://localhost:5287')
    candidates.add('https://localhost:7287')
  }

  candidates.add(DEFAULT_CLOUD_BASE_URL)
  return Array.from(candidates)
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
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

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers ?? {})
  const token = localStorage.getItem('token')
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const bases = getCandidateBaseUrls()
  let lastNetworkError: unknown = null

  for (const baseUrl of bases) {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(parseApiError(body, res.status, path))
      }
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('application/json')) {
        throw new Error(
          `Unexpected response from API (${path}). Is the backend running and reachable? If you use the static site URL, configure the API base URL or proxy /api to your server.`,
        )
      }
      return res.json() as Promise<T>
    } catch (err) {
      // Retry on network-level errors (e.g. failed to fetch / TLS / CORS/preflight).
      if (err instanceof TypeError) {
        lastNetworkError = err
        continue
      }
      throw err
    }
  }

  throw new Error(
    `Failed to fetch API (${path}). Tried: ${bases.join(', ')}${lastNetworkError ? '.' : ''}`,
  )
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
}

export async function apiPut(path: string, body: unknown): Promise<void> {
  await apiFetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
}

export async function apiDelete(path: string): Promise<void> {
  await apiFetch(path, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })
}
