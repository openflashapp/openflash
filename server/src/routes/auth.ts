import { Router, type Response } from 'express'
import bcrypt from 'bcryptjs'
import * as otplib from 'otplib'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db.js'
import { authenticate, type AuthRequest } from '../middleware/auth.js'
import { requireString } from '../lib/validation.js'
import { revealSecret } from '../lib/crypto.js'
import { clearSessionCookie, setSessionCookie } from '../lib/session-cookie.js'
import { createAuthChallenge, createSession, revokeOtherSessions, revokeSession } from '../services/session-store.js'
import { clearTwoFactorFailures, recordTwoFactorFailure, twoFactorRetryAfterMs } from '../services/twofactor-lockout.js'

const router = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// TEMPORARY: allows test accounts to use any non-empty string as an email.
// Remove this flag and the corresponding .env setting before production.
const ALLOW_ANY_EMAIL_TEMP = process.env.ALLOW_ANY_EMAIL_TEMP === 'true'
const USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]{2,29}$/

interface RegisterBody {
  email?: string
  password?: string
  username?: string
}

const SALT_ROUNDS = 12
const dummyPasswordHash = bcrypt.hash('openflash-invalid-password-placeholder', SALT_ROUNDS)

router.get('/username-availability', async (req, res) => {
  const username = typeof req.query.username === 'string' ? req.query.username.trim() : ''
  if (!USERNAME_RE.test(username)) {
    res.json({ available: false, valid: false })
    return
  }
  const { rowCount } = await getDb().query('SELECT id FROM users WHERE username = $1', [username])
  res.json({ available: rowCount === 0, valid: true })
})

router.post('/register', async (req, res) => {
  const { email, password, username } = req.body as RegisterBody

  if (!email || !password || !username) {
    res.status(400).json({ error: 'Email, username and password are required' })
    return
  }

  const sanitizedEmail = requireString(email, 'Email', 254).toLowerCase()
  if (!ALLOW_ANY_EMAIL_TEMP && !EMAIL_RE.test(sanitizedEmail)) {
    res.status(400).json({ error: 'Invalid email format' })
    return
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' })
    return
  }

  if (password.length > 128) {
    res.status(400).json({ error: 'Password too long' })
    return
  }

  const sanitizedUsername = requireString(username, 'Username', 30, 3)
  if (!USERNAME_RE.test(sanitizedUsername)) {
    res.status(400).json({ error: 'Username must be 3-30 characters and start with a letter' })
    return
  }

  const db = getDb()

  const existingEmail = await db.query('SELECT id FROM users WHERE email = $1', [sanitizedEmail])
  if (existingEmail.rowCount) {
    res.status(409).json({ error: 'Email already registered' })
    return
  }

  const existingUsername = await db.query('SELECT id FROM users WHERE username = $1', [sanitizedUsername])
  if (existingUsername.rowCount) {
    res.status(409).json({ error: 'Username already taken' })
    return
  }

  const id = uuidv4()
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

  await db.query('INSERT INTO users (id, email, username, password_hash, created_at) VALUES ($1, $2, $3, $4, $5)',
    [id, sanitizedEmail, sanitizedUsername, passwordHash, Date.now()])
  await db.query('INSERT INTO settings (user_id) VALUES ($1)', [id])

  const token = await createSession(id, req.get('user-agent'))

  setSessionCookie(res, token)
  res.status(201).json({ user: { id, email: sanitizedEmail, username: sanitizedUsername } })
})

interface LoginBody {
  email?: string
  password?: string
}

interface ChangeEmailBody {
  currentPassword?: string
  newEmail?: string
  totpCode?: string
}

interface ChangeUsernameBody {
  username?: string
}

interface DeleteAccountBody {
  password?: string
  totpCode?: string
}

async function requireSecondFactor(userId: string, user: { totp_enabled: boolean; totp_secret: string; totp_locked_until: string }, code: string | undefined, res: Response): Promise<boolean> {
  if (!user.totp_enabled) return true
  const retryAfterMs = twoFactorRetryAfterMs(user.totp_locked_until)
  if (retryAfterMs) {
    sendTwoFactorLockout(res, retryAfterMs)
    return false
  }
  if (!code || !/^\d{6}$/.test(code)) {
    res.status(400).json({ error: '2FA code is required' })
    return false
  }
  const result = await otplib.verify({ token: code, secret: revealSecret(user.totp_secret) })
  if (!result.valid) {
    const lockoutRetryAfterMs = await recordTwoFactorFailure(userId)
    if (lockoutRetryAfterMs) {
      sendTwoFactorLockout(res, lockoutRetryAfterMs)
      return false
    }
    res.status(403).json({ error: 'Invalid 2FA code' })
    return false
  }
  await clearTwoFactorFailures(userId)
  return true
}

function sendTwoFactorLockout(res: Response, retryAfterMs: number): void {
  const retryAfterSeconds = Math.ceil(retryAfterMs / 1000)
  res.set('Retry-After', String(retryAfterSeconds))
  res.status(429).json({ error: `Too many invalid 2FA codes. Try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.` })
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body as LoginBody

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' })
    return
  }
  if (email.length > 254 || password.length > 128) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  const sanitizedEmail = email.trim().toLowerCase()

  const db = getDb()
  const { rows } = await db.query<{ id: string; email: string; username: string; password_hash: string; totp_enabled: boolean; totp_locked_until: string }>(
    'SELECT id, email, username, password_hash, totp_enabled, totp_locked_until FROM users WHERE email = $1', [sanitizedEmail])
  const user = rows[0]
  const passwordMatches = await bcrypt.compare(password, user?.password_hash ?? await dummyPasswordHash)
  if (!user || !passwordMatches) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  if (user.totp_enabled) {
    const retryAfterMs = twoFactorRetryAfterMs(user.totp_locked_until)
    if (retryAfterMs) {
      sendTwoFactorLockout(res, retryAfterMs)
      return
    }
    const tempToken = await createAuthChallenge(user.id)
    res.json({ requires2fa: true, tempToken, user: { id: user.id, email: user.email, username: user.username || '' } })
    return
  }
  const token = await createSession(user.id, req.get('user-agent'))
  setSessionCookie(res, token)
  res.json({ user: { id: user.id, email: user.email, username: user.username || '' } })
})

router.get('/me', authenticate, async (req, res) => {
  const userId = (req as AuthRequest).userId
  const { rows } = await getDb().query<{ id: string; email: string; username: string }>(
    'SELECT id, email, username FROM users WHERE id = $1', [userId])
  const user = rows[0]
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  res.json({ user: { ...user, username: user.username || '' } })
})

router.post('/logout', authenticate, async (req, res) => {
  await revokeSession((req as AuthRequest).sessionId)
  clearSessionCookie(res)
  res.json({ ok: true })
})

router.put('/email', authenticate, async (req, res) => {
  const { currentPassword, newEmail, totpCode } = req.body as ChangeEmailBody
  if (!currentPassword) {
    res.status(400).json({ error: 'Current password is required' })
    return
  }

  const sanitizedEmail = requireString(newEmail, 'Email', 254).toLowerCase()
  if (!ALLOW_ANY_EMAIL_TEMP && !EMAIL_RE.test(sanitizedEmail)) {
    res.status(400).json({ error: 'Invalid email format' })
    return
  }

  const userId = (req as AuthRequest).userId
  const db = getDb()
  const { rows } = await db.query<{ id: string; email: string; username: string; password_hash: string; totp_enabled: boolean; totp_secret: string; totp_locked_until: string }>(
    'SELECT id, email, username, password_hash, totp_enabled, totp_secret, totp_locked_until FROM users WHERE id = $1', [userId])
  const user = rows[0]
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  if (!await bcrypt.compare(currentPassword, user.password_hash)) {
    res.status(403).json({ error: 'Current password is incorrect' })
    return
  }
  if (!await requireSecondFactor(userId, user, totpCode, res)) return
  if (sanitizedEmail === user.email) {
    res.status(400).json({ error: 'New email must be different' })
    return
  }
  const existing = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [sanitizedEmail, userId])
  if (existing.rowCount) {
    res.status(409).json({ error: 'Email already registered' })
    return
  }

  await db.query('UPDATE users SET email = $1 WHERE id = $2', [sanitizedEmail, userId])
  res.json({ ok: true, user: { id: user.id, email: sanitizedEmail, username: user.username || '' } })
})

router.put('/username', authenticate, async (req, res) => {
  const { username } = req.body as ChangeUsernameBody
  const sanitizedUsername = requireString(username, 'Username', 30, 3)
  if (!USERNAME_RE.test(sanitizedUsername)) {
    res.status(400).json({ error: 'Username must be 3-30 characters and start with a letter' })
    return
  }

  const userId = (req as AuthRequest).userId
  const db = getDb()
  const existing = await db.query('SELECT id FROM users WHERE username = $1 AND id != $2', [sanitizedUsername, userId])
  if (existing.rowCount) {
    res.status(409).json({ error: 'Username already taken' })
    return
  }

  await db.query('UPDATE users SET username = $1 WHERE id = $2', [sanitizedUsername, userId])
  res.json({ ok: true, user: { id: userId, email: (req as AuthRequest).userEmail, username: sanitizedUsername } })
})

router.put('/password', authenticate, async (req, res) => {
  const { oldPassword, newPassword, totpCode } = req.body as { oldPassword?: string; newPassword?: string; totpCode?: string }
  if (!oldPassword) {
    res.status(400).json({ error: 'Current password is required' })
    return
  }
  if (!newPassword || newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters' })
    return
  }
  if (newPassword.length > 128) {
    res.status(400).json({ error: 'New password too long' })
    return
  }
  const userId = (req as AuthRequest).userId
  const db = getDb()
  const { rows } = await db.query<{ password_hash: string; totp_enabled: boolean; totp_secret: string; totp_locked_until: string }>(
    'SELECT password_hash, totp_enabled, totp_secret, totp_locked_until FROM users WHERE id = $1', [userId])
  const user = rows[0]
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  if (!await bcrypt.compare(oldPassword, user.password_hash)) {
    res.status(403).json({ error: 'Current password is incorrect' })
    return
  }
  if (!await requireSecondFactor(userId, user, totpCode, res)) return
  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS)
  await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId])
  await revokeOtherSessions(userId, (req as AuthRequest).sessionId)
  res.json({ ok: true })
})

router.delete('/account', authenticate, async (req, res) => {
  const { password, totpCode } = req.body as DeleteAccountBody
  if (!password) {
    res.status(400).json({ error: 'Password is required' })
    return
  }
  if (password.length > 128) {
    res.status(400).json({ error: 'Password too long' })
    return
  }

  const userId = (req as AuthRequest).userId
  const db = getDb()
  const { rows } = await db.query<{ password_hash: string; totp_enabled: boolean; totp_secret: string; totp_locked_until: string }>(
    'SELECT password_hash, totp_enabled, totp_secret, totp_locked_until FROM users WHERE id = $1', [userId])
  const user = rows[0]
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  if (!await bcrypt.compare(password, user.password_hash)) {
    res.status(403).json({ error: 'Password is incorrect' })
    return
  }
  if (!await requireSecondFactor(userId, user, totpCode, res)) return

  await db.query('DELETE FROM users WHERE id = $1', [userId])
  clearSessionCookie(res)
  res.json({ ok: true })
})

export default router
