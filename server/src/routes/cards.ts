import { Router } from 'express'
import { authenticate, type AuthRequest } from '../middleware/auth.js'
import { readUserData } from './sync.js'

const router = Router()

router.use(authenticate)

router.get('/', async (req, res) => {
  const userId = (req as AuthRequest).userId
  res.json((await readUserData(userId)).cards)
})

export default router
