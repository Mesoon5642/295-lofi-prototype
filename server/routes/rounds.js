import { Router } from 'express'
import { getRound, getRounds, saveRound } from '../repository.js'
import { badRequest, notFound } from './errors.js'

export const roundsRouter = Router()

const FILTERS = ['childId', 'status', 'activityId']

// GET /api/rounds?childId=&status=&activityId= (all optional), newest first.
roundsRouter.get('/', async (req, res) => {
  const filter = {}
  for (const key of FILTERS) {
    const value = req.query[key]
    if (value === undefined) continue
    if (typeof value !== 'string') throw badRequest(`${key} must be a single value`)
    filter[key] = value
  }
  res.json(await getRounds(filter))
})

roundsRouter.get('/:roundId', async (req, res) => {
  const round = await getRound(req.params.roundId)
  if (!round) throw notFound('No round with that id')
  res.json(round)
})

// Upsert. A round that is already completed is never changed; the stored copy is returned.
roundsRouter.put('/:roundId', async (req, res) => {
  const round = req.body
  if (round?.id !== req.params.roundId) throw badRequest('The round id must match the URL')
  res.json(await saveRound(round))
})
