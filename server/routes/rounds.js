import { Router } from 'express'
import { assertChildUsable, requireSession } from '../auth/middleware.js'
import { applyRoundAction, getRound } from '../repository.js'
import { notFound } from './errors.js'

export const roundsRouter = Router()

roundsRouter.use(requireSession)

// Loads the round into req.round: 404 if it's missing or another grown-up's child's,
// 403 if it's for one of their children who isn't the one playing on this device.
async function loadRound(req, _res, next) {
  const round = await getRound(req.params.roundId)
  if (!round) throw notFound('No round with that id')
  assertChildUsable(req.auth, round.childId, 'No round with that id')
  req.round = round
  next()
}

roundsRouter.get('/:roundId', loadRound, (req, res) => {
  res.json(req.round)
})

// Body: one game action, e.g. { type: 'SELECT', word: 'cat' } (see ARCHITECTURE.md).
// Responds with the round after the action.
roundsRouter.post('/:roundId/actions', loadRound, async (req, res) => {
  const round = await applyRoundAction(req.params.roundId, req.body)
  if (!round) throw notFound('No round with that id')
  res.json(round)
})
