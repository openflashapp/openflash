import { AI_PROVIDER_IDS, AI_PROVIDERS, createDefaultSettings, isAIProviderId } from '../config/ai'
import { DECK_COLOR_IDS, DECK_ICON_IDS, type DeckColor, type DeckIcon } from '../config/deckAppearance'
import type { DeckConfig, FlashCard, Folder, ProviderConfig, Settings } from '../types'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function nonNegativeInteger(value: unknown, fallback: number): number {
  const number = finiteNumber(value, fallback)
  return Number.isInteger(number) && number >= 0 ? number : fallback
}

export function parseFlashCards(value: unknown): FlashCard[] {
  if (!Array.isArray(value)) return []

  const cards: FlashCard[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    if (
      typeof item.id !== 'string' || !item.id ||
      typeof item.deck !== 'string' || !item.deck ||
      typeof item.question !== 'string' ||
      typeof item.answer !== 'string'
    ) continue

    cards.push({
      id: item.id,
      deck: item.deck,
      question: item.question,
      answer: item.answer,
      transcription: typeof item.transcription === 'string' && item.transcription ? item.transcription : undefined,
      transcriptionPlacement: (item.transcriptionPlacement ?? item.transcriptionplacement) === 'answer' ? 'answer' : 'question',
      interval: nonNegativeInteger(item.interval, 1),
      ease: Math.min(3, Math.max(1.3, finiteNumber(item.ease, 2.5))),
      reps: nonNegativeInteger(item.reps, 0),
      lapses: nonNegativeInteger(item.lapses, 0),
      nextReview: nonNegativeInteger(item.nextReview ?? item.nextreview, Date.now()),
      pinned: item.pinned === true || item.pinned === 1,
      suspended: item.suspended === true || item.suspended === 1,
      updatedAt: nonNegativeInteger(item.updatedAt ?? item.updatedat, 0),
    })
  }
  return cards
}

export function parseDeckConfigs(value: unknown): Record<string, DeckConfig> {
  if (!isRecord(value)) return {}

  const configs: Record<string, DeckConfig> = {}
  for (const [deck, item] of Object.entries(value)) {
    if (!deck || !isRecord(item)) continue
    const steps = Array.isArray(item.steps)
      ? item.steps.filter((step): step is number => Number.isInteger(step) && (step as number) > 0)
      : undefined

    configs[deck] = {
      pinned: item.pinned === true || item.pinned === 1,
      emoji: typeof item.emoji === 'string' && item.emoji.trim().length <= 16 ? item.emoji.trim() || undefined : undefined,
      icon: DECK_ICON_IDS.includes(item.icon as DeckIcon) ? item.icon as DeckIcon : undefined,
      color: DECK_COLOR_IDS.includes(item.color as DeckColor) ? item.color as DeckColor : undefined,
      customColor: isHexColor(item.customColor) ? item.customColor : undefined,
      colorizeInterface: item.colorizeInterface === true,
      folder: typeof item.folder === 'string' && item.folder ? item.folder : undefined,
      steps: steps?.length ? steps : undefined,
      maxInterval: nonNegativeInteger(item.maxInterval ?? item.maxinterval, 365),
      leechThreshold: nonNegativeInteger(item.leechThreshold ?? item.leechthreshold, 8),
      leechAction: (item.leechAction ?? item.leechaction) === 'suspend' ? 'suspend' : 'mark',
      newPerDay: nonNegativeInteger(item.newPerDay ?? item.newperday, 0),
      reviewPerDay: nonNegativeInteger(item.reviewPerDay ?? item.reviewperday, 0),
    }
  }
  return configs
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
}

export function parseFolders(value: unknown): Folder[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const folders: Folder[] = []

  for (const item of value) {
    if (!isRecord(item) || typeof item.name !== 'string') continue
    const name = item.name.trim()
    const key = name.toLocaleLowerCase()
    if (!name || seen.has(key)) continue
    seen.add(key)
    folders.push({ name, collapsed: item.collapsed === true })
  }
  return folders
}

function parseProviderConfig(value: unknown, fallback: ProviderConfig): ProviderConfig {
  if (!isRecord(value)) return { ...fallback }
  return {
    apiKey: typeof value.apiKey === 'string' ? value.apiKey : fallback.apiKey,
    model: typeof value.model === 'string' && value.model ? value.model : fallback.model,
    baseUrl: typeof value.baseUrl === 'string' && value.baseUrl ? value.baseUrl : undefined,
  }
}

export function normalizeSettings(...sources: unknown[]): Settings {
  const result = createDefaultSettings()

  for (const source of sources) {
    if (!isRecord(source)) continue
    if (typeof source.cursorEffect === 'boolean') result.cursorEffect = source.cursorEffect
    if (typeof source.adsEnabled === 'boolean') result.adsEnabled = source.adsEnabled
    if (typeof source.vimMode === 'boolean') result.vimMode = source.vimMode
    if (typeof source.developerMode === 'boolean') result.developerMode = source.developerMode
    if (isAIProviderId(source.activeProvider)) result.activeProvider = source.activeProvider

    if (isRecord(source.providers)) {
      for (const id of AI_PROVIDER_IDS) {
        result.providers[id] = parseProviderConfig(source.providers[id], result.providers[id])
      }
    }

    if (typeof source.mistralApiKey === 'string' && source.mistralApiKey) {
      result.providers.mistral.apiKey = source.mistralApiKey
    }

    if (isRecord(source.aiForm)) {
      const form = source.aiForm
      if (form.mode === 'language' || form.mode === 'custom') result.aiForm.mode = form.mode
      if (typeof form.nativeLang === 'string') result.aiForm.nativeLang = form.nativeLang
      if (typeof form.targetLang === 'string') result.aiForm.targetLang = form.targetLang
      if (typeof form.template === 'string') result.aiForm.template = form.template
      if (typeof form.withTranscription === 'boolean') result.aiForm.withTranscription = form.withTranscription
      if (form.transcriptionPlacement === 'question' || form.transcriptionPlacement === 'answer') {
        result.aiForm.transcriptionPlacement = form.transcriptionPlacement
      }
      if (form.transcriptionLang === 'target' || form.transcriptionLang === 'latin') {
        result.aiForm.transcriptionLang = form.transcriptionLang
      }
    }
  }

  for (const id of AI_PROVIDER_IDS) {
    if (!result.providers[id].model) result.providers[id].model = AI_PROVIDERS[id].defaultModel
  }
  return result
}

export function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))]
}
