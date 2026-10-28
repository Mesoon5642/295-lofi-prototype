// @vitest-environment node
import mongoose from 'mongoose'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MATCH_THE_WORD, PRACTICE_TRICKY_WORDS } from '../src/content/activities.js'
import { DEFAULT_SETTINGS } from '../src/content/settings.js'
import { connectDatabase, disconnectDatabase } from './db.js'
import { Adult, ChildProfile, Round } from './models/index.js'
import {
  checkParentPassword,
  getChildProfile,
  getRound,
  getRounds,
  getSettings,
  resetDemoData,
  saveRound,
  saveSettings,
  signIn,
} from './repository.js'
import { reseed, seedIfEmpty } from './seed/seed.js'
import { SEED_ADULTS, SEED_CHILD, SEED_ROUNDS } from './seed/seedData.js'

const WORDS = MATCH_THE_WORD.items.map((item) => item.word)
const CHILD_ID = SEED_CHILD.id

function makeQuestion(target, overrides = {}) {
  const item = MATCH_THE_WORD.items.find((i) => i.word === target)
  const others = WORDS.filter((w) => w !== target)
  return {
    target,
    pictureId: item.pictureId,
    hint: item.hint,
    options: [others[0], target, others[1]],
    selections: [],
    attempts: 0,
    correct: false,
    hintUsed: false,
    audioUsed: false,
    explanation: null,
    explanationDone: false,
    ...overrides,
  }
}

function makeRound(overrides = {}) {
  return {
    id: 'round-test-1',
    childId: CHILD_ID,
    activityId: MATCH_THE_WORD.id,
    startedAt: '2026-10-22T10:00:00.000Z',
    completedAt: null,
    status: 'in_progress',
    isSample: false,
    currentIndex: 0,
    paused: false,
    questions: WORDS.map((w) => makeQuestion(w)),
    ...overrides,
  }
}

function solved(target) {
  return makeQuestion(target, {
    selections: [target],
    attempts: 1,
    correct: true,
    explanationDone: true,
  })
}

function makeCompletedRound(overrides = {}) {
  return makeRound({
    status: 'completed',
    completedAt: '2026-10-22T10:05:00.000Z',
    currentIndex: 4,
    questions: WORDS.map(solved),
    ...overrides,
  })
}

async function inProgress(childId = CHILD_ID, activityId = MATCH_THE_WORD.id) {
  const [latest] = await getRounds({ childId, activityId, status: 'in_progress' })
  return latest ?? null
}

// A throwaway embedded MongoDB for this file, never MONGODB_URI.
beforeAll(async () => {
  await connectDatabase({ uri: null, persist: false })
})

afterAll(async () => {
  await disconnectDatabase()
})

beforeEach(async () => {
  await reseed()
})

describe('seed data', () => {
  it('has 2-3 well-formed completed sample rounds for Alex in the past', () => {
    expect(SEED_ROUNDS.length).toBeGreaterThanOrEqual(2)
    expect(SEED_ROUNDS.length).toBeLessThanOrEqual(3)
    const ids = new Set()
    let multiAttempt = 0
    let notes = 0
    let hints = 0
    let audio = 0
    for (const round of SEED_ROUNDS) {
      ids.add(round.id)
      expect(round.id.startsWith('sample-')).toBe(true)
      expect(round.isSample).toBe(true)
      expect(round.status).toBe('completed')
      expect(round.childId).toBe(CHILD_ID)
      expect(round.activityId).toBe(MATCH_THE_WORD.id)
      expect(round.currentIndex).toBe(4)
      expect(round.paused).toBe(false)
      expect(round.completedAt < '2026-10-22').toBe(true)
      expect(round.startedAt <= round.completedAt).toBe(true)
      expect(round.questions).toHaveLength(5)
      expect(round.questions.map((q) => q.target).sort()).toEqual([...WORDS].sort())
      for (const q of round.questions) {
        const item = MATCH_THE_WORD.items.find((i) => i.word === q.target)
        expect(q.pictureId).toBe(item.pictureId)
        expect(q.hint).toBe(item.hint)
        expect(q.options).toHaveLength(3)
        expect(new Set(q.options).size).toBe(3)
        expect(q.options).toContain(q.target)
        for (const option of q.options) expect(WORDS).toContain(option)
        expect(q.selections.at(-1)).toBe(q.target)
        expect(q.selections.filter((s) => s === q.target)).toHaveLength(1)
        for (const s of q.selections) expect(q.options).toContain(s)
        expect(q.attempts).toBe(q.selections.length)
        expect(q.correct).toBe(true)
        expect(q.explanationDone).toBe(true)
        if (q.attempts > 1) multiAttempt += 1
        if (q.explanation !== null) {
          expect(q.explanation.trim()).toBe(q.explanation)
          expect(q.explanation.length).toBeGreaterThan(0)
          notes += 1
        }
        if (q.hintUsed) hints += 1
        if (q.audioUsed) audio += 1
      }
    }
    expect(ids.size).toBe(SEED_ROUNDS.length)
    expect(multiAttempt).toBeGreaterThan(0)
    expect(notes).toBeGreaterThan(0)
    expect(hints).toBeGreaterThan(0)
    expect(audio).toBeGreaterThan(0)
  })

  it('every sample round passes the Round schema', async () => {
    for (const { id, ...round } of SEED_ROUNDS) {
      await expect(new Round({ ...round, _id: id }).validate()).resolves.toBeUndefined()
    }
  })
})

describe('seeding', () => {
  it('writes Alex, the grown-up account, and the sample rounds exactly', async () => {
    expect(await getChildProfile(CHILD_ID)).toEqual({ id: CHILD_ID, name: 'Alex' })
    expect(await getChildProfile('child-nobody')).toBeNull()
    expect(await getSettings(CHILD_ID)).toEqual(DEFAULT_SETTINGS)
    expect(await getRounds()).toEqual([...SEED_ROUNDS].reverse())
    expect(await Adult.countDocuments()).toBe(SEED_ADULTS.length)
  })

  it('stores only a hash of the grown-up password and never returns it', async () => {
    const stored = await Adult.findOne({ username: 'admin' }).lean()
    expect(stored.passwordHash).toMatch(/^[0-9a-f]{128}$/)
    expect(stored).not.toHaveProperty('password')
    expect(Object.keys(stored).sort()).toEqual(
      ['__v', '_id', 'childIds', 'passwordHash', 'passwordSalt', 'role', 'username'],
    )
    const account = await signIn('admin', 'admin')
    expect(account).toEqual({ id: expect.any(String), username: 'admin', role: 'parent', childIds: [CHILD_ID] })
  })

  it('seedIfEmpty only writes into an empty database', async () => {
    await saveRound(makeRound())
    expect(await seedIfEmpty()).toBe(false)
    expect(await getRound('round-test-1')).not.toBeNull()

    await Promise.all([ChildProfile.deleteMany({}), Adult.deleteMany({}), Round.deleteMany({})])
    expect(await seedIfEmpty()).toBe(true)
    expect(await getRounds()).toHaveLength(SEED_ROUNDS.length)
    expect(await ChildProfile.countDocuments()).toBe(1)
  })

  it('uses the expected collection names', async () => {
    const names = (await mongoose.connection.db.listCollections().toArray()).map((c) => c.name)
    expect(names.sort()).toEqual(['adults', 'childProfiles', 'rounds'])
  })
})

describe('saveRound', () => {
  it('keeps sample rounds distinguishable from real ones', async () => {
    await saveRound(makeCompletedRound())
    const rounds = await getRounds({ status: 'completed' })
    expect(rounds.filter((r) => r.isSample)).toHaveLength(SEED_ROUNDS.length)
    const real = rounds.filter((r) => !r.isSample)
    expect(real).toHaveLength(1)
    expect(real[0].id).toBe('round-test-1')
    expect(real[0].isSample).toBe(false)
  })

  it('returns exactly what was saved, in the same shape', async () => {
    const round = makeRound()
    expect(await saveRound(round)).toEqual(round)
    expect(await getRound(round.id)).toEqual(round)
  })

  it('updates an in-progress round in place without duplicating it', async () => {
    await saveRound(makeRound())
    const updated = makeRound({ currentIndex: 1 })
    updated.questions[0] = solved('cat')
    expect(await saveRound(updated)).toEqual(updated)

    expect(await Round.countDocuments({ _id: 'round-test-1' })).toBe(1)
    expect(await inProgress()).toEqual(updated)
    expect(await getRound('round-test-1')).toEqual(updated)
  })

  it('finds no in-progress round for other children or activities', async () => {
    expect(await inProgress()).toBeNull()
    await saveRound(makeCompletedRound())
    expect(await inProgress()).toBeNull()
    await saveRound(makeRound({ id: 'round-other-child', childId: 'child-other' }))
    expect(await inProgress()).toBeNull()
    await saveRound(makeRound({ id: 'round-practice', activityId: PRACTICE_TRICKY_WORDS.id }))
    expect(await inProgress()).toBeNull()
    expect((await inProgress(CHILD_ID, PRACTICE_TRICKY_WORDS.id)).id).toBe('round-practice')
  })

  it('lists the most recent in-progress round first', async () => {
    await saveRound(makeRound({ id: 'round-old', startedAt: '2026-10-21T09:00:00.000Z' }))
    await saveRound(makeRound({ id: 'round-new', startedAt: '2026-10-22T09:00:00.000Z' }))
    await saveRound(makeRound({ id: 'round-mid', startedAt: '2026-10-21T12:00:00.000Z' }))
    expect((await inProgress()).id).toBe('round-new')
  })

  it('counts a completed round once despite repeated saves', async () => {
    const completed = makeCompletedRound()
    await saveRound(makeRound())
    await saveRound(completed)
    await saveRound(completed)
    await saveRound(completed)
    expect(await Round.countDocuments({ _id: completed.id })).toBe(1)
    expect(await getRound(completed.id)).toEqual(completed)
  })

  it('never downgrades a completed round or changes its completedAt', async () => {
    const completed = makeCompletedRound()
    await saveRound(completed)

    expect(await saveRound(makeRound({ currentIndex: 4 }))).toEqual(completed)
    expect((await getRound(completed.id)).status).toBe('completed')

    const recompleted = makeCompletedRound({ completedAt: '2026-10-22T11:00:00.000Z' })
    expect((await saveRound(recompleted)).completedAt).toBe('2026-10-22T10:05:00.000Z')
    expect(await getRound(completed.id)).toEqual(completed)
    expect(await inProgress()).toBeNull()
  })

  it('rejects rounds without an id', async () => {
    await expect(saveRound({})).rejects.toThrow(TypeError)
    await expect(saveRound(null)).rejects.toThrow(TypeError)
  })

  it('rejects rounds that break the schema and stores nothing', async () => {
    const broken = [
      makeRound({ status: 'finished' }),
      makeRound({ activityId: 'other-activity' }),
      makeRound({ questions: [] }),
      makeRound({ questions: [makeQuestion('cat', { options: ['cat', 'dog'] })] }),
      makeRound({ currentIndex: -1 }),
      makeRound({ childId: undefined }),
    ]
    for (const round of broken) {
      await expect(saveRound(round)).rejects.toThrow(mongoose.Error.ValidationError)
    }
    expect(await getRound('round-test-1')).toBeNull()
  })
})

describe('getRounds', () => {
  it('orders newest first by completedAt, falling back to startedAt', async () => {
    await saveRound(makeCompletedRound({ id: 'round-a', completedAt: '2026-10-21T08:00:00.000Z' }))
    await saveRound(makeRound({ id: 'round-b', startedAt: '2026-10-22T09:00:00.000Z' }))
    await saveRound(makeCompletedRound({ id: 'round-c', completedAt: '2026-10-22T12:00:00.000Z' }))
    expect((await getRounds()).map((r) => r.id)).toEqual([
      'round-c',
      'round-b',
      'round-a',
      'sample-round-3',
      'sample-round-2',
      'sample-round-1',
    ])
  })

  it('filters by status, childId, and activityId', async () => {
    await saveRound(makeRound({ id: 'round-in-progress' }))
    await saveRound(makeCompletedRound({ id: 'round-done' }))
    await saveRound(makeCompletedRound({ id: 'round-other', childId: 'child-other' }))
    await saveRound(
      makeCompletedRound({ id: 'round-practice', activityId: PRACTICE_TRICKY_WORDS.id }),
    )

    expect((await getRounds({ status: 'in_progress' })).map((r) => r.id)).toEqual([
      'round-in-progress',
    ])
    expect(await getRounds({ status: 'completed' })).toHaveLength(SEED_ROUNDS.length + 3)
    expect((await getRounds({ childId: 'child-other' })).map((r) => r.id)).toEqual(['round-other'])
    expect(
      (await getRounds({ activityId: PRACTICE_TRICKY_WORDS.id })).map((r) => r.id),
    ).toEqual(['round-practice'])
    const alexDone = await getRounds({
      childId: CHILD_ID,
      status: 'completed',
      activityId: MATCH_THE_WORD.id,
    })
    expect(alexDone.map((r) => r.id)).toEqual([
      'round-done',
      'sample-round-3',
      'sample-round-2',
      'sample-round-1',
    ])
  })
})

describe('settings', () => {
  it('defaults to standard text, the standard font, word audio on, and the note prompt off', async () => {
    expect(await getSettings(CHILD_ID)).toEqual({
      textSize: 'standard',
      font: 'standard',
      wordAudio: 'on',
      explanations: 'off',
    })
  })

  it('merges and persists saved settings', async () => {
    expect(await saveSettings(CHILD_ID, { textSize: 'large' })).toEqual({
      ...DEFAULT_SETTINGS,
      textSize: 'large',
    })
    expect(await saveSettings(CHILD_ID, { font: 'dyslexic', explanations: 'on' })).toEqual({
      ...DEFAULT_SETTINGS,
      textSize: 'large',
      font: 'dyslexic',
      explanations: 'on',
    })
    const stored = await ChildProfile.findById(CHILD_ID).lean()
    expect(stored.settings).toEqual({
      textSize: 'large',
      font: 'dyslexic',
      wordAudio: 'on',
      explanations: 'on',
    })
    expect(await saveSettings(CHILD_ID, {})).toEqual(await getSettings(CHILD_ID))
  })

  it('ignores invalid values and unknown keys', async () => {
    await saveSettings(CHILD_ID, { textSize: 'large', font: 'dyslexic' })
    const after = await saveSettings(CHILD_ID, {
      textSize: 'huge',
      font: 'comic',
      wordAudio: 'loud',
      explanations: 'maybe',
      name: 'Bob',
    })
    expect(after).toEqual({ ...DEFAULT_SETTINGS, textSize: 'large', font: 'dyslexic' })
    expect((await getChildProfile(CHILD_ID)).name).toBe('Alex')
    expect(await saveSettings(CHILD_ID, 'garbage')).toEqual(after)
  })

  it('fills in defaults for profiles saved before newer settings existed', async () => {
    await ChildProfile.collection.updateOne(
      { _id: CHILD_ID },
      { $set: { settings: { textSize: 'large' } } },
    )
    expect(await getSettings(CHILD_ID)).toEqual({ ...DEFAULT_SETTINGS, textSize: 'large' })
  })

  it('returns null for an unknown child', async () => {
    expect(await getSettings('child-nobody')).toBeNull()
    expect(await saveSettings('child-nobody', { textSize: 'large' })).toBeNull()
  })
})

describe('resetDemoData', () => {
  it('removes real rounds, restores seed rounds exactly, and keeps settings', async () => {
    await saveSettings(CHILD_ID, { textSize: 'large', font: 'dyslexic' })
    await saveRound(makeRound({ id: 'round-x' }))
    await saveRound(makeCompletedRound({ id: 'round-y' }))

    await resetDemoData()

    expect(await getRounds()).toEqual([...SEED_ROUNDS].reverse())
    expect(await getRound('round-x')).toBeNull()
    expect(await inProgress()).toBeNull()
    expect(await getChildProfile(CHILD_ID)).toEqual({ id: CHILD_ID, name: 'Alex' })
    expect(await getSettings(CHILD_ID)).toEqual({
      ...DEFAULT_SETTINGS,
      textSize: 'large',
      font: 'dyslexic',
    })
  })
})

describe('grown-up checks', () => {
  it('signs in with admin / admin, ignoring spaces around the username only', async () => {
    expect(await signIn('admin', 'admin')).not.toBeNull()
    expect(await signIn('  admin ', 'admin')).not.toBeNull()
    expect(await signIn('admin', ' admin')).toBeNull()
  })

  it('rejects wrong, empty, or missing values', async () => {
    expect(await signIn('admin', 'wrong')).toBeNull()
    expect(await signIn('Admin', 'admin')).toBeNull()
    expect(await signIn('', '')).toBeNull()
    expect(await signIn(undefined, undefined)).toBeNull()
    expect(await signIn({ $ne: null }, 'admin')).toBeNull()
  })

  it('accepts only the password of a grown-up linked to the child', async () => {
    expect(await checkParentPassword(CHILD_ID, 'admin')).toBe(true)
    expect(await checkParentPassword(CHILD_ID, ' admin')).toBe(false)
    expect(await checkParentPassword(CHILD_ID, '')).toBe(false)
    expect(await checkParentPassword(CHILD_ID, undefined)).toBe(false)
    expect(await checkParentPassword('child-other', 'admin')).toBe(false)
    expect(await checkParentPassword(undefined, 'admin')).toBe(false)
    expect(await checkParentPassword({ $ne: null }, 'admin')).toBe(false)
  })
})
