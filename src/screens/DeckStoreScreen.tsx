import { CheckIcon } from '../components/Icons'
import { ENGLISH_DECK_CATALOG } from '../config/deckCatalog'
import { deckKey } from '../domain/decks'
import { useFlashStore } from '../hooks/useFlashStore'
import { useLocale } from '../lib/i18n'
import { secondaryBtn } from '../lib/styles'

interface Props {
  onBack: () => void
  toast: (message: string) => void
}

export function DeckStoreScreen({ onBack, toast }: Props) {
  const { t } = useLocale()
  const { addDeck, getDecks } = useFlashStore()
  const deckKeys = new Set(getDecks().map(deckKey))

  return (
    <div className="deck-store-screen">
      <header className="page-heading">
        <h1>{t('catalog.title')}</h1>
        <button onClick={onBack} style={secondaryBtn}>{t('nav.back')}</button>
      </header>

      <p className="deck-store-lead">{t('catalog.lead')}</p>

      <div className="deck-store-grid">
        {ENGLISH_DECK_CATALOG.map(deck => {
          const added = deckKeys.has(deckKey(deck.name))
          return (
            <article key={deck.id} className="deck-store-card">
              <div className="deck-store-card-header">
                <span className="deck-store-language">ENGLISH</span>
                <span className="deck-store-level">{deck.level}</span>
              </div>
              <h2>{deck.name.replace('English: ', '')}</h2>
              <p>{t(deck.descriptionKey)}</p>
              <button
                type="button"
                className="deck-store-add"
                disabled={added}
                onClick={() => {
                  addDeck(deck.name)
                  toast(`${deck.name} ${t('catalog.added').toLowerCase()}`)
                }}
              >
                {added && <CheckIcon style={{ fontSize: 15 }} />}
                {added ? t('catalog.added') : t('catalog.add')}
              </button>
            </article>
          )
        })}
      </div>
    </div>
  )
}
