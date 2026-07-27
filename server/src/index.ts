import 'dotenv/config'
import { createApp } from './app.js'
import { closeDb, initializeDatabase } from './db.js'

const port = parsePort(process.env.PORT)

const app = createApp()
let server: ReturnType<typeof app.listen> | undefined

void start().catch(error => {
  console.error('Failed to start OpenFlash server:', error)
  process.exitCode = 1
})

async function start(): Promise<void> {
  await initializeDatabase()
  server = app.listen(port, () => {
    console.log(`OpenFlash server running on http://localhost:${port}`)
  })
}

function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down`)
  if (!server) return
  server.close(async error => {
    if (error) {
      console.error('Failed to stop server cleanly:', error)
      process.exitCode = 1
    }
    await closeDb()
  })
}

process.once('SIGTERM', () => shutdown('SIGTERM'))
process.once('SIGINT', () => shutdown('SIGINT'))

function parsePort(value: string | undefined): number {
  const port = Number(value ?? 3001)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535')
  }
  return port
}
