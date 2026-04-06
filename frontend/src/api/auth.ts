import { apiFetch } from './client'

export interface AuthResponse {
  token: string
  role: string
  email: string
}

export function register(data: {
  email: string
  password: string
  firstName?: string
  lastName?: string
  organizationName?: string
  phone?: string
  country?: string
  region?: string
  relationshipType?: string
  acquisitionChannel?: string
  supporterType?: string
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}
