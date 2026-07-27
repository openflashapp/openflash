import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'
import { getJwtSecret } from '../middleware/auth.js'
import { AI_PROVIDER_IDS, type AIProviderId, type ProviderConfigRecord } from '../domain/types.js'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16

function deriveKey(): Buffer {
  return createHash('sha256').update(process.env.ENCRYPTION_SECRET || getJwtSecret()).digest()
}

const ENCRYPTED_PREFIX = 'enc:v1:'

export function protectSecret(plaintext: string): string {
  return plaintext ? ENCRYPTED_PREFIX + encrypt(plaintext) : ''
}

export function revealSecret(value: string): string {
  if (!value) return ''
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value
  return decrypt(value.slice(ENCRYPTED_PREFIX.length))
}

export function protectProviderConfigs(
  providers: Partial<Record<AIProviderId, ProviderConfigRecord>>,
): Partial<Record<AIProviderId, ProviderConfigRecord>> {
  return mapProviderConfigs(providers, protectSecret)
}

export function revealProviderConfigs(value: unknown): Partial<Record<AIProviderId, ProviderConfigRecord>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const source = value as Record<string, unknown>
  const providers: Partial<Record<AIProviderId, ProviderConfigRecord>> = {}

  for (const id of AI_PROVIDER_IDS) {
    const config = source[id]
    if (typeof config !== 'object' || config === null || Array.isArray(config)) continue
    const item = config as Record<string, unknown>
    if (typeof item.model !== 'string') continue
    providers[id] = {
      apiKey: typeof item.apiKey === 'string' ? revealSecret(item.apiKey) : '',
      model: item.model,
      baseUrl: typeof item.baseUrl === 'string' && item.baseUrl ? item.baseUrl : undefined,
    }
  }
  return providers
}

function mapProviderConfigs(
  providers: Partial<Record<AIProviderId, ProviderConfigRecord>>,
  mapSecret: (value: string) => string,
): Partial<Record<AIProviderId, ProviderConfigRecord>> {
  const result: Partial<Record<AIProviderId, ProviderConfigRecord>> = {}
  for (const id of AI_PROVIDER_IDS) {
    const config = providers[id]
    if (!config) continue
    result[id] = { ...config, apiKey: mapSecret(config.apiKey) }
  }
  return result
}

export function encrypt(plaintext: string): string {
  if (!plaintext) return ''
  const key = deriveKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag().toString('hex')

  return `${iv.toString('hex')}:${tag}:${encrypted}`
}

export function decrypt(ciphertext: string): string {
  if (!ciphertext) return ''
  const parts = ciphertext.split(':')
  if (parts.length !== 3) return ''
  const [ivHex, tagHex, encrypted] = parts

  try {
    const key = deriveKey()
    const iv = Buffer.from(ivHex, 'hex')
    const tag = Buffer.from(tagHex, 'hex')
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    return ''
  }
}
