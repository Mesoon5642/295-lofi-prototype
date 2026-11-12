import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import mongoose from 'mongoose'
import { fileURLToPath } from 'node:url'
import { requireJsonWrites } from './auth/middleware.js'
import { authRouter } from './routes/auth.js'
import { childrenRouter } from './routes/children.js'
import { demoRouter } from './routes/demo.js'
import { HttpError } from './routes/errors.js'
import { roundsRouter } from './routes/rounds.js'
import { testSessionsRouter } from './routes/testSessions.js'
import { imagesRouter, wordsRouter } from './routes/words.js'

export const AUDIO_DIR = fileURLToPath(new URL('./audio/', import.meta.url))
const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://localhost:4173']

// The Express app without a database connection or a port, so tests can start it
// against their own database. `clientOrigins` are the React app origins allowed by
// CORS (with credentials, so the session cookie is sent).
export function createApp({ clientOrigins = DEFAULT_ORIGINS } = {}) {
  const app = express()
  app.use(cors({ origin: clientOrigins, credentials: true }))
  app.use(cookieParser())
  app.use(express.json({ limit: '100kb' }))

  // Pre-generated speech clips, played in the browser by Howler.js.
  app.use('/audio', express.static(AUDIO_DIR, { maxAge: '1h', fallthrough: false }))

  app.use('/api', requireJsonWrites)
  app.get('/api/health', (_req, res) => res.json({ ok: true }))
  app.use('/api/auth', authRouter)
  app.use('/api/children', childrenRouter)
  app.use('/api/rounds', roundsRouter)
  app.use('/api/words', wordsRouter)
  app.use('/api/images', imagesRouter)
  app.use('/api/demo', demoRouter)
  app.use('/api/test-sessions', testSessionsRouter)

  app.use('/api', () => {
    throw new HttpError(404, 'Not found')
  })

  // eslint-disable-next-line no-unused-vars
  app.use((error, _req, res, _next) => {
    let status = error.status ?? error.statusCode ?? 500
    if (error instanceof mongoose.Error.ValidationError) status = 400
    if (error instanceof mongoose.Error.CastError) status = 400
    if (status >= 500) console.error(error)
    res.status(status).json({ error: status >= 500 ? 'Something went wrong' : error.message })
  })

  return app
}
