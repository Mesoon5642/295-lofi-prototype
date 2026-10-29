// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { clipName, spokenPhrases } from '../src/audio/clips.js'
import { ACTIVITIES, MATCH_THE_WORD, PRACTICE_TRICKY_WORDS } from '../src/content/activities.js'
import { DEFAULT_SETTINGS } from '../src/content/settings.js'
import { createApp } from './app.js'
import { hashPassword } from './auth/passwords.js'
import { SESSION_COOKIE, clearFailures } from './auth/sessions.js'
import { connectDatabase, disconnectDatabase } from './db.js'
import { Adult } from './models/index.js'
import { reseed } from './seed/seed.js'
import { SEED_CHILD, SEED_ROUNDS } from './seed/seedData.js'
import { SEED_WORDS } from './seed/words.js'

const ORIGIN = 'http://localhost:5173'
const CHILD = SEED_CHILD.id
let server
let base

// A browser-like client against the real Express app: keeps the session cookie and
// sends JSON with the app's Origin.
function client() {
  let cookie = null
  async function call(path, { method = 'GET', body, headers = {} } = {}) {
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
async function signedIn({ username = 'admin', password = 'admin', playing, locked = false } = {}) {
  const browser = client()
  await browser.call('/api/auth/sign-in', { method: 'POST', body: { username, password } })
  if (playing) await browser.call('/api/auth/active-child', { method: 'POST', body: { childId: playing } })
  if (locked) await browser.call('/api/auth/lock', { method: 'POST' })
  return browser
}

// A second grown-up (a teacher) with their own password and children.
async function addTeacher(childIds = []) {
  await Adult.create({ username: 'teacher', role: 'teacher', childIds, ...(await hashPassword('chalk')) })
}

beforeAll(async () => {
  await connectDatabase({ uri: null, persist: false })
  server = createApp({ clientOrigins: [ORIGIN] }).listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
  await disconnectDatabase()
})

beforeEach(async () => {
  clearFailures()
  await reseed()
})

describe('CORS and CSRF', () => {
  it('allows the React app origin with credentials, and no other origin', async () => {
    const allowed = await client().call('/api/health')
    expect(allowed.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    expect(allowed.headers.get('access-control-allow-credentials')).toBe('true')
    const other = await client().call('/api/health', { headers: { Origin: 'http://evil.example' } })
    expect(other.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('refuses writes that are not JSON (e.g. a cross-site form post)', async () => {
    const response = await fetch(`${base}/api/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'username=admin&password=admin',
    })
    expect(response.status).toBe(415)
  })
})

describe('sign-in', () => {
  it('sets an HTTP-only session cookie and reports the session', async () => {
    const browser = client()
    const signIn = await browser.call('/api/auth/sign-in', {
      method: 'POST',
      body: { username: 'admin', password: 'admin' },
    })
    expect(signIn.status).toBe(200)
    expect(signIn.setCookie).toMatch(new RegExp(`^${SESSION_COOKIE}=[A-Za-z0-9_-]{43};`))
    expect(signIn.setCookie).toMatch(/HttpOnly/)
    expect(signIn.setCookie).toMatch(/SameSite=Lax/)
    expect(signIn.setCookie).toMatch(/Path=\/api/)
    expect(signIn.data).toEqual({
      adult: { username: 'admin', role: 'parent' },
      children: [{ id: CHILD, name: 'Alex' }],
      activeChildId: null,
      elevated: true,
    })
    expect((await browser.call('/api/auth/session')).data).toEqual(signIn.data)
  })

  it('401s on wrong credentials and 429s after too many', async () => {
    const browser = client()
    const wrong = () =>
      browser.call('/api/auth/sign-in', { method: 'POST', body: { username: 'admin', password: 'x' } })
    expect((await wrong()).status).toBe(401)
    for (let i = 0; i < 4; i += 1) await wrong()
    expect((await wrong()).status).toBe(429)
    expect(browser.hasCookie()).toBe(false)
  })

  it('signs out, after which the cookie no longer works', async () => {
    const browser = await signedIn()
    expect((await browser.call('/api/auth/sign-out', { method: 'POST' })).status).toBe(200)
    expect((await browser.call('/api/auth/session')).status).toBe(401)
  })

  it('unlocks and locks grown-up actions', async () => {
    const browser = await signedIn({ locked: true })
    const settings = () =>
      browser.call(`/api/children/${CHILD}/settings`, { method: 'PATCH', body: { textSize: 'large' } })
    expect((await settings()).status).toBe(403)
    const wrong = await browser.call('/api/auth/unlock', { method: 'POST', body: { password: 'x' } })
    expect(wrong.status).toBe(401)
    const unlocked = await browser.call('/api/auth/unlock', { method: 'POST', body: { password: 'admin' } })
    expect(unlocked.data.elevated).toBe(true)
    expect((await settings()).data).toEqual({ ...DEFAULT_SETTINGS, textSize: 'large' })
    await browser.call('/api/auth/lock', { method: 'POST' })
    expect((await settings()).status).toBe(403)
  })
})

describe('access control', () => {
  it('401s every data endpoint without a session', async () => {
    const browser = client()
    const paths = [
      `/api/children/${CHILD}`,
      `/api/children/${CHILD}/games`,
      `/api/children/${CHILD}/rounds`,
      '/api/rounds/sample-round-1',
      '/api/words',
      '/api/auth/session',
    ]
    for (const path of paths) expect((await browser.call(path)).status, path).toBe(401)
    const start = await browser.call(`/api/children/${CHILD}/rounds`, {
      method: 'POST',
      body: { activityId: MATCH_THE_WORD.id },
    })
    expect(start.status).toBe(401)
    expect((await browser.call('/api/demo/reset', { method: 'POST' })).status).toBe(401)
  })

  it('hides other children and their rounds behind 404s', async () => {
    const browser = await signedIn()
    expect((await browser.call('/api/children/child-other')).status).toBe(404)
    expect((await browser.call('/api/children/child-other/games')).status).toBe(404)
    expect((await browser.call('/api/rounds/round-nope')).status).toBe(404)
  })

  it('keeps round history and demo reset for unlocked sessions', async () => {
    const browser = await signedIn({ locked: true })
    expect((await browser.call(`/api/children/${CHILD}/rounds`)).status).toBe(403)
    expect((await browser.call('/api/demo/reset', { method: 'POST' })).status).toBe(403)
    await browser.call('/api/auth/unlock', { method: 'POST', body: { password: 'admin' } })
    const history = await browser.call(`/api/children/${CHILD}/rounds?status=completed`)
    expect(history.data.map((r) => r.id)).toEqual(['sample-round-3', 'sample-round-2', 'sample-round-1'])
    expect((await browser.call('/api/demo/reset', { method: 'POST' })).status).toBe(200)
  })
})

describe('playing', () => {
  it('returns the child with settings, and the games', async () => {
    const browser = await signedIn({ playing: CHILD })
    expect((await browser.call(`/api/children/${CHILD}`)).data).toEqual({
      id: CHILD,
      name: 'Alex',
      settings: DEFAULT_SETTINGS,
    })
    expect((await browser.call(`/api/children/${CHILD}/games`)).data).toEqual({
      trickyWords: ['hat', 'cat', 'dog'],
      inProgress: { [MATCH_THE_WORD.id]: null, [PRACTICE_TRICKY_WORDS.id]: null },
    })
  })

  it('starts a round on the server (201), then returns that same round (200)', async () => {
    const browser = await signedIn({ playing: CHILD })
    const start = () =>
      browser.call(`/api/children/${CHILD}/rounds`, { method: 'POST', body: { activityId: MATCH_THE_WORD.id } })
    const first = await start()
    expect(first.status).toBe(201)
    expect(first.data.questions).toHaveLength(5)
    const again = await start()
    expect(again.status).toBe(200)
    expect(again.data.id).toBe(first.data.id)
    expect((await browser.call(`/api/rounds/${first.data.id}`)).data).toEqual(first.data)
  })

  it('400s for an unknown activity', async () => {
    const browser = await signedIn({ playing: CHILD })
    const response = await browser.call(`/api/children/${CHILD}/rounds`, {
      method: 'POST',
      body: { activityId: 'chess' },
    })
    expect(response.status).toBe(400)
  })

  it('plays a whole round through actions', async () => {
    const browser = await signedIn({ playing: CHILD })
    const { data: round } = await browser.call(`/api/children/${CHILD}/rounds`, {
      method: 'POST',
      body: { activityId: MATCH_THE_WORD.id },
    })
    let state = round
    const act = async (action) => {
      const response = await browser.call(`/api/rounds/${round.id}/actions`, { method: 'POST', body: action })
      expect(response.status, JSON.stringify(action)).toBe(200)
      state = response.data
    }
    for (let i = 0; i < round.questions.length; i += 1) {
      const q = state.questions[state.currentIndex]
      await act({ type: 'SELECT', word: q.options.find((w) => w !== q.target) })
      await act({ type: 'SELECT', word: q.target })
      await act({ type: 'SKIP_EXPLANATION' })
      await act({ type: 'NEXT', now: '1999-01-01T00:00:00.000Z' })
    }
    expect(state.status).toBe('completed')
    expect(Date.now() - Date.parse(state.completedAt)).toBeLessThan(60_000)
    expect(state.questions.every((q) => q.attempts === 2)).toBe(true)
  })

  it('400s for invalid actions', async () => {
    const browser = await signedIn({ playing: CHILD })
    const response = await browser.call('/api/rounds/sample-round-1/actions', {
      method: 'POST',
      body: { type: 'WIN' },
    })
    expect(response.status).toBe(400)
  })

  it('does not change a completed round', async () => {
    const browser = await signedIn({ playing: CHILD })
    const response = await browser.call('/api/rounds/sample-round-1/actions', {
      method: 'POST',
      body: { type: 'PAUSE' },
    })
    expect(response.data).toEqual(SEED_ROUNDS[0])
  })
})

describe('children and who is playing', () => {
  it('lists the grown-up’s children with a summary of their results', async () => {
    const browser = await signedIn()
    expect((await browser.call('/api/children')).data).toEqual([
      { id: CHILD, name: 'Alex', completedRounds: 3, lastPlayedAt: SEED_ROUNDS[2].completedAt },
    ])
    const locked = await signedIn({ locked: true })
    expect((await locked.call('/api/children')).status).toBe(403)
  })

  it('creates a child profile linked to the grown-up', async () => {
    const browser = await signedIn()
    const created = await browser.call('/api/children', { method: 'POST', body: { name: '  Sam ' } })
    expect(created.status).toBe(201)
    expect(created.data).toEqual({
      id: expect.stringMatching(/^child-[0-9a-f-]{36}$/),
      name: 'Sam',
      settings: DEFAULT_SETTINGS,
    })
    const session = (await browser.call('/api/auth/session')).data
    expect(session.children.map((c) => c.name)).toEqual(['Alex', 'Sam'])
    const list = (await browser.call('/api/children')).data
    expect(list.find((c) => c.name === 'Sam')).toEqual({
      id: created.data.id,
      name: 'Sam',
      completedRounds: 0,
      lastPlayedAt: null,
    })
  })

  it('rejects blank, too long, duplicate (any case), and locked child creation', async () => {
    const browser = await signedIn()
    const add = (name) => browser.call('/api/children', { method: 'POST', body: { name } })
    expect((await add('   ')).status).toBe(400)
    expect((await add(undefined)).status).toBe(400)
    expect((await add('x'.repeat(61))).status).toBe(400)
    expect((await add('alex')).status).toBe(409)
    const locked = await signedIn({ locked: true })
    expect((await locked.call('/api/children', { method: 'POST', body: { name: 'Kim' } })).status).toBe(403)
  })

  it('picking a child sets who plays here and locks grown-up actions', async () => {
    const browser = await signedIn()
    const picked = await browser.call('/api/auth/active-child', { method: 'POST', body: { childId: CHILD } })
    expect(picked.data).toMatchObject({ activeChildId: CHILD, elevated: false })
    expect((await browser.call('/api/children')).status).toBe(403)
    const again = await browser.call('/api/auth/active-child', { method: 'POST', body: { childId: CHILD } })
    expect(again.status).toBe(403)
  })

  it('cannot pick a child the grown-up isn’t linked to', async () => {
    const browser = await signedIn()
    const picked = await browser.call('/api/auth/active-child', {
      method: 'POST',
      body: { childId: 'child-other' },
    })
    expect(picked.status).toBe(404)
  })

  it('a locked device only reaches the child who is playing (403 for the others)', async () => {
    const browser = await signedIn()
    const { data: sam } = await browser.call('/api/children', { method: 'POST', body: { name: 'Sam' } })
    const { data: samRound } = await browser.call(`/api/children/${sam.id}/rounds`, {
      method: 'POST',
      body: { activityId: MATCH_THE_WORD.id },
    })
    await browser.call('/api/auth/active-child', { method: 'POST', body: { childId: CHILD } })

    expect((await browser.call(`/api/children/${CHILD}/games`)).status).toBe(200)
    expect((await browser.call('/api/rounds/sample-round-1')).status).toBe(200)
    expect((await browser.call(`/api/children/${sam.id}`)).status).toBe(403)
    expect((await browser.call(`/api/children/${sam.id}/games`)).status).toBe(403)
    expect((await browser.call(`/api/rounds/${samRound.id}`)).status).toBe(403)
    const act = await browser.call(`/api/rounds/${samRound.id}/actions`, {
      method: 'POST',
      body: { type: 'PAUSE' },
    })
    expect(act.status).toBe(403)
    expect((await browser.call('/api/children/child-other')).status).toBe(404)
  })

  it('keeps each child’s results separate', async () => {
    const browser = await signedIn()
    const { data: sam } = await browser.call('/api/children', { method: 'POST', body: { name: 'Sam' } })
    expect((await browser.call(`/api/children/${sam.id}/games`)).data.trickyWords).toEqual([])
    const { data: round } = await browser.call(`/api/children/${sam.id}/rounds`, {
      method: 'POST',
      body: { activityId: MATCH_THE_WORD.id },
    })
    expect(round.childId).toBe(sam.id)
    const alexInProgress = (await browser.call(`/api/children/${CHILD}/games`)).data.inProgress
    expect(alexInProgress[MATCH_THE_WORD.id]).toBeNull()
    expect((await browser.call(`/api/children/${sam.id}/rounds`)).data.map((r) => r.id)).toEqual([round.id])
    expect((await browser.call(`/api/children/${CHILD}/rounds`)).data).toHaveLength(SEED_ROUNDS.length)
  })

  it('lets two grown-ups share a child while keeping their other children apart', async () => {
    await addTeacher([CHILD])
    const teacher = await signedIn({ username: 'teacher', password: 'chalk' })
    const { data: kim } = await teacher.call('/api/children', { method: 'POST', body: { name: 'Kim' } })
    expect((await teacher.call('/api/children')).data.map((c) => c.name)).toEqual(['Alex', 'Kim'])
    expect((await teacher.call(`/api/children/${CHILD}/rounds`)).data).toHaveLength(SEED_ROUNDS.length)

    const parent = await signedIn()
    expect((await parent.call('/api/children')).data.map((c) => c.name)).toEqual(['Alex'])
    expect((await parent.call(`/api/children/${kim.id}`)).status).toBe(404)
  })

  it('demo reset only touches the grown-up’s own children', async () => {
    await addTeacher()
    const teacher = await signedIn({ username: 'teacher', password: 'chalk' })
    const { data: kim } = await teacher.call('/api/children', { method: 'POST', body: { name: 'Kim' } })
    await teacher.call(`/api/children/${kim.id}/rounds`, {
      method: 'POST',
      body: { activityId: MATCH_THE_WORD.id },
    })

    const parent = await signedIn()
    await parent.call(`/api/children/${CHILD}/rounds`, { method: 'POST', body: { activityId: MATCH_THE_WORD.id } })
    expect((await parent.call('/api/demo/reset', { method: 'POST' })).status).toBe(200)
    expect((await parent.call(`/api/children/${CHILD}/rounds`)).data).toHaveLength(SEED_ROUNDS.length)
    expect((await teacher.call(`/api/children/${kim.id}/rounds`)).data).toHaveLength(1)
  })
})

describe('words and images', () => {
  it('lists the word list for signed-in grown-ups', async () => {
    const browser = await signedIn()
    const { data } = await browser.call('/api/words')
    expect(data.map((w) => w.word)).toEqual([...SEED_WORDS.map((w) => w.word)].sort())
    expect(data[0]).toEqual({ word: 'bus', hint: expect.any(String), pictureId: 'bus' })
  })

  it('serves images publicly with safe headers', async () => {
    const response = await fetch(`${base}/api/images/cat`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/svg+xml')
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'")
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(await response.text()).toMatch(/^<svg/)
    expect((await fetch(`${base}/api/images/nope`)).status).toBe(404)
  })
})

describe('audio clips', () => {
  it('serves a .wav clip for every phrase the app can speak', async () => {
    for (const { name } of spokenPhrases(ACTIVITIES, SEED_WORDS)) {
      const response = await fetch(`${base}/audio/${name}.wav`, { headers: { Origin: ORIGIN } })
      expect(response.status, name).toBe(200)
      expect(response.headers.get('content-type')).toMatch(/audio\/(x-)?wav/)
      expect(response.headers.get('access-control-allow-origin')).toBe(ORIGIN)
      await response.arrayBuffer()
    }
    expect(clipName(MATCH_THE_WORD.instruction)).toBe('pick-the-word-that-matches-the-picture')
  })

  it('404s for a missing clip', async () => {
    expect((await fetch(`${base}/audio/not-a-clip.wav`)).status).toBe(404)
  })
})

it('404s for unknown API paths', async () => {
  expect((await client().call('/api/nothing-here')).status).toBe(404)
})
