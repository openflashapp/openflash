import type { Request, Response } from 'express'
import { SESSION_TTL_MS } from '../services/session-store.js'

export const SESSION_COOKIE = 'openflash_session'

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_TTL_MS })
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions)
}

export function readSessionCookie(req: Request): string {
  const cookies = req.headers.cookie?.split(';') ?? []
  for (const cookie of cookies) {
    const separator = cookie.indexOf('=')
    if (separator < 0 || cookie.slice(0, separator).trim() !== SESSION_COOKIE) continue
    try {
      return decodeURIComponent(cookie.slice(separator + 1))
    } catch {
      return ''
    }
  }
  return ''
}
