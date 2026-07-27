import { useCallback, useEffect, useRef } from 'react'
import type { SyncPayload } from '../lib/api'
import { downloadAll, getStoredAuth, subscribeToAuth, uploadAll } from '../lib/api'

const SYNC_ACCOUNT_KEY = 'openflash_sync_account_id'
const SYNC_STATE_KEY = 'openflash_sync_state'

interface CloudSyncOptions {
  getSnapshot: () => SyncPayload
  applyRemoteSnapshot: (snapshot: SyncPayload) => void
  autoStart?: boolean
  enabled?: boolean
}

export function useCloudSync({
  getSnapshot,
  applyRemoteSnapshot,
  autoStart = true,
  enabled = true,
}: CloudSyncOptions): () => Promise<void> {
  const syncing = useRef(false)
  const pendingSync = useRef(false)
  const mutationVersion = useRef(0)
  const downloadVersion = useRef(0)
  const syncState = useRef(readSyncState())

  const saveSyncState = useCallback((accountId: string | null, dirty: boolean) => {
    syncState.current = { accountId, dirty }
    if (accountId) sessionStorage.setItem(SYNC_ACCOUNT_KEY, accountId)
    else sessionStorage.removeItem(SYNC_ACCOUNT_KEY)
    sessionStorage.setItem(SYNC_STATE_KEY, JSON.stringify(syncState.current))
  }, [])

  const isDirtyFor = useCallback((userId: string) => (
    syncState.current.accountId === userId && syncState.current.dirty
  ), [])

  const canWriteForCurrentAccount = useCallback(() => {
    if (!enabled) return false
    const userId = getStoredAuth()?.user.id
    return Boolean(userId && (syncState.current.accountId === null || syncState.current.accountId === userId))
  }, [enabled])

  const syncToServer = useCallback(async () => {
    if (!canWriteForCurrentAccount()) return
    const auth = getStoredAuth()
    if (!auth) return

    mutationVersion.current += 1
    saveSyncState(auth.user.id, true)
    if (syncing.current) {
      pendingSync.current = true
      return
    }

    syncing.current = true
    try {
      do {
        pendingSync.current = false
        if (getStoredAuth()?.user.id !== auth.user.id) break
        const version = mutationVersion.current
        const result = await uploadAll(getSnapshot())
        if (getStoredAuth()?.user.id !== auth.user.id) break
        if (mutationVersion.current === version) {
          applyRemoteSnapshot(result.snapshot)
          saveSyncState(auth.user.id, false)
        }
      } while (pendingSync.current)
    } catch {
      // Local data remains the source of truth and the next mutation retries the sync.
    } finally {
      syncing.current = false
    }
  }, [applyRemoteSnapshot, canWriteForCurrentAccount, getSnapshot, saveSyncState])

  const syncFromServer = useCallback(async () => {
    if (!enabled) return
    const auth = getStoredAuth()
    if (!auth) return
    const requestVersion = ++downloadVersion.current

    try {
      // A completed review is saved to local storage synchronously.  Never let
      // an older server snapshot replace it after a reload or a slow request.
      if (isDirtyFor(auth.user.id)) {
        await syncToServer()
        return
      }

      const remote = await downloadAll()
      if (requestVersion !== downloadVersion.current) return
      if (isDirtyFor(auth.user.id)) {
        await syncToServer()
        return
      }
      if (hasData(remote)) {
        applyRemoteSnapshot(remote)
        saveSyncState(auth.user.id, false)
      } else if (syncState.current.accountId === null || syncState.current.accountId === auth.user.id) {
        await syncToServer()
      } else {
        // Never copy another account's local data into a new account.
        applyRemoteSnapshot(remote)
        saveSyncState(auth.user.id, false)
      }
    } catch {
      // Local data remains the source of truth and the next mutation retries the sync.
    }
  }, [applyRemoteSnapshot, enabled, isDirtyFor, saveSyncState, syncToServer])

  useEffect(() => {
    if (!enabled) return
    if (autoStart) void syncFromServer()
    const unsubscribeAuth = subscribeToAuth(() => {
      if (!getStoredAuth()) {
        pendingSync.current = false
        saveSyncState(null, false)
        return
      }
      if (autoStart) void syncFromServer()
    })
    const syncWhenActive = () => { if (autoStart && getStoredAuth()) void syncFromServer() }
    const syncWhenVisible = () => { if (document.visibilityState === 'visible') syncWhenActive() }
    window.addEventListener('online', syncWhenActive)
    window.addEventListener('focus', syncWhenActive)
    document.addEventListener('visibilitychange', syncWhenVisible)
    return () => {
      unsubscribeAuth()
      window.removeEventListener('online', syncWhenActive)
      window.removeEventListener('focus', syncWhenActive)
      document.removeEventListener('visibilitychange', syncWhenVisible)
    }
  }, [autoStart, enabled, saveSyncState, syncFromServer])

  return syncToServer
}

/** Clears account identity and pending state when the user explicitly logs out. */
export function clearCloudSyncState(): void {
  sessionStorage.removeItem(SYNC_ACCOUNT_KEY)
  sessionStorage.removeItem(SYNC_STATE_KEY)
}

function readSyncState(): { accountId: string | null; dirty: boolean } {
  const legacyAccountId = sessionStorage.getItem(SYNC_ACCOUNT_KEY)
  const stored = sessionStorage.getItem(SYNC_STATE_KEY)
  if (!stored) return { accountId: legacyAccountId, dirty: false }

  try {
    const value: unknown = JSON.parse(stored)
    if (typeof value !== 'object' || value === null) return { accountId: legacyAccountId, dirty: false }
    const state = value as Record<string, unknown>
    return {
      accountId: typeof state.accountId === 'string' ? state.accountId : legacyAccountId,
      dirty: state.dirty === true,
    }
  } catch {
    return { accountId: legacyAccountId, dirty: false }
  }
}

function hasData(snapshot: SyncPayload): boolean {
  return snapshot.cards.length > 0 ||
    (snapshot.deletedCards?.length ?? 0) > 0 ||
    snapshot.emptyDecks.length > 0 ||
    snapshot.folders.length > 0 ||
    Object.keys(snapshot.deckConfigs).length > 0 ||
    snapshot.structureUpdatedAt > 0
}
