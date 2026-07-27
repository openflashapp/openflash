import 'dotenv/config'
import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PoolClient } from 'pg'
import { getDb, closeDb, initializeDatabase } from '../src/db.js'
import type { CardRecord, DeckConfigRecord, SyncPayload } from '../src/domain/types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sqlitePath = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : path.resolve(__dirname, '..', 'data.db')

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be set')

const sqlite = new DatabaseSync(sqlitePath, { readOnly: true })
const postgres = getDb()

try {
  await initializeDatabase()
  const { rows } = await postgres.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users')
  if (Number(rows[0]?.count ?? 0) > 0) {
    throw new Error('PostgreSQL already contains users. Migration was not started.')
  }

  const client = await postgres.connect()
  try {
    await client.query('BEGIN')
    const users = rowsFrom('users')
    for (const user of users) await insertUser(client, user)
    if (tableExists('settings')) {
      for (const row of rowsFrom('settings')) await insertSettings(client, row)
    }
    if (tableExists('oauth_accounts')) {
      for (const row of rowsFrom('oauth_accounts')) {
        await client.query('INSERT INTO oauth_accounts (user_id, provider, provider_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [
          row.user_id, row.provider, row.provider_id,
        ])
      }
    }
    for (const user of users) {
      const userId = String(user.id)
      const snapshot = readSnapshot(userId)
      await client.query('INSERT INTO learning_snapshots (user_id, data, updated_at) VALUES ($1, $2::jsonb, $3)', [
        userId, JSON.stringify(snapshot), snapshotTimestamp(snapshot),
      ])
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  console.log(`Migration completed from ${sqlitePath}`)
} finally {
  sqlite.close()
  await closeDb()
}

async function insertUser(client: PoolClient, row: Record<string, unknown>): Promise<void> {
  const id = String(row.id)
  const username = typeof row.username === 'string' && row.username
    ? row.username
    : `user_${id.replaceAll('-', '').slice(0, 16)}`
  await client.query(`INSERT INTO users (
    id, email, username, password_hash, totp_secret, totp_enabled, created_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
    id, row.email, username, row.password_hash ?? '', row.totp_secret ?? '', Boolean(row.totp_enabled), row.created_at,
  ])
  if (row.oauth_provider && row.oauth_id) {
    await client.query('INSERT INTO oauth_accounts (user_id, provider, provider_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [
      id, row.oauth_provider, row.oauth_id,
    ])
  }
}

async function insertSettings(client: PoolClient, row: Record<string, unknown>): Promise<void> {
  await client.query(`INSERT INTO settings (
    user_id, vim_mode, cursor_effect, glow_effect, mistral_api_key, providers, active_provider
  ) VALUES ($1, $2, $3, FALSE, $4, $5, $6) ON CONFLICT (user_id) DO NOTHING`, [
    row.user_id, Boolean(row.vim_mode), Boolean(row.cursor_effect), row.mistral_api_key ?? '',
    row.providers ?? '{}', row.active_provider ?? 'mistral',
  ])
}

function readSnapshot(userId: string): SyncPayload {
  const cardRows = tableExists('cards') ? rowsFrom('cards', userId) : []
  const cards: CardRecord[] = cardRows.map(row => ({
    id: String(row.id),
    deck: String(row.deck),
    question: String(row.question),
    answer: String(row.answer),
    transcription: String(row.transcription ?? ''),
    transcriptionPlacement: row.transcription_placement === 'answer' ? 'answer' : 'question',
    interval: Number(row.interval ?? 1),
    ease: Number(row.ease ?? 2.5),
    reps: Number(row.reps ?? 0),
    lapses: Number(row.lapses ?? 0),
    nextReview: Number(row.next_review ?? Date.now()),
    pinned: Boolean(row.pinned),
    suspended: Boolean(row.suspended),
    updatedAt: Number(row.updated_at ?? row.next_review ?? 0),
  }))

  const deckConfigs: Record<string, DeckConfigRecord> = {}
  if (tableExists('deck_configs')) {
    for (const row of rowsFrom('deck_configs', userId)) {
      deckConfigs[String(row.deck)] = {
        pinned: Boolean(row.pinned),
        colorizeInterface: false,
        folder: row.folder ? String(row.folder) : undefined,
        steps: parseSteps(row.steps),
        maxInterval: Number(row.max_interval ?? 365),
        leechThreshold: Number(row.leech_threshold ?? 8),
        leechAction: row.leech_action === 'suspend' ? 'suspend' : 'mark',
        newPerDay: Number(row.new_per_day ?? 0),
        reviewPerDay: Number(row.review_per_day ?? 0),
      }
    }
  }
  const structureUpdatedAt = Date.now()
  return {
    cards,
    deletedCards: tableExists('card_tombstones')
      ? rowsFrom('card_tombstones', userId).map(row => ({ id: String(row.card_id), deletedAt: Number(row.deleted_at) }))
      : [],
    deckConfigs,
    emptyDecks: tableExists('empty_decks') ? rowsFrom('empty_decks', userId).map(row => String(row.deck)) : [],
    folders: tableExists('folders')
      ? rowsFrom('folders', userId).sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
        .map(row => ({ name: String(row.name), collapsed: Boolean(row.collapsed) }))
      : [],
    structureUpdatedAt,
  }
}

function rowsFrom(table: string, userId?: string): Array<Record<string, unknown>> {
  const statement = userId
    ? sqlite.prepare(`SELECT * FROM ${table} WHERE user_id = ?`)
    : sqlite.prepare(`SELECT * FROM ${table}`)
  return (userId ? statement.all(userId) : statement.all()) as Array<Record<string, unknown>>
}

function tableExists(table: string): boolean {
  return Boolean(sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table))
}

function parseSteps(value: unknown): number[] | undefined {
  try {
    const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value
    if (!Array.isArray(parsed)) return undefined
    const steps = parsed.filter((step): step is number => Number.isInteger(step) && (step as number) > 0)
    return steps.length ? steps : undefined
  } catch {
    return undefined
  }
}

function snapshotTimestamp(snapshot: SyncPayload): number {
  return Math.max(snapshot.structureUpdatedAt, ...snapshot.cards.map(card => card.updatedAt), 0)
}
