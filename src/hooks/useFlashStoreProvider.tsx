import { useState, useCallback, useMemo, useRef, useEffect, type ReactNode } from 'react'
import { FlashStoreContext } from './useFlashStore'
import type { CardTombstone, FlashCard, DeckConfig, Folder, Theme, Settings } from '../types'
import { createDefaultProviderConfigs, createDefaultSettings } from '../config/ai'
import { applyThemePalette } from '../config/themes'
import { loadCards, loadCardTombstones, loadEmptyDecks, loadDeckConfigs, loadFolders, loadLearningSnapshot, loadStructureUpdatedAt, saveCards, saveCardTombstones, saveDeckConfigs, saveEmptyDecks, saveFolders, saveStructureUpdatedAt, loadTheme, saveTheme, loadSettings, loadProviderSettings, saveProviderSettings, saveSettings, loadLearningStorageMode, saveLearningStorageMode, type LearningStorageMode } from '../lib/storage'
import { getProviderSettings, getStoredAuth, saveProviderSettings as saveRemoteProviderSettings, type ProviderSettingsSnapshot, type SyncPayload } from '../lib/api'
import { generateId } from '../lib/srs'
import { normalizeSettings, parseDeckConfigs, parseFlashCards, parseFolders, parseStringArray } from '../lib/validation'
import { collectDeckNames, deckKey, groupDecks, selectDueCards, sortDeckNames } from '../domain/decks'
import { useCloudSync } from './useCloudSync'

export function FlashStoreProvider({ children }: { children: ReactNode }) {
  const authenticatedAccountId = useRef(getStoredAuth()?.user.id ?? null).current
  const [storageMode, setStorageModeState] = useState<LearningStorageMode>(() => loadLearningStorageMode(Boolean(authenticatedAccountId)))
  const learningAccountId = storageMode === 'account' ? authenticatedAccountId : null
  const accountProviderSnapshot = authenticatedAccountId ? loadProviderSettings(authenticatedAccountId) : null
  const [cards, setCards] = useState<FlashCard[]>(() => loadCards(learningAccountId))
  const [deletedCards, setDeletedCards] = useState<CardTombstone[]>(() => loadCardTombstones(learningAccountId))
  const [emptyDecks, setEmptyDecks] = useState<string[]>(() => loadEmptyDecks(learningAccountId))
  const [deckConfigs, setDeckConfigs] = useState<Record<string, DeckConfig>>(() => loadDeckConfigs(learningAccountId))
  const [folders, setFolders] = useState<Folder[]>(() => loadFolders(learningAccountId))
  const [structureUpdatedAt, setStructureUpdatedAt] = useState(() => loadStructureUpdatedAt(learningAccountId))
  const [theme, setThemeState] = useState<Theme>(() => loadTheme() ?? 'froyo')
  const [settings, setSettingsState] = useState<Settings>(() => {
    const local = loadSettings() ?? createDefaultSettings()
    return authenticatedAccountId ? { ...local, providers: accountProviderSnapshot?.providers ?? createDefaultProviderConfigs() } : local
  })

  const cardsRef = useRef(cards)
  cardsRef.current = cards
  const deletedCardsRef = useRef(deletedCards)
  deletedCardsRef.current = deletedCards
  const emptyDecksRef = useRef(emptyDecks)
  emptyDecksRef.current = emptyDecks
  const deckConfigsRef = useRef(deckConfigs)
  deckConfigsRef.current = deckConfigs
  const foldersRef = useRef(folders)
  foldersRef.current = folders
  const structureUpdatedAtRef = useRef(structureUpdatedAt)
  structureUpdatedAtRef.current = structureUpdatedAt
  const activeLearningScopeRef = useRef(learningAccountId)
  activeLearningScopeRef.current = learningAccountId
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const providerUpdatedAtRef = useRef(accountProviderSnapshot?.updatedAt ?? 0)
  const providerSyncTimer = useRef<number | undefined>(undefined)
  const getSnapshot = useCallback((): SyncPayload => ({
    cards: cardsRef.current,
    deletedCards: deletedCardsRef.current,
    deckConfigs: deckConfigsRef.current,
    emptyDecks: emptyDecksRef.current,
    folders: foldersRef.current,
    structureUpdatedAt: structureUpdatedAtRef.current,
  }), [])

  const applyRemoteSnapshot = useCallback((data: SyncPayload) => {
    if (activeLearningScopeRef.current !== learningAccountId) return
    const remoteCards = parseFlashCards(data.cards)
    const remoteDeletedCards = data.deletedCards ?? []
    const remoteEmptyDecks = parseStringArray(data.emptyDecks)
    const remoteConfigs = parseDeckConfigs(data.deckConfigs)
    const remoteFolders = parseFolders(data.folders)
    const remoteStructureUpdatedAt = data.structureUpdatedAt ?? 0
    setCards(remoteCards)
    setDeletedCards(remoteDeletedCards)
    setEmptyDecks(remoteEmptyDecks)
    setDeckConfigs(remoteConfigs)
    setFolders(remoteFolders)
    setStructureUpdatedAt(remoteStructureUpdatedAt)
    cardsRef.current = remoteCards
    deletedCardsRef.current = remoteDeletedCards
    emptyDecksRef.current = remoteEmptyDecks
    deckConfigsRef.current = remoteConfigs
    foldersRef.current = remoteFolders
    structureUpdatedAtRef.current = remoteStructureUpdatedAt
    saveCards(remoteCards, learningAccountId)
    saveCardTombstones(remoteDeletedCards, learningAccountId)
    saveEmptyDecks(remoteEmptyDecks, learningAccountId)
    saveDeckConfigs(remoteConfigs, learningAccountId)
    saveFolders(remoteFolders, learningAccountId)
    saveStructureUpdatedAt(remoteStructureUpdatedAt, learningAccountId)
  }, [learningAccountId])

  const syncToServer = useCloudSync({ getSnapshot, applyRemoteSnapshot, enabled: storageMode === 'account' && Boolean(authenticatedAccountId) })

  useEffect(() => {
    document.documentElement.setAttribute('data-glow', 'off')
  }, [settings.glowEffect])

  const persistCards = useCallback((next: FlashCard[]) => {
    setCards(next)
    saveCards(next, learningAccountId)
  }, [learningAccountId])

  const persistDeletedCards = useCallback((next: CardTombstone[]) => {
    setDeletedCards(next)
    saveCardTombstones(next, learningAccountId)
  }, [learningAccountId])

  const recordDeletedCards = useCallback((ids: readonly string[], deletedAt = Date.now()) => {
    if (ids.length === 0) return
    const latest = new Map(deletedCardsRef.current.map(item => [item.id, item.deletedAt]))
    for (const id of ids) latest.set(id, Math.max(latest.get(id) ?? 0, deletedAt))
    const next = [...latest.entries()].map(([id, timestamp]) => ({ id, deletedAt: timestamp }))
    deletedCardsRef.current = next
    persistDeletedCards(next)
  }, [persistDeletedCards])

  const touchStructure = useCallback((updatedAt = Date.now()) => {
    structureUpdatedAtRef.current = updatedAt
    setStructureUpdatedAt(updatedAt)
    saveStructureUpdatedAt(updatedAt, learningAccountId)
  }, [learningAccountId])

  const persistEmptyDecks = useCallback((next: string[]) => {
    const changed = next.length !== emptyDecksRef.current.length || next.some((deck, index) => deck !== emptyDecksRef.current[index])
    setEmptyDecks(next)
    saveEmptyDecks(next, learningAccountId)
    if (changed) touchStructure()
  }, [learningAccountId, touchStructure])

  const persistDeckConfigs = useCallback((next: Record<string, DeckConfig>) => {
    const changed = JSON.stringify(next) !== JSON.stringify(deckConfigsRef.current)
    setDeckConfigs(next)
    saveDeckConfigs(next, learningAccountId)
    if (changed) touchStructure()
  }, [learningAccountId, touchStructure])

  const persistFolders = useCallback((next: Folder[]) => {
    const changed = JSON.stringify(next) !== JSON.stringify(foldersRef.current)
    setFolders(next)
    saveFolders(next, learningAccountId)
    if (changed) touchStructure()
  }, [learningAccountId, touchStructure])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    saveTheme(t)
    document.documentElement.setAttribute('data-theme', t)
    applyThemePalette(t)
  }, [])

  const applyProviderSettings = useCallback((snapshot: ProviderSettingsSnapshot) => {
    if (!authenticatedAccountId) return
    const providers = normalizeSettings({ providers: snapshot.providers }).providers
    const nextSnapshot = { providers, updatedAt: snapshot.updatedAt }
    providerUpdatedAtRef.current = nextSnapshot.updatedAt
    saveProviderSettings(nextSnapshot, authenticatedAccountId)
    setSettingsState(current => {
      const next = { ...current, providers }
      settingsRef.current = next
      saveSettings(withoutProviderKeys(next))
      return next
    })
  }, [authenticatedAccountId])

  const setSettings = useCallback((s: Settings) => {
    const providersChanged = JSON.stringify(s.providers) !== JSON.stringify(settingsRef.current.providers)
    setSettingsState(s)
    settingsRef.current = s
    saveSettings(authenticatedAccountId ? withoutProviderKeys(s) : s)
    document.documentElement.setAttribute('data-glow', 'off')

    if (!authenticatedAccountId || !providersChanged) return
    const snapshot = { providers: s.providers, updatedAt: Date.now() }
    providerUpdatedAtRef.current = snapshot.updatedAt
    saveProviderSettings(snapshot, authenticatedAccountId)
    if (providerSyncTimer.current) window.clearTimeout(providerSyncTimer.current)
    providerSyncTimer.current = window.setTimeout(() => {
      void saveRemoteProviderSettings(snapshot).then(applyProviderSettings).catch(() => {})
    }, 400)
  }, [authenticatedAccountId, applyProviderSettings])

  useEffect(() => {
    if (!authenticatedAccountId) return
    saveSettings(withoutProviderKeys(settingsRef.current))
    let cancelled = false
    void getProviderSettings().then(remote => {
      if (cancelled) return
      if (remote.updatedAt > providerUpdatedAtRef.current) {
        applyProviderSettings(remote)
      } else if (providerUpdatedAtRef.current > remote.updatedAt) {
        void saveRemoteProviderSettings({
          providers: settingsRef.current.providers,
          updatedAt: providerUpdatedAtRef.current,
        }).then(applyProviderSettings).catch(() => {})
      }
    }).catch(() => {})
    return () => {
      cancelled = true
      if (providerSyncTimer.current) window.clearTimeout(providerSyncTimer.current)
    }
  }, [authenticatedAccountId, applyProviderSettings])

  const addCard = useCallback((deck: string, question: string, answer: string, transcription?: string, transcriptionPlacement?: 'question' | 'answer') => {
    const card: FlashCard = {
      id: generateId(),
      deck,
      question,
      answer,
      transcription,
      transcriptionPlacement,
      interval: 1,
      ease: 2.5,
      reps: 0,
      lapses: 0,
      nextReview: Date.now(),
      pinned: false,
      suspended: false,
      updatedAt: Date.now(),
    }
    const next = [...cardsRef.current, card]
    const nextEmpty = emptyDecksRef.current.filter(name => deckKey(name) !== deckKey(deck))
    persistCards(next)
    persistEmptyDecks(nextEmpty)
    cardsRef.current = next
    emptyDecksRef.current = nextEmpty
    syncToServer()
    return card.id
  }, [persistCards, persistEmptyDecks, syncToServer])

  const addCards = useCallback((deck: string, items: { question: string; answer: string; transcription?: string; transcriptionPlacement?: 'question' | 'answer' }[]) => {
    if (items.length === 0) return
    const now = Date.now()
    const newCards: FlashCard[] = items.map(item => ({
      id: generateId(),
      deck,
      question: item.question,
      answer: item.answer,
      transcription: item.transcription,
      transcriptionPlacement: item.transcriptionPlacement,
      interval: 1,
      ease: 2.5,
      reps: 0,
      lapses: 0,
      nextReview: now,
      pinned: false,
      suspended: false,
      updatedAt: now,
    }))
    const next = [...cardsRef.current, ...newCards]
    const nextEmpty = emptyDecksRef.current.filter(name => deckKey(name) !== deckKey(deck))
    persistCards(next)
    persistEmptyDecks(nextEmpty)
    cardsRef.current = next
    emptyDecksRef.current = nextEmpty
    syncToServer()
  }, [persistCards, persistEmptyDecks, syncToServer])

  const resetDeckProgress = useCallback((deck: string) => {
    const now = Date.now()
    const next = cardsRef.current.map(c =>
      c.deck === deck
        ? { ...c, interval: 1, ease: 2.5, reps: 0, lapses: 0, nextReview: now, suspended: false, updatedAt: now }
        : c
    )
    persistCards(next)
    cardsRef.current = next
    syncToServer()
  }, [persistCards, syncToServer])

  const deleteCard = useCallback((id: string) => {
    const next = cardsRef.current.filter(c => c.id !== id)
    recordDeletedCards([id])
    persistCards(next)
    cardsRef.current = next
    syncToServer()
  }, [persistCards, recordDeletedCards, syncToServer])

  const updateCard = useCallback((id: string, updates: Partial<FlashCard>) => {
    const updatedAt = Date.now()
    const next = cardsRef.current.map(c => c.id === id ? { ...c, ...updates, updatedAt } : c)
    persistCards(next)
    cardsRef.current = next
    syncToServer()
  }, [persistCards, syncToServer])

  const togglePinCard = useCallback((id: string) => {
    const updatedAt = Date.now()
    const next = cardsRef.current.map(c => c.id === id ? { ...c, pinned: !c.pinned, updatedAt } : c)
    persistCards(next)
    cardsRef.current = next
    syncToServer()
  }, [persistCards, syncToServer])

  const addDeck = useCallback((name: string) => {
    const trimmedName = name.trim()
    const existing = collectDeckNames(cardsRef.current, emptyDecksRef.current)
      .find(deck => deckKey(deck) === deckKey(trimmedName))
    if (existing) return existing

    const nextConfigs = { ...deckConfigsRef.current }
    if (!nextConfigs[trimmedName]) {
      nextConfigs[trimmedName] = { pinned: false }
      persistDeckConfigs(nextConfigs)
    }
    const nextEmpty = [...emptyDecksRef.current, trimmedName]
    persistEmptyDecks(nextEmpty)
    deckConfigsRef.current = nextConfigs
    emptyDecksRef.current = nextEmpty
    syncToServer()
    return trimmedName
  }, [persistDeckConfigs, persistEmptyDecks, syncToServer])

  const deleteDeck = useCallback((name: string) => {
    const key = deckKey(name)
    const removedIds = cardsRef.current.filter(card => deckKey(card.deck) === key).map(card => card.id)
    const nextCards = cardsRef.current.filter(card => deckKey(card.deck) !== key)
    recordDeletedCards(removedIds)
    persistCards(nextCards)
    const nextEmpty = emptyDecksRef.current.filter(deck => deckKey(deck) !== key)
    persistEmptyDecks(nextEmpty)
    const nextConfigs = { ...deckConfigsRef.current }
    for (const deck of Object.keys(nextConfigs)) {
      if (deckKey(deck) === key) delete nextConfigs[deck]
    }
    persistDeckConfigs(nextConfigs)
    cardsRef.current = nextCards
    emptyDecksRef.current = nextEmpty
    deckConfigsRef.current = nextConfigs
    syncToServer()
  }, [persistCards, persistEmptyDecks, persistDeckConfigs, recordDeletedCards, syncToServer])

  const deleteDecks = useCallback((names: string[]) => {
    const keys = new Set(names.map(deckKey))
    const removedIds = cardsRef.current.filter(card => keys.has(deckKey(card.deck))).map(card => card.id)
    const nextCards = cardsRef.current.filter(card => !keys.has(deckKey(card.deck)))
    recordDeletedCards(removedIds)
    persistCards(nextCards)
    const nextEmpty = emptyDecksRef.current.filter(deck => !keys.has(deckKey(deck)))
    persistEmptyDecks(nextEmpty)
    const nextConfigs = { ...deckConfigsRef.current }
    Object.keys(nextConfigs).forEach(deck => { if (keys.has(deckKey(deck))) delete nextConfigs[deck] })
    persistDeckConfigs(nextConfigs)
    cardsRef.current = nextCards
    emptyDecksRef.current = nextEmpty
    deckConfigsRef.current = nextConfigs
    syncToServer()
  }, [persistCards, persistEmptyDecks, persistDeckConfigs, recordDeletedCards, syncToServer])

  const deleteAllCards = useCallback(() => {
    const nextEmpty = [...new Set([...emptyDecksRef.current, ...cardsRef.current.map(c => c.deck)])]
    recordDeletedCards(cardsRef.current.map(card => card.id))
    persistCards([])
    persistEmptyDecks(nextEmpty)
    cardsRef.current = []
    emptyDecksRef.current = nextEmpty
    syncToServer()
  }, [persistCards, persistEmptyDecks, recordDeletedCards, syncToServer])

  const togglePinDeck = useCallback((name: string) => {
    const current = deckConfigsRef.current[name] || { pinned: false }
    const next = { ...deckConfigsRef.current, [name]: { ...current, pinned: !current.pinned } }
    persistDeckConfigs(next)
    deckConfigsRef.current = next
    syncToServer()
  }, [persistDeckConfigs, syncToServer])

  const renameDeck = useCallback((oldName: string, newName: string) => {
    const updatedAt = Date.now()
    const nextCards = cardsRef.current.map(c => c.deck === oldName ? { ...c, deck: newName, updatedAt } : c)
    persistCards(nextCards)
    const config = deckConfigsRef.current[oldName]
    let nextConfigs = deckConfigsRef.current
    if (config) {
      nextConfigs = { ...deckConfigsRef.current }
      delete nextConfigs[oldName]
      nextConfigs[newName] = config
      persistDeckConfigs(nextConfigs)
    }
    let nextEmpty = emptyDecksRef.current
    if (emptyDecksRef.current.some(name => deckKey(name) === deckKey(oldName))) {
      nextEmpty = emptyDecksRef.current.map(name => deckKey(name) === deckKey(oldName) ? newName : name)
      persistEmptyDecks(nextEmpty)
    }
    cardsRef.current = nextCards
    emptyDecksRef.current = nextEmpty
    deckConfigsRef.current = nextConfigs
    syncToServer()
  }, [persistCards, persistDeckConfigs, persistEmptyDecks, syncToServer])

  const getDecks = useCallback(() => {
    return sortDeckNames(collectDeckNames(cards, emptyDecks), deckConfigs)
  }, [cards, emptyDecks, deckConfigs])

  const getDeckCards = useCallback((deck: string) => {
    return cards.filter(c => c.deck === deck)
  }, [cards])

  const getDueCards = useCallback((deck?: string) => {
    return selectDueCards(cards, deckConfigs, deck)
  }, [cards, deckConfigs])

  const getDeckConfig = useCallback((deck: string) => {
    return deckConfigs[deck]
  }, [deckConfigs])

  const updateDeckConfig = useCallback((deck: string, config: Partial<DeckConfig>) => {
    const current = deckConfigsRef.current[deck] || { pinned: false }
    const next = { ...deckConfigsRef.current, [deck]: { ...current, ...config } }
    persistDeckConfigs(next)
    deckConfigsRef.current = next
    syncToServer()
  }, [persistDeckConfigs, syncToServer])

  const addFolder = useCallback((name: string) => {
    const next = [...foldersRef.current, { name, collapsed: false }]
    persistFolders(next)
    foldersRef.current = next
    syncToServer()
  }, [persistFolders, syncToServer])

  const deleteFolder = useCallback((name: string) => {
    const next = foldersRef.current.filter(f => f.name !== name)
    persistFolders(next)
    const nextConfigs = { ...deckConfigsRef.current }
    for (const [key, cfg] of Object.entries(nextConfigs)) {
      if (cfg.folder === name) {
        const { folder, ...rest } = cfg
        nextConfigs[key] = rest
      }
    }
    persistDeckConfigs(nextConfigs)
    deckConfigsRef.current = nextConfigs
    foldersRef.current = next
    syncToServer()
  }, [persistFolders, persistDeckConfigs, syncToServer])

  const renameFolder = useCallback((oldName: string, newName: string) => {
    const next = foldersRef.current.map(f => f.name === oldName ? { ...f, name: newName } : f)
    persistFolders(next)
    const nextConfigs = { ...deckConfigsRef.current }
    for (const [key, cfg] of Object.entries(nextConfigs)) {
      if (cfg.folder === oldName) {
        nextConfigs[key] = { ...cfg, folder: newName }
      }
    }
    persistDeckConfigs(nextConfigs)
    deckConfigsRef.current = nextConfigs
    foldersRef.current = next
    syncToServer()
  }, [persistFolders, persistDeckConfigs, syncToServer])

  const toggleFolderCollapsed = useCallback((name: string) => {
    const next = foldersRef.current.map(f => f.name === name ? { ...f, collapsed: !f.collapsed } : f)
    persistFolders(next)
    foldersRef.current = next
    syncToServer()
  }, [persistFolders, syncToServer])

  const getDecksByFolder = useCallback(() => {
    return groupDecks(cards, emptyDecks, deckConfigs, folders)
  }, [cards, emptyDecks, deckConfigs, folders])

  const importBackup = useCallback((data: { cards: FlashCard[]; emptyDecks: string[]; deckConfigs: Record<string, DeckConfig>; theme: Theme; folders?: Folder[]; settings?: Settings }) => {
    const updatedAt = Date.now()
    const importedCards = data.cards.map(card => ({ ...card, updatedAt }))
    const importedIds = new Set(importedCards.map(card => card.id))
    recordDeletedCards(cardsRef.current.filter(card => !importedIds.has(card.id)).map(card => card.id), updatedAt)
    persistCards(importedCards)
    persistEmptyDecks(data.emptyDecks)
    persistDeckConfigs(data.deckConfigs)
    if (data.folders) { persistFolders(data.folders); foldersRef.current = data.folders }
    setThemeState(data.theme)
    saveTheme(data.theme)
    document.documentElement.setAttribute('data-theme', data.theme)
    applyThemePalette(data.theme)
    if (data.settings) {
      const restoredSettings = normalizeSettings(data.settings)
      setSettingsState(restoredSettings)
      saveSettings(authenticatedAccountId ? withoutProviderKeys(restoredSettings) : restoredSettings)
      document.documentElement.setAttribute('data-glow', 'off')
    }
    cardsRef.current = importedCards
    emptyDecksRef.current = data.emptyDecks
    deckConfigsRef.current = data.deckConfigs
    syncToServer()
  }, [authenticatedAccountId, persistCards, persistEmptyDecks, persistDeckConfigs, persistFolders, recordDeletedCards, syncToServer])

  const setStorageMode = useCallback((mode: LearningStorageMode) => {
    if (mode === storageMode || (mode === 'account' && !authenticatedAccountId)) return
    const nextAccountId = mode === 'account' ? authenticatedAccountId : null
    const snapshot = loadLearningSnapshot(nextAccountId)
    setCards(snapshot.cards)
    setDeletedCards(snapshot.deletedCards)
    setEmptyDecks(snapshot.emptyDecks)
    setDeckConfigs(snapshot.deckConfigs)
    setFolders(snapshot.folders)
    setStructureUpdatedAt(snapshot.structureUpdatedAt)
    cardsRef.current = snapshot.cards
    deletedCardsRef.current = snapshot.deletedCards
    emptyDecksRef.current = snapshot.emptyDecks
    deckConfigsRef.current = snapshot.deckConfigs
    foldersRef.current = snapshot.folders
    structureUpdatedAtRef.current = snapshot.structureUpdatedAt
    activeLearningScopeRef.current = nextAccountId
    saveLearningStorageMode(mode)
    setStorageModeState(mode)
  }, [authenticatedAccountId, storageMode])

  const value = useMemo(() => ({
    cards, emptyDecks, deckConfigs, folders, theme, settings, storageMode,
    setTheme, setSettings, setStorageMode, addCard, addCards, resetDeckProgress, deleteCard, updateCard, togglePinCard,
    addDeck, deleteDeck, deleteDecks, deleteAllCards, togglePinDeck, renameDeck,
    getDecks, getDeckCards, getDueCards, getDeckConfig, updateDeckConfig,
    addFolder, deleteFolder, renameFolder, toggleFolderCollapsed, getDecksByFolder,
    importBackup,
  }), [cards, emptyDecks, deckConfigs, folders, theme, settings, setTheme, setSettings, addCard, addCards, resetDeckProgress, deleteCard, updateCard, togglePinCard,
      addDeck, deleteDeck, deleteDecks, deleteAllCards, togglePinDeck, renameDeck, getDecks, getDeckCards, getDueCards, getDeckConfig, updateDeckConfig,
      addFolder, deleteFolder, renameFolder, toggleFolderCollapsed, getDecksByFolder, importBackup, storageMode, setStorageMode])

  return (
    <FlashStoreContext.Provider value={value}>
      {children}
    </FlashStoreContext.Provider>
  )
}

function withoutProviderKeys(settings: Settings): Settings {
  return {
    ...settings,
    providers: Object.fromEntries(
      Object.entries(settings.providers).map(([id, provider]) => [id, { ...provider, apiKey: '' }]),
    ) as Settings['providers'],
  }
}
