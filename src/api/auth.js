// Grown-up sign-in through the API. The session lives in an HTTP-only cookie that page
// code never sees; these calls only report what the server says about it.
import { ApiError, request } from './http.js'

// { adult: { username, role }, children: [{ id, name }], activeChildId, elevated }, or
// null when signed out. Always asks the server, so `elevated` and `activeChildId` are
// current. Rejects with ApiError when the server can't be reached.
export async function loadSession() {
  try {
    return await request('/api/auth/session')
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

// Resolves true (signed in, and unlocked for a few minutes) or false (wrong username or
// password). Rejects with ApiError for anything else, e.g. 429 after too many tries or
// 0 when offline.
export async function signIn(username, password) {
  try {
    await request('/api/auth/sign-in', { method: 'POST', body: { username, password } })
    return true
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return false
    throw error
  }
}

export async function signOut() {
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

// Ends the unlock early (leaving the grown-up screens, closing Settings).
export function lock() {
  return request('/api/auth/lock', { method: 'POST' }).catch(() => {})
}

// Grown-ups only: sets which child plays on this device. The server locks grown-up
// actions again, since the device is being handed to the child.
export function selectChild(childId) {
  return request('/api/auth/active-child', { method: 'POST', body: { childId } })
}
