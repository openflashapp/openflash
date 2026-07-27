import { Router } from 'express'
import { authenticate, type AuthRequest } from '../middleware/auth.js'
import { getDb } from '../db.js'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import type { AuthenticationResponseJSON, RegistrationResponseJSON, WebAuthnCredential } from '@simplewebauthn/server'
import { challengeExpiry, getWebAuthnConfig, newChallengeId } from '../lib/webauthn.js'
import { setSessionCookie } from '../lib/session-cookie.js'
import { createSession } from '../services/session-store.js'

const router = Router()

router.get('/', authenticate, async (req, res) => {
  const { rows } = await getDb().query<{ id: string; name: string; created_at: string; last_used_at: string | null }>(
    'SELECT id, name, created_at, last_used_at FROM webauthn_credentials WHERE user_id = $1 ORDER BY created_at DESC', [(req as AuthRequest).userId])
  res.json({ passkeys: rows.map(row => ({ id: row.id, name: row.name, createdAt: Number(row.created_at), lastUsedAt: row.last_used_at ? Number(row.last_used_at) : null })) })
})

router.post('/registration/options', authenticate, async (req, res) => {
  const userId = (req as AuthRequest).userId
  const { rpID, rpName } = getWebAuthnConfig(req.headers.origin)
  const existing = await getDb().query<{ id: string; transports: string }>('SELECT id, transports FROM webauthn_credentials WHERE user_id = $1', [userId])
  const options = await generateRegistrationOptions({
    rpName, rpID, userName: (req as AuthRequest).userEmail, userDisplayName: (req as AuthRequest).username || (req as AuthRequest).userEmail,
    userID: new TextEncoder().encode(userId), attestationType: 'none',
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    excludeCredentials: existing.rows.map(row => ({ id: row.id, transports: JSON.parse(row.transports) })),
    timeout: 60_000,
  })
  const db = getDb()
  await db.query('DELETE FROM webauthn_challenges WHERE expires_at < $1 OR user_id = $2', [Date.now(), userId])
  await db.query('INSERT INTO webauthn_challenges (id, user_id, type, challenge, expires_at, created_at) VALUES ($1, $2, $3, $4, $5, $6)', [newChallengeId(), userId, 'registration', options.challenge, challengeExpiry(), Date.now()])
  res.json(options)
})

router.post('/registration/verify', authenticate, async (req, res) => {
  const userId = (req as AuthRequest).userId
  const db = getDb()
  const challenge = await db.query<{ id: string; challenge: string }>('DELETE FROM webauthn_challenges WHERE user_id = $1 AND type = $2 AND expires_at > $3 RETURNING id, challenge', [userId, 'registration', Date.now()])
  const expected = challenge.rows[0]
  if (!expected) { res.status(400).json({ error: 'Passkey registration expired. Try again.' }); return }
  try {
    const { rpID, origin } = getWebAuthnConfig(req.headers.origin)
    const verification = await verifyRegistrationResponse({ response: req.body as RegistrationResponseJSON, expectedChallenge: expected.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true })
    if (!verification.verified) { res.status(400).json({ error: 'Passkey verification failed' }); return }
    const info = verification.registrationInfo
    await db.query('INSERT INTO webauthn_credentials (id, user_id, public_key, counter, transports, device_type, backed_up, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [info.credential.id, userId, Buffer.from(info.credential.publicKey), info.credential.counter, JSON.stringify((req.body.response?.transports as string[] | undefined) || []), info.credentialDeviceType, info.credentialBackedUp, Date.now()])
    res.status(201).json({ ok: true, id: info.credential.id })
  } catch { res.status(400).json({ error: 'Invalid passkey response' }) }
})

router.delete('/:id', authenticate, async (req, res) => {
  const { rowCount } = await getDb().query('DELETE FROM webauthn_credentials WHERE id = $1 AND user_id = $2', [req.params.id, (req as AuthRequest).userId])
  if (!rowCount) { res.status(404).json({ error: 'Passkey not found' }); return }
  res.json({ ok: true })
})

router.post('/login/options', async (req, res) => {
  const { rpID } = getWebAuthnConfig(req.headers.origin)
  const options = await generateAuthenticationOptions({ rpID, userVerification: 'required', timeout: 60_000 })
  const db = getDb()
  await db.query('DELETE FROM webauthn_challenges WHERE expires_at < $1', [Date.now()])
  await db.query('INSERT INTO webauthn_challenges (id, type, challenge, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)', [newChallengeId(), 'authentication', options.challenge, challengeExpiry(), Date.now()])
  res.json(options)
})

router.post('/login/verify', async (req, res) => {
  const db = getDb()
  const challenge = await db.query<{ id: string; challenge: string }>('DELETE FROM webauthn_challenges WHERE id = (SELECT id FROM webauthn_challenges WHERE type = $1 AND expires_at > $2 ORDER BY created_at DESC LIMIT 1) RETURNING id, challenge', ['authentication', Date.now()])
  const expected = challenge.rows[0]
  if (!expected) { res.status(400).json({ error: 'Passkey login expired. Try again.' }); return }
  try {
    const response = req.body as AuthenticationResponseJSON
    const credentialId = response.id
    const { rows } = await db.query<{ id: string; user_id: string; public_key: Buffer; counter: string; transports: string }>('SELECT id, user_id, public_key, counter, transports FROM webauthn_credentials WHERE id = $1', [credentialId])
    const stored = rows[0]
    if (!stored) { res.status(401).json({ error: 'Unknown passkey' }); return }
    const credential: WebAuthnCredential = { id: stored.id, publicKey: new Uint8Array(stored.public_key), counter: Number(stored.counter), transports: JSON.parse(stored.transports) }
    const { rpID, origin } = getWebAuthnConfig(req.headers.origin)
    const verification = await verifyAuthenticationResponse({ response, expectedChallenge: expected.challenge, expectedOrigin: origin, expectedRPID: rpID, credential, requireUserVerification: true })
    if (!verification.verified) { res.status(401).json({ error: 'Passkey verification failed' }); return }
    await db.query('UPDATE webauthn_credentials SET counter = $1, last_used_at = $2 WHERE id = $3', [verification.authenticationInfo.newCounter, Date.now(), stored.id])
    const userResult = await db.query<{ id: string; email: string; username: string }>('SELECT id, email, username FROM users WHERE id = $1', [stored.user_id])
    const user = userResult.rows[0]
    if (!user) { res.status(401).json({ error: 'User not found' }); return }
    const token = await createSession(user.id, req.get('user-agent'))
    setSessionCookie(res, token)
    res.json({ user: { id: user.id, email: user.email, username: user.username || '' } })
  } catch { res.status(401).json({ error: 'Invalid passkey response' }) }
})

export default router
