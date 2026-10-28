// Child profile, settings, and rounds, through the Express API. These keep the names
// the localStorage repository had, but are async. Screens use only this module and
// api/auth.js to reach the server.

import { ApiError, createQueue, request } from './http.js'

const path = (strings, ...values) =>
  strings.reduce((out, s, i) => out + s + (i < values.length ? encodeURIComponent(values[i]) : ''), '')

export function getChildProfile(childId) {
  return request(path`/api/children/${childId}`)
}

export function getSettings(childId) {
  return request(path`/api/children/${childId}/settings`)
}

// Partial update; resolves with the full saved settings. Sent in order, like round saves.
const settingsQueue = createQueue()

export function saveSettings(childId, partial) {
  return settingsQueue.run(() =>
    request(path`/api/children/${childId}/settings`, { method: 'PATCH', body: partial }),
  )
}

let idCounter = 0

export function createRoundId() {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return `round-${cryptoApi.randomUUID()}`
  }
  idCounter += 1
  return `round-${Date.now().toString(36)}-${idCounter}`
}

// Saves go out one at a time, in order, so an older copy of a round can never land
// after a newer one.
const roundQueue = createQueue()

export function saveRound(round) {
  return roundQueue.run(() =>
    request(path`/api/rounds/${round.id}`, { method: 'PUT', body: round }),
  )
}

// Resolves once every round save started so far has finished (whether or not it worked).
export function whenSaved() {
  return roundQueue.idle()
}

export async function getRound(id) {
  try {
    return await request(path`/api/rounds/${id}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

// Newest first. Every filter is optional.
export function getRounds({ childId, status, activityId } = {}) {
  const query = new URLSearchParams(
    Object.entries({ childId, status, activityId }).filter(([, value]) => value !== undefined),
  )
  const search = query.size > 0 ? `?${query}` : ''
  return request(`/api/rounds${search}`)
}

export async function getInProgressRound(childId, activityId) {
  const [latest] = await getRounds({ childId, activityId, status: 'in_progress' })
  return latest ?? null
}

export function resetDemoData() {
  return request('/api/demo/reset', { method: 'POST' })
}
