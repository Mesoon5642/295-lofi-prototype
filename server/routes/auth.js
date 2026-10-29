import { Router } from 'express'
import { requireElevated, requireSession } from '../auth/middleware.js'
import {
  SESSION_COOKIE,
  SESSION_MS,
  describeSession,
  findSession,
  lock,
  selectChild,
  signIn,
  signOut,
  unlock,
} from '../auth/sessions.js'

export const authRouter = Router()

// HTTP-only so page scripts can't read it; SameSite=Lax so other sites can't send it.
// Secure (HTTPS only) when NODE_ENV=production or COOKIE_SECURE=true.
function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true',
    path: '/api',
  }
}

// Body: { username, password }. Sets the session cookie; responds with the session.
// Signing in again on the same device replaces its old session.
authRouter.post('/sign-in', async (req, res) => {
  const { token, view } = await signIn(req.body?.username, req.body?.password)
  const previous = await findSession(req.cookies?.[SESSION_COOKIE])
  if (previous) await signOut(previous)
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_MS })
  res.json(view)
})

// The current session: { adult, children, activeChildId, elevated }, or 401 when signed out.
authRouter.get('/session', requireSession, async (req, res) => {
  res.json(await describeSession(req.auth))
})

authRouter.post('/sign-out', requireSession, async (req, res) => {
  await signOut(req.auth)
  res.clearCookie(SESSION_COOKIE, cookieOptions())
  res.json({ ok: true })
})

// Body: { password }. Unlocks grown-up actions for a few minutes.
authRouter.post('/unlock', requireSession, async (req, res) => {
  res.json(await unlock(req.auth, req.body?.password))
})

authRouter.post('/lock', requireSession, async (req, res) => {
  res.json(await lock(req.auth))
})

// Grown-ups only. Body: { childId }. Sets who plays on this device and locks
// grown-up actions again.
authRouter.post('/active-child', requireSession, requireElevated, async (req, res) => {
  res.json(await selectChild(req.auth, req.body?.childId))
})
