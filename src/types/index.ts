import type { Theme as ThemeId } from '../config/themes'
import type { DeckColor, DeckIcon } from '../config/deckAppearance'

export interface FlashCard {
  id: string
  deck: string
  question: string
  answer: string
  transcription?: string
  transcriptionPlacement?: 'question' | 'answer'
  interval: number
  ease: number
  reps: number
  lapses: number
  nextReview: number
  pinned: boolean
  suspended: boolean
  /** Last local mutation time used to resolve cross-device sync conflicts. */
  updatedAt?: number
}

export interface CardTombstone {
  id: string
  deletedAt: number
}

export interface Folder {
  name: string
  collapsed: boolean
}

export interface DeckConfig {
  pinned: boolean
  emoji?: string
  icon?: DeckIcon
  color?: DeckColor
  customColor?: string
  colorizeInterface?: boolean
  folder?: string
  steps?: number[]
  maxInterval?: number
  leechThreshold?: number
  leechAction?: 'mark' | 'suspend'
  newPerDay?: number
  reviewPerDay?: number
}

export interface SessionStats {
  startTime: number
  endTime: number
  cardCount: number
  ratings: Record<1 | 2 | 3 | 4, number>
}

export type Theme = ThemeId

export interface Backup {
  version: 1
  type: 'openflash_full_backup'
  theme: Theme
  settings?: Settings
  cards: FlashCard[]
  emptyDecks: string[]
  deckConfigs: Record<string, DeckConfig>
  folders?: Folder[]
}

export type AIProviderId = 'openai' | 'anthropic' | 'gemini' | 'mistral' | 'deepseek' | 'meta' | 'xai' | 'openrouter' | 'ollama' | 'lmstudio'

export interface ProviderConfig {
  apiKey: string
  model: string
  baseUrl?: string
}

export interface AIFormSettings {
  mode: 'language' | 'custom'
  nativeLang: string
  targetLang: string
  template: string
  withTranscription: boolean
  transcriptionPlacement: 'question' | 'answer'
  transcriptionLang: 'target' | 'latin'
}

export interface Settings {
  cursorEffect: boolean
  adsEnabled: boolean
  vimMode: boolean
  glowEffect: boolean
  developerMode: boolean
  activeProvider: AIProviderId
  providers: Record<AIProviderId, ProviderConfig>
  aiForm: AIFormSettings
}
