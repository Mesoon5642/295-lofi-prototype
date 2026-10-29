// Grown-up sign-in through the API. The session lives in an HTTP-only cookie that page
// code never sees; these calls only report what the server says about it.
import { ApiError, request } from './http.js'

// The session is read once and shared by every loader until it changes.
let sessionPromise = null

// { adult: { username, role }, children: [{ id, name }], elevated }, or null when
// signed out. Rejects with ApiError when the server can't be reached.
export function loadSession() {
  sessionPromise ??= request('/api/auth/session').catch((error) => {
    sessionPromise = null
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  })
  return sessionPromise
}

function forgetSession() {
  sessionPromise = null
}

// Resolves true (signed in) or false (wrong username or password). Rejects with
// ApiError for anything else, e.g. 429 after too many tries or 0 when offline.
export async function signIn(username, password) {
  forgetSession()
  try {
    await request('/api/auth/sign-in', { method: 'POST', body: { username, password } })
    return true
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return false
    throw error
  }
}

export async function signOut() {
  forgetSession()
  await request('/api/auth/sign-out', { method: 'POST' }).catch((error) => {
    if (!(error instanceof ApiError && error.status === 401)) throw error
  })
}

// Re-enters the signed-in grown-up's password to unlock grown-up actions for a few
// minutes. Same answers as signIn.
export async function unlock(password) {
  try {
    await request('/api/auth/unlock', { method: 'POST', body: { password } })
    return true
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return false
    throw error
  }
}

// Ends the unlock early (leaving the parent/teacher view, closing Settings).
export function lock() {
  return request('/api/auth/lock', { method: 'POST' }).catch(() => {})
}
