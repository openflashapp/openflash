import type { Request, Response, NextFunction } from 'express'
import { Router } from 'express'
import passport from 'passport'
import type { VerifyCallback } from 'passport-google-oauth20'
import { Strategy as GoogleStrategy, type Profile as GoogleProfile } from 'passport-google-oauth20'
import { Strategy as GitHubStrategy, type Profile as GitHubProfile } from 'passport-github2'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db.js'
import { getJwtSecret } from '../middleware/auth.js'
import { setSessionCookie } from '../lib/session-cookie.js'
import AppleSignIn from 'apple-signin-auth'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { createSession } from '../services/session-store.js'

const router = Router()

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001'

interface OAuthUser { id: string; email: string; username: string }

async function findOrCreateUser(provider: string, providerId: string, email: string): Promise<OAuthUser> {
  const db = getDb()
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const { rows: linkedRows } = await client.query<OAuthUser>(`
      SELECT users.id, users.email, users.username FROM oauth_accounts
      JOIN users ON users.id = oauth_accounts.user_id
      WHERE oauth_accounts.provider = $1 AND oauth_accounts.provider_id = $2
    `, [provider, providerId])
    const linked = linkedRows[0]
    if (linked) {
      await client.query('COMMIT')
      return linked
    }

    const normalizedEmail = email.trim().toLowerCase()
    const { rows: userRows } = await client.query<OAuthUser>('SELECT id, email, username FROM users WHERE email = $1', [normalizedEmail])
    let user = userRows[0]
    if (!user) {
      const id = uuidv4()
      const username = `${provider}_${id.replaceAll('-', '').slice(0, 16)}`
      await client.query('INSERT INTO users (id, email, username, created_at) VALUES ($1, $2, $3, $4)',
        [id, normalizedEmail, username, Date.now()])
      await client.query('INSERT INTO settings (user_id) VALUES ($1)', [id])
      user = { id, email: normalizedEmail, username }
    }

    await client.query('INSERT INTO oauth_accounts (user_id, provider, provider_id) VALUES ($1, $2, $3)',
      [user.id, provider, providerId])
    await client.query('COMMIT')
    return user
  } catch (error) {
    try { await client.query('ROLLBACK') } catch { /* Preserve the original error. */ }
    throw error
  } finally {
    client.release()
  }
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use('google', new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${SERVER_URL}/api/oauth/google/callback`,
  }, (_accessToken: string, _refreshToken: string, profile: GoogleProfile, done: VerifyCallback) => {
    try {
      const email = profile.emails?.[0]?.value || `google-${profile.id}@oauth.local`
      void findOrCreateUser('google', profile.id, email).then(user => done(null, user), error => done(error as Error))
    } catch (err) {
      done(err as Error)
    }
  }))
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use('github', new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `${SERVER_URL}/api/oauth/github/callback`,
  }, (_accessToken: string, _refreshToken: string, profile: GitHubProfile, done: VerifyCallback) => {
    try {
      const email = profile.emails?.[0]?.value || (profile.username ? `${profile.username}@github.oauth.local` : `github-${profile.id}@oauth.local`)
      void findOrCreateUser('github', profile.id, email).then(user => done(null, user), error => done(error as Error))
    } catch (err) {
      done(err as Error)
    }
  }))
}

router.get('/google', (req: Request, res: Response, next: NextFunction) => {
  const state = createOAuthState('google')
  setStateCookie(res, state)
  passport.authenticate('google', { scope: ['profile', 'email'], session: false, state })(req, res, next)
})

router.get('/google/callback', (req: Request, res: Response, next: NextFunction) => {
  if (!consumeOAuthState(req, res, 'google')) return redirectError(res, 'invalid_state')
  passport.authenticate('google', { session: false }, (err: Error | null, user?: OAuthUser) => {
    if (err || !user) return redirectError(res, 'auth_failed')
    void createSession(user.id, req.get('user-agent'))
      .then(token => {
        setSessionCookie(res, token)
        redirectSuccess(res)
      })
      .catch(() => redirectError(res, 'auth_failed'))
  })(req, res, next)
})

router.get('/github', (req: Request, res: Response, next: NextFunction) => {
  const state = createOAuthState('github')
  setStateCookie(res, state)
  passport.authenticate('github', { scope: ['user:email'], session: false, state })(req, res, next)
})

router.get('/github/callback', (req: Request, res: Response, next: NextFunction) => {
  if (!consumeOAuthState(req, res, 'github')) return redirectError(res, 'invalid_state')
  passport.authenticate('github', { session: false }, (err: Error | null, user?: OAuthUser) => {
    if (err || !user) return redirectError(res, 'auth_failed')
    void createSession(user.id, req.get('user-agent'))
      .then(token => {
        setSessionCookie(res, token)
        redirectSuccess(res)
      })
      .catch(() => redirectError(res, 'auth_failed'))
  })(req, res, next)
})

router.get('/apple', (_req: Request, res: Response) => {
  if (!process.env.APPLE_CLIENT_ID) {
    res.status(501).json({ error: 'Apple Sign-In not configured. Set APPLE_CLIENT_ID in .env' })
    return
  }

  const state = createOAuthState('apple')
  setStateCookie(res, state)
  const authUrl = AppleSignIn.getAuthorizationUrl({
    clientID: process.env.APPLE_CLIENT_ID,
    redirectUri: `${SERVER_URL}/api/oauth/apple/callback`,
    scope: 'name email',
    responseMode: 'form_post',
    state,
  })

  res.redirect(authUrl)
})

router.post('/apple/callback', async (req: Request, res: Response) => {
  if (!consumeOAuthState(req, res, 'apple')) return redirectError(res, 'invalid_state')
  try {
    const { code, id_token } = req.body

    let appleId: string
    let email = ''

    if (id_token) {
      const claims = await AppleSignIn.verifyIdToken(id_token, {
        audience: process.env.APPLE_CLIENT_ID,
        ignoreExpiration: false,
      })
      appleId = claims.sub
      email = getClaimEmail(claims) || `apple-${appleId}@oauth.local`
    } else if (code) {
      const tokenResponse = await AppleSignIn.getAuthorizationToken(code, {
        clientID: process.env.APPLE_CLIENT_ID!,
        redirectUri: `${SERVER_URL}/api/oauth/apple/callback`,
        clientSecret: process.env.APPLE_CLIENT_SECRET || '',
      })
      const claims = await AppleSignIn.verifyIdToken(tokenResponse.id_token, {
        audience: process.env.APPLE_CLIENT_ID,
        ignoreExpiration: false,
      })
      appleId = claims.sub
      email = getClaimEmail(claims) || `apple-${appleId}@oauth.local`
    } else {
      res.status(400).json({ error: 'Missing authorization code' })
      return
    }

    const user = await findOrCreateUser('apple', appleId, email)
    const token = await createSession(user.id, req.get('user-agent'))
    setSessionCookie(res, token)
    redirectSuccess(res)
  } catch (err) {
    console.error('Apple OAuth error:', err)
    redirectError(res, 'auth_failed')
  }
})

const OAUTH_STATE_COOKIE = 'openflash_oauth_state'

function createOAuthState(provider: string): string {
  return jwt.sign(
    { purpose: 'oauth-state', provider, nonce: randomBytes(24).toString('hex') },
    getJwtSecret(),
    { expiresIn: '10m' },
  )
}

function setStateCookie(res: Response, state: string): void {
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/api/oauth',
  })
}

function consumeOAuthState(req: Request, res: Response, provider: string): boolean {
  const candidate = readString(req.query.state) || readBodyState(req.body)
  const expected = readCookie(req, OAUTH_STATE_COOKIE)
  res.clearCookie(OAUTH_STATE_COOKIE, { path: '/api/oauth' })
  if (!candidate || !expected || !safeEqual(candidate, expected)) return false

  try {
    const payload = jwt.verify(candidate, getJwtSecret())
    return typeof payload !== 'string' && payload.purpose === 'oauth-state' && payload.provider === provider
  } catch {
    return false
  }
}

function readCookie(req: Request, name: string): string {
  const cookies = req.headers.cookie?.split(';') ?? []
  for (const cookie of cookies) {
    const separator = cookie.indexOf('=')
    if (separator < 0) continue
    if (cookie.slice(0, separator).trim() === name) return decodeURIComponent(cookie.slice(separator + 1))
  }
  return ''
}

function readBodyState(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('state' in body)) return ''
  return readString(body.state)
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function getClaimEmail(claims: unknown): string {
  if (typeof claims !== 'object' || claims === null || !('email' in claims)) return ''
  return readString(claims.email)
}

function redirectSuccess(res: Response): void {
  res.redirect(`${CLIENT_URL}/auth/callback#oauth=success`)
}

function redirectError(res: Response, error: string): void {
  res.redirect(`${CLIENT_URL}/auth/callback#error=${encodeURIComponent(error)}`)
}

router.get('/config', (_req: Request, res: Response) => {
  res.json({
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    apple: !!process.env.APPLE_CLIENT_ID,
  })
})

export default router
