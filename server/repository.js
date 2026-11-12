// Progress repository: the ONLY server module that reads or writes child, word, image,
// and round data (sign-in sessions are in auth/sessions.js). Every function is async
// and returns plain JSON-safe objects in the shapes described in docs/ARCHITECTURE.md.

import { randomUUID } from 'node:crypto'
import { ACTIVITIES, MATCH_THE_WORD, PRACTICE_TRICKY_WORDS } from '../src/content/activities.js'
import { DEFAULT_SETTINGS, SETTING_VALUES } from '../src/content/settings.js'
import { OUTCOME_IDS, SEVERITY_VALUES, TEST_TASK_IDS, nextTesterLabel } from '../src/content/testTasks.js'
import {
  EVENT_SIGNALS,
  MAX_NOTE_LENGTH,
  OPTION_COUNT,
  createTestSession,
  describeRoute,
  getCurrentScreen,
  recentPracticeWords,
  roundReducer,
  startRound,
  testSessionReducer,
} from '../src/game/index.js'
import { withLock } from './locks.js'
import { Adult, ChildProfile, Image, Round, TestSession, Word } from './models/index.js'
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

// The children with these ids, by name, each with how many rounds they've finished
// and when they last finished one: [{ id, name, completedRounds, lastPlayedAt }].
export async function listChildren(childIds) {
  const [children, stats] = await Promise.all([
    ChildProfile.find({ _id: { $in: childIds } }).collation({ locale: 'en' }).sort({ name: 1 }),
    Round.aggregate([
      { $match: { childId: { $in: childIds }, status: 'completed' } },
      { $group: { _id: '$childId', completedRounds: { $sum: 1 }, lastPlayedAt: { $max: '$completedAt' } } },
    ]),
  ])
  const byChild = new Map(stats.map((stat) => [stat._id, stat]))
  return children.map((child) => ({
    id: child.id,
    name: child.name,
    completedRounds: byChild.get(child.id)?.completedRounds ?? 0,
    lastPlayedAt: byChild.get(child.id)?.lastPlayedAt?.toISOString() ?? null,
  }))
}

// Creates a child profile with default settings and links it to the grown-up who made
// it. Names are trimmed; a grown-up can't have two children with the same name
// (ignoring case), since the name is how they tell them apart.
export async function createChild(adultId, name) {
  if (typeof name !== 'string' || name.trim() === '') throw new HttpError(400, 'Please enter a name')
  const trimmed = name.trim()
  const adult = await Adult.findById(adultId)
  if (!adult) throw new HttpError(404, 'No grown-up with that id')
  const clash = await ChildProfile.findOne({ _id: { $in: adult.childIds }, name: trimmed })
    .collation({ locale: 'en', strength: 2 })
  if (clash) throw new HttpError(409, `There is already a child called ${clash.name}`)

  const child = await ChildProfile.create({ _id: `child-${randomUUID()}`, name: trimmed })
  await Adult.updateOne({ _id: adult._id }, { $addToSet: { childIds: child.id } })
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

// Removes the rounds of the given children (every child when `childIds` is omitted) and
// restores their sample rounds. Profiles, accounts, words, images, and settings are kept.
export async function resetDemoData(childIds) {
  const scope = childIds === undefined ? {} : { childId: { $in: childIds } }
  await Round.deleteMany(scope)
  const samples = SEED_ROUNDS.filter((round) => childIds === undefined || childIds.includes(round.childId))
  if (samples.length > 0) {
    await Round.insertMany(samples.map(({ id, ...round }) => ({ ...round, _id: id })))
  }
}

// Usability test sessions (see src/game/testSession.js). Every function takes the
// signed-in grown-up's id and only reaches that grown-up's sessions.

const ACTIVE_SESSION_TAKEN = 'A usability test session is already running. End it first.'

function isDuplicateKey(error) {
  return error?.code === 11000
}

// Starting a session and New Tester Reset both give the next tester a clean start: the
// grown-up's children's rounds go back to the sample rounds, and the session child's
// reading settings go back to the defaults (so one tester's bigger text doesn't carry over).
async function resetForTester(childIds, childId) {
  await resetDemoData(childIds)
  await saveSettings(childId, DEFAULT_SETTINGS)
}

// Starts a session for the grown-up: { testerLabel, childId, taskIds }. Required tasks
// are always included. Resets demo data first. 409 when one is already active.
export async function startTestSession(adultId, input, { childIds, now = new Date() } = {}) {
  const { testerLabel, childId, taskIds = [] } = isPlainObject(input) ? input : {}
  if (typeof testerLabel !== 'string' || testerLabel.trim() === '' || testerLabel.trim().length > 60) {
    throw new HttpError(400, 'Please enter a tester label (up to 60 characters)')
  }
  if (typeof childId !== 'string' || childId === '') throw new HttpError(400, 'Choose a child')
  if (!Array.isArray(taskIds) || !taskIds.every((id) => TEST_TASK_IDS.includes(id))) {
    throw new HttpError(400, 'Unknown task')
  }

  return withLock(`test-start:${adultId}`, async () => {
    if (await TestSession.exists({ adultId, status: 'active' })) throw new HttpError(409, ACTIVE_SESSION_TAKEN)
    await resetForTester(childIds, childId)
    const session = createTestSession({
      id: `test-${randomUUID()}`,
      testerLabel: testerLabel.trim(),
      adultId,
      childId,
      taskIds,
      now: now.toISOString(),
    })
    const { id, ...fields } = session
    try {
      return plain(await TestSession.create({ ...fields, _id: id }))
    } catch (error) {
      if (isDuplicateKey(error)) throw new HttpError(409, ACTIVE_SESSION_TAKEN)
      throw error
    }
  })
}

export async function getActiveTestSession(adultId) {
  return plain(await TestSession.findOne({ adultId, status: 'active' }))
}

// The session, or null when it doesn't exist or belongs to another grown-up.
export async function getTestSession(adultId, id) {
  return plain(await TestSession.findOne({ _id: id, adultId }))
}

// Newest first: [{ id, testerLabel, childId, status, startedAt, endedAt }].
export async function listTestSessions(adultId) {
  const sessions = await TestSession.find({ adultId })
    .select({ testerLabel: 1, childId: 1, status: 1, startedAt: 1, endedAt: 1 })
    .sort({ startedAt: -1 })
  return sessions.map((session) => {
    const { id, testerLabel, childId, status, startedAt, endedAt } = plain(session)
    return { id, testerLabel, childId, status, startedAt, endedAt }
  })
}

// Facilitator actions the browser may send. The server sets every time, and a note's
// task and screen come from the session itself.
function parseTestSessionAction(input) {
  const type = isPlainObject(input) ? input.type : undefined
  switch (type) {
    case 'START_TASK':
    case 'NEXT_TASK':
      return { type }
    case 'SET_OUTCOME':
      if (!OUTCOME_IDS.includes(input.outcome)) throw new HttpError(400, 'Unknown outcome')
      return { type, outcome: input.outcome }
    case 'ADD_NOTE': {
      const text = typeof input.text === 'string' ? input.text.trim() : ''
      if (text === '') throw new HttpError(400, 'Please type a note')
      if (text.length > MAX_NOTE_LENGTH) {
        throw new HttpError(400, `Notes can be up to ${MAX_NOTE_LENGTH} characters`)
      }
      if (!SEVERITY_VALUES.includes(input.severity)) throw new HttpError(400, 'Severity must be 1, 2 or 3')
      return { type, text, severity: input.severity }
    }
    default:
      throw new HttpError(400, 'Unknown action')
  }
}

// Runs the reducer on a stored session and saves it if it changed. An ended session
// never changes. Resolves with the session, or null if there is no such session.
async function updateTestSession(filter, action) {
  const session = plain(await TestSession.findOne(filter))
  if (!session) return null
  return withLock(`test:${session.id}`, async () => {
    const current = await getTestSession(session.adultId, session.id)
    const resolved = typeof action === 'function' ? action(current) : action
    const next = testSessionReducer(current, resolved)
    if (next === current) return current

    const { id, ...fields } = next
    const doc = new TestSession({ ...fields, _id: id })
    await doc.validate()
    const saved = await TestSession.findOneAndReplace(
      { _id: id, status: 'active' },
      doc.toObject(),
      { returnDocument: 'after' },
    )
    return saved ? plain(saved) : getTestSession(session.adultId, id)
  })
}

export async function applyTestSessionAction(adultId, id, input, { now = new Date() } = {}) {
  const action = { ...parseTestSessionAction(input), now: now.toISOString() }
  return updateTestSession({ _id: id, adultId }, (session) =>
    action.type === 'ADD_NOTE' ? { ...action, screen: getCurrentScreen(session) } : action,
  )
}

// Events from the tester's window: { type: 'route', path } or { type: 'signal', signal,
// roundId? }. Only these fields are read, so typed text can't reach the log.
function parseTestEvent(input) {
  const type = isPlainObject(input) ? input.type : undefined
  if (type === 'route') {
    const { path } = input
    if (typeof path !== 'string' || !path.startsWith('/') || path.length > 300) {
      throw new HttpError(400, 'path must be an app path')
    }
    const { screen, roundId } = describeRoute(path)
    return { type, path, screen, ...(roundId ? { roundId } : {}) }
  }
  if (type === 'signal') {
    if (!EVENT_SIGNALS.includes(input.signal)) throw new HttpError(400, 'Unknown signal')
    const event = { type, signal: input.signal }
    if (input.roundId !== undefined) {
      if (typeof input.roundId !== 'string' || input.roundId.length > 100) {
        throw new HttpError(400, 'roundId must be a string')
      }
      event.roundId = input.roundId
    }
    return event
  }
  throw new HttpError(400, 'Unknown event')
}

// Logs an event on the grown-up's active session, tagged with its current task.
// Resolves with { logged }: false when no session is active.
export async function logTestSessionEvent(adultId, input, { now = new Date() } = {}) {
  const event = { ...parseTestEvent(input), at: now.toISOString() }
  const session = await updateTestSession({ adultId, status: 'active' }, { type: 'LOG_EVENT', event })
  return { logged: session !== null }
}

export async function endTestSession(adultId, id, { now = new Date() } = {}) {
  return updateTestSession({ _id: id, adultId }, { type: 'END', now: now.toISOString() })
}

// Ends the session, gives the next tester a clean start (see resetForTester), and
// resolves with { session, nextLabel }, or null if there is no such session.
export async function newTesterReset(adultId, id, { childIds, now = new Date() } = {}) {
  const session = await endTestSession(adultId, id, { now })
  if (!session) return null
  await resetForTester(childIds, session.childId)
  return { session, nextLabel: nextTesterLabel(session.testerLabel) }
}
