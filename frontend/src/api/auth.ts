import { apiFetch } from './client'

export interface AuthResponse {
  token?: string
  role?: string
  email: string
  firstName?: string
  requires2fa?: boolean
  requires2faSetup?: boolean
  requiresAccountTypeSelection?: boolean
  setupToken?: string
}

export interface RegisterAuthResponse {
  token: string
  role: string
  email: string
  firstName?: string
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
}): Promise<RegisterAuthResponse> {
  return apiFetch<RegisterAuthResponse>('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function login(email: string, password: string, twoFactorCode?: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, twoFactorCode: twoFactorCode ?? null }),
  })
}

export function googleLogin(idToken: string, twoFactorCode?: string, supporterType?: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, twoFactorCode: twoFactorCode ?? null, supporterType: supporterType ?? null }),
  })
}

export interface TwoFactorSetupResponse {
  secret: string
  otpauthUrl: string
}

export function getTwoFactorStatus(): Promise<{ enabled: boolean }> {
  return apiFetch<{ enabled: boolean }>('/api/auth/2fa/status')
}

export function setupTwoFactor(setupToken?: string): Promise<TwoFactorSetupResponse> {
  return apiFetch<TwoFactorSetupResponse>('/api/auth/2fa/setup', {
    method: 'POST',
    headers: setupToken ? { Authorization: `Bearer ${setupToken}` } : undefined,
  })
}

export function enableTwoFactor(code: string, setupToken?: string): Promise<{ enabled: boolean }> {
  return apiFetch<{ enabled: boolean }>('/api/auth/2fa/enable', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(setupToken ? { Authorization: `Bearer ${setupToken}` } : {}),
    },
    body: JSON.stringify({ code }),
  })
}

export function disableTwoFactor(code: string): Promise<{ enabled: boolean }> {
  return apiFetch<{ enabled: boolean }>('/api/auth/2fa/disable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
}
