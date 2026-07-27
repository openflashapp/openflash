import type { AIProviderId, CardTombstone, DeckConfig, FlashCard, Folder, ProviderConfig } from '../types'
import type { AuthenticationResponseJSON, PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON, RegistrationResponseJSON } from '@simplewebauthn/browser'

const API_BASE = '/api'
const AUTH_STORAGE_KEY = 'openflash_window_auth'
const LEGACY_AUTH_STORAGE_KEY = 'openflash_auth'
const AUTH_CHANGE_EVENT = 'openflash:auth-change'

export interface User {
  id: string
  email: string
  username?: string
}

export interface AuthData {
  user: User
}

export interface TwoFactorChallenge {
  requires2fa: true
  tempToken: string
  user: User
}

export interface OAuthConfig {
  google: boolean
  github: boolean
  apple: boolean
}

export function getStoredAuth(): AuthData | null {
  localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY)
  const stored = sessionStorage.getItem(AUTH_STORAGE_KEY)
  if (!stored) return null
  try {
    return parseAuthData(JSON.parse(stored))
  } catch {
    return null
  }
}

export function setStoredAuth(auth: AuthData | null): void {
  localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY)
  if (auth) {
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth))
  } else {
    sessionStorage.removeItem(AUTH_STORAGE_KEY)
  }
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT))
}

export function subscribeToAuth(listener: () => void): () => void {
  window.addEventListener(AUTH_CHANGE_EVENT, listener)
  return () => {
    window.removeEventListener(AUTH_CHANGE_EVENT, listener)
  }
}

function parseAuthData(value: unknown): AuthData | null {
  if (!isRecord(value) || !isRecord(value.user)) return null
  if (typeof value.user.id !== 'string' || typeof value.user.email !== 'string') return null
  return {
    user: {
      id: value.user.id,
      email: value.user.email,
      username: typeof value.user.username === 'string' ? value.user.username : undefined,
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'same-origin' })

  if (res.status === 401 && !isUnauthenticatedRequest(path)) {
    setStoredAuth(null)
  }

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => undefined)
    const message = typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
      ? body.error
      : `Request failed (${res.status})`
    throw new ApiError(message, res.status)
  }

  return await res.json() as T
}

function isUnauthenticatedRequest(path: string): boolean {
  return path === '/auth/login' || path === '/auth/register' || path === '/2fa/verify-login' || path === '/passkeys/login/options' || path === '/passkeys/login/verify'
}

export function register(email: string, password: string, username?: string): Promise<AuthData> {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, username }),
  })
}

export function checkUsernameAvailability(username: string): Promise<{ available: boolean; valid: boolean }> {
  return request(`/auth/username-availability?username=${encodeURIComponent(username)}`)
}

export function login(email: string, password: string): Promise<AuthData | TwoFactorChallenge> {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function verify2faLogin(tempToken: string, code: string): Promise<AuthData> {
  return request('/2fa/verify-login', {
    method: 'POST',
    body: JSON.stringify({ tempToken, code }),
  })
}

export function get2faStatus(): Promise<{ enabled: boolean }> {
  return request('/2fa/status')
}

export function setup2fa(): Promise<{ secret: string; qrCode: string }> {
  return request('/2fa/setup', { method: 'POST' })
}

export function verify2fa(code: string): Promise<{ ok: boolean }> {
  return request('/2fa/verify', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export function disable2fa(password: string): Promise<{ ok: boolean }> {
  return request('/2fa/disable', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

export function getOAuthConfig(): Promise<OAuthConfig> {
  return request('/oauth/config')
}

export async function getCurrentUser(): Promise<AuthData> {
  const result = await request<{ user: User }>('/auth/me')
  return { user: result.user }
}

export function logout(): Promise<{ ok: boolean }> {
  return request('/auth/logout', { method: 'POST' })
}

export interface SyncPayload {
  cards: FlashCard[]
  deletedCards: CardTombstone[]
  deckConfigs: Record<string, DeckConfig>
  emptyDecks: string[]
  folders: Folder[]
  structureUpdatedAt: number
}

export interface ProviderSettingsSnapshot {
  providers: Partial<Record<AIProviderId, ProviderConfig>>
  updatedAt: number
}

export function downloadAll(): Promise<SyncPayload> {
  return request('/sync/download')
}

export function uploadAll(data: SyncPayload): Promise<{ ok: boolean; snapshot: SyncPayload }> {
  return request('/sync/upload', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function getProviderSettings(): Promise<ProviderSettingsSnapshot> {
  return request('/settings/providers')
}

export function saveProviderSettings(data: ProviderSettingsSnapshot): Promise<ProviderSettingsSnapshot> {
  return request('/settings/providers', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function changePassword(data: { oldPassword: string; newPassword: string; totpCode?: string }): Promise<{ ok: boolean }> {
  return request('/auth/password', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function changeEmail(data: { currentPassword: string; newEmail: string; totpCode?: string }): Promise<{ ok: boolean; user: User }> {
  return request('/auth/email', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function changeUsername(username: string): Promise<{ ok: boolean; user: User }> {
  return request('/auth/username', {
    method: 'PUT',
    body: JSON.stringify({ username }),
  })
}

export function deleteAccount(data: { password: string; totpCode?: string }): Promise<{ ok: boolean }> {
  return request('/auth/account', {
    method: 'DELETE',
    body: JSON.stringify(data),
  })
}

export interface PasskeyInfo { id: string; name: string; createdAt: number; lastUsedAt: number | null }

export function getPasskeys(): Promise<{ passkeys: PasskeyInfo[] }> { return request('/passkeys') }
export function getPasskeyRegistrationOptions(): Promise<PublicKeyCredentialCreationOptionsJSON> { return request('/passkeys/registration/options', { method: 'POST' }) }
export function verifyPasskeyRegistration(response: RegistrationResponseJSON): Promise<{ ok: boolean; id: string }> { return request('/passkeys/registration/verify', { method: 'POST', body: JSON.stringify(response) }) }
export function deletePasskey(id: string): Promise<{ ok: boolean }> { return request(`/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE' }) }
export function getPasskeyLoginOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> { return request('/passkeys/login/options', { method: 'POST' }) }
export function verifyPasskeyLogin(response: AuthenticationResponseJSON): Promise<AuthData> { return request('/passkeys/login/verify', { method: 'POST', body: JSON.stringify(response) }) }
