import { Router } from 'express'
import { getDb } from '../db.js'
import type { AIProviderId, ProviderConfigRecord } from '../domain/types.js'
import { protectProviderConfigs, revealProviderConfigs, decrypt, encrypt } from '../lib/crypto.js'
import { parseProviderSettingsInput, parseSettingsInput } from '../lib/validation.js'
import { authenticate, type AuthRequest } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

interface SettingsRow {
  vim_mode: number
  cursor_effect: number
  glow_effect: number
  mistral_api_key: string
  providers: string
  providers_updated_at: string
  active_provider: string
}

interface ProviderSettingsRow {
  providers: string
  providers_updated_at: string
}

router.get('/', async (req, res) => {
  const userId = (req as AuthRequest).userId
  const { rows } = await getDb().query<SettingsRow>(`
    SELECT vim_mode, cursor_effect, glow_effect, mistral_api_key, providers, active_provider
    FROM settings WHERE user_id = $1
  `, [userId])
  const row = rows[0]

  const providers = parseStoredProviders(row?.providers)
  const legacyMistralKey = decrypt(row?.mistral_api_key ?? '')
  if (legacyMistralKey) {
    providers.mistral = {
      apiKey: providers.mistral?.apiKey || legacyMistralKey,
      model: providers.mistral?.model || 'mistral-small-latest',
      baseUrl: providers.mistral?.baseUrl,
    }
  }

  res.json({
    vimMode: Boolean(row?.vim_mode),
    cursorEffect: Boolean(row?.cursor_effect),
    glowEffect: row?.glow_effect !== 0,
    providers,
    activeProvider: row?.active_provider || 'mistral',
  })
})

router.put('/', async (req, res) => {
  const userId = (req as AuthRequest).userId
  const settings = parseSettingsInput(req.body)
  const protectedProviders = protectProviderConfigs(settings.providers)

  await getDb().query(`
    INSERT INTO settings (user_id, vim_mode, cursor_effect, glow_effect, mistral_api_key, providers, providers_updated_at, active_provider)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT(user_id) DO UPDATE SET
      vim_mode = EXCLUDED.vim_mode,
      cursor_effect = EXCLUDED.cursor_effect,
      glow_effect = EXCLUDED.glow_effect,
      mistral_api_key = EXCLUDED.mistral_api_key,
      providers = EXCLUDED.providers,
      providers_updated_at = EXCLUDED.providers_updated_at,
      active_provider = EXCLUDED.active_provider
  `, [
    userId,
    Number(settings.vimMode),
    Number(settings.cursorEffect),
    Number(settings.glowEffect),
    encrypt(''),
    JSON.stringify(protectedProviders),
    Date.now(),
    settings.activeProvider,
  ])

  res.json({ ok: true })
})

router.get('/providers', async (req, res) => {
  const { rows } = await getDb().query<ProviderSettingsRow>(
    'SELECT providers, providers_updated_at FROM settings WHERE user_id = $1',
    [(req as AuthRequest).userId],
  )
  const row = rows[0]
  res.json({
    providers: parseStoredProviders(row?.providers),
    updatedAt: Number(row?.providers_updated_at ?? 0),
  })
})

router.put('/providers', async (req, res) => {
  const userId = (req as AuthRequest).userId
  const input = parseProviderSettingsInput(req.body)
  const protectedProviders = protectProviderConfigs(input.providers)
  const db = getDb()
  const { rows } = await db.query<ProviderSettingsRow>(`
    INSERT INTO settings (user_id, providers, providers_updated_at)
    VALUES ($1, $2, $3)
    ON CONFLICT(user_id) DO UPDATE SET
      providers = EXCLUDED.providers,
      providers_updated_at = EXCLUDED.providers_updated_at
    WHERE settings.providers_updated_at <= EXCLUDED.providers_updated_at
    RETURNING providers, providers_updated_at
  `, [userId, JSON.stringify(protectedProviders), input.updatedAt])
  const row = rows[0] ?? (await db.query<ProviderSettingsRow>(
    'SELECT providers, providers_updated_at FROM settings WHERE user_id = $1', [userId],
  )).rows[0]
  res.json({
    providers: parseStoredProviders(row?.providers),
    updatedAt: Number(row?.providers_updated_at ?? 0),
  })
})

function parseStoredProviders(value: string | undefined): Partial<Record<AIProviderId, ProviderConfigRecord>> {
  if (!value) return {}
  try {
    return revealProviderConfigs(JSON.parse(value) as unknown)
  } catch {
    return {}
  }
}

export default router
