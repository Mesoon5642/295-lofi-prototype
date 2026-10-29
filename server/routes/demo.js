import { Router } from 'express'
import { requireElevated, requireSession } from '../auth/middleware.js'
import { resetDemoData } from '../repository.js'

export const demoRouter = Router()

// Grown-ups only. Removes the rounds of this grown-up's children and restores their
// sample rounds. Other grown-ups' children are not touched. Settings are kept.
demoRouter.post('/reset', requireSession, requireElevated, async (req, res) => {
  await resetDemoData(req.auth.adult.childIds)
  res.json({ ok: true })
})
