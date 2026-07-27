import assert from 'node:assert/strict'
import test from 'node:test'
import { updateSRS } from '../../src/lib/srs.js'
import { addReviewInterval, calendarDayOffset, scheduleReview } from '../../src/lib/scheduling.js'
import type { FlashCard } from '../../src/types/index.js'

const reviewedAt = new Date(2026, 6, 19, 18, 30).getTime()

function card(): FlashCard {
  return {
    id: 'card-1', deck: 'Deck', question: 'Q', answer: 'A', interval: 1,
    ease: 2.5, reps: 0, lapses: 0, nextReview: reviewedAt, pinned: false, suspended: false,
  }
}

test('review intervals preserve time-of-day and cannot collapse near midnight', () => {
  assert.equal(scheduleReview(1, reviewedAt), addReviewInterval(reviewedAt, 1))
  assert.equal(scheduleReview(3, reviewedAt), addReviewInterval(reviewedAt, 3))
  assert.equal(scheduleReview(0, reviewedAt), reviewedAt)
  assert.equal(new Date(scheduleReview(1, reviewedAt)).getHours(), new Date(reviewedAt).getHours())
})

test('calendar-day offsets do not depend on the time of review', () => {
  assert.equal(calendarDayOffset(scheduleReview(1, reviewedAt), reviewedAt), 1)
  assert.equal(calendarDayOffset(scheduleReview(3, reviewedAt), reviewedAt), 3)
})

test('SRS schedules a successful first review for tomorrow', () => {
  const originalNow = Date.now
  Date.now = () => reviewedAt
  try {
    const updated = updateSRS(card(), 3)
    assert.equal(updated.interval, 1)
    assert.equal(updated.ease, 2.5)
    assert.equal(updated.nextReview, addReviewInterval(reviewedAt, 1))
  } finally {
    Date.now = originalNow
  }
})

test('SRS keeps ease stable for Good and changes it only for difficult/easy answers', () => {
  const originalNow = Date.now
  Date.now = () => reviewedAt
  try {
    const established = { ...card(), reps: 2, interval: 3 }
    assert.equal(updateSRS(established, 2).ease, 2.35)
    assert.equal(updateSRS(established, 3).ease, 2.5)
    assert.equal(updateSRS(established, 4).ease, 2.65)
  } finally {
    Date.now = originalNow
  }
})
