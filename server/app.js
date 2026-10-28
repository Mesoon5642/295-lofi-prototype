import cors from 'cors'
import express from 'express'
import mongoose from 'mongoose'
import { fileURLToPath } from 'node:url'
import { authRouter } from './routes/auth.js'
import { childrenRouter } from './routes/children.js'
import { demoRouter } from './routes/demo.js'
import { HttpError } from './routes/errors.js'
import { roundsRouter } from './routes/rounds.js'

export const AUDIO_DIR = fileURLToPath(new URL('./audio/', import.meta.url))
const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://localhost:4173']

// The Express app without a database connection or a port, so tests can start it
// against their own database. `clientOrigins` are the React app origins allowed by CORS.
export function createApp({ clientOrigins = DEFAULT_ORIGINS } = {}) {
  const app = express()
  app.use(cors({ origin: clientOrigins }))
  app.use(express.json({ limit: '100kb' }))

  // Pre-generated speech clips, played in the browser by Howler.js.
  app.use('/audio', express.static(AUDIO_DIR, { maxAge: '1h', fallthrough: false }))

  app.get('/api/health', (_req, res) => res.json({ ok: true }))
  app.use('/api/children', childrenRouter)
  app.use('/api/rounds', roundsRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/demo', demoRouter)

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
