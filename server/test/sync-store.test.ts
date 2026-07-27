import assert from 'node:assert/strict'
import test from 'node:test'
import type { SyncPayload } from '../src/domain/types.js'
import { mergeSnapshots } from '../src/services/sync-store.js'

function snapshot(overrides: Partial<SyncPayload> = {}): SyncPayload {
  return {
    cards: [],
    deletedCards: [],
    deckConfigs: {},
    emptyDecks: [],
    folders: [],
    structureUpdatedAt: 0,
    ...overrides,
  }
}

function card(updatedAt: number, answer: string) {
  return {
    id: 'card-1', deck: 'Deck', question: 'Question', answer, transcription: '',
    transcriptionPlacement: 'question' as const, interval: 1, ease: 2.5, reps: 0,
    lapses: 0, nextReview: 0, pinned: false, suspended: false, updatedAt,
  }
}

test('newer card updated_at wins regardless of upload order', () => {
  const result = mergeSnapshots(
    snapshot({ cards: [card(20, 'new')] }),
    snapshot({ cards: [card(10, 'old')] }),
  )
  assert.equal(result.cards[0]?.answer, 'new')
})

test('newer tombstone prevents an older client from restoring a deleted card', () => {
  const result = mergeSnapshots(
    snapshot({ deletedCards: [{ id: 'card-1', deletedAt: 20 }] }),
    snapshot({ cards: [card(10, 'stale')] }),
  )
  assert.equal(result.cards.length, 0)
  assert.deepEqual(result.deletedCards, [{ id: 'card-1', deletedAt: 20 }])
})

test('deck structure uses its own updated_at clock', () => {
  const result = mergeSnapshots(
    snapshot({ emptyDecks: ['Cloud'], structureUpdatedAt: 20 }),
    snapshot({ emptyDecks: ['Stale local'], structureUpdatedAt: 10 }),
  )
  assert.deepEqual(result.emptyDecks, ['Cloud'])
  assert.equal(result.structureUpdatedAt, 20)
})
