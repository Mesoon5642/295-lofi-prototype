import { HttpError } from '../routes/errors.js'
import { SESSION_COOKIE, canAccessChild, canUseChild, findSession, isElevated } from './sessions.js'

// Loads the signed-in grown-up from the session cookie into req.auth, or 401s.
export async function requireSession(req, _res, next) {
  const auth = await findSession(req.cookies?.[SESSION_COOKIE])
  if (!auth) throw new HttpError(401, 'Please sign in.')
  req.auth = auth
  next()
}

// After requireSession: 403s unless the session was unlocked with the password recently.
export function requireElevated(req, _res, next) {
  if (!isElevated(req.auth)) throw new HttpError(403, 'Enter the grown-up password first.')
  next()
}

// Throws unless the session may use this child (see canUseChild): 404 when the grown-up
// isn't linked to the child (so other ids aren't confirmed), 403 when it's one of their
// children but the device is locked to a different child.
export function assertChildUsable(auth, childId, notFoundMessage = 'No child with that id') {
  if (!canAccessChild(auth, childId)) throw new HttpError(404, notFoundMessage)
  if (!canUseChild(auth, childId)) throw new HttpError(403, 'Enter the grown-up password first.')
}

// After requireSession: checks the child in the URL with assertChildUsable.
export function requireChildAccess(req, _res, next) {
  assertChildUsable(req.auth, req.params.childId)
  next()
}

// Writes must be JSON. Browsers can't send JSON across sites without a CORS preflight,
// which the CORS settings refuse, so this blocks cross-site form posts (CSRF).
export function requireJsonWrites(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  if (!req.is('application/json')) throw new HttpError(415, 'Send JSON')
  next()
}
