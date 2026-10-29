// @vitest-environment node
import mongoose from 'mongoose'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MATCH_THE_WORD, PRACTICE_TRICKY_WORDS } from '../src/content/activities.js'
import { DEFAULT_SETTINGS } from '../src/content/settings.js'
import { createRng } from '../src/game/index.js'
import {
  ELEVATED_MS,
  canAccessChild,
  clearFailures,
  findSession,
  isElevated,
  lock,
  signIn,
  signOut,
  unlock,
} from './auth/sessions.js'
import { connectDatabase, disconnectDatabase } from './db.js'
import { Adult, ChildProfile, Image, Round, Session, Word } from './models/index.js'
import {
  applyRoundAction,
  createRound,
  getChild,
  getGames,
  getImage,
  getRound,
  getRounds,
  getTrickyWords,
  listWords,
  resetDemoData,
  saveSettings,
} from './repository.js'
import { reseed, seedIfEmpty } from './seed/seed.js'
import { SEED_ADULTS, SEED_CHILD, SEED_ROUNDS } from './seed/seedData.js'
import { SEED_IMAGES, SEED_WORDS } from './seed/words.js'

const WORDS = SEED_WORDS.map((item) => item.word)
const CHILD_ID = SEED_CHILD.id
const NOW = new Date('2026-10-28T10:00:00.000Z')

// Every word the seed rounds flagged (more than one try), most often first.
const SEED_TRICKY = ['hat', 'cat', 'dog']

async function start(activityId = MATCH_THE_WORD.id, seed = 1) {
  return createRound(CHILD_ID, activityId, { rng: createRng(seed), now: NOW })
}

// Answers every question correctly (and moves on) through the server.
async function finish(roundId) {
  let round = await getRound(roundId)
  for (let i = 0; i < round.questions.length; i += 1) {
    const q = round.questions[round.currentIndex]
    await applyRoundAction(roundId, { type: 'SELECT', word: q.target })
    round = await applyRoundAction(roundId, { type: 'NEXT' }, { now: NOW })
  }
  return round
}

// A throwaway embedded MongoDB for this file, never MONGODB_URI.
beforeAll(async () => {
  await connectDatabase({ uri: null, persist: false })
})

afterAll(async () => {
  await disconnectDatabase()
})

beforeEach(async () => {
  clearFailures()
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
        const item = SEED_WORDS.find((i) => i.word === q.target)
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

  it('every seed word has a seed image', () => {
    const imageIds = SEED_IMAGES.map((image) => image.id)
    for (const word of SEED_WORDS) expect(imageIds).toContain(word.pictureId)
  })
})

describe('seeding', () => {
  it('writes the images, word list, Alex, the grown-up account, and the sample rounds', async () => {
    expect(await listWords()).toEqual([...SEED_WORDS].sort((a, b) => a.word.localeCompare(b.word)))
    expect(await Image.countDocuments()).toBe(SEED_IMAGES.length)
    expect(await getChild(CHILD_ID)).toEqual({ id: CHILD_ID, name: 'Alex', settings: DEFAULT_SETTINGS })
    expect(await getChild('child-nobody')).toBeNull()
    expect(await getRounds()).toEqual([...SEED_ROUNDS].reverse())
    expect(await Adult.countDocuments()).toBe(SEED_ADULTS.length)
  })

  it('stores images as bytes with their type', async () => {
    const cat = await getImage('cat')
    expect(cat.contentType).toBe('image/svg+xml')
    expect(Buffer.isBuffer(cat.data)).toBe(true)
    expect(cat.data.toString('utf8')).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/)
    expect(await getImage('nope')).toBeNull()
  })

  it('stores only a hash of the grown-up password', async () => {
    const stored = await Adult.findOne({ username: 'admin' }).lean()
    expect(stored.passwordHash).toMatch(/^[0-9a-f]{128}$/)
    expect(Object.keys(stored).sort()).toEqual(
      ['__v', '_id', 'childIds', 'passwordHash', 'passwordSalt', 'role', 'username'],
    )
  })

  it('seedIfEmpty only writes into empty parts of the database', async () => {
    await start()
    expect(await seedIfEmpty()).toEqual([])
    expect(await getRounds({ status: 'in_progress' })).toHaveLength(1)

    // A database from before words and images were stored keeps its rounds.
    await Promise.all([Word.deleteMany({}), Image.deleteMany({})])
    expect(await seedIfEmpty()).toEqual(['images', 'words'])
    expect(await listWords()).toHaveLength(SEED_WORDS.length)
    expect(await getRounds({ status: 'in_progress' })).toHaveLength(1)

    const models = [ChildProfile, Adult, Round, Session, Word, Image]
    await Promise.all(models.map((model) => model.deleteMany({})))
    expect(await seedIfEmpty()).toEqual(['images', 'words', 'profiles, accounts, sample rounds'])
    expect(await getRounds()).toHaveLength(SEED_ROUNDS.length)
  })

  it('uses the expected collection names', async () => {
    await signIn('admin', 'admin')
    const names = (await mongoose.connection.db.listCollections().toArray()).map((c) => c.name)
    expect(names.sort()).toEqual(['adults', 'childProfiles', 'images', 'rounds', 'sessions', 'words'])
  })
})

describe('schemas', () => {
  it('reject rounds that break the Round schema', async () => {
    for (const { id, ...round } of SEED_ROUNDS) {
      await expect(new Round({ ...round, _id: id }).validate()).resolves.toBeUndefined()
    }
    const [{ id, ...sample }] = SEED_ROUNDS
    const broken = [
      { ...sample, status: 'finished' },
      { ...sample, activityId: 'other-activity' },
      { ...sample, questions: [] },
      { ...sample, currentIndex: -1 },
    ]
    for (const round of broken) {
      await expect(new Round({ ...round, _id: id }).validate()).rejects.toThrow()
    }
  })

  it('reject words and images that break their schemas', async () => {
    await expect(new Word({ _id: 'Cat 1', hint: 'h', pictureId: 'cat' }).validate()).rejects.toThrow()
    await expect(new Word({ _id: 'ice cream', hint: 'h', pictureId: 'x' }).validate()).resolves.toBeUndefined()
    await expect(
      new Image({ _id: 'x', contentType: 'text/html', data: Buffer.from('<p>') }).validate(),
    ).rejects.toThrow()
    await expect(
      new Image({ _id: 'x', contentType: 'image/png', data: Buffer.alloc(0) }).validate(),
    ).rejects.toThrow()
  })
})

describe('createRound', () => {
  it('builds a fresh Match the Word round from the database word list', async () => {
    const { round, created } = await start()
    expect(created).toBe(true)
    expect(round).toMatchObject({
      childId: CHILD_ID,
      activityId: MATCH_THE_WORD.id,
      startedAt: NOW.toISOString(),
      completedAt: null,
      status: 'in_progress',
      isSample: false,
      currentIndex: 0,
    })
    expect(round.id).toMatch(/^round-[0-9a-f-]{36}$/)
    expect(round.questions.map((q) => q.target).sort()).toEqual([...WORDS].sort())
    for (const q of round.questions) {
      expect(q.hint).toBe(SEED_WORDS.find((w) => w.word === q.target).hint)
    }
    expect(await getRound(round.id)).toEqual(round)
  })

  it('uses words added to the database', async () => {
    await Word.create({ _id: 'pig', hint: 'Starts with p.', pictureId: 'cat' })
    await Word.deleteOne({ _id: 'bus' })
    const { round } = await start()
    const targets = round.questions.map((q) => q.target)
    expect(targets).toContain('pig')
    expect(targets).not.toContain('bus')
  })

  it('returns the in-progress round instead of starting a second one', async () => {
    const first = await start()
    const again = await start(MATCH_THE_WORD.id, 2)
    expect(again).toEqual({ round: first.round, created: false })
    const both = await Promise.all([start(PRACTICE_TRICKY_WORDS.id), start(PRACTICE_TRICKY_WORDS.id)])
    expect(both[0].round.id).toBe(both[1].round.id)
    expect(both.filter((result) => result.created)).toHaveLength(1)
  })

  it('builds Tricky Words rounds from the child’s tricky words', async () => {
    expect(await getTrickyWords(CHILD_ID)).toEqual(SEED_TRICKY)
    const { round } = await start(PRACTICE_TRICKY_WORDS.id)
    expect(round.activityId).toBe(PRACTICE_TRICKY_WORDS.id)
    expect(round.questions.map((q) => q.target).sort()).toEqual([...SEED_TRICKY].sort())
    for (const q of round.questions) expect(q.options).toHaveLength(3)
  })

  it('falls back to Match the Word when there are no tricky words', async () => {
    await Round.deleteMany({})
    const { round } = await start(PRACTICE_TRICKY_WORDS.id)
    expect(round.activityId).toBe(MATCH_THE_WORD.id)
    expect((await start(PRACTICE_TRICKY_WORDS.id)).round.id).toBe(round.id)
  })

  it('rejects unknown activities and too-short word lists', async () => {
    await expect(start('chess')).rejects.toMatchObject({ status: 400 })
    await Word.deleteMany({ _id: { $in: ['cat', 'dog', 'sun'] } })
    await expect(start()).rejects.toMatchObject({ status: 409 })
  })
})

describe('applyRoundAction', () => {
  it('applies the shared reducer and saves the result', async () => {
    const { round } = await start()
    const q = round.questions[0]
    const wrong = q.options.find((w) => w !== q.target)
    await applyRoundAction(round.id, { type: 'USE_HINT' })
    const after = await applyRoundAction(round.id, { type: 'SELECT', word: wrong })
    expect(after.questions[0]).toMatchObject({ selections: [wrong], attempts: 1, correct: false, hintUsed: true })
    expect(await getRound(round.id)).toEqual(after)
  })

  it('sets the completion time on the server and never changes a completed round', async () => {
    const { round } = await start()
    const done = await finish(round.id)
    expect(done.status).toBe('completed')
    expect(done.completedAt).toBe(NOW.toISOString())

    const later = new Date('2026-10-29T00:00:00.000Z')
    for (const action of [{ type: 'NEXT' }, { type: 'PAUSE' }, { type: 'USE_HINT' }]) {
      expect(await applyRoundAction(round.id, action, { now: later })).toEqual(done)
    }
    expect(await getRound(round.id)).toEqual(done)
  })

  it('applies concurrent actions one at a time', async () => {
    const { round } = await start()
    const wrong = round.questions[0].options.filter((w) => w !== round.questions[0].target)
    await Promise.all(wrong.map((word) => applyRoundAction(round.id, { type: 'SELECT', word })))
    expect((await getRound(round.id)).questions[0].attempts).toBe(2)
  })

  it('rejects unknown or malformed actions', async () => {
    const { round } = await start()
    const bad = [null, {}, { type: 'WIN' }, { type: 'SELECT' }, { type: 'SELECT', word: 3 }]
    for (const action of bad) {
      await expect(applyRoundAction(round.id, action)).rejects.toMatchObject({ status: 400 })
    }
  })

  it('rejects notes longer than the schema allows', async () => {
    const { round } = await start()
    await applyRoundAction(round.id, { type: 'SELECT', word: round.questions[0].target })
    await expect(
      applyRoundAction(round.id, { type: 'SAVE_EXPLANATION', text: 'x'.repeat(201) }),
    ).rejects.toThrow(mongoose.Error.ValidationError)
  })

  it('returns null for an unknown round', async () => {
    expect(await applyRoundAction('round-nope', { type: 'PAUSE' })).toBeNull()
  })
})

describe('getGames and getRounds', () => {
  it('reports tricky words and each game’s in-progress round', async () => {
    expect(await getGames(CHILD_ID)).toEqual({
      trickyWords: SEED_TRICKY,
      inProgress: { [MATCH_THE_WORD.id]: null, [PRACTICE_TRICKY_WORDS.id]: null },
    })
    const { round } = await start()
    expect((await getGames(CHILD_ID)).inProgress[MATCH_THE_WORD.id]).toBe(round.id)
  })

  it('only counts tricky words still in the word list', async () => {
    await Word.deleteOne({ _id: 'hat' })
    expect(await getTrickyWords(CHILD_ID)).toEqual(['cat', 'dog'])
  })

  it('orders newest first and filters', async () => {
    const { round } = await start()
    expect((await getRounds()).map((r) => r.id)).toEqual([
      round.id,
      'sample-round-3',
      'sample-round-2',
      'sample-round-1',
    ])
    expect((await getRounds({ status: 'in_progress' })).map((r) => r.id)).toEqual([round.id])
    expect(await getRounds({ childId: 'child-other' })).toEqual([])
    expect(await getRounds({ activityId: PRACTICE_TRICKY_WORDS.id })).toEqual([])
  })
})

describe('settings', () => {
  it('merges and persists saved settings', async () => {
    expect(await saveSettings(CHILD_ID, { textSize: 'large', explanations: 'on' })).toEqual({
      ...DEFAULT_SETTINGS,
      textSize: 'large',
      explanations: 'on',
    })
    expect((await getChild(CHILD_ID)).settings.textSize).toBe('large')
  })

  it('ignores invalid values and unknown keys', async () => {
    const after = await saveSettings(CHILD_ID, { textSize: 'huge', font: 'comic', name: 'Bob' })
    expect(after).toEqual(DEFAULT_SETTINGS)
    expect((await getChild(CHILD_ID)).name).toBe('Alex')
    expect(await saveSettings(CHILD_ID, 'garbage')).toEqual(DEFAULT_SETTINGS)
  })

  it('fills in defaults for profiles saved before newer settings existed', async () => {
    await ChildProfile.collection.updateOne({ _id: CHILD_ID }, { $set: { settings: { textSize: 'large' } } })
    expect((await getChild(CHILD_ID)).settings).toEqual({ ...DEFAULT_SETTINGS, textSize: 'large' })
  })

  it('returns null for an unknown child', async () => {
    expect(await saveSettings('child-nobody', { textSize: 'large' })).toBeNull()
  })
})

describe('resetDemoData', () => {
  it('removes real rounds, restores seed rounds exactly, and keeps settings and words', async () => {
    await saveSettings(CHILD_ID, { textSize: 'large' })
    await start()
    await resetDemoData()
    expect(await getRounds()).toEqual([...SEED_ROUNDS].reverse())
    expect((await getChild(CHILD_ID)).settings.textSize).toBe('large')
    expect(await listWords()).toHaveLength(SEED_WORDS.length)
  })
})

describe('sessions', () => {
  it('signs in with admin / admin and finds the session by its token', async () => {
    const { token, view } = await signIn(' admin ', 'admin')
    expect(view).toEqual({
      adult: { username: 'admin', role: 'parent' },
      children: [{ id: CHILD_ID, name: 'Alex' }],
      activeChildId: null,
      elevated: true,
    })
    const auth = await findSession(token)
    expect(auth.adult.username).toBe('admin')
    expect(canAccessChild(auth, CHILD_ID)).toBe(true)
    expect(canAccessChild(auth, 'child-other')).toBe(false)
    expect(canAccessChild(auth, undefined)).toBe(false)
  })

  it('stores only a hash of the session token', async () => {
    const { token } = await signIn('admin', 'admin')
    const [stored] = await Session.find().lean()
    expect(stored._id).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(stored)).not.toContain(token)
  })

  it('rejects wrong, empty, or missing credentials', async () => {
    const wrong = [
      ['admin', 'wrong'],
      ['Admin', 'admin'],
      ['admin', ' admin'],
      ['', ''],
      [undefined, undefined],
      [{ $ne: null }, 'admin'],
    ]
    for (const [username, password] of wrong) {
      await expect(signIn(username, password)).rejects.toMatchObject({ status: 401 })
    }
    expect(await Session.countDocuments()).toBe(0)
  })

  it('locks a username out after five wrong passwords', async () => {
    for (let i = 0; i < 5; i += 1) {
      await expect(signIn('admin', 'nope')).rejects.toMatchObject({ status: 401 })
    }
    await expect(signIn('admin', 'admin')).rejects.toMatchObject({ status: 429 })
  })

  it('finds nothing for unknown, expired, or signed-out tokens', async () => {
    expect(await findSession('nope')).toBeNull()
    expect(await findSession(undefined)).toBeNull()
    const { token } = await signIn('admin', 'admin')
    await Session.updateMany({}, { expiresAt: new Date(Date.now() - 1000) })
    expect(await findSession(token)).toBeNull()

    const second = await signIn('admin', 'admin')
    await signOut(await findSession(second.token))
    expect(await findSession(second.token)).toBeNull()
  })

  it('starts unlocked, and re-unlocks with the password for a limited time', async () => {
    const { token } = await signIn('admin', 'admin')
    expect(isElevated(await findSession(token))).toBe(true)
    await lock(await findSession(token))
    const auth = await findSession(token)
    expect(isElevated(auth)).toBe(false)
    await expect(unlock(auth, 'wrong')).rejects.toMatchObject({ status: 401 })
    expect((await unlock(auth, 'admin')).elevated).toBe(true)

    const reloaded = await findSession(token)
    expect(isElevated(reloaded)).toBe(true)
    const left = reloaded.session.elevatedUntil - Date.now()
    expect(left).toBeGreaterThan(ELEVATED_MS - 5000)
    expect(left).toBeLessThanOrEqual(ELEVATED_MS)

    expect((await lock(reloaded)).elevated).toBe(false)
    expect(isElevated(await findSession(token))).toBe(false)
  })
})
