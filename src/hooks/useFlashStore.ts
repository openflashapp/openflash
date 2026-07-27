import { createContext, useContext } from 'react'
import type { FlashCard, DeckConfig, Folder, Theme, Settings } from '../types'
import type { LearningStorageMode } from '../lib/storage'

export interface FlashStore {
  cards: FlashCard[]
  emptyDecks: string[]
  deckConfigs: Record<string, DeckConfig>
  folders: Folder[]
  theme: Theme
  settings: Settings
  storageMode: LearningStorageMode

  setTheme: (t: Theme) => void
  setSettings: (s: Settings) => void
  setStorageMode: (mode: LearningStorageMode) => void
  addCard: (deck: string, question: string, answer: string, transcription?: string, transcriptionPlacement?: 'question' | 'answer') => string
  addCards: (deck: string, items: { question: string; answer: string; transcription?: string; transcriptionPlacement?: 'question' | 'answer' }[]) => void
  resetDeckProgress: (deck: string) => void
  deleteCard: (id: string) => void
  updateCard: (id: string, updates: Partial<FlashCard>) => void
  togglePinCard: (id: string) => void

  addDeck: (name: string) => string
  deleteDeck: (name: string) => void
  deleteDecks: (names: string[]) => void
  deleteAllCards: () => void
  togglePinDeck: (name: string) => void
  renameDeck: (oldName: string, newName: string) => void

  getDecks: () => string[]
  getDeckCards: (deck: string) => FlashCard[]
  getDueCards: (deck?: string) => FlashCard[]
  getDeckConfig: (deck: string) => DeckConfig | undefined
  updateDeckConfig: (deck: string, config: Partial<DeckConfig>) => void

  addFolder: (name: string) => void
  deleteFolder: (name: string) => void
  renameFolder: (oldName: string, newName: string) => void
  toggleFolderCollapsed: (name: string) => void
  getDecksByFolder: () => { folder: string | null; decks: string[] }[]

  importBackup: (data: { cards: FlashCard[]; emptyDecks: string[]; deckConfigs: Record<string, DeckConfig>; theme: Theme; folders?: Folder[]; settings?: Settings }) => void
}

export const FlashStoreContext = createContext<FlashStore | null>(null)

export function useFlashStore(): FlashStore {
  const ctx = useContext(FlashStoreContext)
  if (!ctx) throw new Error('useFlashStore must be used within FlashStoreProvider')
  return ctx
}
