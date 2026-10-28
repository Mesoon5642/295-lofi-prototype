// Progress repository: the ONLY server module that reads or writes MongoDB data
// (besides seeding). Every function is async and returns plain JSON-safe objects in
// the shapes described in docs/ARCHITECTURE.md, so routes can send them as-is.

import { DEFAULT_SETTINGS, SETTING_VALUES } from '../src/content/settings.js'
import { verifyPassword } from './auth/passwords.js'
import { Adult, ChildProfile, Round } from './models/index.js'
import { SEED_ROUNDS } from './seed/seedData.js'

const DUPLICATE_KEY = 11000

// JSON round trip turns Dates into ISO strings, matching what the client sends.
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

// Profiles and settings

export async function getChildProfile(childId) {
  const child = await ChildProfile.findById(childId)
  return child ? { id: child.id, name: child.name } : null
}

export async function getSettings(childId) {
  const child = await ChildProfile.findById(childId)
  return child ? { ...DEFAULT_SETTINGS, ...plain(child.settings) } : null
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

// Rounds

// Upserts by id. Idempotent completion: once the stored copy is completed it always
// wins (never downgraded, completedAt never changes), so repeat saves are harmless.
export async function saveRound(round) {
  if (!isPlainObject(round) || typeof round.id !== 'string' || round.id === '') {
    throw new TypeError('saveRound requires a round with a string id')
  }
  const { id, ...fields } = round
  const doc = new Round({ ...fields, _id: id })
  await doc.validate()
  const replacement = doc.toObject()

  try {
    const saved = await Round.findOneAndReplace(
      { _id: id, status: { $ne: 'completed' } },
      replacement,
      { upsert: true, returnDocument: 'after' },
    )
    return plain(saved)
  } catch (error) {
    // The filter skipped a completed round, so the upsert hit its id: keep the stored one.
    if (error?.code === DUPLICATE_KEY) return getRound(id)
    throw error
  }
}

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

// Removes every round and restores the sample rounds. Profiles, accounts, and
// settings are kept.
export async function resetDemoData() {
  await Round.deleteMany({})
  await Round.insertMany(SEED_ROUNDS.map(({ id, ...round }) => ({ ...round, _id: id })))
}

// Grown-ups

// Sign-in for the parent/teacher view. Returns the account (no password data) or null.
export async function signIn(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string') return null
  const adult = await Adult.findOne({ username: username.trim() })
  if (!adult || !(await verifyPassword(password, adult))) return null
  return plain(adult)
}

// The password check behind the child's Settings button: true if any grown-up
// linked to this child has that password.
export async function checkParentPassword(childId, password) {
  if (typeof childId !== 'string' || typeof password !== 'string') return false
  const adults = await Adult.find({ childIds: childId })
  for (const adult of adults) {
    if (await verifyPassword(password, adult)) return true
  }
  return false
}
