import { API_BASE } from './config.js'

// A failed API call. `status` is the HTTP status, or 0 when the server couldn't be reached.
export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// JSON request to the Express API, sending the session cookie. Writes always carry a
// JSON body (the API refuses other writes, which blocks cross-site form posts).
// Resolves with the parsed body; rejects with ApiError.
export async function request(path, { method = 'GET', body, base = API_BASE } = {}) {
  const write = method !== 'GET' && method !== 'HEAD'
  let response
  try {
    response = await fetch(`${base}${path}`, {
      method,
      credentials: 'include',
      headers: write ? { 'Content-Type': 'application/json' } : undefined,
      body: write ? JSON.stringify(body ?? {}) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Could not reach the game server')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, data?.error ?? response.statusText)
  return data
}

// Runs async tasks one at a time, in the order they were added. A failed task doesn't
// block the ones after it. `idle()` resolves once every task added so far has settled.
export function createQueue() {
  let tail = Promise.resolve()
  return {
    run(task) {
      const result = tail.then(task)
      tail = result.catch(() => {})
      return result
    },
    idle() {
      return tail
    },
  }
}
