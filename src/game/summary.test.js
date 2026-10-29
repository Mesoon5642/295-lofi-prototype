import { describe, expect, it } from 'vitest'
import { SEED_WORDS } from '../../server/seed/words.js'
import { MATCH_THE_WORD } from '../content/activities.js'
import { createRng } from './random.js'
import { getCurrentQuestion, roundReducer, startRound } from './round.js'
import { needsPractice, recentPracticeWords, summarizeRound } from './summary.js'

// Plays a full round. plan maps a target word to { wrong, hint, audio, note }.
function playRound({ id, seed, startedAt, completedAt, plan = {} }) {
  let r = startRound({
    id,
    childId: 'child-alex',
    activity: MATCH_THE_WORD,
    items: SEED_WORDS,
    now: startedAt,
    rng: createRng(seed),
  })
  for (let i = 0; i < r.questions.length; i += 1) {
    const q = getCurrentQuestion(r)
    const step = plan[q.target] ?? {}
    const wrong = q.options.filter((w) => w !== q.target)
    for (let w = 0; w < (step.wrong ?? 0); w += 1) {
      r = roundReducer(r, { type: 'SELECT', word: wrong[w % 2] })
    }
    if (step.hint) r = roundReducer(r, { type: 'USE_HINT' })
    if (step.audio) r = roundReducer(r, { type: 'USE_AUDIO' })
    r = roundReducer(r, { type: 'SELECT', word: q.target })
    r = step.note
      ? roundReducer(r, { type: 'SAVE_EXPLANATION', text: step.note })
      : roundReducer(r, { type: 'SKIP_EXPLANATION' })
    r = roundReducer(r, { type: 'NEXT', now: completedAt })
  }
  return r
}

describe('needsPractice', () => {
  it('flags questions that took more than one attempt', () => {
    expect(needsPractice({ attempts: 0 })).toBe(false)
    expect(needsPractice({ attempts: 1 })).toBe(false)
    expect(needsPractice({ attempts: 2 })).toBe(true)
    expect(needsPractice({ attempts: 5 })).toBe(true)
  })
})

describe('summarizeRound', () => {
  it('summarizes words, practice words, and hint/audio counts', () => {
    const round = playRound({
      id: 'round-a',
      seed: 11,
      startedAt: '2026-10-20T09:00:00.000Z',
      completedAt: '2026-10-20T09:04:00.000Z',
      plan: {
        cat: { wrong: 1, hint: true, note: '  c for cat ' },
        dog: { wrong: 2, audio: true },
        sun: { audio: true },
      },
    })
    const summary = summarizeRound(round)

    expect(summary).toMatchObject({
      roundId: 'round-a',
      isSample: false,
      startedAt: '2026-10-20T09:00:00.000Z',
      completedAt: '2026-10-20T09:04:00.000Z',
      totalWords: 5,
      hintCount: 1,
      audioCount: 2,
    })
    expect(summary.words.map((w) => w.word)).toEqual(round.questions.map((q) => q.target))
    expect([...summary.practiceWords].sort()).toEqual(['cat', 'dog'])

    const byWord = Object.fromEntries(summary.words.map((w) => [w.word, w]))
    expect(byWord.cat).toMatchObject({
      attempts: 2,
      hintUsed: true,
      audioUsed: false,
      explanation: 'c for cat',
      needsPractice: true,
    })
    expect(byWord.cat.selections).toHaveLength(2)
    expect(byWord.cat.selections.at(-1)).toBe('cat')
    expect(byWord.dog).toMatchObject({ attempts: 3, audioUsed: true, needsPractice: true })
    expect(byWord.sun).toMatchObject({
      attempts: 1,
      selections: ['sun'],
      audioUsed: true,
      explanation: null,
      needsPractice: false,
    })
    expect(Object.keys(byWord.hat).sort()).toEqual(
      ['attempts', 'audioUsed', 'explanation', 'hintUsed', 'needsPractice', 'selections', 'word'],
    )
  })

  it('does not share selection arrays with the round', () => {
    const round = playRound({ id: 'r', seed: 2, startedAt: 'a', completedAt: 'b' })
    const summary = summarizeRound(round)
    expect(summary.words[0].selections).not.toBe(round.questions[0].selections)
    expect(summary.practiceWords).toEqual([])
  })
})

describe('recentPracticeWords', () => {
  const day = (d) => `2026-10-${String(d).padStart(2, '0')}T12:00:00.000Z`
  const oldest = playRound({
    id: 'r1',
    seed: 1,
    startedAt: day(1),
    completedAt: day(1),
    plan: { bus: { wrong: 1 }, hat: { wrong: 1 } },
  })
  const middle = playRound({
    id: 'r2',
    seed: 2,
    startedAt: day(2),
    completedAt: day(2),
    plan: { cat: { wrong: 2 }, dog: { wrong: 1 } },
  })
  const newest = playRound({
    id: 'r3',
    seed: 3,
    startedAt: day(3),
    completedAt: day(3),
    plan: { cat: { wrong: 1 }, sun: { wrong: 1 } },
  })
  const inProgress = roundReducer(
    startRound({
      id: 'r4',
      childId: 'child-alex',
      activity: MATCH_THE_WORD,
      items: SEED_WORDS,
      now: day(4),
      rng: createRng(4),
    }),
    { type: 'SELECT', word: 'nope' },
  )

  it('counts flagged words across completed rounds, sorted by count then alphabetically', () => {
    expect(recentPracticeWords([newest, middle, oldest, inProgress])).toEqual([
      { word: 'cat', roundsNeedingPractice: 2 },
      { word: 'bus', roundsNeedingPractice: 1 },
      { word: 'dog', roundsNeedingPractice: 1 },
      { word: 'hat', roundsNeedingPractice: 1 },
      { word: 'sun', roundsNeedingPractice: 1 },
    ])
  })

  it('only considers the newest `limit` completed rounds', () => {
    expect(recentPracticeWords([newest, middle, oldest], { limit: 1 })).toEqual([
      { word: 'cat', roundsNeedingPractice: 1 },
      { word: 'sun', roundsNeedingPractice: 1 },
    ])
    // Order of input does not matter: newest is chosen by date.
    expect(recentPracticeWords([oldest, middle, newest], { limit: 2 })).toEqual([
      { word: 'cat', roundsNeedingPractice: 2 },
      { word: 'dog', roundsNeedingPractice: 1 },
      { word: 'sun', roundsNeedingPractice: 1 },
    ])
  })

  it('ignores in-progress rounds and handles empty input', () => {
    const q = getCurrentQuestion(inProgress)
    const wrong = q.options.find((w) => w !== q.target)
    let wrongInProgress = roundReducer(inProgress, { type: 'SELECT', word: wrong })
    wrongInProgress = roundReducer(wrongInProgress, { type: 'SELECT', word: q.target })
    expect(needsPractice(getCurrentQuestion(wrongInProgress))).toBe(true)
    expect(recentPracticeWords([wrongInProgress])).toEqual([])
    expect(recentPracticeWords([])).toEqual([])
  })

  it('does not mutate the input array', () => {
    const input = [oldest, newest, middle]
    recentPracticeWords(input)
    expect(input.map((r) => r.id)).toEqual(['r1', 'r3', 'r2'])
  })
})
