import { randomUUID } from 'node:crypto'
const CHALLENGE_TTL_MS = 5 * 60 * 1000

export function getWebAuthnConfig(requestOrigin?: string): { rpID: string; origin: string | string[]; rpName: string } {
  const origins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',').map(value => value.trim()).filter(Boolean)
  const configuredRpId = process.env.WEBAUTHN_RP_ID?.trim()
  if (configuredRpId) return { rpID: configuredRpId, origin: origins, rpName: process.env.WEBAUTHN_RP_NAME || 'OpenFlash' }
  const selectedOrigin = requestOrigin && origins.includes(requestOrigin) ? requestOrigin : origins[0]
  const selected = new URL(selectedOrigin)
  return { rpID: selected.hostname, origin: selectedOrigin, rpName: process.env.WEBAUTHN_RP_NAME || 'OpenFlash' }
}

export function newChallengeId(): string { return randomUUID() }
export function challengeExpiry(): number { return Date.now() + CHALLENGE_TTL_MS }
