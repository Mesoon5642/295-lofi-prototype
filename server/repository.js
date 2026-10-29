// Progress repository: the ONLY server module that reads or writes child, word, image,
// and round data (sign-in sessions are in auth/sessions.js). Every function is async
// and returns plain JSON-safe objects in the shapes described in docs/ARCHITECTURE.md.

import { randomUUID } from 'node:crypto'
import { ACTIVITIES, MATCH_THE_WORD, PRACTICE_TRICKY_WORDS } from '../src/content/activities.js'
import { DEFAULT_SETTINGS, SETTING_VALUES } from '../src/content/settings.js'
import { OPTION_COUNT, recentPracticeWords, roundReducer, startRound } from '../src/game/index.js'
import { withLock } from './locks.js'
import { ChildProfile, Image, Round, Word } from './models/index.js'
import { HttpError } from './routes/errors.js'
import { SEED_ROUNDS } from './seed/seedData.js'

// JSON round trip turns Dates into ISO strings, matching the client's round shape.
function plain(doc) {
  return doc == null ? null : JSON.parse(JSON.stringify(doc))
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
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

// Children and settings

// { id, name, settings } or null. Missing settings keys get defaults.
export async function getChild(childId) {
  const child = await ChildProfile.findById(childId)
  if (!child) return null
  return { id: child.id, name: child.name, settings: { ...DEFAULT_SETTINGS, ...plain(child.settings) } }
}

// Saves only known keys with allowed values; anything else is ignored.
export async function saveSettings(childId, partial = {}) {
  const updates = {}
  if (isPlainObject(partial)) {
    for (const [key, allowed] of Object.entries(SETTING_VALUES)) {
      if (allowed.includes(partial[key])) updates[`settings.${key}`] = partial[key]
    }
  }
  const child = await ChildProfile.findByIdAndUpdate(
    childId,
    { $set: updates },
    { returnDocument: 'after', runValidators: true },
  )
  return child ? { ...DEFAULT_SETTINGS, ...plain(child.settings) } : null
}

// Words and images

// The whole word list, alphabetically: [{ word, hint, pictureId }].
export async function listWords() {
  return plain(await Word.find().sort({ _id: 1 }))
}

// { contentType, data: Buffer } or null.
export async function getImage(id) {
  const image = await Image.findById(id)
  return image ? { contentType: image.contentType, data: image.data } : null
}

// Rounds

export async function getRound(id) {
  return plain(await Round.findById(id))
}

// Newest first (by completedAt, else startedAt).
export async function getRounds({ childId, status, activityId } = {}) {
  const filter = {}
  if (childId !== undefined) filter.childId = childId
  if (status !== undefined) filter.status = status
  if (activityId !== undefined) filter.activityId = activityId
  const rounds = plain(await Round.find(filter))
  return rounds.sort(newestFirst)
}

// Words that took more than one try in the child's recent completed rounds, most often
// tricky first. Only words still in the word list count.
export async function getTrickyWords(childId) {
  const [completed, words] = await Promise.all([
    getRounds({ childId, status: 'completed' }),
    Word.find().distinct('_id'),
  ])
  const current = new Set(words)
  return recentPracticeWords(completed)
    .map(({ word }) => word)
    .filter((word) => current.has(word))
}

// What the Choose a game screen needs: the tricky words, and each game's
// in-progress round id (or null).
export async function getGames(childId) {
  const [trickyWords, inProgress] = await Promise.all([
    getTrickyWords(childId),
    getRounds({ childId, status: 'in_progress' }),
  ])
  return {
    trickyWords,
    inProgress: Object.fromEntries(
      ACTIVITIES.map((activity) => [
        activity.id,
        inProgress.find((round) => round.activityId === activity.id)?.id ?? null,
      ]),
    ),
  }
}

// Starts a round for the child, or returns the game's in-progress round if there is
// one (so a double tap can't start two). Questions come from the word list. A Tricky
// Words round uses the child's tricky words as targets; with none, it falls back to
// a regular Match the Word round. Resolves with { round, created }.
export async function createRound(childId, activityId, { rng = Math.random, now = new Date() } = {}) {
  if (!ACTIVITIES.some((activity) => activity.id === activityId)) {
    throw new HttpError(400, 'Unknown activity')
  }
  return withLock(`start:${childId}`, async () => {
    const [existing] = await getRounds({ childId, activityId, status: 'in_progress' })
    if (existing) return { round: existing, created: false }

    const items = await listWords()
    if (items.length < OPTION_COUNT) {
      throw new HttpError(409, `The word list needs at least ${OPTION_COUNT} words`)
    }
    const trickyWords = activityId === PRACTICE_TRICKY_WORDS.id ? await getTrickyWords(childId) : []
    const activity = trickyWords.length > 0 ? PRACTICE_TRICKY_WORDS : MATCH_THE_WORD
    if (activity.id !== activityId) {
      const [fallback] = await getRounds({ childId, activityId: activity.id, status: 'in_progress' })
      if (fallback) return { round: fallback, created: false }
    }

    const round = startRound({
      id: `round-${randomUUID()}`,
      childId,
      activity,
      items,
      now: now.toISOString(),
      rng,
      targets: trickyWords.length > 0 ? trickyWords : undefined,
    })
    const { id, ...fields } = round
    return { round: plain(await Round.create({ ...fields, _id: id })), created: true }
  })
}

// Actions the browser may send, and the fields each one carries (all strings).
const ACTION_FIELDS = {
  SELECT: ['word'],
  USE_HINT: [],
  USE_AUDIO: [],
  SAVE_EXPLANATION: ['text'],
  SKIP_EXPLANATION: [],
  PAUSE: [],
  CONTINUE: [],
  NEXT: [],
}

function parseAction(input) {
  const fields = isPlainObject(input) ? ACTION_FIELDS[input.type] : undefined
  if (!fields) throw new HttpError(400, 'Unknown action')
  const action = { type: input.type }
  for (const field of fields) {
    if (typeof input[field] !== 'string') throw new HttpError(400, `${field} must be a string`)
    action[field] = input[field]
  }
  return action
}

// Applies one game action with the shared round reducer and saves the result. The
// server sets NEXT's time. A completed round never changes. Resolves with the round
// (unchanged if the action was a no-op), or null if there is no such round.
export async function applyRoundAction(roundId, input, { now = new Date() } = {}) {
  const action = parseAction(input)
  if (action.type === 'NEXT') action.now = now.toISOString()

  return withLock(`round:${roundId}`, async () => {
    const round = await getRound(roundId)
    if (!round) return null
    const next = roundReducer(round, action)
    if (next === round) return round

    const { id, ...fields } = next
    const doc = new Round({ ...fields, _id: id })
    await doc.validate()
    const saved = await Round.findOneAndReplace(
      { _id: id, status: { $ne: 'completed' } },
      doc.toObject(),
      { returnDocument: 'after' },
    )
    return saved ? plain(saved) : getRound(roundId)
  })
}

// Removes every round and restores the sample rounds. Profiles, accounts, words,
// images, and settings are kept.
export async function resetDemoData() {
  await Round.deleteMany({})
  await Round.insertMany(SEED_ROUNDS.map(({ id, ...round }) => ({ ...round, _id: id })))
}
