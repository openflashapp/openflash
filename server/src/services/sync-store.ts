import type { PoolClient } from 'pg'
import { getDb } from '../db.js'
import type { CardRecord, DeckConfigRecord, FolderRecord, SyncPayload } from '../domain/types.js'
import { parseSyncPayload } from '../lib/validation.js'

export function emptySnapshot(): SyncPayload {
  return {
    cards: [],
    deletedCards: [],
    deckConfigs: {},
    emptyDecks: [],
    folders: [],
    structureUpdatedAt: 0,
  }
}

export function mergeSnapshots(remote: SyncPayload, incoming: SyncPayload): SyncPayload {
  const tombstones = new Map(remote.deletedCards.map(item => [item.id, item.deletedAt]))
  for (const item of incoming.deletedCards) {
    tombstones.set(item.id, Math.max(tombstones.get(item.id) ?? 0, item.deletedAt))
  }

  const cards = new Map(remote.cards.map(card => [card.id, card]))
  for (const card of incoming.cards) {
    const current = cards.get(card.id)
    if (!current || card.updatedAt > current.updatedAt) cards.set(card.id, card)
  }

  for (const [id, deletedAt] of tombstones) {
    const card = cards.get(id)
    if (card && deletedAt >= card.updatedAt) cards.delete(id)
    else if (card && card.updatedAt > deletedAt) tombstones.delete(id)
  }

  const incomingStructureWins = incoming.structureUpdatedAt > remote.structureUpdatedAt
  return {
    cards: [...cards.values()],
    deletedCards: [...tombstones.entries()].map(([id, deletedAt]) => ({ id, deletedAt })),
    deckConfigs: incomingStructureWins ? incoming.deckConfigs : remote.deckConfigs,
    emptyDecks: incomingStructureWins ? incoming.emptyDecks : remote.emptyDecks,
    folders: incomingStructureWins ? incoming.folders : remote.folders,
    structureUpdatedAt: Math.max(remote.structureUpdatedAt, incoming.structureUpdatedAt),
  }
}

export async function mergeUserData(userId: string, incoming: SyncPayload): Promise<SyncPayload> {
  const client = await getDb().connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [userId])
    const { rows } = await client.query<{ data: unknown }>(
      'SELECT data FROM learning_snapshots WHERE user_id = $1 FOR UPDATE', [userId],
    )
    const remote = rows[0] ? parseSyncPayload(rows[0].data) : emptySnapshot()
    const merged = mergeSnapshots(remote, incoming)
    await client.query(`INSERT INTO learning_snapshots (user_id, data, updated_at)
      VALUES ($1, $2::jsonb, $3)
      ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
    [userId, JSON.stringify(merged), snapshotTimestamp(merged)])
    await client.query('COMMIT')
    return merged
  } catch (error) {
    await rollback(client)
    throw error
  } finally {
    client.release()
  }
}

export async function readUserData(userId: string): Promise<SyncPayload> {
  const { rows } = await getDb().query<{ data: unknown }>('SELECT data FROM learning_snapshots WHERE user_id = $1', [userId])
  return rows[0] ? parseSyncPayload(rows[0].data) : emptySnapshot()
}

/** Copies data from the previous relational sync tables once, without deleting them. */
export async function migrateLegacyLearningData(): Promise<void> {
  const db = getDb()
  const { rows: tableRows } = await db.query<{ cards: string | null }>("SELECT to_regclass('public.cards')::text AS cards")
  if (!tableRows[0]?.cards) return

  const { rows: users } = await db.query<{ id: string }>(`
    SELECT users.id FROM users
    LEFT JOIN learning_snapshots ON learning_snapshots.user_id = users.id
    WHERE learning_snapshots.user_id IS NULL
  `)
  for (const user of users) {
    const snapshot = await readLegacySnapshot(user.id)
    await db.query('INSERT INTO learning_snapshots (user_id, data, updated_at) VALUES ($1, $2::jsonb, $3) ON CONFLICT DO NOTHING', [
      user.id, JSON.stringify(snapshot), snapshotTimestamp(snapshot),
    ])
  }
}

async function readLegacySnapshot(userId: string): Promise<SyncPayload> {
  const db = getDb()
  const { rows: cardRows } = await db.query<Record<string, unknown>>(`
    SELECT id, deck, question, answer, transcription,
      transcription_placement AS "transcriptionPlacement", interval, ease, reps, lapses,
      next_review AS "nextReview", pinned, suspended, updated_at AS "updatedAt"
    FROM cards WHERE user_id = $1
  `, [userId])
  const cards: CardRecord[] = cardRows.map(row => ({
    id: String(row.id),
    deck: String(row.deck),
    question: String(row.question),
    answer: String(row.answer),
    transcription: String(row.transcription ?? ''),
    transcriptionPlacement: row.transcriptionPlacement === 'answer' ? 'answer' : 'question',
    interval: Number(row.interval),
    ease: Number(row.ease),
    reps: Number(row.reps),
    lapses: Number(row.lapses),
    nextReview: Number(row.nextReview),
    pinned: Boolean(row.pinned),
    suspended: Boolean(row.suspended),
    updatedAt: Number(row.updatedAt) || 0,
  }))

  const { rows: deletedRows } = await db.query<{ id: string; deletedAt: string }>(`
    SELECT card_id AS id, deleted_at AS "deletedAt" FROM card_tombstones WHERE user_id = $1
  `, [userId])
  const { rows: configRows } = await db.query<Record<string, unknown>>(`
    SELECT deck, pinned, folder, steps, max_interval AS "maxInterval",
      leech_threshold AS "leechThreshold", leech_action AS "leechAction",
      new_per_day AS "newPerDay", review_per_day AS "reviewPerDay"
    FROM deck_configs WHERE user_id = $1
  `, [userId])
  const deckConfigs: Record<string, DeckConfigRecord> = {}
  for (const row of configRows) {
    deckConfigs[String(row.deck)] = {
      pinned: Boolean(row.pinned),
      colorizeInterface: false,
      folder: row.folder ? String(row.folder) : undefined,
      steps: parseSteps(row.steps),
      maxInterval: Number(row.maxInterval) || 365,
      leechThreshold: Number(row.leechThreshold) || 8,
      leechAction: row.leechAction === 'suspend' ? 'suspend' : 'mark',
      newPerDay: Number(row.newPerDay) || 0,
      reviewPerDay: Number(row.reviewPerDay) || 0,
    }
  }
  const { rows: emptyRows } = await db.query<{ deck: string }>('SELECT deck FROM empty_decks WHERE user_id = $1 ORDER BY deck', [userId])
  const { rows: folderRows } = await db.query<{ name: string; collapsed: boolean }>(
    'SELECT name, collapsed FROM folders WHERE user_id = $1 ORDER BY position, name', [userId],
  )
  const folders: FolderRecord[] = folderRows.map(row => ({ name: row.name, collapsed: Boolean(row.collapsed) }))
  const structureUpdatedAt = cards.length || configRows.length || emptyRows.length || folders.length ? Date.now() : 0

  return {
    cards,
    deletedCards: deletedRows.map(row => ({ id: row.id, deletedAt: Number(row.deletedAt) })),
    deckConfigs,
    emptyDecks: emptyRows.map(row => row.deck),
    folders,
    structureUpdatedAt,
  }
}

function parseSteps(value: unknown): number[] | undefined {
  try {
    const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value
    if (!Array.isArray(parsed)) return undefined
    const steps = parsed.filter((step): step is number => Number.isInteger(step) && step > 0)
    return steps.length ? steps : undefined
  } catch {
    return undefined
  }
}

function snapshotTimestamp(snapshot: SyncPayload): number {
  return Math.max(
    snapshot.structureUpdatedAt,
    ...snapshot.cards.map(card => card.updatedAt),
    ...snapshot.deletedCards.map(item => item.deletedAt),
    0,
  )
}

async function rollback(client: PoolClient): Promise<void> {
  try { await client.query('ROLLBACK') } catch { /* Preserve the original error. */ }
}
