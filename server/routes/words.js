import { Router } from 'express'
import { requireSession } from '../auth/middleware.js'
import { getImage, listWords } from '../repository.js'
import { notFound } from './errors.js'

export const wordsRouter = Router()

// The word list: [{ word, hint, pictureId }].
wordsRouter.get('/', requireSession, async (_req, res) => {
  res.json(await listWords())
})

export const imagesRouter = Router()

// An image's bytes. Public so <img> tags work without credentials; pictures are not
// private. The CSP keeps an SVG from running scripts if it is opened directly.
imagesRouter.get('/:imageId', async (req, res) => {
  const image = await getImage(req.params.imageId)
  if (!image) throw notFound('No image with that id')
  res.set({
    'Content-Type': image.contentType,
    'Cache-Control': 'public, max-age=3600',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    'X-Content-Type-Options': 'nosniff',
  })
  res.send(image.data)
})
