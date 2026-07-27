export type TranscriptionPlacement = 'question' | 'answer'
export type LeechAction = 'mark' | 'suspend'
export type DeckIcon =
  | 'book-open' | 'language' | 'translate' | 'headphones' | 'speech' | 'code' | 'terminal' | 'database'
  | 'brackets' | 'git-branch' | 'function' | 'atom' | 'flask' | 'calculator' | 'map' | 'dictionary'
export type DeckColor = 'slate' | 'blue' | 'sky' | 'cyan' | 'teal' | 'green' | 'lime' | 'yellow' | 'amber' | 'orange'
  | 'red' | 'rose' | 'pink' | 'fuchsia' | 'purple' | 'violet' | 'indigo' | 'brown'

export interface CardRecord {
  id: string
  deck: string
  question: string
  answer: string
  transcription: string
  transcriptionPlacement: TranscriptionPlacement
  interval: number
  ease: number
  reps: number
  lapses: number
  nextReview: number
  pinned: boolean
  suspended: boolean
  updatedAt: number
}

export interface CardTombstoneRecord {
  id: string
  deletedAt: number
}

export interface DeckConfigRecord {
  pinned: boolean
  emoji?: string
  icon?: DeckIcon
  color?: DeckColor
  customColor?: string
  colorizeInterface: boolean
  folder?: string
  steps?: number[]
  maxInterval: number
  leechThreshold: number
  leechAction: LeechAction
  newPerDay: number
  reviewPerDay: number
}

export interface FolderRecord {
  name: string
  collapsed: boolean
}

export interface SyncPayload {
  cards: CardRecord[]
  deletedCards: CardTombstoneRecord[]
  deckConfigs: Record<string, DeckConfigRecord>
  emptyDecks: string[]
  folders: FolderRecord[]
  /** Last mutation of decks, deck settings, or folders. */
  structureUpdatedAt: number
}

export const AI_PROVIDER_IDS = [
  'mistral',
  'openrouter',
  'openai',
  'anthropic',
  'gemini',
  'deepseek',
  'meta',
  'xai',
  'ollama',
  'lmstudio',
] as const

export type AIProviderId = typeof AI_PROVIDER_IDS[number]

export interface ProviderConfigRecord {
  apiKey: string
  model: string
  baseUrl?: string
}

export interface ProviderSettingsInput {
  providers: Partial<Record<AIProviderId, ProviderConfigRecord>>
  updatedAt: number
}

export interface SettingsInput {
  vimMode: boolean
  cursorEffect: boolean
  glowEffect: boolean
  providers: Partial<Record<AIProviderId, ProviderConfigRecord>>
  activeProvider: AIProviderId
}
