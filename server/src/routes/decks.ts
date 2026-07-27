import { Router } from 'express'
import { authenticate, type AuthRequest } from '../middleware/auth.js'
import { readUserData } from './sync.js'

const router = Router()

router.use(authenticate)

router.get('/', async (req, res) => {
  const userId = (req as AuthRequest).userId
  const data = await readUserData(userId)
  const decks = [...new Set([...data.emptyDecks, ...data.cards.map(card => card.deck)])]
  res.json({ decks, configs: data.deckConfigs, folders: data.folders })
})

export default router
