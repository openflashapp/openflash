import assert from 'node:assert/strict'
import test from 'node:test'
import { groupDecks, selectDueCards } from '../../src/domain/decks.js'
import type { FlashCard } from '../../src/types/index.js'

function card(id: string, overrides: Partial<FlashCard> = {}): FlashCard {
  return {
    id,
    deck: 'Deck',
    question: id,
    answer: id,
    interval: 1,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    nextReview: 0,
    pinned: false,
    suspended: false,
    ...overrides,
  }
}

test('selectDueCards excludes suspended cards and applies daily limits', () => {
  const cards = [
    card('new-1'),
    card('new-2'),
    card('review-1', { reps: 2 }),
    card('review-2', { reps: 2 }),
    card('suspended', { suspended: true }),
  ]
  const due = selectDueCards(cards, { Deck: { pinned: false, newPerDay: 1, reviewPerDay: 1 } }, 'Deck', 100)
  assert.deepEqual(due.map(item => item.id), ['new-1', 'review-1'])
})

test('selectDueCards applies every deck daily limit in the global queue', () => {
  const cards = [
    card('a-review-1', { deck: 'A', reps: 1 }),
    card('a-review-2', { deck: 'A', reps: 1 }),
    card('b-review-1', { deck: 'B', reps: 1 }),
    card('b-review-2', { deck: 'B', reps: 1 }),
  ]
  const due = selectDueCards(cards, {
    A: { pinned: false, reviewPerDay: 1 },
    B: { pinned: false, reviewPerDay: 1 },
  }, undefined, 100)
  assert.deepEqual(due.map(item => item.id), ['a-review-1', 'b-review-1'])
})

test('groupDecks keeps decks with missing folders visible as ungrouped', () => {
  const groups = groupDecks(
    [card('one', { deck: 'Orphan' })],
    ['Empty'],
    { Orphan: { pinned: false, folder: 'Deleted' } },
    [],
  )
  assert.deepEqual(groups, [{ folder: null, decks: ['Empty', 'Orphan'] }])
})
