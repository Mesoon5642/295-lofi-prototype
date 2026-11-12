// The child, their settings, and rounds, through the Express API. Rounds are created
// and changed on the server; the browser sends game actions and shows the result.
// Screens use only this module and api/auth.js to reach the server.

import { ApiError, createQueue, request } from './http.js'

const path = (strings, ...values) =>
  strings.reduce((out, s, i) => out + s + (i < values.length ? encodeURIComponent(values[i]) : ''), '')

// Grown-ups only: [{ id, name, completedRounds, lastPlayedAt }] for every child the
// signed-in grown-up can see.
export function listChildren() {
  return request('/api/children')
}

// Grown-ups only: creates a child profile linked to the signed-in grown-up and
// resolves with it ({ id, name, settings }).
export function createChild(name) {
  return request('/api/children', { method: 'POST', body: { name } })
}

// { id, name, settings }. A locked device can only read the child who is playing.
export function getChild(childId) {
  return request(path`/api/children/${childId}`)
}

// Grown-ups only (needs an unlocked session). Partial update; resolves with the full
// saved settings. Sent in order, like round actions.
const settingsQueue = createQueue()

export function saveSettings(childId, partial) {
  return settingsQueue.run(() =>
    request(path`/api/children/${childId}/settings`, { method: 'PATCH', body: partial }),
  )
}

// { trickyWords: string[], inProgress: { [activityId]: roundId | null } }
export function getGames(childId) {
  return request(path`/api/children/${childId}/games`)
}

// The server starts a round (or returns the game's in-progress one) and resolves with it.
export function startRound(childId, activityId) {
  return request(path`/api/children/${childId}/rounds`, { method: 'POST', body: { activityId } })
}

export async function getRound(id) {
  try {
    return await request(path`/api/rounds/${id}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

// Game actions go out one at a time, in order, so the server applies them in the
// order the child made them. Resolves with the round after the action.
const actionQueue = createQueue()

export function sendRoundAction(roundId, action) {
  return actionQueue.run(() =>
    request(path`/api/rounds/${roundId}/actions`, { method: 'POST', body: action }),
  )
}

// Resolves once every action sent so far has finished (whether or not it worked).
export function whenSaved() {
  return actionQueue.idle()
}

// Grown-ups only: the child's completed rounds, newest first.
export function getCompletedRounds(childId) {
  return request(path`/api/children/${childId}/rounds?status=completed`)
}

// Grown-ups only: every round of the child (in progress and completed), newest first.
export function getRounds(childId) {
  return request(path`/api/children/${childId}/rounds`)
}

// Grown-ups only.
export function resetDemoData() {
  return request('/api/demo/reset', { method: 'POST' })
}
