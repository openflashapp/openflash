import assert from 'node:assert/strict'
import test from 'node:test'
import { ENGLISH_DECK_CATALOG } from '../../src/config/deckCatalog.js'
import { buildAppPath, getPathLocale, parseAppRoute } from '../../src/lib/routes.js'

test('localized app routes round-trip deck names safely', () => {
  const path = buildAppPath('ru', { screen: 'deck-detail', deck: 'C++ / основы' })
  assert.equal(getPathLocale(path), 'ru')
  assert.deepEqual(parseAppRoute(path), { screen: 'deck-detail', deck: 'C++ / основы' })
})

test('malformed URL encoding does not crash routing', () => {
  assert.deepEqual(parseAppRoute('/en/deck/%E0%A4%A'), { screen: 'deck-detail', deck: '' })
})

test('deck store route and catalog are available', () => {
  const path = buildAppPath('en', { screen: 'deck-store', deck: '' })
  assert.equal(path, '/en/deck-store')
  assert.deepEqual(parseAppRoute(path), { screen: 'deck-store', deck: '' })
  assert.equal(ENGLISH_DECK_CATALOG.length, 3)
  assert.deepEqual(ENGLISH_DECK_CATALOG.map(deck => deck.name), [
    'English: Everyday Vocabulary',
    'English: Travel Essentials',
    'English: Phrasal Verbs',
  ])
})

test('about page is the localized landing route', () => {
  assert.deepEqual(parseAppRoute('/'), { screen: 'about', deck: '' })
  assert.deepEqual(parseAppRoute('/en'), { screen: 'about', deck: '' })
  assert.equal(buildAppPath('en', { screen: 'about', deck: '' }), '/en/about')
})
