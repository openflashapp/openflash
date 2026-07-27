import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import * as otplib from 'otplib'

const testDatabaseUrl = process.env.TEST_DATABASE_URL

test('cookie sessions and local-first synchronization work together', { skip: !testDatabaseUrl }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-oauth-state'
  process.env.ENCRYPTION_SECRET = 'separate-test-encryption-secret'

  const [{ createApp }, { closeDb, getDb, initializeDatabase }] = await Promise.all([
    import('../src/app.js'),
    import('../src/db.js'),
  ])
  await initializeDatabase()
  await getDb().query('TRUNCATE TABLE users CASCADE')
  const server = createApp().listen(0, '127.0.0.1')
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  const { port } = server.address() as AddressInfo
  const baseUrl = `http://127.0.0.1:${port}`

  try {
    const missingOrigin = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'blocked@example.com', username: 'blocked', password: 'correct horse battery staple' }),
    })
    assert.equal(missingOrigin.status, 403)

    const registration = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({ email: 'test@example.com', username: 'tester', password: 'correct horse battery staple' }),
    })
    assert.equal(registration.status, 201)
    const firstCookie = sessionCookie(registration)
    assert.match(registration.headers.get('set-cookie') ?? '', /HttpOnly/)
    assert.match(registration.headers.get('set-cookie') ?? '', /SameSite=Lax/)
    const registrationBody = await registration.json() as { user: { id: string } }
    assert.ok(registrationBody.user.id)
    assert.equal('token' in registrationBody, false)

    const usernameChange = await fetch(`${baseUrl}/api/auth/username`, {
      method: 'PUT',
      headers: { ...cookie(firstCookie), 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({ username: 'tester_next' }),
    })
    assert.equal(usernameChange.status, 200)
    assert.equal(((await usernameChange.json()) as { user: { username: string } }).user.username, 'tester_next')

    const secondLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({ email: 'test@example.com', password: 'correct horse battery staple' }),
    })
    assert.equal(secondLogin.status, 200)
    const secondCookie = sessionCookie(secondLogin)
    assert.notEqual(secondCookie, firstCookie)
    const secondLoginBody = await secondLogin.json() as object
    assert.equal('token' in secondLoginBody, false)

    const currentUser = await fetch(`${baseUrl}/api/auth/me`, { headers: cookie(firstCookie) })
    assert.equal(currentUser.status, 200)
    assert.equal((await fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: 'Bearer ofs_not_a_cookie' } })).status, 401)

    const initialUpdatedAt = Date.now()
    const snapshot = {
      cards: [{
        id: 'card-1', deck: 'German', question: 'Haus', answer: 'House', transcription: 'haʊs',
        transcriptionPlacement: 'answer', interval: 3, ease: 2.5, reps: 2, lapses: 1,
        nextReview: Date.now() + 86_400_000, pinned: true, suspended: false, updatedAt: initialUpdatedAt,
      }],
      deletedCards: [],
      deckConfigs: { German: { pinned: true, folder: 'Languages', steps: [1, 3] } },
      emptyDecks: ['Empty'],
      folders: [{ name: 'Languages', collapsed: true }],
      structureUpdatedAt: initialUpdatedAt,
    }
    const upload = await fetch(`${baseUrl}/api/sync/upload`, {
      method: 'POST',
      headers: { ...cookie(firstCookie), 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify(snapshot),
    })
    assert.equal(upload.status, 200)

    const download = await fetch(`${baseUrl}/api/sync/download`, { headers: cookie(secondCookie) })
    assert.equal(download.status, 200)
    const downloaded = await download.json() as typeof snapshot
    assert.equal(downloaded.cards[0]?.transcriptionPlacement, 'answer')
    assert.equal(downloaded.cards[0]?.nextReview, snapshot.cards[0]?.nextReview)
    assert.deepEqual(downloaded.folders, snapshot.folders)

    const reviewedSnapshot = {
      ...snapshot,
      cards: [{ ...snapshot.cards[0], reps: 3, interval: 7, nextReview: Date.now() + 7 * 86_400_000, updatedAt: initialUpdatedAt + 2 }],
    }
    await fetch(`${baseUrl}/api/sync/upload`, {
      method: 'POST', headers: { ...cookie(secondCookie), 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify(reviewedSnapshot),
    })
    await fetch(`${baseUrl}/api/sync/upload`, {
      method: 'POST', headers: { ...cookie(firstCookie), 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({ ...snapshot, cards: [{ ...snapshot.cards[0], nextReview: Date.now(), updatedAt: initialUpdatedAt + 1 }] }),
    })
    const merged = await fetch(`${baseUrl}/api/sync/download`, { headers: cookie(firstCookie) })
    const mergedSnapshot = await merged.json() as typeof snapshot
    assert.equal(mergedSnapshot.cards[0]?.nextReview, reviewedSnapshot.cards[0]?.nextReview)

    const settingsWrite = await fetch(`${baseUrl}/api/settings`, {
      method: 'PUT',
      headers: { ...cookie(firstCookie), 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({ activeProvider: 'openai', providers: {} }),
    })
    assert.equal(settingsWrite.status, 200)

    const providerSettingsWrite = await fetch(`${baseUrl}/api/settings/providers`, {
      method: 'PUT',
      headers: { ...cookie(firstCookie), 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        updatedAt: Date.now(),
        providers: { openai: { apiKey: 'test-provider-key', model: 'gpt-4o-mini' } },
      }),
    })
    assert.equal(providerSettingsWrite.status, 200)
    const providerSettings = await fetch(`${baseUrl}/api/settings/providers`, { headers: cookie(secondCookie) })
    assert.equal(providerSettings.status, 200)
    assert.equal(((await providerSettings.json()) as { providers: { openai?: { apiKey: string } } }).providers.openai?.apiKey, 'test-provider-key')

    const { protectSecret } = await import('../src/lib/crypto.js')
    const totpSecret = otplib.generateSecret()
    await getDb().query('UPDATE users SET totp_enabled = TRUE, totp_secret = $1 WHERE id = $2', [protectSecret(totpSecret), registrationBody.user.id])
    const twoFactorLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({ email: 'test@example.com', password: 'correct horse battery staple' }),
    })
    const { tempToken } = await twoFactorLogin.json() as { tempToken: string }
    const validCode = await otplib.generate({ secret: totpSecret })
    const invalidCode = validCode === '000000' ? '000001' : '000000'
    for (let attempt = 1; attempt <= 5; attempt++) {
      const verification = await fetch(`${baseUrl}/api/2fa/verify-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
        body: JSON.stringify({ tempToken, code: invalidCode }),
      })
      assert.equal(verification.status, attempt === 5 ? 429 : 401)
      if (attempt === 5) assert.ok(Number(verification.headers.get('retry-after')) >= 899)
    }
    const lockedLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({ email: 'test@example.com', password: 'correct horse battery staple' }),
    })
    assert.equal(lockedLogin.status, 429)

    const logout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST', headers: { ...cookie(firstCookie), Origin: 'http://localhost:5173' },
    })
    assert.equal(logout.status, 200)
    assert.match(logout.headers.get('set-cookie') ?? '', /openflash_session=;/)
    assert.equal((await fetch(`${baseUrl}/api/sync/download`, { headers: cookie(firstCookie) })).status, 401)
    assert.equal((await fetch(`${baseUrl}/api/sync/download`, { headers: cookie(secondCookie) })).status, 200)

    const missingPasswordDeletion = await fetch(`${baseUrl}/api/auth/account`, {
      method: 'DELETE', headers: { ...cookie(secondCookie), 'Content-Type': 'application/json', Origin: 'http://localhost:5173' }, body: JSON.stringify({}),
    })
    assert.equal(missingPasswordDeletion.status, 400)
    const incorrectPasswordDeletion = await fetch(`${baseUrl}/api/auth/account`, {
      method: 'DELETE', headers: { ...cookie(secondCookie), 'Content-Type': 'application/json', Origin: 'http://localhost:5173' }, body: JSON.stringify({ password: 'incorrect password' }),
    })
    assert.equal(incorrectPasswordDeletion.status, 403)

    await getDb().query('UPDATE users SET totp_locked_until = 0 WHERE id = $1', [registrationBody.user.id])
    const missingTwoFactorDeletion = await fetch(`${baseUrl}/api/auth/account`, {
      method: 'DELETE', headers: { ...cookie(secondCookie), 'Content-Type': 'application/json', Origin: 'http://localhost:5173' }, body: JSON.stringify({ password: 'correct horse battery staple' }),
    })
    assert.equal(missingTwoFactorDeletion.status, 400)
    const deletionCode = await otplib.generate({ secret: totpSecret })
    const accountDeletion = await fetch(`${baseUrl}/api/auth/account`, {
      method: 'DELETE', headers: { ...cookie(secondCookie), 'Content-Type': 'application/json', Origin: 'http://localhost:5173' }, body: JSON.stringify({ password: 'correct horse battery staple', totpCode: deletionCode }),
    })
    assert.equal(accountDeletion.status, 200)
    assert.equal((await fetch(`${baseUrl}/api/auth/me`, { headers: cookie(secondCookie) })).status, 401)
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()))
    await closeDb()
  }
})

function sessionCookie(response: Response): string {
  const setCookie = response.headers.get('set-cookie')
  assert.ok(setCookie)
  const cookieValue = setCookie.split(';', 1)[0]
  assert.ok(cookieValue)
  return cookieValue
}

function cookie(value: string): Record<string, string> {
  return { Cookie: value }
}
