import { Router } from 'express'
import { resetDemoData } from '../repository.js'

export const demoRouter = Router()

// Removes every round and restores the sample rounds. Settings are kept.
demoRouter.post('/reset', async (_req, res) => {
  await resetDemoData()
  res.json({ ok: true })
})
