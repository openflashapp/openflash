import { Router } from 'express'
import { parseSyncPayload } from '../lib/validation.js'
import { authenticate, type AuthRequest } from '../middleware/auth.js'
import { mergeUserData, readUserData } from '../services/sync-store.js'

const router = Router()

router.use(authenticate)

router.post('/upload', async (req, res) => {
  const snapshot = await mergeUserData((req as AuthRequest).userId, parseSyncPayload(req.body))
  res.json({ ok: true, snapshot })
})

router.get('/download', async (req, res) => {
  res.json(await readUserData((req as AuthRequest).userId))
})

export { readUserData }
export default router
