import type { FlashCard, DeckConfig } from '../types'
import { scheduleReview } from './scheduling'

const DEFAULT_STEPS = [1, 3]
const DEFAULT_MAX_INTERVAL = 365
const MIN_EASE = 1.3
const MAX_EASE = 3.0

export function updateSRS(card: FlashCard, grade: 1 | 2 | 3 | 4, deckConfig?: DeckConfig): FlashCard {
  let { interval, ease, reps, lapses } = card

  const steps = deckConfig?.steps?.length ? deckConfig.steps : DEFAULT_STEPS
  const maxInterval = deckConfig?.maxInterval ?? DEFAULT_MAX_INTERVAL

  if (grade === 1) {
    interval = 0
    reps = 0
    lapses += 1
    ease = Math.max(MIN_EASE, ease - 0.2)
  } else if (grade === 2) {
    ease = Math.max(MIN_EASE, ease - 0.15)
    if (reps === 0) {
      interval = 1
      reps = 1
    } else {
      interval = Math.max(1, Math.round(interval * 1.2))
      reps += 1
    }
  } else {
    reps += 1
    const stepIdx = reps - 1
    if (stepIdx < steps.length) {
      interval = steps[stepIdx]
    } else {
      interval = Math.round(interval * ease)
    }
    if (grade === 4) {
      interval = Math.round(interval * 1.3)
      ease = Math.min(MAX_EASE, ease + 0.15)
    }
  }

  interval = Math.min(interval, maxInterval)
  const nextReview = scheduleReview(interval)

  const leechThreshold = deckConfig?.leechThreshold ?? 8
  const suspended = lapses >= leechThreshold && deckConfig?.leechAction === 'suspend'

  return { ...card, interval, ease, reps, lapses, nextReview, suspended }
}

export function isLeech(card: FlashCard, deckConfig?: DeckConfig): boolean {
  const threshold = deckConfig?.leechThreshold ?? 8
  return card.lapses >= threshold
}

export function parseMarkdown(text: string): string {
  if (!text) return ''
  let safe = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
  safe = safe.replace(/```(?:[a-zA-Z0-9]+)?\n([\s\S]+?)\n```/g, '<pre><code>$1</code></pre>')
  safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>')
  safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  safe = safe.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  safe = safe.replace(/\n/g, '<br>')
  return safe
}

export function generateId(): string {
  return `card-${crypto.randomUUID()}`
}
