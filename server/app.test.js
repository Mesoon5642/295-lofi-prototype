// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ACTIVITIES, MATCH_THE_WORD } from '../src/content/activities.js'
import { DEFAULT_SETTINGS } from '../src/content/settings.js'
import { clipName, spokenPhrases } from '../src/audio/clips.js'
import { createApp } from './app.js'
import { connectDatabase, disconnectDatabase } from './db.js'
import { reseed } from './seed/seed.js'
import { SEED_CHILD, SEED_ROUNDS } from './seed/seedData.js'

const ORIGIN = 'http://localhost:5173'
let server
let base

// Real HTTP against the Express app and a throwaway embedded MongoDB.
async function call(path, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { Origin: ORIGIN, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const type = response.headers.get('content-type') ?? ''
  const data = type.includes('json') ? await response.json() : null
  return { status: response.status, headers: response.headers, data }
}

function newRound(overrides = {}) {
  const [first] = SEED_ROUNDS
  return {
    ...structuredClone(first),
    id: 'round-http-1',
    isSample: false,
    status: 'in_progress',
    completedAt: null,
    currentIndex: 0,
    startedAt: '2026-10-28T10:00:00.000Z',
    ...overrides,
  }
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
  await reseed()
})

describe('CORS', () => {
  it('allows the React app origin and no other', async () => {
    const allowed = await call('/api/health')
    expect(allowed.status).toBe(200)
    expect(allowed.headers.get('access-control-allow-origin')).toBe(ORIGIN)

    const other = await call('/api/health', { headers: { Origin: 'http://evil.example' } })
    expect(other.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('answers preflight requests for JSON writes', async () => {
    const response = await fetch(`${base}/api/rounds/round-x`, {
      method: 'OPTIONS',
      headers: {
        Origin: ORIGIN,
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'content-type',
      },
    })
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-methods')).toContain('PUT')
  })
})

describe('children', () => {
  it('returns the profile and settings', async () => {
    expect((await call(`/api/children/${SEED_CHILD.id}`)).data).toEqual({ id: 'child-alex', name: 'Alex' })
    expect((await call(`/api/children/${SEED_CHILD.id}/settings`)).data).toEqual(DEFAULT_SETTINGS)
  })

  it('patches settings, ignoring invalid values', async () => {
    const { status, data } = await call(`/api/children/${SEED_CHILD.id}/settings`, {
      method: 'PATCH',
      body: { explanations: 'on', textSize: 'huge' },
    })
    expect(status).toBe(200)
    expect(data).toEqual({ ...DEFAULT_SETTINGS, explanations: 'on' })
  })

  it('404s for an unknown child', async () => {
    expect((await call('/api/children/child-nobody')).status).toBe(404)
    expect((await call('/api/children/child-nobody/settings')).status).toBe(404)
  })
})

describe('rounds', () => {
  it('lists rounds newest first with filters', async () => {
    const all = await call('/api/rounds')
    expect(all.data.map((r) => r.id)).toEqual(['sample-round-3', 'sample-round-2', 'sample-round-1'])
    const none = await call('/api/rounds?status=in_progress&childId=child-alex')
    expect(none.data).toEqual([])
  })

  it('rejects repeated query parameters', async () => {
    expect((await call('/api/rounds?status=a&status=b')).status).toBe(400)
  })

  it('saves with PUT and reads back the same round', async () => {
    const round = newRound()
    const saved = await call(`/api/rounds/${round.id}`, { method: 'PUT', body: round })
    expect(saved.status).toBe(200)
    expect(saved.data).toEqual(round)
    expect((await call(`/api/rounds/${round.id}`)).data).toEqual(round)
    const listed = await call(
      `/api/rounds?childId=child-alex&status=in_progress&activityId=${MATCH_THE_WORD.id}`,
    )
    expect(listed.data.map((r) => r.id)).toEqual([round.id])
  })

  it('keeps a completed round as stored', async () => {
    const [sample] = SEED_ROUNDS
    const downgrade = { ...structuredClone(sample), status: 'in_progress', completedAt: null }
    const { status, data } = await call(`/api/rounds/${sample.id}`, { method: 'PUT', body: downgrade })
    expect(status).toBe(200)
    expect(data).toEqual(sample)
  })

  it('400s when the body id does not match the URL or the round is invalid', async () => {
    const round = newRound()
    expect((await call('/api/rounds/round-other', { method: 'PUT', body: round })).status).toBe(400)
    const invalid = await call(`/api/rounds/${round.id}`, {
      method: 'PUT',
      body: { ...round, status: 'finished' },
    })
    expect(invalid.status).toBe(400)
    expect(invalid.data.error).toMatch(/status/)
  })

  it('400s for malformed JSON', async () => {
    const response = await fetch(`${base}/api/rounds/round-x`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    })
    expect(response.status).toBe(400)
  })

  it('404s for an unknown round', async () => {
    expect((await call('/api/rounds/round-nope')).status).toBe(404)
  })
})

describe('auth', () => {
  it('signs in with admin / admin and returns no password data', async () => {
    const ok = await call('/api/auth/sign-in', { method: 'POST', body: { username: 'admin', password: 'admin' } })
    expect(ok.status).toBe(200)
    expect(ok.data).toEqual({ username: 'admin', role: 'parent', childIds: ['child-alex'] })

    const wrong = await call('/api/auth/sign-in', { method: 'POST', body: { username: 'admin', password: 'x' } })
    expect(wrong.status).toBe(401)
    expect((await call('/api/auth/sign-in', { method: 'POST' })).status).toBe(401)
  })

  it('checks the parent password for a child', async () => {
    const check = (body) => call('/api/auth/check-password', { method: 'POST', body })
    expect((await check({ childId: 'child-alex', password: 'admin' })).status).toBe(200)
    expect((await check({ childId: 'child-alex', password: 'nope' })).status).toBe(401)
    expect((await check({ password: 'admin' })).status).toBe(401)
  })
})

describe('demo reset', () => {
  it('restores the sample rounds', async () => {
    const round = newRound()
    await call(`/api/rounds/${round.id}`, { method: 'PUT', body: round })
    expect((await call('/api/demo/reset', { method: 'POST' })).status).toBe(200)
    expect((await call('/api/rounds')).data).toHaveLength(SEED_ROUNDS.length)
  })
})

describe('audio clips', () => {
  it('serves a .wav clip for every phrase the app can speak', async () => {
    for (const { name } of spokenPhrases(ACTIVITIES)) {
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
  expect((await call('/api/nothing-here')).status).toBe(404)
})
