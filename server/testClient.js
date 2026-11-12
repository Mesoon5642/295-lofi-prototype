// Shared helpers for the HTTP-level server tests (app.test.js, testSessions.test.js).
// Not a test file itself: it only talks to the real Express app over real HTTP.
import { hashPassword } from './auth/passwords.js'
import { SESSION_COOKIE } from './auth/sessions.js'
import { Adult } from './models/index.js'

export const ORIGIN = 'http://localhost:5173'

let base = null

// Call once the test server is listening: setBase(`http://127.0.0.1:${port}`).
export function setBase(url) {
  base = url
}

// A browser-like client against the real Express app: keeps the session cookie and
// sends JSON with the app's Origin.
export function client() {
  let cookie = null
  async function call(path, { method = 'GET', body, headers = {} } = {}) {
    if (base === null) throw new Error('Call setBase() before making requests')
    const send = method !== 'GET' && method !== 'HEAD'
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        Origin: ORIGIN,
        ...(send ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: send ? JSON.stringify(body ?? {}) : undefined,
    })
    const setCookie = response.headers.get('set-cookie')
    if (setCookie?.startsWith(`${SESSION_COOKIE}=`)) {
      const value = setCookie.split(';')[0]
      cookie = value.endsWith('=') ? null : value
    }
    const type = response.headers.get('content-type') ?? ''
    const data = type.includes('json') ? await response.json() : null
    return { status: response.status, headers: response.headers, data, setCookie }
  }
  return { call, hasCookie: () => cookie !== null }
}

// Signs in (which starts unlocked). `playing` picks the child for the device (which
// locks it again); `locked` just locks it.
export async function signedIn({ username = 'admin', password = 'admin', playing, locked = false } = {}) {
  const browser = client()
  await browser.call('/api/auth/sign-in', { method: 'POST', body: { username, password } })
  if (playing) await browser.call('/api/auth/active-child', { method: 'POST', body: { childId: playing } })
  if (locked) await browser.call('/api/auth/lock', { method: 'POST' })
  return browser
}

// A second grown-up (a teacher, password 'chalk') with their own children.
export async function addTeacher(childIds = []) {
  await Adult.create({ username: 'teacher', role: 'teacher', childIds, ...(await hashPassword('chalk')) })
}
