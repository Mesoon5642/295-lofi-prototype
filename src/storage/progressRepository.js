// Progress repository: the ONLY module that touches localStorage.
// Everything is synchronous and returns JSON-safe copies so callers can't
// mutate the store by accident. The same names can later become async API calls.

import { MATCH_THE_WORD, SAMPLE_CHILD } from '../content/activities.js'
import { DEFAULT_SETTINGS, STORAGE_VERSION, createSeedState } from './seedData.js'

export const STORAGE_KEY = 'reading-game:v1'

// Allowed values for each setting; anything else is ignored by saveSettings.
const SETTING_VALUES = {
  textSize: ['standard', 'large'],
  font: ['standard', 'dyslexic'],
  wordAudio: ['on', 'off'],
  explanations: ['off', 'on'],
}

// Used only if localStorage is missing or throws (e.g. blocked site data),
// so the app still works for the session.
let memoryFallback = null
let idCounter = 0

function copy(value) {
  return value == null ? null : JSON.parse(JSON.stringify(value))
}

function readRaw() {
  try {
    const storage = globalThis.localStorage
    if (storage) return storage.getItem(STORAGE_KEY)
  } catch {
    // fall through to memory
  }
  return memoryFallback
}

function writeState(state) {
  const raw = JSON.stringify(state)
  memoryFallback = raw
  try {
    const storage = globalThis.localStorage
    if (storage) storage.setItem(STORAGE_KEY, raw)
  } catch {
    // keep the in-memory copy
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isValidState(state) {
  return (
    isPlainObject(state) &&
    state.version === STORAGE_VERSION &&
    Array.isArray(state.profiles) &&
    Array.isArray(state.rounds) &&
    state.rounds.every((round) => isPlainObject(round) && typeof round.id === 'string') &&
    isPlainObject(state.settings)
  )
}

function parse(raw) {
  if (typeof raw !== 'string') return null
  try {
    const state = JSON.parse(raw)
    return isValidState(state) ? state : null
  } catch {
    return null
  }
}

// Returns the current state, writing seed data first if it's missing or corrupt.
function loadState() {
  const state = parse(readRaw())
  if (state) return state
  const seeded = createSeedState()
  writeState(seeded)
  return seeded
}

function sortKey(round) {
  return round.completedAt ?? round.startedAt ?? ''
}

function newestFirst(a, b) {
  const ka = sortKey(a)
  const kb = sortKey(b)
  if (ka === kb) return 0
  return ka < kb ? 1 : -1
}

export function ensureSeeded() {
  loadState()
}

export function getChildProfile(childId = SAMPLE_CHILD.id) {
  const profile = loadState().profiles.find((p) => p && p.id === childId)
  return profile ? copy(profile) : null
}

export function createRoundId() {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return `round-${cryptoApi.randomUUID()}`
  }
  idCounter += 1
  return `round-${Date.now().toString(36)}-${idCounter}`
}

export function saveRound(round) {
  if (!isPlainObject(round) || typeof round.id !== 'string' || round.id === '') {
    throw new TypeError('saveRound requires a round with a string id')
  }
  const state = loadState()
  const index = state.rounds.findIndex((r) => r.id === round.id)
  const stored = index === -1 ? null : state.rounds[index]

  // Idempotent completion: a stored completed round always wins.
  if (stored && stored.status === 'completed') return copy(stored)

  const next = copy(round)
  if (index === -1) state.rounds.push(next)
  else state.rounds[index] = next
  writeState(state)
  return copy(next)
}

export function getRound(id) {
  const round = loadState().rounds.find((r) => r.id === id)
  return round ? copy(round) : null
}

export function getRounds({ childId, status } = {}) {
  const rounds = loadState().rounds.filter(
    (r) =>
      (childId === undefined || r.childId === childId) &&
      (status === undefined || r.status === status),
  )
  return copy(rounds.sort(newestFirst))
}

export function getInProgressRound(childId = SAMPLE_CHILD.id, activityId = MATCH_THE_WORD.id) {
  const [latest] = getRounds({ childId, status: 'in_progress' }).filter(
    (r) => r.activityId === activityId,
  )
  return latest ?? null
}

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...copy(loadState().settings) }
}

export function saveSettings(partial = {}) {
  const state = loadState()
  const settings = { ...DEFAULT_SETTINGS, ...state.settings }
  if (isPlainObject(partial)) {
    for (const [key, allowed] of Object.entries(SETTING_VALUES)) {
      if (allowed.includes(partial[key])) settings[key] = partial[key]
    }
  }
  state.settings = settings
  writeState(state)
  return copy(settings)
}

export function resetDemoData() {
  const current = parse(readRaw())
  const settings = current ? current.settings : DEFAULT_SETTINGS
  writeState(createSeedState(settings))
}
