import { Router } from 'express'
import { getChildProfile, getSettings, saveSettings } from '../repository.js'
import { notFound } from './errors.js'

export const childrenRouter = Router()

childrenRouter.get('/:childId', async (req, res) => {
  const child = await getChildProfile(req.params.childId)
  if (!child) throw notFound('No child with that id')
  res.json(child)
})

childrenRouter.get('/:childId/settings', async (req, res) => {
  const settings = await getSettings(req.params.childId)
  if (!settings) throw notFound('No child with that id')
  res.json(settings)
})

// Partial update; unknown keys and invalid values are ignored.
childrenRouter.patch('/:childId/settings', async (req, res) => {
  const settings = await saveSettings(req.params.childId, req.body)
  if (!settings) throw notFound('No child with that id')
  res.json(settings)
})
