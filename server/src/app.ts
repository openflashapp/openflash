import express, { type ErrorRequestHandler } from 'express'
import path from 'node:path'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import passport from 'passport'
import authRoutes from './routes/auth.js'
import twofactorRoutes from './routes/twofactor.js'
import cardsRoutes from './routes/cards.js'
import decksRoutes from './routes/decks.js'
import syncRoutes from './routes/sync.js'
import oauthRoutes from './routes/oauth.js'
import passkeyRoutes from './routes/passkeys.js'
import settingsRoutes from './routes/settings.js'
import { ValidationError } from './lib/validation.js'

export function createApp(): express.Express {
  const app = express()
  if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY)

  app.disable('x-powered-by')
  app.use(helmet())
  app.use(cors({ origin: allowedOrigins(), credentials: true }))
  app.use(express.json({ limit: '10mb', strict: true }))
  app.use(express.urlencoded({ extended: false, limit: '64kb' }))
  app.use(verifyRequestOrigin)
  app.use(passport.initialize())

  const authLimiter = createLimiter(20, 'Too many authentication attempts. Try again later.', true)
  const twoFactorLimiter = createLimiter(10, 'Too many 2FA attempts. Try again later.', true)
  const oauthLimiter = createLimiter(30, 'Too many OAuth attempts. Try again later.')
  const passkeyLimiter = createLimiter(20, 'Too many passkey attempts. Try again later.')
  const writeLimiter = createLimiter(120, 'Too many write requests. Try again later.')

  app.use('/api/auth', authLimiter, authRoutes)
  app.use('/api/2fa', (req, res, next) => {
    if (req.method === 'GET') return next()
    twoFactorLimiter(req, res, next)
  }, twofactorRoutes)
  app.use('/api/oauth', oauthLimiter, oauthRoutes)
  app.use('/api/passkeys', passkeyLimiter, passkeyRoutes)
  app.use('/api/cards', cardsRoutes)
  app.use('/api/decks', decksRoutes)
  app.use('/api/sync', writeLimiter, syncRoutes)
  app.use('/api/settings', settingsRoutes)

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint not found' })
  })
  const clientDist = process.env.CLIENT_DIST
  if (clientDist) {
    app.use(express.static(clientDist))
    app.get('/{*path}', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'))
    })
  }
  app.use(errorHandler)
  return app
}

function createLimiter(max: number, message: string, skipSuccessfulRequests = false) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
  })
}

function allowedOrigins(): string[] {
  const configured = process.env.CLIENT_URLS || process.env.CLIENT_URL
  if (configured) return configured.split(',').map(origin => origin.trim()).filter(Boolean)
  return ['http://localhost:5173', 'http://127.0.0.1:5173']
}

function verifyRequestOrigin(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.path.startsWith('/api/oauth/')) {
    next()
    return
  }
  const origin = req.headers.origin
  if (!origin || !allowedOrigins().includes(origin)) {
    res.status(403).json({ error: 'Request origin is not allowed' })
    return
  }
  next()
}

const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ValidationError) {
    res.status(error.status).json({ error: error.message })
    return
  }

  if (isHttpError(error)) {
    res.status(error.status).json({ error: error.status < 500 ? error.message : 'Request failed' })
    return
  }

  console.error('Unhandled request error:', error)
  res.status(500).json({ error: 'Internal server error' })
}

function isHttpError(value: unknown): value is Error & { status: number } {
  return value instanceof Error && 'status' in value && typeof value.status === 'number'
}
