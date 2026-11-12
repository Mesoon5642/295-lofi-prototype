// Usability test sessions through the Express API. The facilitator calls need an
// unlocked session; getActiveTestSession and logTestEvent work while a child plays.
// Screens use only this module to reach /api/test-sessions.

import { createQueue, request } from './http.js'

const path = (strings, ...values) =>
  strings.reduce((out, s, i) => out + s + (i < values.length ? encodeURIComponent(values[i]) : ''), '')

// Grown-ups only: [{ id, testerLabel, childId, status, startedAt, endedAt }], newest first.
export function listTestSessions() {
  return request('/api/test-sessions')
}

// Grown-ups only. Resets demo data and starts a session; rejects with ApiError 409
// when one is already active.
export function startTestSession({ testerLabel, childId, taskIds }) {
  return request('/api/test-sessions', { method: 'POST', body: { testerLabel, childId, taskIds } })
}

// What the task card shows: { active: false } or
// { active: true, childId, taskId, taskNumber, taskTotal, scenario }.
export function getActiveTestSession() {
  return request('/api/test-sessions/active')
}

// Grown-ups only: the full session (tasks, events, notes).
export function getTestSession(id) {
  return request(path`/api/test-sessions/${id}`)
}

// Grown-ups only. One of { type: 'START_TASK' }, { type: 'SET_OUTCOME', outcome },
// { type: 'NEXT_TASK' }, { type: 'ADD_NOTE', text, severity }. Resolves with the session.
export function sendTestSessionAction(id, action) {
  return request(path`/api/test-sessions/${id}/actions`, { method: 'POST', body: action })
}

export function endTestSession(id) {
  return request(path`/api/test-sessions/${id}/end`, { method: 'POST' })
}

// Grown-ups only: ends the session and resets for the next tester: { session, nextLabel }.
export function newTesterReset(id) {
  return request(path`/api/test-sessions/${id}/new-tester`, { method: 'POST' })
}

// Route changes and signals from the tester's window: { type: 'route', path } or
// { type: 'signal', signal, roundId? }. Sent in order, and failures are ignored so
// logging never gets in the way of the child's game.
const eventQueue = createQueue()

export function logTestEvent(event) {
  return eventQueue.run(() =>
    request('/api/test-sessions/active/events', { method: 'POST', body: event }).catch(() => null),
  )
}
