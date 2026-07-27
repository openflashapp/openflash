import assert from 'node:assert/strict'
import test from 'node:test'
import { parseProviderSettingsInput, parseSettingsInput, parseSyncPayload, ValidationError } from '../src/lib/validation.js'

test('parseSyncPayload normalizes a complete snapshot', () => {
  const result = parseSyncPayload({
    cards: [{
      id: 'card-1', deck: 'German', question: 'Haus', answer: 'House',
      transcription: 'haʊs', transcriptionPlacement: 'answer', interval: 3,
      ease: 2.5, reps: 2, lapses: 1, nextReview: 123, pinned: true, suspended: true, updatedAt: 456,
    }],
    deletedCards: [{ id: 'deleted-1', deletedAt: 400 }],
    deckConfigs: { German: { pinned: true, emoji: '📘', icon: 'language', color: 'purple', customColor: '#4f46e5', colorizeInterface: true, steps: [1, 3], folder: 'Languages' } },
    emptyDecks: ['Empty'],
    folders: [{ name: 'Languages', collapsed: true }],
  })

  assert.equal(result.cards[0]?.transcriptionPlacement, 'answer')
  assert.equal(result.cards[0]?.suspended, true)
  assert.equal(result.cards[0]?.updatedAt, 456)
  assert.deepEqual(result.deletedCards, [{ id: 'deleted-1', deletedAt: 400 }])
  assert.equal(result.deckConfigs.German?.maxInterval, 365)
  assert.equal(result.deckConfigs.German?.emoji, '📘')
  assert.equal(result.deckConfigs.German?.icon, 'language')
  assert.equal(result.deckConfigs.German?.color, 'purple')
  assert.equal(result.deckConfigs.German?.customColor, '#4f46e5')
  assert.equal(result.deckConfigs.German?.colorizeInterface, true)
  assert.deepEqual(result.folders, [{ name: 'Languages', collapsed: true }])
})

test('parseSyncPayload rejects duplicate card ids', () => {
  const card = { id: 'same', deck: 'A', question: 'Q', answer: 'A' }
  assert.throws(
    () => parseSyncPayload({ cards: [card, card], deckConfigs: {}, emptyDecks: [], folders: [] }),
    ValidationError,
  )
})

test('parseSettingsInput rejects insecure custom provider URLs', () => {
  assert.throws(() => parseSettingsInput({
    providers: { openai: { apiKey: 'key', model: 'model', baseUrl: 'http://example.com/api' } },
    activeProvider: 'openai',
  }), /must use HTTPS/)
})

test('parseProviderSettingsInput validates encrypted-sync payloads', () => {
  const result = parseProviderSettingsInput({
    updatedAt: Date.now(),
    providers: { openai: { apiKey: 'test-key', model: 'gpt-4o-mini' } },
  })
  assert.equal(result.providers.openai?.apiKey, 'test-key')
  assert.equal(result.providers.openai?.model, 'gpt-4o-mini')
  assert.throws(() => parseProviderSettingsInput({ providers: {}, updatedAt: 0 }), ValidationError)
})

test('parseProviderSettingsInput accepts local AI providers', () => {
  const result = parseProviderSettingsInput({
    updatedAt: Date.now(),
    providers: {
      ollama: { apiKey: '', model: 'llama3.2', baseUrl: 'http://localhost:11434/v1/chat/completions' },
      lmstudio: { apiKey: '', model: 'local-model', baseUrl: 'http://localhost:1234/v1/chat/completions' },
    },
  })
  assert.equal(result.providers.ollama?.baseUrl, 'http://localhost:11434/v1/chat/completions')
  assert.equal(result.providers.lmstudio?.model, 'local-model')
})
