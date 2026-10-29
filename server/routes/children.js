import { Router } from 'express'
import { requireChildAccess, requireElevated, requireSession } from '../auth/middleware.js'
import {
  createChild,
  createRound,
  getChild,
  getGames,
  getRounds,
  listChildren,
  saveSettings,
} from '../repository.js'
import { badRequest, notFound } from './errors.js'

export const childrenRouter = Router()

// Grown-ups only: the signed-in grown-up's children with a summary of their results,
// [{ id, name, completedRounds, lastPlayedAt }].
childrenRouter.get('/', requireSession, requireElevated, async (req, res) => {
  res.json(await listChildren(req.auth.adult.childIds))
})

// Grown-ups only. Body: { name }. Creates a child profile linked to this grown-up (201).
childrenRouter.post('/', requireSession, requireElevated, async (req, res) => {
  res.status(201).json(await createChild(req.auth.adult._id, req.body?.name))
})

childrenRouter.use('/:childId', requireSession, requireChildAccess)

// { id, name, settings }
childrenRouter.get('/:childId', async (req, res) => {
  const child = await getChild(req.params.childId)
  if (!child) throw notFound('No child with that id')
  res.json(child)
})

// Grown-ups only. Partial update; unknown keys and invalid values are ignored.
childrenRouter.patch('/:childId/settings', requireElevated, async (req, res) => {
  const settings = await saveSettings(req.params.childId, req.body)
  if (!settings) throw notFound('No child with that id')
  res.json(settings)
})

// For Choose a game: { trickyWords, inProgress: { [activityId]: roundId | null } }
childrenRouter.get('/:childId/games', async (req, res) => {
  res.json(await getGames(req.params.childId))
})

// Body: { activityId }. Starts a round (201), or returns the in-progress one (200).
childrenRouter.post('/:childId/rounds', async (req, res) => {
  const { round, created } = await createRound(req.params.childId, req.body?.activityId)
  res.status(created ? 201 : 200).json(round)
})

const FILTERS = ['status', 'activityId']

// Grown-ups only: the child's rounds, newest first, for review. ?status=&activityId=
childrenRouter.get('/:childId/rounds', requireElevated, async (req, res) => {
  const filter = { childId: req.params.childId }
  for (const key of FILTERS) {
    const value = req.query[key]
    if (value === undefined) continue
    if (typeof value !== 'string') throw badRequest(`${key} must be a single value`)
    filter[key] = value
  }
  res.json(await getRounds(filter))
})
