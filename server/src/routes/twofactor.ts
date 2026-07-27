import { Router, type Response } from 'express'
import * as otplib from 'otplib'
import QRCode from 'qrcode'
import bcrypt from 'bcryptjs'
import { getDb } from '../db.js'
import { authenticate, type AuthRequest } from '../middleware/auth.js'
import { protectSecret, revealSecret } from '../lib/crypto.js'
import { setSessionCookie } from '../lib/session-cookie.js'
import { consumeAuthChallenge, createSession, findAuthChallengeUser } from '../services/session-store.js'
import { clearTwoFactorFailures, recordTwoFactorFailure, twoFactorRetryAfterMs } from '../services/twofactor-lockout.js'

const router = Router()

router.get('/status', authenticate, async (req, res) => {
  const userId = (req as AuthRequest).userId
  const db = getDb()
  const { rows } = await db.query<{ totp_enabled: boolean }>('SELECT totp_enabled FROM users WHERE id = $1', [userId])
  res.json({ enabled: rows[0]?.totp_enabled === true })
})

router.post('/setup', authenticate, async (req, res) => {
  const userReq = req as AuthRequest
  const db = getDb()
  const { rows } = await db.query<{ email: string; username: string; totp_enabled: boolean }>(
    'SELECT email, username, totp_enabled FROM users WHERE id = $1', [userReq.userId])
  const user = rows[0]
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  if (user.totp_enabled) {
    res.status(400).json({ error: '2FA already enabled' })
    return
  }

  const secret = otplib.generateSecret()
  const label = user.username || user.email
  const otpauth = otplib.generateURI({ secret, label, issuer: 'OpenFlash' })
  const dataUrl = await QRCode.toDataURL(otpauth)
  await db.query('UPDATE users SET totp_secret = $1 WHERE id = $2', [protectSecret(secret), userReq.userId])
  res.json({ secret, qrCode: dataUrl })
})

router.post('/verify', authenticate, async (req, res) => {
  const { code } = req.body as { code?: string }
  if (!code || !/^\d{6}$/.test(code)) {
    res.status(400).json({ error: 'Invalid verification code' })
    return
  }

  const userId = (req as AuthRequest).userId
  const db = getDb()
  const { rows } = await db.query<{ totp_secret: string; totp_enabled: boolean }>(
    'SELECT totp_secret, totp_enabled FROM users WHERE id = $1', [userId])
  const user = rows[0]
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  if (user.totp_enabled) {
    res.status(400).json({ error: '2FA already enabled' })
    return
  }

  const secret = revealSecret(user.totp_secret)
  if (!secret) {
    res.status(400).json({ error: '2FA setup has expired. Start setup again.' })
    return
  }
  const result = await otplib.verify({ token: code, secret })
  if (!result.valid) {
    res.status(400).json({ error: 'Invalid code' })
    return
  }

  await db.query('UPDATE users SET totp_enabled = TRUE WHERE id = $1', [userId])
  await clearTwoFactorFailures(userId)
  res.json({ ok: true })
})

router.post('/disable', authenticate, async (req, res) => {
  const { password } = req.body as { password?: string }
  if (!password) {
    res.status(400).json({ error: 'Password is required' })
    return
  }

  const userId = (req as AuthRequest).userId
  const db = getDb()
  const { rows } = await db.query<{ password_hash: string; totp_enabled: boolean }>(
    'SELECT password_hash, totp_enabled FROM users WHERE id = $1', [userId])
  const user = rows[0]
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  if (!user.totp_enabled) {
    res.status(400).json({ error: '2FA not enabled' })
    return
  }

  if (!await bcrypt.compare(password, user.password_hash)) {
    res.status(403).json({ error: 'Password is incorrect' })
    return
  }

  await db.query("UPDATE users SET totp_secret = '', totp_enabled = FALSE WHERE id = $1", [userId])
  await clearTwoFactorFailures(userId)
  res.json({ ok: true })
})

router.post('/verify-login', async (req, res) => {
  const { tempToken, code } = req.body as { tempToken?: string; code?: string }
  if (!tempToken || !code || !/^\d{6}$/.test(code)) {
    res.status(400).json({ error: 'Invalid request' })
    return
  }

  const db = getDb()
  const challengeUserId = await findAuthChallengeUser(tempToken)
  if (!challengeUserId) {
    res.status(401).json({ error: 'Invalid or expired session' })
    return
  }
  const { rows } = await db.query<{ id: string; email: string; username: string; totp_secret: string; totp_enabled: boolean; totp_locked_until: string }>(
    'SELECT id, email, username, totp_secret, totp_enabled, totp_locked_until FROM users WHERE id = $1', [challengeUserId])
  const user = rows[0]
  if (!user || !user.totp_enabled || !user.totp_secret) {
    res.status(401).json({ error: '2FA not configured' })
    return
  }

  const retryAfterMs = twoFactorRetryAfterMs(user.totp_locked_until)
  if (retryAfterMs) {
    sendTwoFactorLockout(res, retryAfterMs)
    return
  }

  const result = await otplib.verify({ token: code, secret: revealSecret(user.totp_secret) })
  if (!result.valid) {
    const lockoutRetryAfterMs = await recordTwoFactorFailure(user.id)
    if (lockoutRetryAfterMs) {
      sendTwoFactorLockout(res, lockoutRetryAfterMs)
      return
    }
    res.status(401).json({ error: 'Invalid code' })
    return
  }

  if (await consumeAuthChallenge(tempToken) !== user.id) {
    res.status(401).json({ error: 'This verification request was already used' })
    return
  }
  await clearTwoFactorFailures(user.id)
  const token = await createSession(user.id, req.get('user-agent'))
  setSessionCookie(res, token)
  res.json({ user: { id: user.id, email: user.email, username: user.username || '' } })
})

function sendTwoFactorLockout(res: Response, retryAfterMs: number): void {
  const retryAfterSeconds = Math.ceil(retryAfterMs / 1000)
  res.set('Retry-After', String(retryAfterSeconds))
  res.status(429).json({ error: `Too many invalid 2FA codes. Try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.` })
}

export default router
