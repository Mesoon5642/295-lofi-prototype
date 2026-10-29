import { Router } from 'express'
import { requireElevated, requireSession } from '../auth/middleware.js'
import { resetDemoData } from '../repository.js'

export const demoRouter = Router()

// Grown-ups only. Removes every round and restores the sample rounds. Settings are kept.
demoRouter.post('/reset', requireSession, requireElevated, async (_req, res) => {
  await resetDemoData()
  res.json({ ok: true })
})
