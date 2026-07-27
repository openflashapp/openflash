import type { Request, Response, NextFunction } from 'express'
import { randomBytes } from 'node:crypto'
import { getDb } from '../db.js'
import { readSessionCookie } from '../lib/session-cookie.js'
import { hashToken } from '../services/session-store.js'

let jwtSecret: string

/** Used only for short-lived OAuth state signatures, never for account sessions. */
export function getJwtSecret(): string {
  if (!jwtSecret) {
    const fromEnv = process.env.JWT_SECRET
    if (fromEnv) jwtSecret = fromEnv
    else if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be set in production')
    else jwtSecret = randomBytes(64).toString('hex')
  }
  return jwtSecret
}

export interface AuthRequest extends Request {
  userId: string
  userEmail: string
  username?: string
  sessionId: string
}

interface SessionRow {
  sessionId: string
  userId: string
  email: string
  username: string
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = readSessionCookie(req)
  if (!token || !token.startsWith('ofs_')) {
    res.status(401).json({ error: 'Missing or invalid session cookie' })
    return
  }

  const now = Date.now()
  const { rows } = await getDb().query<SessionRow>(`
    SELECT sessions.id AS "sessionId", users.id AS "userId", users.email, users.username
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = $1
      AND sessions.revoked_at IS NULL
      AND sessions.expires_at > $2
  `, [hashToken(token), now])
  const session = rows[0]
  if (!session) {
    res.status(401).json({ error: 'Session has ended' })
    return
  }

  await getDb().query('UPDATE sessions SET last_seen_at = $1 WHERE id = $2', [now, session.sessionId])
  const authRequest = req as AuthRequest
  authRequest.userId = session.userId
  authRequest.userEmail = session.email
  authRequest.username = session.username || undefined
  authRequest.sessionId = session.sessionId
  next()
}
