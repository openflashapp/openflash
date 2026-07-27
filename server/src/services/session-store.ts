import { createHash, randomBytes } from 'node:crypto'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db.js'

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const CHALLENGE_TTL_MS = 5 * 60 * 1000

function newToken(prefix: string): string {
  return `${prefix}_${randomBytes(32).toString('base64url')}`
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(userId: string, userAgent = ''): Promise<string> {
  const token = newToken('ofs')
  const now = Date.now()
  const db = getDb()
  await db.query('DELETE FROM sessions WHERE expires_at <= $1 OR revoked_at IS NOT NULL', [now])
  await db.query(`INSERT INTO sessions (
    id, user_id, token_hash, user_agent, created_at, last_seen_at, expires_at
  ) VALUES ($1, $2, $3, $4, $5, $5, $6)`, [
    uuidv4(), userId, hashToken(token), userAgent.slice(0, 500), now, now + SESSION_TTL_MS,
  ])
  return token
}

export async function revokeSession(sessionId: string): Promise<void> {
  await getDb().query('UPDATE sessions SET revoked_at = $1 WHERE id = $2 AND revoked_at IS NULL', [Date.now(), sessionId])
}

export async function revokeOtherSessions(userId: string, currentSessionId: string): Promise<void> {
  await getDb().query(
    'UPDATE sessions SET revoked_at = $1 WHERE user_id = $2 AND id != $3 AND revoked_at IS NULL',
    [Date.now(), userId, currentSessionId],
  )
}

export async function createAuthChallenge(userId: string): Promise<string> {
  const token = newToken('ofc')
  const now = Date.now()
  const db = getDb()
  await db.query('DELETE FROM auth_challenges WHERE expires_at <= $1 OR consumed_at IS NOT NULL', [now])
  await db.query(`INSERT INTO auth_challenges (id, user_id, token_hash, type, expires_at)
    VALUES ($1, $2, $3, 'two_factor', $4)`, [uuidv4(), userId, hashToken(token), now + CHALLENGE_TTL_MS])
  return token
}

export async function consumeAuthChallenge(token: string): Promise<string | null> {
  const now = Date.now()
  const { rows } = await getDb().query<{ user_id: string }>(`
    UPDATE auth_challenges SET consumed_at = $1
    WHERE token_hash = $2 AND type = 'two_factor' AND consumed_at IS NULL AND expires_at > $1
    RETURNING user_id
  `, [now, hashToken(token)])
  return rows[0]?.user_id ?? null
}

export async function findAuthChallengeUser(token: string): Promise<string | null> {
  const { rows } = await getDb().query<{ user_id: string }>(`
    SELECT user_id FROM auth_challenges
    WHERE token_hash = $1 AND type = 'two_factor' AND consumed_at IS NULL AND expires_at > $2
  `, [hashToken(token), Date.now()])
  return rows[0]?.user_id ?? null
}
