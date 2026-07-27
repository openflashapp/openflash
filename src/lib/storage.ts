import type { CardTombstone, FlashCard, DeckConfig, Folder, Theme, Settings } from '../types'
import { normalizeSettings, parseDeckConfigs, parseFlashCards, parseFolders, parseStringArray } from './validation'
import { isTheme } from '../config/themes'

const CARDS_KEY = 'openflash_cards'
const EMPTY_DECKS_KEY = 'openflash_empty_decks'
const DECK_CONFIGS_KEY = 'openflash_deck_configs'
const THEME_KEY = 'mono_theme'
const DELETED_CARDS_KEY = 'openflash_deleted_cards'
const STRUCTURE_UPDATED_AT_KEY = 'openflash_structure_updated_at'
const PROVIDER_SETTINGS_KEY = 'openflash_provider_settings'
const LEARNING_STORAGE_MODE_KEY = 'openflash_learning_storage_mode'

export type LearningStorageMode = 'guest' | 'account'

export interface LearningSnapshot {
  cards: FlashCard[]
  emptyDecks: string[]
  deckConfigs: Record<string, DeckConfig>
  folders: Folder[]
  deletedCards: CardTombstone[]
  structureUpdatedAt: number
}

export interface ProviderSettingsSnapshot {
  providers: Settings['providers']
  updatedAt: number
}

export function loadLearningStorageMode(hasAccount: boolean): LearningStorageMode {
  if (!hasAccount) return 'guest'
  return sessionStorage.getItem(LEARNING_STORAGE_MODE_KEY) === 'guest' ? 'guest' : 'account'
}

export function saveLearningStorageMode(mode: LearningStorageMode): void {
  sessionStorage.setItem(LEARNING_STORAGE_MODE_KEY, mode)
}

function scopedKey(key: string, accountId?: string | null): string {
  return accountId ? `${key}:${accountId}` : key
}

function loadJson(key: string, accountId?: string | null): unknown {
  const stored = localStorage.getItem(scopedKey(key, accountId))
  if (!stored) return undefined
  try {
    return JSON.parse(stored) as unknown
  } catch {
    return undefined
  }
}

function saveJson(key: string, value: unknown, accountId?: string | null): void {
  localStorage.setItem(scopedKey(key, accountId), JSON.stringify(value))
}

export function loadCards(accountId?: string | null): FlashCard[] {
  return parseFlashCards(loadJson(CARDS_KEY, accountId))
}

export function saveCards(cards: FlashCard[], accountId?: string | null): void {
  saveJson(CARDS_KEY, cards, accountId)
}

export function loadEmptyDecks(accountId?: string | null): string[] {
  return parseStringArray(loadJson(EMPTY_DECKS_KEY, accountId))
}

export function saveEmptyDecks(decks: string[], accountId?: string | null): void {
  saveJson(EMPTY_DECKS_KEY, decks, accountId)
}

export function loadDeckConfigs(accountId?: string | null): Record<string, DeckConfig> {
  return parseDeckConfigs(loadJson(DECK_CONFIGS_KEY, accountId))
}

export function saveDeckConfigs(configs: Record<string, DeckConfig>, accountId?: string | null): void {
  saveJson(DECK_CONFIGS_KEY, configs, accountId)
}

export function loadTheme(): Theme | null {
  const theme = localStorage.getItem(THEME_KEY)
  return isTheme(theme) ? theme : null
}

export function saveTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme)
}

const FOLDERS_KEY = 'openflash_folders'
const SETTINGS_KEY = 'openflash_settings'

export function loadFolders(accountId?: string | null): Folder[] {
  return parseFolders(loadJson(FOLDERS_KEY, accountId))
}

export function saveFolders(folders: Folder[], accountId?: string | null): void {
  saveJson(FOLDERS_KEY, folders, accountId)
}

export function loadLearningSnapshot(accountId?: string | null): LearningSnapshot {
  return {
    cards: loadCards(accountId),
    emptyDecks: loadEmptyDecks(accountId),
    deckConfigs: loadDeckConfigs(accountId),
    folders: loadFolders(accountId),
    deletedCards: loadCardTombstones(accountId),
    structureUpdatedAt: loadStructureUpdatedAt(accountId),
  }
}

export function hasLearningData(accountId?: string | null): boolean {
  const snapshot = loadLearningSnapshot(accountId)
  return snapshot.cards.length > 0 || snapshot.deletedCards.length > 0 || snapshot.emptyDecks.length > 0 ||
    snapshot.folders.length > 0 || Object.keys(snapshot.deckConfigs).length > 0
}

export function clearLearningSnapshot(accountId?: string | null): void {
  for (const key of [CARDS_KEY, DELETED_CARDS_KEY, EMPTY_DECKS_KEY, DECK_CONFIGS_KEY, FOLDERS_KEY, STRUCTURE_UPDATED_AT_KEY]) {
    localStorage.removeItem(scopedKey(key, accountId))
  }
}

export function loadCardTombstones(accountId?: string | null): CardTombstone[] {
  const value = loadJson(DELETED_CARDS_KEY, accountId)
  if (!Array.isArray(value)) return []
  const latest = new Map<string, number>()
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    if (typeof record.id !== 'string' || !record.id || typeof record.deletedAt !== 'number' ||
      !Number.isSafeInteger(record.deletedAt) || record.deletedAt < 0) continue
    latest.set(record.id, Math.max(latest.get(record.id) ?? 0, record.deletedAt))
  }
  return [...latest.entries()].map(([id, deletedAt]) => ({ id, deletedAt }))
}

export function saveCardTombstones(tombstones: CardTombstone[], accountId?: string | null): void {
  saveJson(DELETED_CARDS_KEY, tombstones, accountId)
}

export function loadStructureUpdatedAt(accountId?: string | null): number {
  const value = loadJson(STRUCTURE_UPDATED_AT_KEY, accountId)
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
}

export function saveStructureUpdatedAt(updatedAt: number, accountId?: string | null): void {
  saveJson(STRUCTURE_UPDATED_AT_KEY, updatedAt, accountId)
}

export function loadSettings(): Settings | null {
  const value = loadJson(SETTINGS_KEY)
  return value === undefined ? null : normalizeSettings(value)
}

export function saveSettings(settings: Settings): void {
  saveJson(SETTINGS_KEY, settings)
}

export function loadProviderSettings(accountId: string): ProviderSettingsSnapshot | null {
  const value = loadJson(PROVIDER_SETTINGS_KEY, accountId)
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const snapshot = value as Record<string, unknown>
  if (typeof snapshot.updatedAt !== 'number' || !Number.isSafeInteger(snapshot.updatedAt) || snapshot.updatedAt < 0) return null
  return {
    providers: normalizeSettings({ providers: snapshot.providers }).providers,
    updatedAt: snapshot.updatedAt,
  }
}

export function saveProviderSettings(snapshot: ProviderSettingsSnapshot, accountId: string): void {
  saveJson(PROVIDER_SETTINGS_KEY, snapshot, accountId)
}

export function clearProviderSettings(accountId: string): void {
  localStorage.removeItem(scopedKey(PROVIDER_SETTINGS_KEY, accountId))
}
