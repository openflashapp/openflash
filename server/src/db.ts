import { Pool } from 'pg'

let pool: Pool | undefined

export function getDb(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) throw new Error('DATABASE_URL must be set')
    pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 })
  }
  return pool
}

export async function initializeDatabase(): Promise<void> {
  const db = getDb()
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL DEFAULT '',
      totp_secret TEXT NOT NULL DEFAULT '',
      totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      totp_failed_attempts INTEGER NOT NULL DEFAULT 0,
      totp_failure_window_started_at BIGINT NOT NULL DEFAULT 0,
      totp_locked_until BIGINT NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      user_agent TEXT NOT NULL DEFAULT '',
      created_at BIGINT NOT NULL,
      last_seen_at BIGINT NOT NULL,
      expires_at BIGINT NOT NULL,
      revoked_at BIGINT
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS auth_challenges (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('two_factor')),
      expires_at BIGINT NOT NULL,
      consumed_at BIGINT
    );

    CREATE INDEX IF NOT EXISTS idx_auth_challenges_token ON auth_challenges(token_hash);
    CREATE INDEX IF NOT EXISTS idx_auth_challenges_expiry ON auth_challenges(expires_at);

    CREATE TABLE IF NOT EXISTS learning_snapshots (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      updated_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      vim_mode BOOLEAN NOT NULL DEFAULT FALSE,
      cursor_effect BOOLEAN NOT NULL DEFAULT FALSE,
      glow_effect BOOLEAN NOT NULL DEFAULT FALSE,
      mistral_api_key TEXT NOT NULL DEFAULT '',
      providers TEXT NOT NULL DEFAULT '{}',
      providers_updated_at BIGINT NOT NULL DEFAULT 0,
      active_provider TEXT NOT NULL DEFAULT 'mistral'
    );

    CREATE TABLE IF NOT EXISTS oauth_accounts (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      PRIMARY KEY (provider, provider_id)
    );

    CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user ON oauth_accounts(user_id);

    CREATE TABLE IF NOT EXISTS webauthn_credentials (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      public_key BYTEA NOT NULL,
      counter BIGINT NOT NULL DEFAULT 0,
      transports TEXT NOT NULL DEFAULT '[]',
      device_type TEXT NOT NULL DEFAULT 'singleDevice',
      backed_up BOOLEAN NOT NULL DEFAULT FALSE,
      name TEXT NOT NULL DEFAULT 'Passkey',
      created_at BIGINT NOT NULL,
      last_used_at BIGINT
    );

    CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user ON webauthn_credentials(user_id);

    CREATE TABLE IF NOT EXISTS webauthn_challenges (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
      challenge TEXT NOT NULL,
      expires_at BIGINT NOT NULL,
      created_at BIGINT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expiry ON webauthn_challenges(expires_at);

    ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT NOT NULL DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT NOT NULL DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_failed_attempts INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_failure_window_started_at BIGINT NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_locked_until BIGINT NOT NULL DEFAULT 0;
    ALTER TABLE settings ADD COLUMN IF NOT EXISTS glow_effect BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE settings ADD COLUMN IF NOT EXISTS providers_updated_at BIGINT NOT NULL DEFAULT 0;
  `)

  const { migrateLegacyLearningData } = await import('./services/sync-store.js')
  await migrateLegacyLearningData()
}

export async function closeDb(): Promise<void> {
  if (!pool) return
  await pool.end()
  pool = undefined
}
