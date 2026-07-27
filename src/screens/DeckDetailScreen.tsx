import { useState, useMemo, useRef, useEffect } from 'react'
import { useFlashStore } from '../hooks/useFlashStore'
import { useLocale } from '../lib/i18n'
import { calendarDayOffset } from '../lib/scheduling'
import type { FlashCard } from '../types'
import { Modal } from '../components/Modal'
import { ContextMenu } from '../components/ContextMenu'
import { primaryBtn, secondaryBtn, dangerBtn, iconBtn, inputField } from '../lib/styles'
import { ToggleSwitch } from '../components/ToggleSwitch'
import { ChoiceOption } from '../components/ChoiceOption'
import { ProgressBar } from '../components/ProgressBar'
import { parseMarkdown, isLeech } from '../lib/srs'
import { exportDeckCSV } from '../lib/export'
import { EditIcon, RefreshIcon, DeleteIcon, PinIcon, TransferIcon, GearIcon } from '../components/Icons'
import { DeckSettingsModal } from '../components/DeckSettingsModal'
import { DeckAppearance } from '../components/DeckAppearance'
import { DeckAppearancePicker } from '../components/DeckAppearancePicker'
import { resolveDeckColor } from '../config/deckAppearance'

interface Props {
  deckName: string
  onBack: () => void
  onStartStudy: () => void
  onRename?: (oldName: string, newName: string) => void
  toast: (msg: string, err?: boolean) => void
}

interface ForecastTooltipState {
  day: number
  x: number
  y: number
}

export function DeckDetailScreen({ deckName, onBack, onStartStudy, onRename, toast }: Props) {
  const { t } = useLocale()
  const { getDeckCards, getDueCards, deleteCard, togglePinCard, updateCard, addCard, deleteDeck, renameDeck, resetDeckProgress, deckConfigs, settings } = useFlashStore()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [q, setQ] = useState('')
  const [a, setA] = useState('')
  const [tR, setTR] = useState('')
  const [showTR, setShowTR] = useState(false)
  const [showEditTR, setShowEditTR] = useState(false)
  const [trPlacement, setTrPlacement] = useState<'question' | 'answer'>('question')
  const [cardError, setCardError] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [editCard, setEditCard] = useState<{ id: string; q: string; a: string; t: string; p: 'question' | 'answer' } | null>(null)
  const [newName, setNewName] = useState(deckName)
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set())
  const [selectCardsMode, setSelectCardsMode] = useState(false)
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null)
  const [deleteSelectedOpen, setDeleteSelectedOpen] = useState(false)
  const [deckSettingsOpen, setDeckSettingsOpen] = useState(false)
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const [forecastTooltip, setForecastTooltip] = useState<ForecastTooltipState | null>(null)
  const [focusIdx, setFocusIdx] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; target?: string } | null>(null)

  const deckCards = getDeckCards(deckName)
  const now = Date.now()
  const dueCount = getDueCards(deckName).length
  const deckConfig = deckConfigs[deckName]
  const interfaceColor = deckConfig?.colorizeInterface ? resolveDeckColor(deckConfig) : undefined
  const forecastDay = (card: FlashCard): number | null => {
    if (card.suspended) return null
    if (!card.nextReview || card.nextReview <= now) return 0
    const day = calendarDayOffset(card.nextReview, now)
    return day >= 0 && day <= 6 ? day : null
  }
  const forecast = Array.from({ length: 7 }, (_, day) => ({ day, count: 0 }))
  for (const card of deckCards) {
    const day = forecastDay(card)
    if (day !== null) forecast[day].count += 1
  }
  const maxForecast = Math.max(...forecast.map(item => item.count), 1)
  const highlightedCardIds = forecastTooltip
    ? new Set(deckCards.filter(card => forecastDay(card) === forecastTooltip.day).map(card => card.id))
    : null

  const sorted = useMemo(() => {
    return [...deckCards].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return a.question.localeCompare(b.question)
    })
  }, [deckCards])

  const searchLower = search.toLowerCase().trim()
  const rawFiltered = !searchLower ? sorted : sorted.filter(c =>
    c.question.toLowerCase().includes(searchLower) ||
    c.answer.toLowerCase().includes(searchLower) ||
    (c.transcription && c.transcription.toLowerCase().includes(searchLower)) ||
    searchLower.split(/\s+/).every(word =>
      c.question.toLowerCase().includes(word) || c.answer.toLowerCase().includes(word)
    )
  )
  const filtered = searchLower
    ? [...rawFiltered].sort((a, b) => {
        const qA = a.question.toLowerCase()
        const qB = b.question.toLowerCase()
        const aStarts = qA.startsWith(searchLower) ? 0 : qA.includes(searchLower) ? 1 : 2
        const bStarts = qB.startsWith(searchLower) ? 0 : qB.includes(searchLower) ? 1 : 2
        return aStarts - bStarts
      })
    : rawFiltered

  const studyDisabled = deckCards.length === 0
  const studyAllDone = !studyDisabled && dueCount === 0

  useEffect(() => {
    if (!settings.vimMode) return
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const list = filtered
      if (e.key === 'j') { e.preventDefault(); setFocusIdx(i => Math.min(i + 1, list.length - 1)) }
      else if (e.key === 'k') { e.preventDefault(); setFocusIdx(i => Math.max(i - 1, 0)) }
      else if (e.key === 'Enter' && list[focusIdx]) { e.preventDefault(); setEditCard({ id: list[focusIdx].id, q: list[focusIdx].question, a: list[focusIdx].answer, t: list[focusIdx].transcription || '', p: list[focusIdx].transcriptionPlacement || 'question' }); setShowEditTR(!!list[focusIdx].transcription) }
      else if (e.key === 'n') { e.preventDefault(); setCreateOpen(true) }
      else if (e.key === '/') { e.preventDefault(); searchInputRef.current?.focus() }
      else if (e.key === 'v') { e.preventDefault(); if (selectCardsMode) { setSelectedCards(new Set()); setSelectCardsMode(false) } else { setSelectCardsMode(true); setSelectedCards(new Set()) } }
      else if (e.key === 'd' && selectCardsMode && selectedCards.size > 0) { e.preventDefault(); setDeleteSelectedOpen(true) }
      else if (e.key === 'Escape') { e.preventDefault(); if (selectCardsMode) { setSelectedCards(new Set()); setSelectCardsMode(false) } else onBack() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [settings.vimMode, filtered, focusIdx, selectCardsMode, selectedCards, onBack])



  const handleAddCard = () => {
    if (!q.trim() || !a.trim()) {
      setCardError(t('errors.emptyFields'))
      return false
    }
    if (showTR && !tR.trim()) {
      setCardError(`${t('createCard.transcription')}: ${t('errors.emptyFields')}`)
      return false
    }
    setCardError('')
    addCard(deckName, q.trim(), a.trim(), showTR ? tR.trim() || undefined : undefined, showTR ? trPlacement : undefined)
    setQ('')
    setA('')
    setTR('')
    setShowTR(false)
    setCreateOpen(false)
    toast(t('createCard.add'))
  }

  const handleDeleteDeck = () => {
    deleteDeck(deckName)
    setDeleteConfirmOpen(false)
    toast(t('deck.deleteDeck'))
    onBack()
  }

  const handleRename = () => {
    if (!newName.trim()) {
      toast(t('errors.emptyName'), true)
      return
    }
    if (newName.trim() === deckName) {
      setRenameOpen(false)
      return
    }
    renameDeck(deckName, newName.trim())
    setRenameOpen(false)
    onRename?.(deckName, newName.trim())
    toast(t('deck.rename') + ': ' + newName.trim())
  }

  const handleResetProgress = () => {
    resetDeckProgress(deckName)
    setResetConfirmOpen(false)
    toast(t('deck.resetProgress'))
  }

  const handleExportDeck = () => {
    exportDeckCSV(deckName, getDeckCards(deckName), name => toast(`${t('deck.export')}: ${name}`))
  }

  const handleEditCard = () => {
    if (!editCard) return
    if (!editCard.q.trim() || !editCard.a.trim()) {
      setCardError(t('errors.emptyFields'))
      return false
    }
    if (showEditTR && !editCard.t.trim()) {
      setCardError(`${t('createCard.transcription')}: ${t('errors.emptyFields')}`)
      return false
    }
    setCardError('')
    const trimmedT = showEditTR ? editCard.t.trim() : ''
    updateCard(editCard.id, {
      question: editCard.q.trim(),
      answer: editCard.a.trim(),
      transcription: trimmedT || undefined,
      transcriptionPlacement: trimmedT ? editCard.p : undefined,
    })
    setEditCard(null)
    toast(t('editCard.save'))
  }

  if (!deckName) return null

  return (
    <div className={interfaceColor ? 'deck-interface-theme' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 24, ...(interfaceColor ? { '--deck-interface-color': interfaceColor } : {}) } as React.CSSProperties} onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
            {t('deck.title')}:
          </span>
          <button onClick={() => setAppearanceOpen(true)} style={{ ...iconBtn, width: 30, height: 30, padding: 0 }} title={t('deckSettings.appearance')}>
            <DeckAppearance config={deckConfigs[deckName]} size={28} />
          </button>
          <span style={{ fontSize: 16, fontWeight: 500 }}>{deckName}</span>
          <button onClick={() => { setNewName(deckName); setRenameOpen(true) }} style={{ ...iconBtn, color: 'var(--text-muted)' }} title={t('deck.rename')}>
            <EditIcon style={{ fontSize: 14 }} />
          </button>
        </div>
        <button onClick={onBack} style={secondaryBtn}>{t('nav.home')}</button>
      </div>

      <div style={{
        border: `1px solid ${interfaceColor ? `color-mix(in srgb, ${interfaceColor} 55%, var(--border-color))` : 'var(--border-color)'}`,
        background: interfaceColor ? `color-mix(in srgb, ${interfaceColor} 8%, var(--surface-color))` : 'var(--surface-color)',
        boxShadow: interfaceColor ? `inset 3px 0 0 ${interfaceColor}` : 'none',
        padding: 24, borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
            {t('stats.title')}
          </span>
          <button
            onClick={onStartStudy}
            disabled={studyDisabled}
            style={{
              ...primaryBtn,
              opacity: studyDisabled ? 0.5 : 1,
              cursor: studyDisabled ? 'not-allowed' : 'pointer',
              fontWeight: 700, padding: '12px 24px',
            }}
          >
            {studyDisabled ? t('deck.noCards') : studyAllDone ? t('deck.reviewAll') : t('deck.study')}
          </button>
        </div>

        {deckCards.length > 0 && (() => {
          const newCards = deckCards.filter(card => card.reps === 0).length
          const dueNow = getDueCards(deckName).length
          const learned = deckCards.filter(card => card.reps > 0).length
          const avgEase = deckCards.reduce((s, c) => s + (c.ease || 2.5), 0) / deckCards.length
          const leeches = deckCards.filter(c => isLeech(c, deckConfigs[deckName])).length
          const learnedPct = Math.round((learned / deckCards.length) * 100)

          return (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {[
                  { label: t('stats.cardsPerDeck'), value: deckCards.length, color: 'var(--text)' },
                  { label: t('card.new'), value: newCards, color: 'var(--accent-blue)' },
                  { label: t('stats.learned'), value: learned, color: 'var(--accent-green)' },
                  { label: t('status.due'), value: dueNow, color: 'var(--accent-red)' },
                  { label: 'Ease', value: avgEase.toFixed(2) + 'x', color: 'var(--text-muted)' },
                  { label: 'Leeches', value: leeches, color: leeches > 0 ? 'var(--accent-red)' : 'var(--text-muted)' },
                ].map(item => (
                  <div key={item.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 500, color: item.color }}>
                      {item.value}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>{t('status.title')}</span>
                  <span>{learnedPct}%</span>
                </div>
                <ProgressBar value={learnedPct} height={6} borderRadius={3} transition="width 0.6s ease" glow="0 0 8px color-mix(in srgb, var(--accent) 25%, transparent)" />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  {t('stats.dueForecast')}
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, alignItems: 'end' }}>
                  {forecast.map(({ day, count }) => {
                    const date = new Date()
                    date.setDate(date.getDate() + day)
                    const periodLabel = day === 0 ? t('stats.today') : day === 1 ? t('stats.tomorrow') : day === 2 ? t('stats.afterTomorrow') : `+${day}`
                    return (
                      <div key={day} className="forecast-day" tabIndex={0}
                        onMouseEnter={event => {
                          const rect = event.currentTarget.getBoundingClientRect()
                          setForecastTooltip({ day, x: Math.min(window.innerWidth - 124, Math.max(124, rect.left + rect.width / 2)), y: rect.top })
                        }}
                        onMouseLeave={() => setForecastTooltip(null)}
                        onFocus={event => {
                          const rect = event.currentTarget.getBoundingClientRect()
                          setForecastTooltip({ day, x: Math.min(window.innerWidth - 124, Math.max(124, rect.left + rect.width / 2)), y: rect.top })
                        }}
                        onBlur={() => setForecastTooltip(null)}
                        aria-label={`${periodLabel}: ${count}`}
                      >
                        <div style={{ fontSize: 16, fontWeight: 600, color: day === 0 ? 'var(--accent)' : 'var(--text)' }}>{count}</div>
                        <div style={{ width: '100%', height: 56, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                          <div style={{ width: '100%', maxWidth: 32, height: `${Math.max((count / maxForecast) * 100, 4)}%`, background: day === 0 ? 'var(--accent)' : 'var(--text-muted)', borderRadius: '3px 3px 0 0', opacity: 0.8, minHeight: 4, transition: 'height 0.4s ease' }} />
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>
                          <div>{[t('stats.dayMon'), t('stats.dayTue'), t('stats.dayWed'), t('stats.dayThu'), t('stats.dayFri'), t('stats.daySat'), t('stats.daySun')][date.getDay() === 0 ? 6 : date.getDay() - 1]}</div>
                          <div style={{ opacity: 0.6 }}>{date.getDate()}.{date.getMonth() + 1}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {forecastTooltip && (
                  <div className="forecast-tooltip" style={{ left: forecastTooltip.x, top: forecastTooltip.y }} role="status">
                    <div className="forecast-tooltip-title"><span>{forecastTooltip.day === 0 ? t('stats.today') : forecastTooltip.day === 1 ? t('stats.tomorrow') : forecastTooltip.day === 2 ? t('stats.afterTomorrow') : `+${forecastTooltip.day}`}</span><strong>{forecast[forecastTooltip.day].count}</strong></div>
                    <div className="forecast-tooltip-empty">{t('stats.cardsPerDeck')}: {highlightedCardIds?.size ?? 0}</div>
                  </div>
                )}
              </div>
            </>
          )
        })()}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div ref={searchRef} style={{ position: 'relative', flex: 1, borderRadius: 3, transition: 'box-shadow var(--speed)' }}>
            <input
              ref={searchInputRef}
              type="text" placeholder={t('deck.search')} value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => { if (searchRef.current) { if (settings.glowEffect) searchRef.current.style.boxShadow = '0 0 20px color-mix(in srgb, var(--accent) 18%, transparent)' } }}
              onBlur={() => { if (searchRef.current) { if (settings.glowEffect) searchRef.current.style.boxShadow = 'none' } }}
              style={{
                background: 'var(--bg-color)', border: '1px solid var(--border-color)',
                color: 'var(--text-main)', padding: '0 12px', fontFamily: 'var(--font-mono)',
                fontSize: 15, width: '100%', height: 38, outline: 'none', borderRadius: 3, boxSizing: 'border-box',
                caretColor: 'var(--accent)',
              }}
            />
          </div>
          {search && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {filtered.length} / {sorted.length}
            </span>
          )}
          {selectCardsMode ? (
            <div style={{ display: 'flex', gap: 6, flexShrink: 0, animation: 'fadeIn 0.12s ease-out' }}>
              <button onClick={() => { setSelectedCards(new Set()); setSelectCardsMode(false) }} style={{ ...secondaryBtn, height: 38, padding: '0 14px', fontSize: 12 }}>{t('deck.cancel')}</button>
              <button onClick={() => setDeleteSelectedOpen(true)} disabled={selectedCards.size === 0} style={{ ...dangerBtn, opacity: selectedCards.size === 0 ? 0.4 : 1 }}>
                {t('deck.delete')} ({selectedCards.size})
              </button>
            </div>
          ) : (
            <button onClick={() => { setSelectCardsMode(true); setSelectedCards(new Set()) }} style={{ ...secondaryBtn, height: 38, padding: '0 14px', fontSize: 12, flexShrink: 0, animation: 'fadeIn 0.12s ease-out' }}>{t('deck.selectCards')}</button>
          )}
          <button onClick={() => setCreateOpen(true)} style={{ ...iconBtn, width: 38, height: 38, flexShrink: 0 }} title={t('deck.createCard')}>
            <span style={{ fontSize: 22, lineHeight: 1, color: 'var(--accent-blue)' }}>+</span>
          </button>
          <button onClick={() => setDeckSettingsOpen(true)} style={{ ...iconBtn, width: 38, height: 38, flexShrink: 0 }} title={t('decks.deckSettings')}>
            <GearIcon style={{ fontSize: 15 }} />
          </button>
          <button onClick={() => setResetConfirmOpen(true)} style={{ ...iconBtn, width: 38, height: 38, flexShrink: 0 }} title={t('deck.resetProgress')}>
            <RefreshIcon style={{ fontSize: 16 }} />
          </button>
          <button onClick={handleExportDeck} style={{ ...iconBtn, width: 38, height: 38, flexShrink: 0 }} title={t('deck.export')}>
            <TransferIcon style={{ fontSize: 14 }} />
          </button>
          <button onClick={() => setDeleteConfirmOpen(true)} style={{ ...iconBtn, width: 38, height: 38, flexShrink: 0, color: 'var(--accent-red)' }} title={t('deck.deleteDeck')}>
            <DeleteIcon style={{ fontSize: 16 }} />
          </button>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(240px, 100%), 1fr))', gap: 12,
        }}>
          {filtered.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32, border: '1px dashed var(--border-color)', gridColumn: '1 / -1', animation: 'fadeIn 0.12s ease-out' }}>
              {t('deck.empty')}
            </div>
          ) : filtered.map((card, idx) => {
            const highlighted = highlightedCardIds?.has(card.id) ?? false
            return (
            <div key={card.id} style={{
              border: `1px solid ${selectedCards.has(card.id) ? 'var(--accent-red)' : settings.vimMode && idx === focusIdx ? 'var(--accent-blue)' : highlighted ? 'var(--accent)' : 'var(--border)'}`,
              background: highlighted ? 'color-mix(in srgb, var(--accent) 9%, var(--surface-color))' : 'var(--surface-color)', borderRadius: 3, padding: 16,
              cursor: selectCardsMode ? 'pointer' : undefined, userSelect: selectCardsMode ? 'none' : undefined,
              display: 'flex', flexDirection: 'column', gap: 8,
              opacity: 1,
              transition: 'border-color var(--speed), box-shadow var(--speed)',
              boxShadow: settings.vimMode && idx === focusIdx ? '0 0 0 1px var(--accent-blue)' : highlighted ? '0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent)' : 'none',
            }}
              onClick={() => { if (selectCardsMode) { const next = new Set(selectedCards); if (next.has(card.id)) next.delete(card.id); else next.add(card.id); setSelectedCards(next) } }}
              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, target: card.id }) }}
              onMouseEnter={e => { if (!settings.vimMode) { e.currentTarget.style.borderColor = 'var(--border-active)'; if (settings.glowEffect) e.currentTarget.style.boxShadow = '0 0 20px color-mix(in srgb, var(--accent) 8%, transparent)' } }}
              onMouseLeave={e => { if (!settings.vimMode) { e.currentTarget.style.borderColor = selectedCards.has(card.id) ? 'var(--accent-red)' : highlighted ? 'var(--accent)' : 'var(--border)'; if (settings.glowEffect) e.currentTarget.style.boxShadow = highlighted ? '0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent)' : 'none' } }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ fontSize: 13, color: 'var(--text)', wordBreak: 'break-word', fontWeight: 500, flex: 1 }}>
                  <div dangerouslySetInnerHTML={{ __html: parseMarkdown(card.question) }} />
                  {isLeech(card, deckConfigs[deckName]) && (
                    <span style={{
                      display: 'inline-block', marginTop: 4, fontSize: 9, color: 'var(--accent-red)',
                      border: '1px solid var(--accent-red)', padding: '1px 6px', borderRadius: 3,
                      textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: '14px',
                    }}>{t('study.leech')}</span>
                  )}
                  {card.transcription && (!card.transcriptionPlacement || card.transcriptionPlacement === 'question') && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 400, fontStyle: 'italic' }}>
                      [{card.transcription}]
                    </div>
                  )}
                </div>
                <span onClick={e => { e.stopPropagation(); togglePinCard(card.id) }} style={{
                  cursor: 'pointer', opacity: 0.7, transition: 'opacity var(--speed), color var(--speed)',
                  flexShrink: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }} title={card.pinned ? t('unpinned') : t('pinned')}
                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
                >
                  <PinIcon style={{ fontSize: 18, color: card.pinned ? 'var(--accent)' : 'var(--text-muted)', fill: card.pinned ? 'var(--accent)' : 'currentColor', opacity: card.pinned ? 1 : 0.5 }} />
                </span>
              </div>
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              <div style={{ fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-word', flex: 1 }}>
                <div dangerouslySetInnerHTML={{ __html: parseMarkdown(card.answer) }} />
                {card.transcription && card.transcriptionPlacement === 'answer' && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 400, fontStyle: 'italic' }}>
                    [{card.transcription}]
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0', flexWrap: 'wrap' }}>
                {(() => {
                  if (card.reps === 0) {
                    return <span style={{ fontSize: 10, color: 'var(--accent)', border: '1px solid var(--accent)', padding: '1px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('card.new')}</span>
                  }
                  const days = card.nextReview <= now ? 0 : calendarDayOffset(card.nextReview, now)
                  if (days <= 0) {
                    return <span style={{ fontSize: 10, color: 'var(--accent-red)', border: '1px solid var(--accent-red)', padding: '1px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('card.due')}</span>
                  }
                  return <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{days === 1 ? t('stats.tomorrow') : `${t('in')} ${days} ${t('days')}`}</span>
                })()}
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{Math.round(card.ease * 100)}%</span>
                {card.lapses > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>⚑ {card.lapses}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={e => { e.stopPropagation(); setEditCard({ id: card.id, q: card.question, a: card.answer, t: card.transcription || '', p: card.transcriptionPlacement || 'question' }); setShowEditTR(!!card.transcription) }} style={iconBtn} title={t('edit')}>
                  <EditIcon style={{ fontSize: 13 }} />
                </button>
                <button onClick={e => { e.stopPropagation(); setDeleteCardId(card.id) }} style={{ ...iconBtn, color: 'var(--accent-red)' }} title={t('modal.delete')}>
                  <DeleteIcon style={{ fontSize: 13 }} />
                </button>
              </div>
            </div>
          )})}
        </div>
      </div>

      <Modal open={createOpen} title={t('createCard.title')} confirmText={t('createCard.add')} onConfirm={handleAddCard}
        onCancel={() => { setCreateOpen(false); setQ(''); setA(''); setTR(''); setShowTR(false); setTrPlacement('question'); setCardError('') }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{t('createCard.question')}</span>
          <div className="input-glow-wrapper">
            <input type="text" placeholder={t('createCard.question') + '...'} autoFocus value={q}
              onChange={e => { setQ(e.target.value); setCardError('') }} style={inputField} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{t('createCard.answer')}</span>
          <div className="input-glow-wrapper">
            <input type="text" placeholder={t('createCard.answer') + '...'} value={a}
              onChange={e => { setA(e.target.value); setCardError('') }}
              onKeyDown={e => e.key === 'Enter' && handleAddCard()}
              style={inputField} />
          </div>
        </div>
        <ToggleSwitch checked={showTR} label="Transcription" onChange={setShowTR} className="form-toggle" />
        {showTR && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{t('createCard.transcription')}</span>
              <div className="input-glow-wrapper">
                <input type="text" placeholder={t('createCard.transcription') + '...'} value={tR}
                  onChange={e => { setTR(e.target.value); setCardError('') }} style={inputField} />
              </div>
            </div>
            <div className="ui-choice-group form-choice-group">
              <ChoiceOption checked={trPlacement === 'question'} label="In question" onChange={() => setTrPlacement('question')} />
              <ChoiceOption checked={trPlacement === 'answer'} label="In answer" onChange={() => setTrPlacement('answer')} />
            </div>
          </>
        )}
        {cardError && <div style={{ color: 'var(--accent-red)', fontSize: 12, marginTop: 8 }}>{cardError}</div>}
      </Modal>

      <Modal open={!!editCard} title={t('editCard.title')} confirmText={t('editCard.save')} onConfirm={handleEditCard}
        onCancel={() => { setEditCard(null); setCardError('') }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{t('createCard.question')}</span>
          <div className="input-glow-wrapper">
            <input type="text" placeholder={t('createCard.question') + '...'} autoFocus value={editCard?.q || ''}
              onChange={e => { setEditCard(prev => prev ? { ...prev, q: e.target.value } : null); setCardError('') }} style={inputField} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{t('createCard.answer')}</span>
          <div className="input-glow-wrapper">
            <input type="text" placeholder={t('createCard.answer') + '...'} value={editCard?.a || ''}
              onChange={e => { setEditCard(prev => prev ? { ...prev, a: e.target.value } : null); setCardError('') }}
              onKeyDown={e => e.key === 'Enter' && handleEditCard()}
              style={inputField} />
          </div>
        </div>
        <ToggleSwitch checked={showEditTR} label="Transcription" onChange={setShowEditTR} className="form-toggle" />
        {showEditTR && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{t('createCard.transcription')}</span>
              <div className="input-glow-wrapper">
                <input type="text" placeholder={t('createCard.transcription') + '...'} value={editCard?.t || ''}
                  onChange={e => setEditCard(prev => prev ? { ...prev, t: e.target.value } : null)} style={inputField} />
              </div>
            </div>
            {editCard && (
              <div className="ui-choice-group form-choice-group">
                <ChoiceOption checked={editCard.p === 'question'} label="In question" onChange={() => setEditCard(prev => prev ? { ...prev, p: 'question' } : null)} />
                <ChoiceOption checked={editCard.p === 'answer'} label="In answer" onChange={() => setEditCard(prev => prev ? { ...prev, p: 'answer' } : null)} />
              </div>
            )}
          </>
        )}
        {cardError && <div style={{ color: 'var(--accent-red)', fontSize: 12, marginTop: 8 }}>{cardError}</div>}
      </Modal>

      <Modal open={resetConfirmOpen} title={t('resetProgress.title')} confirmText={t('modal.ok')} onConfirm={handleResetProgress}
        onCancel={() => setResetConfirmOpen(false)}>
        <p>{t('resetProgress.desc')} <strong>{deckName}</strong></p>
      </Modal>

      <Modal open={renameOpen} title={t('renameDeck.title')} confirmText={t('modal.ok')} onConfirm={handleRename}
        onCancel={() => setRenameOpen(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{t('renameDeck.label')}</span>
          <div className="input-glow-wrapper">
            <input type="text" placeholder={t('renameDeck.label') + '...'} autoFocus value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRename()}
              style={inputField} />
          </div>
        </div>
      </Modal>

      <Modal open={deleteConfirmOpen} title={t('deleteDeck.title')} confirmText={t('modal.delete')} confirmDanger onConfirm={handleDeleteDeck}
        onCancel={() => setDeleteConfirmOpen(false)}>
        <p>{t('deleteDeck.desc')} <strong>{deckName}</strong></p>
      </Modal>

      <Modal open={deleteCardId !== null} title={t('modal.deleteCard')} confirmText={t('modal.delete')} cancelText={t('modal.cancel')} confirmDanger
        onConfirm={() => { if (deleteCardId) { const id = deleteCardId; setDeleteCardId(null); deleteCard(id) } else setDeleteCardId(null) }}
        onCancel={() => setDeleteCardId(null)}>
        <p>{t('modal.deleteCardDesc')}</p>
      </Modal>

      <Modal open={deleteSelectedOpen} title={t('deleteAllCards.title')} confirmText={t('modal.delete')} cancelText={t('modal.cancel')} confirmDanger
        onConfirm={() => { const ids = [...selectedCards]; setSelectedCards(new Set()); setSelectCardsMode(false); setDeleteSelectedOpen(false); ids.forEach(id => deleteCard(id)) }}
        onCancel={() => setDeleteSelectedOpen(false)}>
        <p>{t('modal.deleteCardDesc')} ({selectedCards.size})</p>
      </Modal>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={
            ctxMenu.target
              ? (() => {
                  const card = deckCards.find(c => c.id === ctxMenu.target)
                  if (!card) return []
                  return [
                    { label: t('edit'), onClick: () => { setEditCard({ id: card.id, q: card.question, a: card.answer, t: card.transcription || '', p: card.transcriptionPlacement || 'question' }); setShowEditTR(!!card.transcription) } },
                    { label: card.pinned ? t('unpinned') : t('pinned'), onClick: () => togglePinCard(card.id) },
                    { label: '-', onClick: () => {} },
                    { label: t('deck.selectCards'), onClick: () => { setSelectedCards(new Set([card.id])); setSelectCardsMode(true) } },
                    { label: t('modal.delete'), onClick: () => setDeleteCardId(card.id), danger: true },
                  ]
                })()
              : [
                  { label: t('nav.home'), onClick: () => onBack() },
                  { label: '-', onClick: () => {} },
                  { label: t('deck.createCard'), onClick: () => setCreateOpen(true) },
                  { label: t('deckSettings.title'), onClick: () => setDeckSettingsOpen(true) },
                  { label: t('deck.resetProgress'), onClick: () => setResetConfirmOpen(true) },
                ]
          }
          onClose={() => setCtxMenu(null)}
        />
      )}

      <DeckSettingsModal deckName={deckSettingsOpen ? deckName : null} onClose={() => setDeckSettingsOpen(false)} onSaved={(n) => toast(`${t('deckSettings.saved')}: "${n}"`)} />
      <DeckAppearancePicker deckName={appearanceOpen ? deckName : null} onClose={() => setAppearanceOpen(false)} />
    </div>
  )
}
