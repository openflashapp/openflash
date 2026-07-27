import type { DeckConfig, FlashCard, Folder } from '../types'

export interface DeckGroup {
  folder: string | null
  decks: string[]
}

export function deckKey(name: string): string {
  return name.trim().toLocaleLowerCase()
}

export function collectDeckNames(cards: readonly FlashCard[], emptyDecks: readonly string[]): string[] {
  const names = new Map<string, string>()
  for (const name of [...emptyDecks, ...cards.map(card => card.deck)]) {
    const trimmed = name.trim()
    if (trimmed) names.set(deckKey(trimmed), trimmed)
  }
  return [...names.values()]
}

export function sortDeckNames(names: readonly string[], configs: Readonly<Record<string, DeckConfig>>): string[] {
  return [...names].sort((left, right) => {
    const pinDifference = Number(Boolean(configs[right]?.pinned)) - Number(Boolean(configs[left]?.pinned))
    return pinDifference || left.localeCompare(right)
  })
}

export function selectDueCards(
  cards: readonly FlashCard[],
  configs: Readonly<Record<string, DeckConfig>>,
  deck?: string,
  now = Date.now(),
): FlashCard[] {
  const relevantCards = deck ? cards.filter(card => card.deck === deck) : cards
  const dueCards = relevantCards.filter(card => !card.suspended && (!card.nextReview || card.nextReview <= now))

  if (deck) return applyDailyLimits(dueCards, configs[deck])

  const cardsByDeck = new Map<string, FlashCard[]>()
  for (const card of dueCards) {
    const cardsInDeck = cardsByDeck.get(card.deck) ?? []
    cardsInDeck.push(card)
    cardsByDeck.set(card.deck, cardsInDeck)
  }
  return [...cardsByDeck.entries()].flatMap(([deckName, cardsInDeck]) => applyDailyLimits(cardsInDeck, configs[deckName]))
}

function applyDailyLimits(dueCards: readonly FlashCard[], config?: DeckConfig): FlashCard[] {
  let limitedCards = [...dueCards]

  if (config?.reviewPerDay && config.reviewPerDay > 0) {
    const reviews = limitedCards.filter(card => card.reps > 0).sort(byReviewDate)
    const includedReviews = new Set(reviews.slice(0, config.reviewPerDay).map(card => card.id))
    limitedCards = limitedCards.filter(card => card.reps === 0 || includedReviews.has(card.id))
  }

  if (config?.newPerDay && config.newPerDay > 0) {
    const newCards = limitedCards.filter(card => card.reps === 0).slice(0, config.newPerDay)
    const includedNewCards = new Set(newCards.map(card => card.id))
    limitedCards = limitedCards.filter(card => card.reps > 0 || includedNewCards.has(card.id))
  }

  return limitedCards
}

export function groupDecks(
  cards: readonly FlashCard[],
  emptyDecks: readonly string[],
  configs: Readonly<Record<string, DeckConfig>>,
  folders: readonly Folder[],
): DeckGroup[] {
  const groups = new Map<string | null, string[]>()
  for (const deck of collectDeckNames(cards, emptyDecks)) {
    const folder = configs[deck]?.folder ?? null
    const group = groups.get(folder) ?? []
    group.push(deck)
    groups.set(folder, group)
  }

  const result: DeckGroup[] = []
  for (const folder of folders) {
    const decks = groups.get(folder.name)
    if (decks?.length) result.push({ folder: folder.name, decks: sortDeckNames(decks, configs) })
  }

  const knownFolders = new Set(folders.map(folder => folder.name))
  const orphaned = [...groups.entries()]
    .filter(([folder]) => folder !== null && !knownFolders.has(folder))
    .flatMap(([, decks]) => decks)
  const ungrouped = [...(groups.get(null) ?? []), ...orphaned]
  if (ungrouped.length) result.push({ folder: null, decks: sortDeckNames(ungrouped, configs) })
  return result
}

function byReviewDate(left: FlashCard, right: FlashCard): number {
  return left.nextReview - right.nextReview
}
