// Grown-up checks through the API. Both answer yes/no; a wrong password is `false`,
// while an unreachable server rejects with ApiError so the form can say so.
import { ApiError, request } from './http.js'

async function allowed(promise) {
  try {
    await promise
    return true
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return false
    throw error
  }
}

// Sign-in for the parent/teacher view.
export function checkCredentials(username, password) {
  return allowed(request('/api/auth/sign-in', { method: 'POST', body: { username, password } }))
}

// The parent/teacher password behind the child's Settings button.
export function checkParentPassword(childId, password) {
  return allowed(request('/api/auth/check-password', { method: 'POST', body: { childId, password } }))
}
