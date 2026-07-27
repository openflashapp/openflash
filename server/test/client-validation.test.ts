import assert from 'node:assert/strict'
import test from 'node:test'
import { DECK_EMOJIS } from '../../src/config/deckAppearance.js'
import { parseDeckConfigs, parseFlashCards } from '../../src/lib/validation.js'

test('client preserves legacy lowercase PostgreSQL aliases during migration', () => {
  const cards = parseFlashCards([{
    id: 'card-1', deck: 'Deck', question: 'Q', answer: 'A', interval: 3,
    ease: 2.5, reps: 2, lapses: 0, nextreview: 1_800_000_000_000,
    transcriptionplacement: 'answer', updatedat: 123, pinned: false, suspended: false,
  }])
  assert.equal(cards[0]?.nextReview, 1_800_000_000_000)
  assert.equal(cards[0]?.transcriptionPlacement, 'answer')
  assert.equal(cards[0]?.updatedAt, 123)

  const configs = parseDeckConfigs({
    Deck: { pinned: false, emoji: '📘', icon: 'language', color: 'purple', customColor: '#4f46e5', colorizeInterface: true, maxinterval: 40, leechthreshold: 5, leechaction: 'suspend', newperday: 10, reviewperday: 20 },
  })
  assert.equal(configs.Deck?.maxInterval, 40)
  assert.equal(configs.Deck?.reviewPerDay, 20)
  assert.equal(configs.Deck?.emoji, '📘')
  assert.equal(configs.Deck?.icon, 'language')
  assert.equal(configs.Deck?.color, 'purple')
  assert.equal(configs.Deck?.colorizeInterface, true)
  assert.ok(DECK_EMOJIS.length > 50)
})
