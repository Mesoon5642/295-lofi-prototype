import { beforeEach, describe, expect, it } from 'vitest'
import { MATCH_THE_WORD, SAMPLE_CHILD } from '../content/activities.js'
import {
  STORAGE_KEY,
  createRoundId,
  ensureSeeded,
  getChildProfile,
  getInProgressRound,
  getRound,
  getRounds,
  getSettings,
  resetDemoData,
  saveRound,
  saveSettings,
} from './progressRepository.js'
import { SEED_ROUNDS, createSeedState } from './seedData.js'

const WORDS = MATCH_THE_WORD.items.map((item) => item.word)

function readStored() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY))
}

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
    childId: SAMPLE_CHILD.id,
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

beforeEach(() => {
  localStorage.clear()
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
      expect(round.childId).toBe(SAMPLE_CHILD.id)
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

  it('createSeedState returns an independent copy each time', () => {
    const a = createSeedState()
    a.rounds[0].questions[0].target = 'changed'
    expect(createSeedState().rounds[0].questions[0].target).toBe(SEED_ROUNDS[0].questions[0].target)
  })
})

describe('ensureSeeded', () => {
  it('seeds Alex and the sample rounds when storage is empty', () => {
    ensureSeeded()
    const stored = readStored()
    expect(stored.version).toBe(1)
    expect(stored.profiles).toEqual([{ id: 'child-alex', name: 'Alex' }])
    expect(stored.rounds).toEqual(SEED_ROUNDS)
    expect(stored.settings).toEqual({ textSize: 'standard', font: 'standard', wordAudio: 'on' })
    expect(getChildProfile()).toEqual({ id: 'child-alex', name: 'Alex' })
    expect(getChildProfile('child-nobody')).toBeNull()
  })

  it('is safe to call repeatedly without duplicating or wiping data', () => {
    ensureSeeded()
    saveRound(makeRound())
    ensureSeeded()
    ensureSeeded()
    const stored = readStored()
    expect(stored.profiles).toHaveLength(1)
    expect(stored.rounds).toHaveLength(SEED_ROUNDS.length + 1)
  })

  it('reseeds when the stored JSON is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    ensureSeeded()
    expect(readStored().rounds).toEqual(SEED_ROUNDS)
  })

  it('reseeds when the stored data has the wrong shape', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, rounds: 'nope' }))
    expect(getRounds()).toHaveLength(SEED_ROUNDS.length)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(null))
    expect(getRounds()).toHaveLength(SEED_ROUNDS.length)
  })

  it('is called implicitly by the other functions', () => {
    expect(getRounds()).toHaveLength(SEED_ROUNDS.length)
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  })
})

describe('createRoundId', () => {
  it('returns unique round- prefixed ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createRoundId()))
    expect(ids.size).toBe(50)
    for (const id of ids) expect(id.startsWith('round-')).toBe(true)
  })
})

describe('saveRound', () => {
  it('keeps sample rounds distinguishable from real ones', () => {
    saveRound(makeCompletedRound())
    const rounds = getRounds({ status: 'completed' })
    expect(rounds.filter((r) => r.isSample)).toHaveLength(SEED_ROUNDS.length)
    const real = rounds.filter((r) => !r.isSample)
    expect(real).toHaveLength(1)
    expect(real[0].id).toBe('round-test-1')
    expect(real[0].isSample).toBe(false)
  })

  it('updates an in-progress round in place without duplicating it', () => {
    saveRound(makeRound())
    const updated = makeRound({ currentIndex: 1 })
    updated.questions[0] = solved('cat')
    const returned = saveRound(updated)
    expect(returned).toEqual(updated)

    const matches = readStored().rounds.filter((r) => r.id === 'round-test-1')
    expect(matches).toHaveLength(1)
    expect(matches[0].currentIndex).toBe(1)

    const resumed = getInProgressRound(SAMPLE_CHILD.id, MATCH_THE_WORD.id)
    expect(resumed).toEqual(updated)
    expect(getRound('round-test-1')).toEqual(updated)
  })

  it('returns null when there is no in-progress round', () => {
    expect(getInProgressRound(SAMPLE_CHILD.id, MATCH_THE_WORD.id)).toBeNull()
    saveRound(makeCompletedRound())
    expect(getInProgressRound(SAMPLE_CHILD.id, MATCH_THE_WORD.id)).toBeNull()
    saveRound(makeRound({ id: 'round-other-child', childId: 'child-other' }))
    expect(getInProgressRound(SAMPLE_CHILD.id, MATCH_THE_WORD.id)).toBeNull()
    saveRound(makeRound({ id: 'round-other-activity', activityId: 'other-activity' }))
    expect(getInProgressRound(SAMPLE_CHILD.id, MATCH_THE_WORD.id)).toBeNull()
  })

  it('returns the most recent in-progress round', () => {
    saveRound(makeRound({ id: 'round-old', startedAt: '2026-10-21T09:00:00.000Z' }))
    saveRound(makeRound({ id: 'round-new', startedAt: '2026-10-22T09:00:00.000Z' }))
    saveRound(makeRound({ id: 'round-mid', startedAt: '2026-10-21T12:00:00.000Z' }))
    expect(getInProgressRound(SAMPLE_CHILD.id, MATCH_THE_WORD.id).id).toBe('round-new')
  })

  it('persists completed rounds and counts them once despite repeated saves', () => {
    const completed = makeCompletedRound()
    saveRound(makeRound())
    saveRound(completed)
    saveRound(completed)
    saveRound(completed)

    // Re-read straight from localStorage to prove it persisted.
    const stored = readStored().rounds.filter((r) => r.id === completed.id)
    expect(stored).toEqual([completed])

    const real = getRounds({ status: 'completed' }).filter((r) => !r.isSample)
    expect(real).toHaveLength(1)
  })

  it('never downgrades a completed round or changes its completedAt', () => {
    const completed = makeCompletedRound()
    saveRound(completed)

    const stale = makeRound({ currentIndex: 4 })
    const afterStale = saveRound(stale)
    expect(afterStale).toEqual(completed)
    expect(getRound(completed.id).status).toBe('completed')

    const recompleted = makeCompletedRound({ completedAt: '2026-10-22T11:00:00.000Z' })
    const afterRecomplete = saveRound(recompleted)
    expect(afterRecomplete.completedAt).toBe('2026-10-22T10:05:00.000Z')
    expect(getRound(completed.id)).toEqual(completed)
    expect(getInProgressRound(SAMPLE_CHILD.id, MATCH_THE_WORD.id)).toBeNull()
  })

  it('rejects rounds without an id', () => {
    expect(() => saveRound({})).toThrow(TypeError)
    expect(() => saveRound(null)).toThrow(TypeError)
  })
})

describe('getRounds', () => {
  it('orders newest first by completedAt, falling back to startedAt', () => {
    saveRound(makeCompletedRound({ id: 'round-a', completedAt: '2026-10-21T08:00:00.000Z' }))
    saveRound(makeRound({ id: 'round-b', startedAt: '2026-10-22T09:00:00.000Z' }))
    saveRound(makeCompletedRound({ id: 'round-c', completedAt: '2026-10-22T12:00:00.000Z' }))
    const ids = getRounds().map((r) => r.id)
    expect(ids).toEqual([
      'round-c',
      'round-b',
      'round-a',
      'sample-round-3',
      'sample-round-2',
      'sample-round-1',
    ])
  })

  it('filters by status and childId', () => {
    saveRound(makeRound({ id: 'round-in-progress' }))
    saveRound(makeCompletedRound({ id: 'round-done' }))
    saveRound(makeCompletedRound({ id: 'round-other', childId: 'child-other' }))

    expect(getRounds({ status: 'in_progress' }).map((r) => r.id)).toEqual(['round-in-progress'])
    expect(getRounds({ status: 'completed' })).toHaveLength(SEED_ROUNDS.length + 2)
    expect(getRounds({ childId: 'child-other' }).map((r) => r.id)).toEqual(['round-other'])
    const alexDone = getRounds({ childId: SAMPLE_CHILD.id, status: 'completed' })
    expect(alexDone.map((r) => r.id)).toEqual([
      'round-done',
      'sample-round-3',
      'sample-round-2',
      'sample-round-1',
    ])
  })
})

describe('copies', () => {
  it('returned objects can be mutated without changing the store', () => {
    const round = makeRound()
    const saved = saveRound(round)
    saved.questions[0].selections.push('cat')
    round.questions[0].attempts = 99

    const fetched = getRound(round.id)
    expect(fetched.questions[0].selections).toEqual([])
    expect(fetched.questions[0].attempts).toBe(0)
    fetched.status = 'completed'

    const list = getRounds()
    list[0].questions = []
    list.pop()

    const inProgress = getInProgressRound(SAMPLE_CHILD.id, MATCH_THE_WORD.id)
    inProgress.paused = true

    const profile = getChildProfile()
    profile.name = 'Bob'

    const settings = getSettings()
    settings.textSize = 'large'
    settings.font = 'dyslexic'
    settings.wordAudio = 'off'

    expect(getRound(round.id)).toEqual(makeRound())
    expect(getRounds()).toHaveLength(SEED_ROUNDS.length + 1)
    expect(getChildProfile().name).toBe('Alex')
    expect(getSettings()).toEqual({ textSize: 'standard', font: 'standard', wordAudio: 'on' })
    expect(getRound('sample-round-1')).toEqual(SEED_ROUNDS[0])
  })
})

describe('settings', () => {
  it('defaults to standard text size, the standard font, and word audio on', () => {
    expect(getSettings()).toEqual({ textSize: 'standard', font: 'standard', wordAudio: 'on' })
  })

  it('merges and persists saved settings', () => {
    expect(saveSettings({ textSize: 'large' })).toEqual({ textSize: 'large', font: 'standard', wordAudio: 'on' })
    expect(getSettings()).toEqual({ textSize: 'large', font: 'standard', wordAudio: 'on' })
    expect(readStored().settings).toEqual({ textSize: 'large', font: 'standard', wordAudio: 'on' })
    expect(saveSettings({ font: 'dyslexic' })).toEqual({ textSize: 'large', font: 'dyslexic', wordAudio: 'on' })
    expect(readStored().settings).toEqual({ textSize: 'large', font: 'dyslexic', wordAudio: 'on' })
    expect(saveSettings({})).toEqual({ textSize: 'large', font: 'dyslexic', wordAudio: 'on' })
  })

  it('saves word audio on and off', () => {
    expect(saveSettings({ wordAudio: 'off' })).toEqual({
      textSize: 'standard',
      font: 'standard',
      wordAudio: 'off',
    })
    expect(readStored().settings.wordAudio).toBe('off')
    expect(saveSettings({ wordAudio: 'on' }).wordAudio).toBe('on')
  })

  it('ignores invalid settings values', () => {
    saveSettings({ textSize: 'large', font: 'dyslexic' })
    expect(saveSettings({ textSize: 'huge', font: 'comic', wordAudio: 'loud' })).toEqual({
      textSize: 'large',
      font: 'dyslexic',
      wordAudio: 'on',
    })
    expect(getSettings()).toEqual({ textSize: 'large', font: 'dyslexic', wordAudio: 'on' })
  })

  it('fills in defaults for settings saved before font and word audio existed', () => {
    const state = createSeedState()
    state.settings = { textSize: 'large' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    expect(getSettings()).toEqual({ textSize: 'large', font: 'standard', wordAudio: 'on' })
  })
})

describe('resetDemoData', () => {
  it('removes real rounds, restores seed rounds exactly, and keeps settings', () => {
    saveSettings({ textSize: 'large', font: 'dyslexic' })
    saveRound(makeRound({ id: 'round-x' }))
    saveRound(makeCompletedRound({ id: 'round-y' }))

    resetDemoData()

    expect(getRounds()).toHaveLength(SEED_ROUNDS.length)
    expect(readStored().rounds).toEqual(SEED_ROUNDS)
    expect(getRound('round-x')).toBeNull()
    expect(getRound('round-y')).toBeNull()
    expect(getInProgressRound(SAMPLE_CHILD.id, MATCH_THE_WORD.id)).toBeNull()
    expect(getChildProfile()).toEqual({ id: 'child-alex', name: 'Alex' })
    expect(getSettings()).toEqual({ textSize: 'large', font: 'dyslexic', wordAudio: 'on' })
  })

  it('works on empty or corrupt storage', () => {
    resetDemoData()
    expect(readStored().rounds).toEqual(SEED_ROUNDS)
    localStorage.setItem(STORAGE_KEY, 'garbage')
    resetDemoData()
    expect(readStored().rounds).toEqual(SEED_ROUNDS)
    expect(getSettings()).toEqual({ textSize: 'standard', font: 'standard', wordAudio: 'on' })
  })
})
