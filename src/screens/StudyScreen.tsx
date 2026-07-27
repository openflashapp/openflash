import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useFlashStore } from '../hooks/useFlashStore'
import { useLocale } from '../lib/i18n'
import { updateSRS, isLeech, parseMarkdown } from '../lib/srs'
import type { FlashCard, SessionStats } from '../types'
import { ChevronLeftIcon, ChevronRightIcon, RefreshIcon, BoltIcon, CheckIcon, StarIcon, CloseIcon, ShuffleIcon } from '../components/Icons'
import { ProgressBar } from '../components/ProgressBar'
import { secureRandomIndex } from '../lib/random'
import { resolveDeckColor } from '../config/deckAppearance'

const GRADE_COLORS = ['', 'var(--accent-red)', '#f59e0b', '#22c55e', 'var(--accent-blue)']

interface Props {
  deckName: string
  onFinish: (stats: SessionStats) => void
  onStop: () => void
}

export function StudyScreen({ deckName, onFinish, onStop }: Props) {
  const { t } = useLocale()
  const { getDeckCards, getDueCards, updateCard, settings, getDeckConfig } = useFlashStore()
  const [queue, setQueue] = useState<FlashCard[]>([])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [cardRatings, setCardRatings] = useState<Record<string, 1 | 2 | 3 | 4>>({})
  const [animatingGrade, setAnimatingGrade] = useState<1 | 2 | 3 | 4 | null>(null)
  const statsRef = useRef<SessionStats>({
    startTime: Date.now(), endTime: 0, cardCount: 0,
    ratings: { 1: 0, 2: 0, 3: 0, 4: 0 },
  })

  useEffect(() => {
    const deckCards = getDeckCards(deckName).filter(card => !card.suspended)
    const dueCards = getDueCards(deckName)
    const q = dueCards.length > 0 ? dueCards : [...deckCards]
    q.sort((a, b) => (a.nextReview || 0) - (b.nextReview || 0))
    setQueue(q)
    setIndex(0)
    setRevealed(false)
    setCardRatings({})
    statsRef.current = { startTime: Date.now(), endTime: 0, cardCount: 0, ratings: { 1: 0, 2: 0, 3: 0, 4: 0 } }
  }, [deckName])

  const currentCard = queue[index]
  const currentGrade = currentCard ? cardRatings[currentCard.id] : undefined
  const isLastCard = index === queue.length - 1
  const isFirstCard = index === 0
  const cardsAhead = queue.length - index - 1
  const cardDeckConfig = getDeckConfig(deckName)
  const interfaceColor = cardDeckConfig?.colorizeInterface ? resolveDeckColor(cardDeckConfig) : undefined

  const goRandom = useCallback(() => {
    const ahead = queue.length - index - 1
    if (ahead < 1) return
    const current = queue[index]
    const rest = queue.slice(index + 1)
    for (let i = rest.length - 1; i > 0; i--) {
      const swapIndex = secureRandomIndex(i + 1)
      const currentValue = rest[i]
      rest[i] = rest[swapIndex]
      rest[swapIndex] = currentValue
    }
    setQueue([...queue.slice(0, index), ...rest, current])
    setRevealed(false)
  }, [queue, index])

  const handleReveal = useCallback(() => setRevealed(true), [])

  const unrateCard = useCallback(() => {
    if (!currentCard) return
    const grade = cardRatings[currentCard.id]
    if (!grade) return
    // The queued card is the exact pre-rating snapshot. Restoring it makes
    // "undo" a real undo instead of erasing the card's entire SRS history.
    updateCard(currentCard.id, currentCard)
    setCardRatings(prev => {
      const next = { ...prev }
      delete next[currentCard.id]
      return next
    })
    statsRef.current.ratings[grade]--
    statsRef.current.cardCount--
  }, [currentCard, cardRatings, updateCard])

  const queueRef = useRef(queue)
  queueRef.current = queue
  const indexRef = useRef(index)
  indexRef.current = index

  const goNext = useCallback(() => {
    const isLast = indexRef.current === queueRef.current.length - 1
    if (isLast) {
      statsRef.current.endTime = Date.now()
      onFinish(statsRef.current)
      return
    }
    setIndex(i => i + 1)
    setRevealed(false)
  }, [onFinish])

  const goPrev = useCallback(() => {
    const isFirst = indexRef.current === 0
    if (isFirst) return
    setIndex(i => i - 1)
    setRevealed(false)
  }, [])

  const goNextRef = useRef(goNext)
  goNextRef.current = goNext

  const handleRating = useCallback((grade: 1 | 2 | 3 | 4) => {
    if (!currentCard) return

    const oldGrade = cardRatings[currentCard.id]
    setAnimatingGrade(grade)
    setTimeout(() => setAnimatingGrade(null), 400)

    if (oldGrade === grade && grade !== 1) return

    const updated = updateSRS(currentCard, grade, getDeckConfig(deckName))
    updateCard(currentCard.id, updated)

    if (grade === 1) {
      const nextQueue = [...queueRef.current, updated]
      queueRef.current = nextQueue
      setQueue(nextQueue)
    }

    setCardRatings(prev => ({ ...prev, [currentCard.id]: grade }))

    if (oldGrade) {
      statsRef.current.ratings[oldGrade]--
    } else {
      statsRef.current.cardCount++
    }
    statsRef.current.ratings[grade]++

    goNextRef.current()
  }, [currentCard, cardRatings, updateCard, deckName])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        if (!revealed) setRevealed(true)
      }
      if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        handleRating(parseInt(e.key) as 1 | 2 | 3 | 4)
      }
      if (e.code === 'ArrowRight' || e.code === 'ArrowDown') {
        e.preventDefault()
        goNext()
      }
      if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
        e.preventDefault()
        goPrev()
      }
      if (settings.vimMode) {
        if (e.key === 'j') { e.preventDefault(); goNext(); return }
        if (e.key === 'k') { e.preventDefault(); goPrev(); return }
        if (e.key === 'u') { e.preventDefault(); unrateCard(); return }
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        goRandom()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [revealed, handleRating, goNext, goPrev, goRandom, unrateCard, settings.vimMode])

  const progressPct = queue.length > 0 ? Math.round(((index + 1) / queue.length) * 100) : 0

  if (!currentCard) {
    return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>{t('deck.noCards')}</div>
  }

  return (
    <div className={interfaceColor ? 'deck-interface-theme' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 24, ...(interfaceColor ? { '--deck-interface-color': interfaceColor } : {}) } as React.CSSProperties}>
      <div style={{
        border: '1px solid var(--border)', background: 'var(--surface)',
        padding: '36px 32px', display: 'flex', flexDirection: 'column', gap: 28, borderRadius: 3,
      }}>
        <div style={{
          fontSize: 12, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)',
          paddingBottom: 16, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{t('deck.title')}: {deckName}</span>
            <span>{t('deck.cards')} {index + 1} / {queue.length}</span>
          </div>
          <ProgressBar value={progressPct} transition="width 0.4s ease" />
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', gap: 24, minHeight: 260,
          justifyContent: 'center',
        }}>
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={goPrev} disabled={isFirstCard} title={t('nav.back')} style={{
                  ...iconNavBtn, visibility: isFirstCard ? 'hidden' : 'visible',
                }}>
                  <ChevronLeftIcon style={{ fontSize: 22 }} />
                </button>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                    {t('study.question')}
                  </span>
                  {currentCard && isLeech(currentCard, cardDeckConfig) && (
                    <span style={{
                      marginLeft: 8, fontSize: 9, color: 'var(--accent-red)', border: '1px solid var(--accent-red)',
                      padding: '1px 6px', borderRadius: 3, textTransform: 'uppercase', verticalAlign: 'middle', letterSpacing: 0.5,
                    }}>{t('study.leech')}</span>
                  )}
                  <div style={{ fontSize: 28, fontWeight: 400, minHeight: 50, lineHeight: 1.5, marginTop: 12 }}
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(currentCard.question) }} />
                  {currentCard.transcription && currentCard.transcriptionPlacement !== 'answer' && (
                    <div style={{ fontSize: 15, color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>
                      [{currentCard.transcription}]
                    </div>
                  )}
                </div>
                <button onClick={goNext} title={isLastCard ? t('study.finished') : t('study.stop')} style={{
                  ...iconNavBtn,
                  borderColor: isLastCard ? 'var(--accent)' : 'var(--border-color)',
                  color: isLastCard ? 'var(--accent)' : 'var(--text-muted)',
                }}>
                  <ChevronRightIcon style={{ fontSize: 22 }} />
                </button>
              </div>
            </div>

          {!revealed ? (
            <button onClick={handleReveal} style={{
              background: 'transparent', border: '1px solid var(--accent)',
              color: 'var(--accent)', padding: '14px 40px', fontSize: 13,
              cursor: 'pointer', borderRadius: 3, textTransform: 'uppercase',
              fontWeight: 500, letterSpacing: 1,
              transition: 'all var(--speed)',
            }}
              onMouseEnter={e => { if (settings.glowEffect) e.currentTarget.style.boxShadow = '0 0 25px color-mix(in srgb, var(--accent) 25%, transparent)' }}
              onMouseLeave={e => { if (settings.glowEffect) e.currentTarget.style.boxShadow = 'none' }}>
              {t('study.reveal')}
            </button>
          ) : (
            <div style={{
              textAlign: 'center', animation: 'fadeIn 0.12s ease-out', width: '100%',
            }}>
              <div style={{ height: '1px', background: 'var(--border)', margin: '0 0 24px' }} />
              <span style={{ fontSize: 12, color: 'var(--accent-green)', textTransform: 'uppercase', letterSpacing: 1 }}>
                {t('study.answer')}
              </span>
              <div style={{ fontSize: 28, fontWeight: 400, minHeight: 50, lineHeight: 1.5, marginTop: 12 }}
                dangerouslySetInnerHTML={{ __html: parseMarkdown(currentCard.answer) }} />
              {currentCard.transcription && currentCard.transcriptionPlacement === 'answer' && (
                <div style={{ fontSize: 15, color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>
                  [{currentCard.transcription}]
                </div>
              )}

              <div style={{ marginTop: 32 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {([1, 2, 3, 4] as const).map(grade => {
                    const isSelected = currentGrade === grade
                    const isAnimating = animatingGrade === grade
                    const labels = ['', t('study.again'), t('study.hard'), t('study.good'), t('study.easy')]
                    const gradeIcons = [null, <RefreshIcon style={{ fontSize: 13 }} />, <BoltIcon style={{ fontSize: 13 }} />, <CheckIcon style={{ fontSize: 13 }} />, <StarIcon style={{ fontSize: 13 }} />]
                    return (
                      <button
                        key={grade}
                        onClick={() => handleRating(grade)}
                        onMouseEnter={e => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = GRADE_COLORS[grade]
                            if (settings.glowEffect) e.currentTarget.style.boxShadow = `0 0 20px color-mix(in srgb, ${GRADE_COLORS[grade]} 20%, transparent)`
                          }
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = ''
                          if (settings.glowEffect) e.currentTarget.style.boxShadow = ''
                        }}
                        style={{
                          background: isSelected ? GRADE_COLORS[grade] + '15' : 'transparent',
                          border: `1px solid ${isSelected || isAnimating ? GRADE_COLORS[grade] : 'var(--border-color)'}`,
                          color: GRADE_COLORS[grade],
                          padding: '12px 6px', fontFamily: 'var(--font-mono)', fontSize: 11,
                          cursor: 'pointer', borderRadius: 3, textTransform: 'uppercase',
                          transition: 'all var(--speed)',
                          boxShadow: isAnimating ? `0 0 30px color-mix(in srgb, ${GRADE_COLORS[grade]} 35%, transparent)` : 'none',
                          transform: isAnimating ? 'scale(1.05)' : isSelected ? 'scale(1.02)' : 'scale(1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        {gradeIcons[grade]} {labels[grade]}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <button onClick={onStop} style={{
          ...secondaryBtnStyle, borderColor: 'var(--red)', color: 'var(--red)',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <CloseIcon style={{ fontSize: 13 }} />{t('study.stop')}
        </button>
        <button onClick={goRandom} disabled={cardsAhead < 1} style={{ ...navBtnStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ShuffleIcon style={{ fontSize: 13 }} />{t('study.random')}
        </button>
      </div>

      <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.3px' }}>
        {settings.vimMode ? t('study.kbHint') + ' | j/k — nav · u — undo' : t('study.kbHint')}
      </div>
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)',
  height: 38, padding: '0 18px', fontFamily: 'var(--font-mono)', fontSize: 12,
  cursor: 'pointer', borderRadius: 3, fontWeight: 500, textTransform: 'uppercase',
  transition: 'all var(--speed)',
}

const secondaryBtnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)',
  height: 38, padding: '0 18px', fontFamily: 'var(--font-mono)', fontSize: 12,
  cursor: 'pointer', borderRadius: 3, fontWeight: 500, textTransform: 'uppercase',
  transition: 'all var(--speed)',
}

const iconNavBtn: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border-color)',
  color: 'var(--text-muted)', width: 40, height: 40, fontSize: 14,
  cursor: 'pointer', borderRadius: 3, flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all var(--speed)',
}
