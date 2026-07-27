import { useState } from 'react'
import { useFlashStore } from '../hooks/useFlashStore'
import { useLocale } from '../lib/i18n'
import { calendarDayOffset } from '../lib/scheduling'
import { ProgressBar } from '../components/ProgressBar'
import { secondaryBtn } from '../lib/styles'

interface Props {
  onBack: () => void
}

interface ForecastTooltipState {
  day: number
  x: number
  y: number
}

export function StatsScreen({ onBack }: Props) {
  const { t } = useLocale()
  const { cards, getDecks, getDeckCards, getDueCards } = useFlashStore()
  const [forecastTooltip, setForecastTooltip] = useState<ForecastTooltipState | null>(null)

  const now = Date.now()
  const totalCards = cards.length
  const dueCards = getDueCards().length
  const learned = cards.filter(card => card.reps > 0).length

  const avgEase = totalCards > 0
    ? cards.reduce((acc, c) => acc + (c.ease || 2.5), 0) / totalCards
    : 0

  const forecast: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  const forecastByDeck: Record<number, Map<string, number>> = {
    0: new Map(), 1: new Map(), 2: new Map(), 3: new Map(), 4: new Map(), 5: new Map(), 6: new Map(),
  }
  cards.forEach(c => {
    if (c.nextReview) {
      const diffDays = c.nextReview <= now ? 0 : calendarDayOffset(c.nextReview, now)
      if (diffDays >= 0 && diffDays <= 6) {
        forecast[diffDays]++
        forecastByDeck[diffDays].set(c.deck, (forecastByDeck[diffDays].get(c.deck) || 0) + 1)
      }
    } else {
      forecast[0]++
      forecastByDeck[0].set(c.deck, (forecastByDeck[0].get(c.deck) || 0) + 1)
    }
  })

  const maxVal = Math.max(...Object.values(forecast), 1)
  const today = new Date()

  const decks = getDecks()

  return (
    <div className="stats-screen">
      <header className="page-heading">
        <h1>{t('stats.title')}</h1>
        <button onClick={onBack} style={secondaryBtn}>{t('nav.back')}</button>
      </header>

      <section className="settings-section stats-section">
        <div className="settings-section-heading"><span>{t('status.title')}</span></div>
        <div className="stats-section-body stats-summary-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 4 }}>
          {[
            { label: t('stats.cardsPerDeck'), value: totalCards },
            { label: t('stats.learned'), value: learned },
            { label: t('status.due'), value: dueCards, accent: true },
          ].map(item => (
            <div key={item.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 500, color: item.accent ? 'var(--accent)' : 'var(--text)' }}>
                {item.value}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>
        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {t('summary.ratings')}: <span style={{ color: 'var(--text)' }}>{avgEase.toFixed(2)}</span>
        </div>
        </div>
      </section>

      <section className="settings-section stats-section">
        <div className="settings-section-heading"><span>{t('stats.dueForecast')}</span></div>
        <div className="stats-section-body stats-forecast-body">
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(7, 1fr)`,
          gap: 6,
          alignItems: 'end',
        }}>
          {[0, 1, 2, 3, 4, 5, 6].map(i => {
            const count = forecast[i]
            const pct = maxVal > 0 ? (count / maxVal) * 100 : 0
            const date = new Date(today)
            date.setDate(date.getDate() + i)

            const dayLabels = [t('stats.dayMon'), t('stats.dayTue'), t('stats.dayWed'), t('stats.dayThu'), t('stats.dayFri'), t('stats.daySat'), t('stats.daySun')]
            const periodLabels: Record<number, string> = {
              0: t('stats.today'),
              1: t('stats.tomorrow'),
              2: t('stats.afterTomorrow'),
            }

            return (
              <div key={i} className="forecast-day" tabIndex={0}
                onMouseEnter={event => {
                  const rect = event.currentTarget.getBoundingClientRect()
                  setForecastTooltip({ day: i, x: Math.min(window.innerWidth - 124, Math.max(124, rect.left + rect.width / 2)), y: rect.top })
                }}
                onMouseLeave={() => setForecastTooltip(null)}
                onFocus={event => {
                  const rect = event.currentTarget.getBoundingClientRect()
                  setForecastTooltip({ day: i, x: Math.min(window.innerWidth - 124, Math.max(124, rect.left + rect.width / 2)), y: rect.top })
                }}
                onBlur={() => setForecastTooltip(null)}
                aria-label={`${periodLabels[i] || `+${i}`}: ${count}`}
              >
                <div style={{
                  fontSize: 18, fontWeight: 600, color: i === 0 ? 'var(--accent)' : 'var(--text)',
                  transition: 'color 0.3s',
                }}>
                  {count}
                </div>
                <div style={{
                  width: '100%', height: 80,
                  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                }}>
                  <div style={{
                    width: '100%', maxWidth: 36,
                    height: `${Math.max(pct, 4)}%`,
                    background: i === 0
                      ? 'linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 60%, transparent))'
                      : 'var(--text-muted)',
                    borderRadius: '3px 3px 0 0',
                    transition: 'height 0.6s ease, background 0.3s',
                    opacity: 0.8,
                    minHeight: 4,
                  }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
                  <div>{dayLabels[date.getDay() === 0 ? 6 : date.getDay() - 1]}</div>
                  <div style={{ fontSize: 9, opacity: 0.6 }}>{date.getDate()}.{date.getMonth() + 1}</div>
                </div>
                <div style={{ fontSize: 9, color: i === 0 ? 'var(--accent)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                  {periodLabels[i] || `+${i}`}
                </div>
              </div>
            )
          })}
        </div>
        {forecastTooltip && (() => {
          const periodLabel = { 0: t('stats.today'), 1: t('stats.tomorrow'), 2: t('stats.afterTomorrow') }[forecastTooltip.day] || `+${forecastTooltip.day}`
          const breakdown = [...forecastByDeck[forecastTooltip.day].entries()].sort(([, left], [, right]) => right - left)
          return (
            <div className="forecast-tooltip" style={{ left: forecastTooltip.x, top: forecastTooltip.y }} role="status">
              <div className="forecast-tooltip-title"><span>{periodLabel}</span><strong>{forecast[forecastTooltip.day]}</strong></div>
              {breakdown.length === 0 ? <span className="forecast-tooltip-empty">{t('deck.noCards')}</span> : breakdown.map(([deck, count]) => (
                <div className="forecast-tooltip-row" key={deck}><span>{deck}</span><strong>{count}</strong></div>
              ))}
            </div>
          )
        })()}
        </div>
      </section>

      <section className="settings-section stats-section">
        <div className="settings-section-heading"><span>{t('stats.perDeck')}</span></div>
        <div className="stats-section-body stats-decks-body">
        {decks.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t('deck.noCards')}</div>
        ) : decks.map(name => {
          const deckCards = getDeckCards(name)
          const deckDue = getDueCards(name).length
          const deckLearned = deckCards.length - deckDue
          const pct = deckCards.length > 0 ? (deckLearned / deckCards.length) * 100 : 0
          return (
            <div key={name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: 'var(--text)' }}>{name}</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {deckLearned}/{deckCards.length}
                  {deckDue > 0 && <span style={{ color: 'var(--accent)', marginLeft: 4 }}>(+{deckDue})</span>}
                </span>
              </div>
              <ProgressBar value={pct} glow="0 0 6px color-mix(in srgb, var(--accent) 25%, transparent)" />
            </div>
          )
        })}
        </div>
      </section>
    </div>
  )
}
