import assert from 'node:assert/strict'
import test from 'node:test'
import { loadCards, loadLearningStorageMode, saveCards, saveLearningStorageMode } from '../../src/lib/storage.js'

test('learning storage mode keeps guest data separate from an authenticated account', () => {
  const values = new Map<string, string>()
  const localValues = new Map<string, string>()
  const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  const originalLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  })
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => localValues.get(key) ?? null,
      setItem: (key: string, value: string) => localValues.set(key, value),
    },
  })

  try {
    assert.equal(loadLearningStorageMode(false), 'guest')
    assert.equal(loadLearningStorageMode(true), 'account')

    saveLearningStorageMode('guest')
    assert.equal(loadLearningStorageMode(true), 'guest')
    assert.equal(loadLearningStorageMode(false), 'guest')

    saveLearningStorageMode('account')
    assert.equal(loadLearningStorageMode(true), 'account')

    const card = { id: 'guest-card', deck: 'Guest', question: 'Q', answer: 'A', interval: 1, ease: 2.5, reps: 0, lapses: 0, nextReview: 1, pinned: false, suspended: false }
    saveCards([card])
    saveCards([{ ...card, id: 'account-card', deck: 'Account' }], 'account-1')
    assert.equal(loadCards()[0]?.id, 'guest-card')
    assert.equal(loadCards('account-1')[0]?.id, 'account-card')
  } finally {
    if (original) Object.defineProperty(globalThis, 'sessionStorage', original)
    else Reflect.deleteProperty(globalThis, 'sessionStorage')
    if (originalLocal) Object.defineProperty(globalThis, 'localStorage', originalLocal)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
