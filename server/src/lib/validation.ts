import { AI_PROVIDER_IDS, type AIProviderId, type CardRecord, type CardTombstoneRecord, type DeckColor, type DeckConfigRecord, type DeckIcon, type FolderRecord, type ProviderConfigRecord, type ProviderSettingsInput, type SettingsInput, type SyncPayload } from '../domain/types.js'

const MAX_CARDS = 10_000
const MAX_DECKS = 1_000
const MAX_FOLDERS = 1_000

export class ValidationError extends Error {
  readonly status = 400

  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function requireString(value: unknown, field: string, maxLength: number, minLength = 1): string {
  if (typeof value !== 'string') throw new ValidationError(`${field} must be a string`)
  const normalized = value.trim()
  if (normalized.length < minLength || normalized.length > maxLength) {
    throw new ValidationError(`${field} must be ${minLength}-${maxLength} characters`)
  }
  return normalized
}

export function optionalString(value: unknown, field: string, maxLength: number): string {
  if (value === undefined || value === null || value === '') return ''
  return requireString(value, field, maxLength)
}

function booleanValue(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (value === 0 || value === 1) return Boolean(value)
  return fallback
}

function integerValue(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function numberValue(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

export function parseSyncPayload(value: unknown): SyncPayload {
  if (!isRecord(value)) throw new ValidationError('Request body must be an object')
  if (!Array.isArray(value.cards) || value.cards.length > MAX_CARDS) {
    throw new ValidationError(`cards must contain at most ${MAX_CARDS} items`)
  }
  if (!isRecord(value.deckConfigs) || Object.keys(value.deckConfigs).length > MAX_DECKS) {
    throw new ValidationError(`deckConfigs must contain at most ${MAX_DECKS} items`)
  }
  if (!Array.isArray(value.emptyDecks) || value.emptyDecks.length > MAX_DECKS) {
    throw new ValidationError(`emptyDecks must contain at most ${MAX_DECKS} items`)
  }
  const rawFolders = value.folders === undefined ? [] : value.folders
  if (!Array.isArray(rawFolders) || rawFolders.length > MAX_FOLDERS) {
    throw new ValidationError(`folders must contain at most ${MAX_FOLDERS} items`)
  }

  const cards = value.cards.map((card, index) => parseCard(card, index))
  const ids = new Set(cards.map(card => card.id))
  if (ids.size !== cards.length) throw new ValidationError('Card ids must be unique')
  const rawDeletedCards = value.deletedCards === undefined ? [] : value.deletedCards
  if (!Array.isArray(rawDeletedCards) || rawDeletedCards.length > MAX_CARDS) {
    throw new ValidationError(`deletedCards must contain at most ${MAX_CARDS} items`)
  }
  const deletedCards = rawDeletedCards.map((item, index) => parseCardTombstone(item, index))
  if (new Set(deletedCards.map(item => item.id)).size !== deletedCards.length) {
    throw new ValidationError('deletedCards ids must be unique')
  }

  const deckConfigs: Record<string, DeckConfigRecord> = {}
  for (const [deck, config] of Object.entries(value.deckConfigs)) {
    const normalizedDeck = requireString(deck, 'deck name', 200)
    deckConfigs[normalizedDeck] = parseDeckConfig(config, normalizedDeck)
  }

  const emptyDecks = [...new Set(value.emptyDecks.map((deck, index) => requireString(deck, `emptyDecks[${index}]`, 200)))]
  const folders = rawFolders.map((folder, index) => parseFolder(folder, index))
  const folderNames = new Set(folders.map(folder => folder.name.toLocaleLowerCase()))
  if (folderNames.size !== folders.length) throw new ValidationError('Folder names must be unique')

  const structureUpdatedAt = integerValue(value.structureUpdatedAt, 0, 0, Date.now() + 5 * 60_000)
  return { cards, deletedCards, deckConfigs, emptyDecks, folders, structureUpdatedAt }
}

function parseCard(value: unknown, index: number): CardRecord {
  if (!isRecord(value)) throw new ValidationError(`cards[${index}] must be an object`)
  return {
    id: requireString(value.id, `cards[${index}].id`, 100),
    deck: requireString(value.deck, `cards[${index}].deck`, 200),
    question: requireString(value.question, `cards[${index}].question`, 20_000),
    answer: requireString(value.answer, `cards[${index}].answer`, 20_000),
    transcription: optionalString(value.transcription, `cards[${index}].transcription`, 2_000),
    transcriptionPlacement: value.transcriptionPlacement === 'answer' ? 'answer' : 'question',
    interval: integerValue(value.interval, 1, 0, 36_500),
    ease: numberValue(value.ease, 2.5, 1.3, 3),
    reps: integerValue(value.reps, 0, 0, 1_000_000),
    lapses: integerValue(value.lapses, 0, 0, 1_000_000),
    nextReview: integerValue(value.nextReview, Date.now(), 0, Number.MAX_SAFE_INTEGER),
    pinned: booleanValue(value.pinned),
    suspended: booleanValue(value.suspended),
    updatedAt: integerValue(value.updatedAt, 0, 0, Date.now() + 5 * 60_000),
  }
}

function parseCardTombstone(value: unknown, index: number): CardTombstoneRecord {
  if (!isRecord(value)) throw new ValidationError(`deletedCards[${index}] must be an object`)
  if (typeof value.deletedAt !== 'number' || !Number.isSafeInteger(value.deletedAt) || value.deletedAt <= 0) {
    throw new ValidationError(`deletedCards[${index}].deletedAt must be a positive timestamp`)
  }
  return {
    id: requireString(value.id, `deletedCards[${index}].id`, 100),
    deletedAt: integerValue(value.deletedAt, 0, 0, Date.now() + 5 * 60_000),
  }
}

function parseDeckConfig(value: unknown, deck: string): DeckConfigRecord {
  if (!isRecord(value)) throw new ValidationError(`Configuration for ${deck} must be an object`)
  const steps = Array.isArray(value.steps)
    ? value.steps.map(step => integerValue(step, 1, 1, 36_500)).slice(0, 20)
    : undefined
  return {
    pinned: booleanValue(value.pinned),
    emoji: optionalString(value.emoji, `deckConfigs.${deck}.emoji`, 16) || undefined,
    icon: isDeckIcon(value.icon) ? value.icon : undefined,
    color: isDeckColor(value.color) ? value.color : undefined,
    customColor: isHexColor(value.customColor) ? value.customColor : undefined,
    colorizeInterface: booleanValue(value.colorizeInterface),
    folder: optionalString(value.folder, `deckConfigs.${deck}.folder`, 200) || undefined,
    steps: steps?.length ? steps : undefined,
    maxInterval: integerValue(value.maxInterval, 365, 1, 36_500),
    leechThreshold: integerValue(value.leechThreshold, 8, 1, 1_000),
    leechAction: value.leechAction === 'suspend' ? 'suspend' : 'mark',
    newPerDay: integerValue(value.newPerDay, 0, 0, 100_000),
    reviewPerDay: integerValue(value.reviewPerDay, 0, 0, 100_000),
  }
}

function isDeckIcon(value: unknown): value is DeckIcon {
  return value === 'book-open' || value === 'language' || value === 'translate' || value === 'headphones' ||
    value === 'speech' || value === 'code' || value === 'terminal' || value === 'database' || value === 'brackets' ||
    value === 'git-branch' || value === 'function' || value === 'atom' || value === 'flask' || value === 'calculator' ||
    value === 'map' || value === 'dictionary'
}

function isDeckColor(value: unknown): value is DeckColor {
  return value === 'slate' || value === 'blue' || value === 'sky' || value === 'cyan' || value === 'teal' ||
    value === 'green' || value === 'lime' || value === 'yellow' || value === 'amber' || value === 'orange' ||
    value === 'red' || value === 'rose' || value === 'pink' || value === 'fuchsia' || value === 'purple' ||
    value === 'violet' || value === 'indigo' || value === 'brown'
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
}

function parseFolder(value: unknown, index: number): FolderRecord {
  if (!isRecord(value)) throw new ValidationError(`folders[${index}] must be an object`)
  return {
    name: requireString(value.name, `folders[${index}].name`, 200),
    collapsed: booleanValue(value.collapsed),
  }
}

export function parseSettingsInput(value: unknown): SettingsInput {
  if (!isRecord(value)) throw new ValidationError('Request body must be an object')
  const providers: Partial<Record<AIProviderId, ProviderConfigRecord>> = {}
  if (value.providers !== undefined && !isRecord(value.providers)) {
    throw new ValidationError('providers must be an object')
  }

  if (isRecord(value.providers)) {
    for (const id of AI_PROVIDER_IDS) {
      const config = value.providers[id]
      if (config === undefined) continue
      if (!isRecord(config)) throw new ValidationError(`providers.${id} must be an object`)
      const baseUrl = optionalString(config.baseUrl, `providers.${id}.baseUrl`, 2_000)
      if (baseUrl && !isSafeProviderUrl(baseUrl)) {
        throw new ValidationError(`providers.${id}.baseUrl must use HTTPS`)
      }
      providers[id] = {
        apiKey: optionalString(config.apiKey, `providers.${id}.apiKey`, 1_000),
        model: requireString(config.model, `providers.${id}.model`, 300),
        baseUrl: baseUrl || undefined,
      }
    }
  }

  const activeProvider = AI_PROVIDER_IDS.includes(value.activeProvider as AIProviderId)
    ? value.activeProvider as AIProviderId
    : 'mistral'

  return {
    vimMode: booleanValue(value.vimMode),
    cursorEffect: booleanValue(value.cursorEffect),
    glowEffect: booleanValue(value.glowEffect, true),
    providers,
    activeProvider,
  }
}

export function parseProviderSettingsInput(value: unknown): ProviderSettingsInput {
  if (!isRecord(value) || !isRecord(value.providers)) {
    throw new ValidationError('providers must be an object')
  }
  if (typeof value.updatedAt !== 'number' || !Number.isSafeInteger(value.updatedAt) || value.updatedAt <= 0 || value.updatedAt > Date.now() + 5 * 60_000) {
    throw new ValidationError('updatedAt must be a valid timestamp')
  }
  return { providers: parseSettingsInput(value).providers, updatedAt: value.updatedAt }
}

function isSafeProviderUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
  } catch {
    return false
  }
}
