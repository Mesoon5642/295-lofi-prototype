// Usability test sessions: pure functions + reducer, like round.js. No React, DOM, or
// network. The server applies facilitator actions and logged events with the same
// reducer. All time values are passed in (`now` = ISO string).

import { PRACTICE_TRICKY_WORDS } from '../content/activities.js'
import {
  OUTCOMES,
  OUTCOME_IDS,
  SEVERITIES,
  SEVERITY_VALUES,
  TEST_TASKS,
  findTestTask,
} from '../content/testTasks.js'

export const EVENT_TYPES = ['route', 'signal']
export const EVENT_SIGNALS = ['round-detail-opened', 'text-size-large']
export const MAX_EVENTS = 2000
export const MAX_NOTE_LENGTH = 500

// Only these fields of a logged event are kept. Nothing else (in particular a child's
// typed explanation) can reach the session log.
const EVENT_FIELDS = ['type', 'path', 'screen', 'signal', 'roundId', 'at']

// The tasks a session runs, in task order: every required task plus the chosen ones.
export function includedTaskIds(taskIds = []) {
  return TEST_TASKS.filter((task) => task.required || taskIds.includes(task.id)).map((task) => task.id)
}

export function createTestSession({ id, testerLabel, adultId, childId, taskIds, now }) {
  return {
    id,
    testerLabel,
    adultId,
    childId,
    status: 'active',
    startedAt: now,
    endedAt: null,
    currentTaskIndex: 0,
    tasks: includedTaskIds(taskIds).map((taskId) => ({
      taskId,
      startedAt: null,
      endedAt: null,
      outcome: null,
    })),
    events: [],
    notes: [],
  }
}

// Readable screen names for the facilitator, from a pathname.
const SCREENS = [
  [/^\/sign-in\/?$/, 'Sign in'],
  [/^\/players\/?$/, 'Who’s playing?'],
  [/^\/parent\/?$/, 'Parent or Teacher'],
  [/^\/parent\/[^/]+\/?$/, 'Child results'],
  [/^\/facilitator(\/.*)?$/, 'Facilitator console'],
  [/^\/$/, 'Start'],
  [/^\/games\/?$/, 'Choose a game'],
  [/^\/play\/[^/]+\/?$/, 'Activity'],
  [/^\/summary\/[^/]+\/?$/, 'Summary'],
]

export function screenName(pathname) {
  return SCREENS.find(([pattern]) => pattern.test(pathname))?.[1] ?? pathname
}

// { screen, roundId } for a pathname: roundId is set on /play/:id and /summary/:id.
export function describeRoute(pathname) {
  const match = /^\/(?:play|summary)\/([^/]+)\/?$/.exec(pathname)
  return { screen: screenName(pathname), roundId: match ? decodeURIComponent(match[1]) : null }
}

function pickEvent(event) {
  const picked = {}
  for (const field of EVENT_FIELDS) {
    if (typeof event[field] === 'string') picked[field] = event[field]
  }
  return picked
}

function updateCurrentTask(session, changes) {
  return {
    ...session,
    tasks: session.tasks.map((task, index) =>
      index === session.currentTaskIndex ? { ...task, ...changes } : task,
    ),
  }
}

// Returns the same object reference when an action is a no-op.
//   START_TASK { now }                         starts the current task's timer (once)
//   SET_OUTCOME { outcome, now }               needs a started task; stops the timer
//   NEXT_TASK                                  moves to the next included task
//   LOG_EVENT { event }                        appends an event tagged with the current task
//   ADD_NOTE { text, severity, screen, now }   appends a note tagged with the current task
//   END { now }                                closes the session; later actions are no-ops
export function testSessionReducer(session, action) {
  if (session.status === 'ended') return session
  const task = getCurrentTask(session)

  switch (action.type) {
    case 'START_TASK':
      if (!task || task.startedAt) return session
      return updateCurrentTask(session, { startedAt: action.now })

    case 'SET_OUTCOME':
      if (!task?.startedAt || !OUTCOME_IDS.includes(action.outcome)) return session
      if (task.outcome === action.outcome) return session
      return updateCurrentTask(session, { outcome: action.outcome, endedAt: task.endedAt ?? action.now })

    case 'NEXT_TASK':
      if (session.currentTaskIndex >= session.tasks.length - 1) return session
      return { ...session, currentTaskIndex: session.currentTaskIndex + 1 }

    case 'LOG_EVENT': {
      const event = pickEvent(action.event ?? {})
      if (!EVENT_TYPES.includes(event.type) || !event.at) return session
      if (event.type === 'signal' && !EVENT_SIGNALS.includes(event.signal)) return session
      if (session.events.length >= MAX_EVENTS) return session
      return { ...session, events: [...session.events, { ...event, taskId: task?.taskId ?? null }] }
    }

    case 'ADD_NOTE': {
      const text = typeof action.text === 'string' ? action.text.trim() : ''
      if (text === '' || text.length > MAX_NOTE_LENGTH) return session
      if (!SEVERITY_VALUES.includes(action.severity)) return session
      const note = {
        at: action.now,
        taskId: task?.taskId ?? null,
        screen: typeof action.screen === 'string' ? action.screen : null,
        text,
        severity: action.severity,
      }
      return { ...session, notes: [...session.notes, note] }
    }

    case 'END':
      return { ...session, status: 'ended', endedAt: action.now }

    default:
      return session
  }
}

// Selectors

export function getCurrentTask(session) {
  return session.tasks[session.currentTaskIndex] ?? null
}

export function isLastTask(session) {
  return session.currentTaskIndex >= session.tasks.length - 1
}

// { number, total } for "Task 2 of 6".
export function taskPosition(session) {
  return { number: session.currentTaskIndex + 1, total: session.tasks.length }
}

// Milliseconds on a task: from Start Task until its outcome, or until `now` while running.
export function getElapsedMs(task, now) {
  if (!task?.startedAt) return 0
  const end = task.endedAt ?? now
  return Math.max(0, Date.parse(end) - Date.parse(task.startedAt))
}

// The screen of the latest route event, or null before the tester has moved.
export function getCurrentScreen(session) {
  for (let i = session.events.length - 1; i >= 0; i -= 1) {
    if (session.events[i].type === 'route') return session.events[i].screen ?? null
  }
  return null
}

// '1:05' for 65 000 ms; '12:00' for 720 000 ms.
export function formatDuration(ms) {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function outcomeLabel(outcome) {
  return OUTCOMES.find((o) => o.id === outcome)?.label ?? 'No outcome'
}

export function severityLabel(severity) {
  return SEVERITIES.find((s) => s.value === severity)?.label ?? String(severity)
}

// One row per included task (outcome, time on task, notes) plus every note in order.
export function summarizeSession(session) {
  const tasks = session.tasks.map((task) => {
    const info = findTestTask(task.taskId)
    return {
      taskId: task.taskId,
      number: info?.number ?? null,
      title: info?.title ?? task.taskId,
      outcome: task.outcome,
      outcomeLabel: outcomeLabel(task.outcome),
      timeOnTaskMs: task.startedAt && task.endedAt ? getElapsedMs(task) : null,
      notes: session.notes.filter((note) => note.taskId === task.taskId),
    }
  })
  return {
    id: session.id,
    testerLabel: session.testerLabel,
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    tasks,
    notes: session.notes.map((note) => ({
      ...note,
      taskNumber: findTestTask(note.taskId)?.number ?? null,
    })),
  }
}

// Plain-text results for Copy as Text.
export function sessionAsText(session) {
  const summary = summarizeSession(session)
  const lines = [
    `Usability session: ${summary.testerLabel}`,
    `Started ${summary.startedAt}${summary.endedAt ? `, ended ${summary.endedAt}` : ''}`,
    '',
    'Tasks',
  ]
  for (const task of summary.tasks) {
    const time = task.timeOnTaskMs === null ? '—' : formatDuration(task.timeOnTaskMs)
    lines.push(`${task.number}. ${task.title}: ${task.outcomeLabel} (${time})`)
  }
  lines.push('', 'Notes')
  if (summary.notes.length === 0) lines.push('None')
  for (const note of summary.notes) {
    lines.push(
      `[${note.at}] Task ${note.taskNumber ?? '?'} · ${note.screen ?? 'unknown screen'} · severity ${severityLabel(note.severity)}: ${note.text}`,
    )
  }
  return lines.join('\n')
}

// When each task's signal was first seen, as a timing aid for the facilitator:
// { [taskId]: { seen, at } }. `at` is null when the signal comes from stored round data
// or settings rather than a timestamped event. `rounds` are the child's rounds (any
// status); `settings` are the child's current reading settings.
export function deriveSignals(session, { rounds = [], settings = null } = {}) {
  const roundsById = new Map(rounds.map((round) => [round.id, round]))
  const result = {}

  for (const task of session.tasks) {
    const info = findTestTask(task.taskId)
    const events = session.events.filter((event) => event.taskId === task.taskId)
    const routes = events.filter((event) => event.type === 'route')
    const playEvents = routes.filter((event) => event.path?.startsWith('/play/'))
    const signalAt = (name) => events.find((event) => event.type === 'signal' && event.signal === name)?.at

    let found = null
    switch (info?.signal) {
      case 'round-created':
        found = playEvents[0] ? { at: playEvents[0].at } : null
        break
      case 'round-summary': {
        const summary = routes.find((event) => event.path?.startsWith('/summary/'))
        found = summary ? { at: summary.at } : null
        break
      }
      case 'help-used': {
        const helped = playEvents.some((event) => {
          const round = roundsById.get(event.roundId)
          if (!round) return false
          return (
            round.questions.some((q) => q.attempts > 1) &&
            round.questions.some((q) => q.hintUsed) &&
            round.questions.some((q) => q.audioUsed)
          )
        })
        found = helped ? { at: null } : null
        break
      }
      case 'round-detail-opened': {
        const at = signalAt('round-detail-opened')
        found = at ? { at } : null
        break
      }
      case 'tricky-round-created': {
        const tricky = playEvents.find(
          (event) => roundsById.get(event.roundId)?.activityId === PRACTICE_TRICKY_WORDS.id,
        )
        found = tricky ? { at: tricky.at } : null
        break
      }
      case 'text-size-large': {
        const at = signalAt('text-size-large')
        if (at) found = { at }
        else if (settings?.textSize === 'large') found = { at: null }
        break
      }
      default:
        found = null
    }
    result[task.taskId] = found ? { seen: true, at: found.at } : { seen: false, at: null }
  }
  return result
}
