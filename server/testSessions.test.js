// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MATCH_THE_WORD } from '../src/content/activities.js'
import { DEFAULT_SETTINGS } from '../src/content/settings.js'
import { REQUIRED_TASK_IDS, TEST_TASKS } from '../src/content/testTasks.js'
import { createApp } from './app.js'
import { clearFailures } from './auth/sessions.js'
import { connectDatabase, disconnectDatabase } from './db.js'
import { reseed } from './seed/seed.js'
import { SEED_CHILD, SEED_ROUNDS } from './seed/seedData.js'
import { ORIGIN, addTeacher, client, setBase, signedIn } from './testClient.js'

const CHILD = SEED_CHILD.id
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const PAST = '1999-01-01T00:00:00.000Z'
let server

// Starts a session for `browser` (Alex, required tasks only, unless overridden).
function start(browser, body = {}) {
  return browser.call('/api/test-sessions', {
    method: 'POST',
    body: { testerLabel: 'Tester 1', childId: CHILD, taskIds: [], ...body },
  })
}

function act(browser, id, action) {
  return browser.call(`/api/test-sessions/${id}/actions`, { method: 'POST', body: action })
}

function logEvent(browser, event) {
  return browser.call('/api/test-sessions/active/events', { method: 'POST', body: event })
}

async function getSession(browser, id) {
  return (await browser.call(`/api/test-sessions/${id}`)).data
}

// A server-set time: an ISO string from the last minute, never a client-sent one.
function expectServerTime(value) {
  expect(value).toMatch(ISO)
  expect(Date.now() - Date.parse(value)).toBeLessThan(60_000)
  expect(Date.now() - Date.parse(value)).toBeGreaterThanOrEqual(0)
}

async function startRound(browser) {
  const response = await browser.call(`/api/children/${CHILD}/rounds`, {
    method: 'POST',
    body: { activityId: MATCH_THE_WORD.id },
  })
  expect(response.status).toBe(201)
  return response.data
}

beforeAll(async () => {
  await connectDatabase({ uri: null, persist: false })
  server = createApp({ clientOrigins: [ORIGIN] }).listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  setBase(`http://127.0.0.1:${server.address().port}`)
})

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
  await disconnectDatabase()
})

beforeEach(async () => {
  clearFailures()
  await reseed()
})

describe('access', () => {
  it('401s every route when signed out', async () => {
    const { data: session } = await start(await signedIn())
    const browser = client()
    const calls = [
      ['GET', '/api/test-sessions'],
      ['POST', '/api/test-sessions', { testerLabel: 'Tester 1', childId: CHILD, taskIds: [] }],
      ['GET', '/api/test-sessions/active'],
      ['POST', '/api/test-sessions/active/events', { type: 'route', path: '/games' }],
      ['GET', `/api/test-sessions/${session.id}`],
      ['POST', `/api/test-sessions/${session.id}/actions`, { type: 'START_TASK' }],
      ['POST', `/api/test-sessions/${session.id}/end`],
      ['POST', `/api/test-sessions/${session.id}/new-tester`],
    ]
    for (const [method, path, body] of calls) {
      expect((await browser.call(path, { method, body })).status, `${method} ${path}`).toBe(401)
    }
  })

  it('403s the facilitator routes when the device is locked', async () => {
    const facilitator = await signedIn()
    const { data: session } = await start(facilitator)
    const locked = await signedIn({ locked: true })
    const calls = [
      ['GET', '/api/test-sessions'],
      ['POST', '/api/test-sessions', { testerLabel: 'Tester 2', childId: CHILD, taskIds: [] }],
      ['GET', `/api/test-sessions/${session.id}`],
      ['POST', `/api/test-sessions/${session.id}/actions`, { type: 'START_TASK' }],
      ['POST', `/api/test-sessions/${session.id}/end`],
      ['POST', `/api/test-sessions/${session.id}/new-tester`],
    ]
    for (const [method, path, body] of calls) {
      expect((await locked.call(path, { method, body })).status, `${method} ${path}`).toBe(403)
    }
    expect(await getSession(facilitator, session.id)).toEqual(session)
  })

  it('lets the locked tester window read the task card and log events, and nothing more', async () => {
    const facilitator = await signedIn()
    const tester = await signedIn({ playing: CHILD })
    expect((await tester.call('/api/test-sessions/active')).data).toEqual({ active: false })

    const { data: session } = await start(facilitator, { taskIds: ['bigger-text'] })
    const active = await tester.call('/api/test-sessions/active')
    expect(active.status).toBe(200)
    expect(active.data).toEqual({
      active: true,
      childId: CHILD,
      taskId: 'start-round',
      taskNumber: 1,
      taskTotal: 5,
      scenario: TEST_TASKS[0].scenario,
    })
    expect(Object.keys(active.data).sort()).toEqual(
      ['active', 'childId', 'scenario', 'taskId', 'taskNumber', 'taskTotal'],
    )

    const logged = await logEvent(tester, { type: 'route', path: '/games' })
    expect(logged.status).toBe(200)
    expect(logged.data).toEqual({ logged: true })
    expect((await getSession(facilitator, session.id)).events).toHaveLength(1)

    await act(facilitator, session.id, { type: 'NEXT_TASK' })
    await act(facilitator, session.id, { type: 'ADD_NOTE', text: 'Hesitated', severity: 1 })
    const next = (await tester.call('/api/test-sessions/active')).data
    expect(next).toEqual({
      active: true,
      childId: CHILD,
      taskId: 'finish-round',
      taskNumber: 2,
      taskTotal: 5,
      scenario: TEST_TASKS[1].scenario,
    })
    expect(JSON.stringify(next)).not.toContain('Hesitated')
    expect(JSON.stringify(next)).not.toContain('Tester 1')
  })
})

describe('starting a session', () => {
  it('201s with every required task even when none are chosen', async () => {
    const response = await start(await signedIn())
    expect(response.status).toBe(201)
    expect(response.data).toEqual({
      id: expect.stringMatching(/^test-[0-9a-f-]{36}$/),
      testerLabel: 'Tester 1',
      adultId: expect.any(String),
      childId: CHILD,
      status: 'active',
      startedAt: expect.stringMatching(ISO),
      endedAt: null,
      currentTaskIndex: 0,
      tasks: REQUIRED_TASK_IDS.map((taskId) => ({ taskId, startedAt: null, endedAt: null, outcome: null })),
      events: [],
      notes: [],
    })
    expectServerTime(response.data.startedAt)
  })

  it('includes a chosen optional task, in task order, and trims the label', async () => {
    const browser = await signedIn()
    const response = await start(browser, {
      testerLabel: '  Pilot  ',
      taskIds: ['bigger-text', 'start-round', 'practice-tricky-words'],
    })
    expect(response.status).toBe(201)
    expect(response.data.testerLabel).toBe('Pilot')
    expect(response.data.tasks.map((t) => t.taskId)).toEqual([
      ...REQUIRED_TASK_IDS,
      'practice-tricky-words',
      'bigger-text',
    ])
  })

  it('400s for a blank label or an unknown task, and starts nothing', async () => {
    const browser = await signedIn()
    expect((await start(browser, { testerLabel: '   ' })).status).toBe(400)
    expect((await start(browser, { testerLabel: undefined })).status).toBe(400)
    expect((await start(browser, { taskIds: ['chess'] })).status).toBe(400)
    expect((await start(browser, { taskIds: 'bigger-text' })).status).toBe(400)
    expect((await browser.call('/api/test-sessions')).data).toEqual([])
    expect((await browser.call('/api/test-sessions/active')).data).toEqual({ active: false })
  })

  it('404s for a child the grown-up isn’t linked to', async () => {
    const browser = await signedIn()
    expect((await start(browser, { childId: 'child-other' })).status).toBe(404)
    expect((await start(browser, { childId: undefined })).status).toBe(404)
    expect((await browser.call('/api/test-sessions')).data).toEqual([])
  })

  it('resets the demo data to just the sample rounds', async () => {
    const browser = await signedIn()
    const round = await startRound(browser)
    expect((await browser.call(`/api/children/${CHILD}/rounds`)).data).toHaveLength(SEED_ROUNDS.length + 1)

    expect((await start(browser)).status).toBe(201)
    expect((await browser.call(`/api/children/${CHILD}/rounds`)).data).toEqual([...SEED_ROUNDS].reverse())
    expect((await browser.call(`/api/rounds/${round.id}`)).status).toBe(404)
  })

  it('resets Alex’s settings to the defaults', async () => {
    const browser = await signedIn()
    const patch = await browser.call(`/api/children/${CHILD}/settings`, {
      method: 'PATCH',
      body: { textSize: 'large', explanations: 'on' },
    })
    expect(patch.data).toEqual({ ...DEFAULT_SETTINGS, textSize: 'large', explanations: 'on' })

    expect((await start(browser)).status).toBe(201)
    expect((await browser.call(`/api/children/${CHILD}`)).data.settings).toEqual(DEFAULT_SETTINGS)
  })
})

describe('one active session per grown-up', () => {
  it('409s a second start, without resetting anything', async () => {
    const browser = await signedIn()
    const { data: first } = await start(browser)
    const round = await startRound(browser)

    const second = await start(browser, { testerLabel: 'Tester 2' })
    expect(second.status).toBe(409)
    expect(second.data.error).toEqual(expect.any(String))
    expect((await browser.call(`/api/rounds/${round.id}`)).status).toBe(200)
    expect((await browser.call('/api/test-sessions')).data.map((s) => s.id)).toEqual([first.id])
  })

  it('409s a second start from another signed-in device of the same grown-up', async () => {
    const laptop = await signedIn()
    const tablet = await signedIn()
    const { data: first } = await start(laptop)
    expect((await start(tablet, { testerLabel: 'Tester 2' })).status).toBe(409)
    expect((await tablet.call('/api/test-sessions')).data.map((s) => s.id)).toEqual([first.id])
  })

  it('lets a teacher run their own session at the same time, apart from the admin’s', async () => {
    await addTeacher([CHILD])
    const admin = await signedIn()
    const teacher = await signedIn({ username: 'teacher', password: 'chalk' })
    const { data: adminSession } = await start(admin)
    const started = await start(teacher, { testerLabel: 'Class 1' })
    expect(started.status).toBe(201)
    expect(started.data.adultId).not.toBe(adminSession.adultId)

    expect((await teacher.call(`/api/test-sessions/${adminSession.id}`)).status).toBe(404)
    expect((await admin.call(`/api/test-sessions/${started.data.id}`)).status).toBe(404)
    expect((await act(teacher, adminSession.id, { type: 'START_TASK' })).status).toBe(404)
    expect((await teacher.call(`/api/test-sessions/${adminSession.id}/end`, { method: 'POST' })).status).toBe(404)
    expect(
      (await teacher.call(`/api/test-sessions/${adminSession.id}/new-tester`, { method: 'POST' })).status,
    ).toBe(404)
    expect(await getSession(admin, adminSession.id)).toEqual(adminSession)
  })
})

describe('facilitator actions', () => {
  it('START_TASK, SET_OUTCOME and NEXT_TASK persist across a fresh GET', async () => {
    const browser = await signedIn()
    const { data: session } = await start(browser)

    const started = await act(browser, session.id, { type: 'START_TASK', now: PAST })
    expect(started.status).toBe(200)
    expectServerTime(started.data.tasks[0].startedAt)
    const outcome = await act(browser, session.id, { type: 'SET_OUTCOME', outcome: 'completed_with_hesitation' })
    expect(outcome.status).toBe(200)
    const next = await act(browser, session.id, { type: 'NEXT_TASK' })
    expect(next.status).toBe(200)

    const fresh = await getSession(await signedIn(), session.id)
    expect(fresh).toEqual(next.data)
    expect(fresh.currentTaskIndex).toBe(1)
    expect(fresh.tasks[0]).toEqual({
      taskId: 'start-round',
      startedAt: started.data.tasks[0].startedAt,
      endedAt: expect.stringMatching(ISO),
      outcome: 'completed_with_hesitation',
    })
    expect(fresh.tasks[1]).toEqual({ taskId: 'finish-round', startedAt: null, endedAt: null, outcome: null })
  })

  it('SET_OUTCOME needs a started task, and stops the timer', async () => {
    const browser = await signedIn()
    const { data: session } = await start(browser)

    const early = await act(browser, session.id, { type: 'SET_OUTCOME', outcome: 'failed' })
    expect(early.status).toBe(200)
    expect(early.data).toEqual(session)

    await act(browser, session.id, { type: 'START_TASK' })
    const stopped = (await act(browser, session.id, { type: 'SET_OUTCOME', outcome: 'failed' })).data
    const task = stopped.tasks[0]
    expect(task.outcome).toBe('failed')
    expectServerTime(task.endedAt)
    expect(Date.parse(task.endedAt)).toBeGreaterThanOrEqual(Date.parse(task.startedAt))

    const changed = (await act(browser, session.id, { type: 'SET_OUTCOME', outcome: 'completed_unaided' })).data
    expect(changed.tasks[0]).toEqual({ ...task, outcome: 'completed_unaided' })
  })

  it('stores a note with the current task and the tester’s latest screen', async () => {
    const facilitator = await signedIn()
    const tester = await signedIn({ playing: CHILD })
    const { data: session } = await start(facilitator)
    await act(facilitator, session.id, { type: 'NEXT_TASK' })
    await logEvent(tester, { type: 'route', path: '/' })
    await logEvent(tester, { type: 'route', path: '/games' })
    await logEvent(tester, { type: 'signal', signal: 'text-size-large' })

    const response = await act(facilitator, session.id, {
      type: 'ADD_NOTE',
      text: '  Looked for a start button  ',
      severity: 2,
      screen: 'Made up',
      taskId: 'bigger-text',
    })
    expect(response.status).toBe(200)
    expect(response.data.notes).toEqual([
      {
        at: expect.stringMatching(ISO),
        taskId: 'finish-round',
        screen: 'Choose a game',
        text: 'Looked for a start button',
        severity: 2,
      },
    ])
    expectServerTime(response.data.notes[0].at)
    expect((await getSession(facilitator, session.id)).notes).toEqual(response.data.notes)
  })

  it('400s for bad notes, outcomes, action types and bodies, and changes nothing', async () => {
    const browser = await signedIn()
    const { data: session } = await start(browser)
    await act(browser, session.id, { type: 'START_TASK' })
    const before = await getSession(browser, session.id)

    const bad = [
      { type: 'ADD_NOTE', text: 'Stuck', severity: 4 },
      { type: 'ADD_NOTE', text: 'Stuck', severity: '2' },
      { type: 'ADD_NOTE', text: 'Stuck' },
      { type: 'ADD_NOTE', text: '', severity: 1 },
      { type: 'ADD_NOTE', text: '   ', severity: 1 },
      { type: 'ADD_NOTE', text: 'x'.repeat(501), severity: 1 },
      { type: 'SET_OUTCOME', outcome: 'won' },
      { type: 'SET_OUTCOME' },
      { type: 'WIN' },
      { type: 'END' },
      { type: 'LOG_EVENT', event: { type: 'route', path: '/games', at: PAST } },
      {},
      [{ type: 'START_TASK' }],
    ]
    for (const action of bad) {
      expect((await act(browser, session.id, action)).status, JSON.stringify(action)).toBe(400)
    }
    expect(await getSession(browser, session.id)).toEqual(before)
  })

  it('404s for an unknown session id', async () => {
    const browser = await signedIn()
    await start(browser)
    expect((await browser.call('/api/test-sessions/test-nope')).status).toBe(404)
    expect((await act(browser, 'test-nope', { type: 'START_TASK' })).status).toBe(404)
    expect((await browser.call('/api/test-sessions/test-nope/end', { method: 'POST' })).status).toBe(404)
    expect((await browser.call('/api/test-sessions/test-nope/new-tester', { method: 'POST' })).status).toBe(404)
  })
})

describe('event logging', () => {
  it('tags route events with the task, screen, round id and a server time', async () => {
    const facilitator = await signedIn()
    const tester = await signedIn({ playing: CHILD })
    const { data: session } = await start(facilitator)
    await logEvent(tester, { type: 'route', path: '/play/round-abc', at: PAST })
    await act(facilitator, session.id, { type: 'NEXT_TASK' })
    await logEvent(tester, { type: 'route', path: '/summary/round-abc' })
    await logEvent(tester, { type: 'route', path: '/games' })
    await logEvent(tester, { type: 'signal', signal: 'round-detail-opened', roundId: 'sample-round-3' })

    const { events } = await getSession(facilitator, session.id)
    expect(events).toEqual([
      {
        at: expect.stringMatching(ISO),
        taskId: 'start-round',
        type: 'route',
        path: '/play/round-abc',
        screen: 'Activity',
        roundId: 'round-abc',
      },
      {
        at: expect.stringMatching(ISO),
        taskId: 'finish-round',
        type: 'route',
        path: '/summary/round-abc',
        screen: 'Summary',
        roundId: 'round-abc',
      },
      { at: expect.stringMatching(ISO), taskId: 'finish-round', type: 'route', path: '/games', screen: 'Choose a game' },
      {
        at: expect.stringMatching(ISO),
        taskId: 'finish-round',
        type: 'signal',
        signal: 'round-detail-opened',
        roundId: 'sample-round-3',
      },
    ])
    for (const event of events) expectServerTime(event.at)
  })

  it('400s for an unknown signal, event type or path', async () => {
    const facilitator = await signedIn()
    const tester = await signedIn({ playing: CHILD })
    const { data: session } = await start(facilitator)
    const bad = [
      { type: 'signal', signal: 'won-the-game' },
      { type: 'signal' },
      { type: 'signal', signal: 'text-size-large', roundId: 7 },
      { type: 'click', path: '/games' },
      { type: 'route', path: 'games' },
      { type: 'route' },
      {},
      [{ type: 'route', path: '/games' }],
    ]
    for (const event of bad) {
      expect((await logEvent(tester, event)).status, JSON.stringify(event)).toBe(400)
    }
    expect((await getSession(facilitator, session.id)).events).toEqual([])
  })

  it('reports { logged: false } when no session is active', async () => {
    const tester = await signedIn({ playing: CHILD })
    const response = await logEvent(tester, { type: 'route', path: '/games' })
    expect(response.status).toBe(200)
    expect(response.data).toEqual({ logged: false })
  })

  it('drops extra fields such as an explanation', async () => {
    const facilitator = await signedIn()
    const tester = await signedIn({ playing: CHILD })
    const { data: session } = await start(facilitator)
    const response = await logEvent(tester, {
      type: 'route',
      path: '/games',
      screen: 'Made up',
      taskId: 'bigger-text',
      explanation: 'secret',
    })
    expect(response.data).toEqual({ logged: true })
    await logEvent(tester, { type: 'signal', signal: 'text-size-large', explanation: 'secret', path: '/x' })

    const stored = await getSession(facilitator, session.id)
    expect(stored.events).toEqual([
      { at: expect.stringMatching(ISO), taskId: 'start-round', type: 'route', path: '/games', screen: 'Choose a game' },
      { at: expect.stringMatching(ISO), taskId: 'start-round', type: 'signal', signal: 'text-size-large' },
    ])
    expect(JSON.stringify(stored)).not.toContain('secret')
  })

  it('never logs a child’s explanation from a real round', async () => {
    const facilitator = await signedIn()
    const tester = await signedIn({ playing: CHILD })
    const { data: session } = await start(facilitator)
    // "Ask how they chose" is turned on after the start (which resets settings).
    const patch = await facilitator.call(`/api/children/${CHILD}/settings`, {
      method: 'PATCH',
      body: { explanations: 'on' },
    })
    expect(patch.data.explanations).toBe('on')

    await logEvent(tester, { type: 'route', path: '/games' })
    const round = await startRound(tester)
    await logEvent(tester, { type: 'route', path: `/play/${round.id}` })
    let state = round
    const play = async (action) => {
      const response = await tester.call(`/api/rounds/${round.id}/actions`, { method: 'POST', body: action })
      expect(response.status, JSON.stringify(action)).toBe(200)
      state = response.data
      await logEvent(tester, { type: 'route', path: `/play/${round.id}`, explanation: action.text })
    }
    for (let i = 0; i < round.questions.length; i += 1) {
      const q = state.questions[state.currentIndex]
      await play({ type: 'SELECT', word: q.target })
      await play({ type: 'SAVE_EXPLANATION', text: 'secret' })
      await play({ type: 'NEXT' })
    }
    await logEvent(tester, { type: 'route', path: `/summary/${round.id}` })

    expect(state.status).toBe('completed')
    expect(state.questions.every((q) => q.explanation === 'secret')).toBe(true)
    const stored = await getSession(facilitator, session.id)
    expect(stored.events.length).toBeGreaterThan(round.questions.length * 3)
    expect(stored.events.at(-1)).toMatchObject({ screen: 'Summary', roundId: round.id })
    expect(JSON.stringify(stored)).not.toContain('secret')
  })
})

describe('ending a session', () => {
  it('ends it, after which actions change nothing and a new session can start', async () => {
    const facilitator = await signedIn()
    const tester = await signedIn({ playing: CHILD })
    const { data: session } = await start(facilitator)
    await act(facilitator, session.id, { type: 'START_TASK' })

    const ended = await facilitator.call(`/api/test-sessions/${session.id}/end`, { method: 'POST' })
    expect(ended.status).toBe(200)
    expect(ended.data.status).toBe('ended')
    expectServerTime(ended.data.endedAt)

    const later = [
      { type: 'SET_OUTCOME', outcome: 'completed_unaided' },
      { type: 'NEXT_TASK' },
      { type: 'ADD_NOTE', text: 'Too late', severity: 1 },
    ]
    for (const action of later) {
      const response = await act(facilitator, session.id, action)
      expect(response.status).toBe(200)
      expect(response.data).toEqual(ended.data)
    }
    const again = await facilitator.call(`/api/test-sessions/${session.id}/end`, { method: 'POST' })
    expect(again.data).toEqual(ended.data)
    expect((await logEvent(tester, { type: 'route', path: '/games' })).data).toEqual({ logged: false })
    expect(await getSession(facilitator, session.id)).toEqual(ended.data)

    expect((await tester.call('/api/test-sessions/active')).data).toEqual({ active: false })
    const next = await start(facilitator, { testerLabel: 'Tester 2' })
    expect(next.status).toBe(201)
    expect(next.data.id).not.toBe(session.id)
  })
})

describe('New Tester Reset', () => {
  it('ends the session, restores the sample rounds and default settings, and suggests the next label', async () => {
    const facilitator = await signedIn()
    const tester = await signedIn({ playing: CHILD })
    const { data: session } = await start(facilitator)
    await facilitator.call(`/api/children/${CHILD}/settings`, {
      method: 'PATCH',
      body: { textSize: 'large', font: 'dyslexic', explanations: 'on' },
    })
    const round = await startRound(tester)

    const response = await facilitator.call(`/api/test-sessions/${session.id}/new-tester`, { method: 'POST' })
    expect(response.status).toBe(200)
    expect(response.data.nextLabel).toBe('Tester 2')
    expect(response.data.session).toMatchObject({ id: session.id, status: 'ended' })
    expectServerTime(response.data.session.endedAt)
    expect(await getSession(facilitator, session.id)).toEqual(response.data.session)

    const rounds = (await facilitator.call(`/api/children/${CHILD}/rounds`)).data
    expect(rounds.map((r) => r.id).sort()).toEqual(SEED_ROUNDS.map((r) => r.id).sort())
    expect(rounds.every((r) => r.isSample === true)).toBe(true)
    expect(rounds).toEqual([...SEED_ROUNDS].reverse())
    expect((await facilitator.call(`/api/rounds/${round.id}`)).status).toBe(404)
    expect((await facilitator.call(`/api/children/${CHILD}`)).data.settings).toEqual(DEFAULT_SETTINGS)
    expect((await tester.call('/api/test-sessions/active')).data).toEqual({ active: false })
  })
})

describe('listing sessions', () => {
  it('lists the grown-up’s own sessions newest first, with tester labels', async () => {
    await addTeacher([CHILD])
    const admin = await signedIn()
    const teacher = await signedIn({ username: 'teacher', password: 'chalk' })
    for (const label of ['Tester 1', 'Tester 2']) {
      const { data } = await start(admin, { testerLabel: label })
      await admin.call(`/api/test-sessions/${data.id}/end`, { method: 'POST' })
    }
    const { data: current } = await start(admin, { testerLabel: 'Tester 3' })
    const { data: theirs } = await start(teacher, { testerLabel: 'Class 1' })

    const list = (await admin.call('/api/test-sessions')).data
    expect(list.map((s) => [s.testerLabel, s.status])).toEqual([
      ['Tester 3', 'active'],
      ['Tester 2', 'ended'],
      ['Tester 1', 'ended'],
    ])
    expect(list[0]).toEqual({
      id: current.id,
      testerLabel: 'Tester 3',
      childId: CHILD,
      status: 'active',
      startedAt: current.startedAt,
      endedAt: null,
    })
    for (let i = 1; i < list.length; i += 1) {
      expect(list[i - 1].startedAt > list[i].startedAt).toBe(true)
    }
    expect(list.map((s) => s.id)).not.toContain(theirs.id)
    expect((await teacher.call('/api/test-sessions')).data.map((s) => s.id)).toEqual([theirs.id])
  })
})
