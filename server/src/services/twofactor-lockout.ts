import { getDb } from '../db.js'

const MAX_FAILED_ATTEMPTS = 5
const OBSERVATION_WINDOW_MS = 15 * 60 * 1000
const LOCKOUT_DURATION_MS = 15 * 60 * 1000

interface LockoutRow {
  lockedUntil: string
}

export function twoFactorRetryAfterMs(lockedUntil: string | number): number {
  return Math.max(0, Number(lockedUntil) - Date.now())
}

export async function recordTwoFactorFailure(userId: string): Promise<number> {
  const now = Date.now()
  const { rows } = await getDb().query<LockoutRow>(`
    UPDATE users
    SET
      totp_failed_attempts = CASE
        WHEN totp_locked_until > $1 THEN totp_failed_attempts
        WHEN totp_failure_window_started_at + $2 <= $1 THEN 1
        ELSE totp_failed_attempts + 1
      END,
      totp_failure_window_started_at = CASE
        WHEN totp_locked_until > $1 THEN totp_failure_window_started_at
        WHEN totp_failure_window_started_at + $2 <= $1 THEN $1
        ELSE totp_failure_window_started_at
      END,
      totp_locked_until = CASE
        WHEN totp_locked_until > $1 THEN totp_locked_until
        WHEN totp_failure_window_started_at + $2 <= $1 THEN 0
        WHEN totp_failed_attempts + 1 >= $3 THEN $4
        ELSE 0
      END
    WHERE id = $5
    RETURNING totp_locked_until AS "lockedUntil"
  `, [now, OBSERVATION_WINDOW_MS, MAX_FAILED_ATTEMPTS, now + LOCKOUT_DURATION_MS, userId])
  return twoFactorRetryAfterMs(rows[0]?.lockedUntil ?? 0)
}

export async function clearTwoFactorFailures(userId: string): Promise<void> {
  await getDb().query(`
    UPDATE users
    SET totp_failed_attempts = 0, totp_failure_window_started_at = 0, totp_locked_until = 0
    WHERE id = $1
  `, [userId])
}
