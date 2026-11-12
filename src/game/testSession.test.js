import { describe, expect, it } from 'vitest'
import { SEED_WORDS } from '../../server/seed/words.js'
import { MATCH_THE_WORD, PRACTICE_TRICKY_WORDS } from '../content/activities.js'
import { REQUIRED_TASK_IDS, TEST_TASK_IDS } from '../content/testTasks.js'
import { createRng } from './random.js'
import { getCurrentQuestion, roundReducer, startRound } from './round.js'
import {
  MAX_EVENTS,
  MAX_NOTE_LENGTH,
  createTestSession,
  deriveSignals,
  describeRoute,
  formatDuration,
  getCurrentScreen,
  getCurrentTask,
  getElapsedMs,
  includedTaskIds,
  isLastTask,
  outcomeLabel,
  screenName,
  sessionAsText,
  severityLabel,
  summarizeSession,
  taskPosition,
  testSessionReducer,
} from './testSession.js'

const START = '2026-11-12T10:00:00.000Z'
// ISO time `seconds` after START.
const at = (seconds) => new Date(Date.parse(START) + seconds * 1000).toISOString()

function newSession(taskIds = []) {
  return createTestSession({
    id: 'test-1',
    testerLabel: 'Tester 1',
    adultId: 'adult-1',
    childId: 'child-alex',
    taskIds,
    now: START,
  })
}

function apply(session, ...actions) {
  return actions.reduce(testSessionReducer, session)
}

// A route event as the server logs it: path plus its screen and roundId.
function route(path, seconds) {
  return {
    type: 'LOG_EVENT',
    event: { type: 'route', path, ...describeRoute(path), at: at(seconds) },
  }
}

function signal(name, seconds) {
  return { type: 'LOG_EVENT', event: { type: 'signal', signal: name, at: at(seconds) } }
}

// Moves to the task with this id (it must be included).
function goTo(session, taskId) {
  let s = session
  while (getCurrentTask(s).taskId !== taskId) s = testSessionReducer(s, { type: 'NEXT_TASK' })
  return s
}

function newRound(id, { activity = MATCH_THE_WORD, seed = 1, targets } = {}) {
  return startRound({
    id,
    childId: 'child-alex',
    activity,
    items: SEED_WORDS,
    now: START,
    rng: createRng(seed),
    targets,
  })
}

// A real round where question 1 had a wrong answer then the right one (attempts 2),
// a hint and audio. Pass { wrong: false } (or hint / audio) to leave one out.
function helpRound({ wrong = true, hint = true, audio = true } = {}) {
  let round = newRound('round-help', { seed: 3 })
  const q = getCurrentQuestion(round)
  if (wrong)
    round = roundReducer(round, { type: 'SELECT', word: q.options.find((w) => w !== q.target) })
  if (hint) round = roundReducer(round, { type: 'USE_HINT' })
  if (audio) round = roundReducer(round, { type: 'USE_AUDIO' })
  return roundReducer(round, { type: 'SELECT', word: q.target })
}

describe('includedTaskIds / createTestSession', () => {
  it('always includes the required tasks', () => {
    expect(includedTaskIds()).toEqual(REQUIRED_TASK_IDS)
    expect(includedTaskIds([])).toEqual(REQUIRED_TASK_IDS)
    expect(includedTaskIds(['start-round'])).toEqual(REQUIRED_TASK_IDS)
  })

  it('includes optional tasks only when chosen, in task order', () => {
    expect(includedTaskIds(['bigger-text'])).toEqual([...REQUIRED_TASK_IDS, 'bigger-text'])
    expect(includedTaskIds(['bigger-text', 'practice-tricky-words', 'nope'])).toEqual(TEST_TASK_IDS)
  })

  it('builds an active session with zeroed task fields', () => {
    const session = newSession(['practice-tricky-words'])
    expect(session).toEqual({
      id: 'test-1',
      testerLabel: 'Tester 1',
      adultId: 'adult-1',
      childId: 'child-alex',
      status: 'active',
      startedAt: START,
      endedAt: null,
      currentTaskIndex: 0,
      tasks: [...REQUIRED_TASK_IDS, 'practice-tricky-words'].map((taskId) => ({
        taskId,
        startedAt: null,
        endedAt: null,
        outcome: null,
      })),
      events: [],
      notes: [],
    })
  })
})

describe('START_TASK', () => {
  it('sets startedAt only once', () => {
    const session = newSession()
    const started = apply(session, { type: 'START_TASK', now: at(5) })
    expect(getCurrentTask(started).startedAt).toBe(at(5))
    expect(started.tasks[1]).toBe(session.tasks[1])
    expect(testSessionReducer(started, { type: 'START_TASK', now: at(9) })).toBe(started)
  })

  it('does not mutate the input session', () => {
    const session = newSession()
    const snapshot = structuredClone(session)
    apply(session, { type: 'START_TASK', now: at(5) })
    expect(session).toEqual(snapshot)
  })
})

describe('SET_OUTCOME', () => {
  it('is a no-op before the task starts', () => {
    const session = newSession()
    expect(
      testSessionReducer(session, { type: 'SET_OUTCOME', outcome: 'failed', now: at(1) }),
    ).toBe(session)
  })

  it('is a no-op for an unknown outcome', () => {
    const started = apply(newSession(), { type: 'START_TASK', now: at(0) })
    expect(testSessionReducer(started, { type: 'SET_OUTCOME', outcome: 'meh', now: at(1) })).toBe(
      started,
    )
    expect(testSessionReducer(started, { type: 'SET_OUTCOME', now: at(1) })).toBe(started)
  })

  it('sets the outcome and stops the timer at now', () => {
    const done = apply(
      newSession(),
      { type: 'START_TASK', now: at(0) },
      { type: 'SET_OUTCOME', outcome: 'completed_unaided', now: at(65) },
    )
    expect(getCurrentTask(done)).toEqual({
      taskId: 'start-round',
      startedAt: at(0),
      endedAt: at(65),
      outcome: 'completed_unaided',
    })
  })

  it('changing the outcome keeps the first endedAt; the same outcome again is a no-op', () => {
    const first = apply(
      newSession(),
      { type: 'START_TASK', now: at(0) },
      { type: 'SET_OUTCOME', outcome: 'completed_unaided', now: at(65) },
    )
    const changed = testSessionReducer(first, {
      type: 'SET_OUTCOME',
      outcome: 'completed_with_hesitation',
      now: at(90),
    })
    expect(getCurrentTask(changed)).toMatchObject({
      outcome: 'completed_with_hesitation',
      endedAt: at(65),
    })
    expect(
      testSessionReducer(changed, {
        type: 'SET_OUTCOME',
        outcome: 'completed_with_hesitation',
        now: at(120),
      }),
    ).toBe(changed)
  })
})

describe('NEXT_TASK', () => {
  it('advances through the included tasks only', () => {
    let s = newSession(['bigger-text'])
    const seen = [getCurrentTask(s).taskId]
    for (let i = 0; i < 4; i += 1) {
      s = testSessionReducer(s, { type: 'NEXT_TASK' })
      seen.push(getCurrentTask(s).taskId)
    }
    expect(seen).toEqual([...REQUIRED_TASK_IDS, 'bigger-text'])
    expect(s.currentTaskIndex).toBe(4)
  })

  it('is a no-op on the last task', () => {
    const last = goTo(newSession(), 'review-as-parent')
    expect(isLastTask(last)).toBe(true)
    expect(testSessionReducer(last, { type: 'NEXT_TASK' })).toBe(last)
  })
})

describe('LOG_EVENT', () => {
  it('appends an event tagged with the current task', () => {
    const s = apply(newSession(), route('/games', 1), { type: 'NEXT_TASK' }, route('/play/r1', 2))
    // A null roundId is not a string, so it is dropped.
    expect(s.events).toEqual([
      { type: 'route', path: '/games', screen: 'Choose a game', at: at(1), taskId: 'start-round' },
      {
        type: 'route',
        path: '/play/r1',
        screen: 'Activity',
        roundId: 'r1',
        at: at(2),
        taskId: 'finish-round',
      },
    ])
  })

  it('keeps only the allowed fields, so explanation text never gets in', () => {
    const session = apply(newSession(), {
      type: 'LOG_EVENT',
      event: {
        type: 'route',
        path: '/play/r1',
        screen: 'Activity',
        roundId: 'r1',
        at: at(1),
        explanation: 'secret',
        text: 'secret',
        taskId: 'bigger-text',
        extra: { nested: 'secret' },
      },
    })
    expect(session.events).toEqual([
      {
        type: 'route',
        path: '/play/r1',
        screen: 'Activity',
        roundId: 'r1',
        at: at(1),
        taskId: 'start-round',
      },
    ])
    expect(JSON.stringify(session)).not.toContain('secret')
  })

  it('rejects an unknown type or signal, and an event without at', () => {
    const session = newSession()
    const rejected = [
      { type: 'click', at: at(1) },
      { type: 'signal', signal: 'round-created', at: at(1) },
      { type: 'signal', at: at(1) },
      { type: 'route', path: '/games' },
      { type: 'route', path: '/games', at: 123 },
      {},
    ]
    for (const event of rejected) {
      expect(testSessionReducer(session, { type: 'LOG_EVENT', event })).toBe(session)
    }
    expect(testSessionReducer(session, { type: 'LOG_EVENT' })).toBe(session)
  })

  it('accepts the two known signals', () => {
    const s = apply(newSession(), signal('round-detail-opened', 1), signal('text-size-large', 2))
    expect(s.events.map((e) => e.signal)).toEqual(['round-detail-opened', 'text-size-large'])
  })

  it('stops at MAX_EVENTS', () => {
    const base = newSession()
    const full = {
      ...base,
      events: Array.from({ length: MAX_EVENTS }, () => ({
        type: 'route',
        path: '/games',
        at: START,
        taskId: 'start-round',
      })),
    }
    expect(testSessionReducer(full, route('/', 1))).toBe(full)
    const almost = { ...full, events: full.events.slice(1) }
    expect(testSessionReducer(almost, route('/', 1)).events).toHaveLength(MAX_EVENTS)
  })
})

describe('ADD_NOTE', () => {
  const note = (fields) => ({
    type: 'ADD_NOTE',
    text: 'Missed Help',
    severity: 2,
    screen: 'Activity',
    now: at(30),
    ...fields,
  })

  it('stores trimmed text with the current task, screen and time', () => {
    const s = apply(newSession(), { type: 'NEXT_TASK' }, note({ text: '  Missed Help  ' }))
    expect(s.notes).toEqual([
      { at: at(30), taskId: 'finish-round', screen: 'Activity', text: 'Missed Help', severity: 2 },
    ])
  })

  it('stores a null screen when none is given', () => {
    const s = apply(newSession(), note({ screen: undefined }))
    expect(s.notes[0].screen).toBe(null)
  })

  it('rejects empty or over-long text', () => {
    const session = newSession()
    for (const text of ['', '   ', undefined, 42, 'x'.repeat(MAX_NOTE_LENGTH + 1)]) {
      expect(testSessionReducer(session, note({ text }))).toBe(session)
    }
    expect(apply(session, note({ text: 'x'.repeat(MAX_NOTE_LENGTH) })).notes).toHaveLength(1)
  })

  it('rejects a severity outside 1–3', () => {
    const session = newSession()
    for (const severity of [0, 4, '2', null, undefined, 1.5]) {
      expect(testSessionReducer(session, note({ severity }))).toBe(session)
    }
    for (const severity of [1, 2, 3]) {
      expect(apply(session, note({ severity })).notes[0].severity).toBe(severity)
    }
  })
})

describe('END', () => {
  it('sets status and endedAt, and every later action is a no-op', () => {
    const started = apply(newSession(), { type: 'START_TASK', now: at(0) })
    const ended = testSessionReducer(started, { type: 'END', now: at(300) })
    expect(ended).toMatchObject({ status: 'ended', endedAt: at(300) })

    const later = [
      { type: 'START_TASK', now: at(301) },
      { type: 'SET_OUTCOME', outcome: 'failed', now: at(301) },
      { type: 'NEXT_TASK' },
      route('/games', 301),
      signal('text-size-large', 301),
      { type: 'ADD_NOTE', text: 'late', severity: 1, screen: 'Start', now: at(301) },
      { type: 'END', now: at(400) },
      { type: 'NOPE' },
    ]
    for (const action of later) expect(testSessionReducer(ended, action)).toBe(ended)
  })
})

describe('unknown actions', () => {
  it('return the same reference', () => {
    const session = newSession()
    expect(testSessionReducer(session, { type: 'NOPE' })).toBe(session)
    expect(testSessionReducer(session, {})).toBe(session)
  })
})

describe('selectors', () => {
  it('getCurrentTask, isLastTask and taskPosition follow currentTaskIndex', () => {
    const s = newSession(TEST_TASK_IDS)
    expect(getCurrentTask(s)).toBe(s.tasks[0])
    expect(isLastTask(s)).toBe(false)
    expect(taskPosition(s)).toEqual({ number: 1, total: 6 })
    const second = testSessionReducer(s, { type: 'NEXT_TASK' })
    expect(taskPosition(second)).toEqual({ number: 2, total: 6 })
    const last = goTo(s, 'bigger-text')
    expect(isLastTask(last)).toBe(true)
    expect(taskPosition(last)).toEqual({ number: 6, total: 6 })
  })

  it('getElapsedMs: 0 before start, uses now while running, endedAt once stopped', () => {
    const task = { taskId: 'start-round', startedAt: null, endedAt: null, outcome: null }
    expect(getElapsedMs(task, at(10))).toBe(0)
    expect(getElapsedMs(null, at(10))).toBe(0)
    const running = { ...task, startedAt: at(5) }
    expect(getElapsedMs(running, at(65))).toBe(60_000)
    const stopped = { ...running, endedAt: at(20), outcome: 'failed' }
    expect(getElapsedMs(stopped, at(999))).toBe(15_000)
    expect(getElapsedMs(running, at(0))).toBe(0)
  })

  it('getCurrentScreen: null before any route event, then the latest route screen', () => {
    const session = newSession()
    expect(getCurrentScreen(session)).toBe(null)
    const onlySignal = apply(session, signal('round-detail-opened', 1))
    expect(getCurrentScreen(onlySignal)).toBe(null)
    const moved = apply(
      session,
      route('/games', 1),
      route('/play/r1', 2),
      signal('text-size-large', 3),
    )
    expect(getCurrentScreen(moved)).toBe('Activity')
  })

  it('screenName maps every route to a readable name', () => {
    expect(screenName('/')).toBe('Start')
    expect(screenName('/games')).toBe('Choose a game')
    expect(screenName('/play/x')).toBe('Activity')
    expect(screenName('/summary/x')).toBe('Summary')
    expect(screenName('/players')).toBe('Who’s playing?')
    expect(screenName('/parent')).toBe('Parent or Teacher')
    expect(screenName('/parent/child-alex')).toBe('Child results')
    expect(screenName('/facilitator')).toBe('Facilitator console')
    expect(screenName('/sign-in')).toBe('Sign in')
    expect(screenName('/nowhere/at/all')).toBe('/nowhere/at/all')
  })

  it('describeRoute sets roundId on /play and /summary only', () => {
    expect(describeRoute('/play/round-1')).toEqual({ screen: 'Activity', roundId: 'round-1' })
    expect(describeRoute('/summary/round%201')).toEqual({ screen: 'Summary', roundId: 'round 1' })
    expect(describeRoute('/parent/child-alex')).toEqual({ screen: 'Child results', roundId: null })
    expect(describeRoute('/games')).toEqual({ screen: 'Choose a game', roundId: null })
  })

  it('formatDuration', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(65_000)).toBe('1:05')
    expect(formatDuration(720_000)).toBe('12:00')
    expect(formatDuration(-5_000)).toBe('0:00')
  })

  it('outcomeLabel and severityLabel', () => {
    expect(outcomeLabel('completed_unaided')).toBe('Completed Unaided')
    expect(outcomeLabel('completed_with_hesitation')).toBe('Completed With Hesitation')
    expect(outcomeLabel('failed')).toBe('Failed')
    expect(outcomeLabel(null)).toBe('No outcome')
    expect(severityLabel(1)).toBe('1 minor')
    expect(severityLabel(2)).toBe('2 recovered')
    expect(severityLabel(3)).toBe('3 blocked')
    expect(severityLabel(7)).toBe('7')
  })
})

describe('summarizeSession / sessionAsText', () => {
  function playedSession() {
    return apply(
      newSession(),
      { type: 'START_TASK', now: at(0) },
      { type: 'ADD_NOTE', text: 'Looked for Start', severity: 1, screen: 'Start', now: at(10) },
      { type: 'SET_OUTCOME', outcome: 'completed_unaided', now: at(65) },
      { type: 'NEXT_TASK' },
      { type: 'START_TASK', now: at(70) },
      { type: 'ADD_NOTE', text: 'Stuck on Next', severity: 3, screen: 'Activity', now: at(80) },
    )
  }

  it('gives one row per task, with time on task only once stopped', () => {
    const summary = summarizeSession(playedSession())
    expect(summary).toMatchObject({
      id: 'test-1',
      testerLabel: 'Tester 1',
      status: 'active',
      startedAt: START,
      endedAt: null,
    })
    expect(summary.tasks.map((t) => t.taskId)).toEqual(REQUIRED_TASK_IDS)
    expect(summary.tasks[0]).toMatchObject({
      number: 1,
      title: 'Start a round',
      outcome: 'completed_unaided',
      outcomeLabel: 'Completed Unaided',
      timeOnTaskMs: 65_000,
    })
    // Started but not stopped, and never started.
    expect(summary.tasks[1]).toMatchObject({
      number: 2,
      outcome: null,
      outcomeLabel: 'No outcome',
      timeOnTaskMs: null,
    })
    expect(summary.tasks[2].timeOnTaskMs).toBe(null)
  })

  it('groups notes per task and numbers them in the full list', () => {
    const summary = summarizeSession(playedSession())
    expect(summary.tasks[0].notes.map((n) => n.text)).toEqual(['Looked for Start'])
    expect(summary.tasks[1].notes.map((n) => n.text)).toEqual(['Stuck on Next'])
    expect(summary.tasks[2].notes).toEqual([])
    expect(summary.notes).toEqual([
      {
        at: at(10),
        taskId: 'start-round',
        screen: 'Start',
        text: 'Looked for Start',
        severity: 1,
        taskNumber: 1,
      },
      {
        at: at(80),
        taskId: 'finish-round',
        screen: 'Activity',
        text: 'Stuck on Next',
        severity: 3,
        taskNumber: 2,
      },
    ])
  })

  it('sessionAsText lists the tester, each task with outcome and time, and each note', () => {
    const ended = testSessionReducer(playedSession(), { type: 'END', now: at(600) })
    const text = sessionAsText(ended)
    const lines = text.split('\n')
    expect(lines[0]).toBe('Usability session: Tester 1')
    expect(lines[1]).toBe(`Started ${START}, ended ${at(600)}`)
    expect(lines).toContain('1. Start a round: Completed Unaided (1:05)')
    expect(lines).toContain('2. Finish a round: No outcome (—)')
    expect(lines).toContain('3. Get help: No outcome (—)')
    expect(lines).toContain('4. Review as a parent: No outcome (—)')
    expect(lines).toContain(`[${at(10)}] Task 1 · Start · severity 1 minor: Looked for Start`)
    expect(lines).toContain(`[${at(80)}] Task 2 · Activity · severity 3 blocked: Stuck on Next`)
    expect(lines).not.toContain('None')
  })

  it('sessionAsText says None when there are no notes', () => {
    const lines = sessionAsText(newSession()).split('\n')
    expect(lines[1]).toBe(`Started ${START}`)
    expect(lines.at(-1)).toBe('None')
  })
})

describe('deriveSignals', () => {
  const ALL = newSession(TEST_TASK_IDS)
  const NOT_SEEN = { seen: false, at: null }

  it('reports not seen for every task with no events', () => {
    expect(deriveSignals(ALL)).toEqual(
      Object.fromEntries(TEST_TASK_IDS.map((id) => [id, NOT_SEEN])),
    )
  })

  it('round-created: the first /play event during Start a round', () => {
    const s = apply(ALL, route('/games', 1), route('/play/r1', 2), route('/play/r2', 3))
    expect(deriveSignals(s)['start-round']).toEqual({ seen: true, at: at(2) })
  })

  it('round-summary: a /summary event during Finish a round', () => {
    const s = apply(goTo(ALL, 'finish-round'), route('/play/r1', 1), route('/summary/r1', 40))
    expect(deriveSignals(s)['finish-round']).toEqual({ seen: true, at: at(40) })
  })

  it('help-used: a round played during Get help with a wrong answer, hint and audio', () => {
    const round = helpRound()
    expect(getCurrentQuestion(round)).toMatchObject({
      attempts: 2,
      hintUsed: true,
      audioUsed: true,
    })

    const s = apply(goTo(ALL, 'get-help'), route('/play/round-help', 5))
    expect(deriveSignals(s, { rounds: [round] })['get-help']).toEqual({ seen: true, at: null })
  })

  it('help-used: not seen when the round lacks any of wrong answer, hint or audio', () => {
    const s = apply(goTo(ALL, 'get-help'), route('/play/round-help', 5))
    for (const parts of [{ wrong: false }, { hint: false }, { audio: false }]) {
      const round = helpRound(parts)
      expect(deriveSignals(s, { rounds: [round] })['get-help']).toEqual(NOT_SEEN)
    }
    // And when the round itself is unknown.
    expect(deriveSignals(s)['get-help']).toEqual(NOT_SEEN)
  })

  it('round-detail-opened: the signal event during Review as a parent', () => {
    const s = apply(
      goTo(ALL, 'review-as-parent'),
      route('/parent/child-alex', 1),
      signal('round-detail-opened', 7),
    )
    expect(deriveSignals(s)['review-as-parent']).toEqual({ seen: true, at: at(7) })
  })

  it('tricky-round-created: a /play event for a Tricky Words round', () => {
    const normal = newRound('round-normal')
    const tricky = newRound('round-tricky', {
      activity: PRACTICE_TRICKY_WORDS,
      targets: ['cat', 'dog'],
    })
    const s = apply(
      goTo(ALL, 'practice-tricky-words'),
      route('/play/round-normal', 1),
      route('/play/round-tricky', 9),
    )
    expect(deriveSignals(s, { rounds: [normal, tricky] })['practice-tricky-words']).toEqual({
      seen: true,
      at: at(9),
    })
    const onlyNormal = apply(goTo(ALL, 'practice-tricky-words'), route('/play/round-normal', 1))
    expect(
      deriveSignals(onlyNormal, { rounds: [normal, tricky] })['practice-tricky-words'],
    ).toEqual(NOT_SEEN)
  })

  it('text-size-large: via the signal event', () => {
    const s = apply(goTo(ALL, 'bigger-text'), signal('text-size-large', 12))
    expect(deriveSignals(s, { settings: { textSize: 'standard' } })['bigger-text']).toEqual({
      seen: true,
      at: at(12),
    })
  })

  it('text-size-large: via the current settings', () => {
    expect(deriveSignals(ALL, { settings: { textSize: 'large' } })['bigger-text']).toEqual({
      seen: true,
      at: null,
    })
    expect(deriveSignals(ALL, { settings: { textSize: 'standard' } })['bigger-text']).toEqual(
      NOT_SEEN,
    )
  })

  it('ignores events logged during a different task', () => {
    const helped = helpRound()
    const tricky = newRound('round-tricky', { activity: PRACTICE_TRICKY_WORDS, targets: ['cat'] })

    // Everything happens during task 1 (Start a round).
    const s = apply(
      ALL,
      route('/play/round-help', 1),
      route('/summary/round-help', 2),
      route('/play/round-tricky', 3),
      signal('round-detail-opened', 4),
      signal('text-size-large', 5),
    )
    const result = deriveSignals(s, { rounds: [helped, tricky] })
    expect(result['start-round']).toEqual({ seen: true, at: at(1) })
    for (const id of TEST_TASK_IDS.slice(1)) expect(result[id]).toEqual(NOT_SEEN)
  })

  it('only reports the included tasks', () => {
    expect(Object.keys(deriveSignals(newSession()))).toEqual(REQUIRED_TASK_IDS)
  })
})
