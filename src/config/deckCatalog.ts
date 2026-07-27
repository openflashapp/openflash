export interface DeckCatalogItem {
  id: 'everyday-vocabulary' | 'travel-essentials' | 'phrasal-verbs'
  name: string
  level: string
  descriptionKey: string
}

export const ENGLISH_DECK_CATALOG: readonly DeckCatalogItem[] = [
  {
    id: 'everyday-vocabulary',
    name: 'English: Everyday Vocabulary',
    level: 'A1-A2',
    descriptionKey: 'catalog.everyday.description',
  },
  {
    id: 'travel-essentials',
    name: 'English: Travel Essentials',
    level: 'A2-B1',
    descriptionKey: 'catalog.travel.description',
  },
  {
    id: 'phrasal-verbs',
    name: 'English: Phrasal Verbs',
    level: 'B1-B2',
    descriptionKey: 'catalog.phrasal.description',
  },
]
