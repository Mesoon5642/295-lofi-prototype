import { describe, expect, it } from 'vitest'
import { SEED_WORDS } from '../../server/seed/words.js'
import { MATCH_THE_WORD } from '../content/activities.js'
import { generateQuestions } from './questions.js'
import { createRng } from './random.js'
import {
  createRound,
  getCompletedCount,
  getCurrentQuestion,
  getFeedback,
  isRoundComplete,
  roundReducer,
  startRound,
} from './round.js'

const START = '2026-10-22T10:00:00.000Z'
const END = '2026-10-22T10:05:00.000Z'

function newRound(seed = 1) {
  return startRound({
    id: `round-${seed}`,
    childId: 'child-alex',
    activity: MATCH_THE_WORD,
    items: SEED_WORDS,
    now: START,
    rng: createRng(seed),
  })
}

function wrongWords(round) {
  const q = getCurrentQuestion(round)
  return q.options.filter((w) => w !== q.target)
}

function selectCorrect(round) {
  return roundReducer(round, { type: 'SELECT', word: getCurrentQuestion(round).target })
}

// Answers every question correctly (with `wrongFirst` wrong picks first) and hits NEXT.
function playAll(round, { wrongFirst = 0, now = END } = {}) {
  let r = round
  for (let i = 0; i < r.questions.length; i += 1) {
    for (let w = 0; w < wrongFirst; w += 1) {
      r = roundReducer(r, { type: 'SELECT', word: wrongWords(r)[w % 2] })
    }
    r = selectCorrect(r)
    r = roundReducer(r, { type: 'NEXT', now })
  }
  return r
}

describe('createRound / startRound', () => {
  it('builds a fresh in-progress round with zeroed tracking fields', () => {
    const round = newRound()
    expect(round).toMatchObject({
      id: 'round-1',
      childId: 'child-alex',
      activityId: 'match-the-word',
      startedAt: START,
      completedAt: null,
      status: 'in_progress',
      isSample: false,
      currentIndex: 0,
      paused: false,
    })
    expect(round.questions).toHaveLength(MATCH_THE_WORD.questionCount)
    for (const q of round.questions) {
      expect(q).toMatchObject({
        selections: [],
        attempts: 0,
        correct: false,
        hintUsed: false,
        audioUsed: false,
        explanation: null,
        explanationDone: false,
      })
    }
  })

  it('startRound is deterministic for a seed and matches createRound(generateQuestions)', () => {
    const questions = generateQuestions(SEED_WORDS, { rng: createRng(8), count: 5 })
    const manual = createRound({
      id: 'round-8',
      childId: 'child-alex',
      activityId: MATCH_THE_WORD.id,
      questions,
      now: START,
    })
    expect(newRound(8)).toEqual(manual)
  })

  it('does not share option arrays with the generated questions', () => {
    const questions = generateQuestions(SEED_WORDS, { rng: createRng(2) })
    const round = createRound({ id: 'r', childId: 'c', activityId: 'a', questions, now: START })
    expect(round.questions[0].options).not.toBe(questions[0].options)
    expect(round.questions[0].options).toEqual(questions[0].options)
  })
})

describe('SELECT', () => {
  it('wrong answers increment attempts, record selections in order, and keep the question open', () => {
    const round = newRound()
    const [w1, w2] = wrongWords(round)
    const r1 = roundReducer(round, { type: 'SELECT', word: w1 })
    const r2 = roundReducer(r1, { type: 'SELECT', word: w2 })
    const r3 = roundReducer(r2, { type: 'SELECT', word: w1 })
    const q = getCurrentQuestion(r3)
    expect(q.selections).toEqual([w1, w2, w1])
    expect(q.attempts).toBe(3)
    expect(q.correct).toBe(false)
    expect(r3.currentIndex).toBe(0)
    expect(getFeedback(q)).toBe('incorrect')
  })

  it('does not mutate the input round', () => {
    const round = newRound()
    const snapshot = structuredClone(round)
    roundReducer(round, { type: 'SELECT', word: wrongWords(round)[0] })
    selectCorrect(round)
    expect(round).toEqual(snapshot)
  })

  it('correct answer locks the question: later selects return the same reference', () => {
    const round = newRound()
    const wrong = roundReducer(round, { type: 'SELECT', word: wrongWords(round)[0] })
    const locked = selectCorrect(wrong)
    const q = getCurrentQuestion(locked)
    expect(q.correct).toBe(true)
    expect(q.attempts).toBe(2)
    expect(q.selections).toEqual([wrongWords(round)[0], q.target])
    expect(getFeedback(q)).toBe('correct')

    expect(roundReducer(locked, { type: 'SELECT', word: q.target })).toBe(locked)
    for (const w of wrongWords(locked)) {
      expect(roundReducer(locked, { type: 'SELECT', word: w })).toBe(locked)
    }
    expect(getCurrentQuestion(locked).attempts).toBe(2)
  })

  it('ignores words that are not among the options', () => {
    const round = newRound()
    expect(roundReducer(round, { type: 'SELECT', word: 'zebra' })).toBe(round)
    expect(roundReducer(round, { type: 'SELECT' })).toBe(round)
  })

  it('leaves other questions untouched (structural sharing)', () => {
    const round = newRound()
    const next = selectCorrect(round)
    for (let i = 1; i < round.questions.length; i += 1) {
      expect(next.questions[i]).toBe(round.questions[i])
    }
  })
})

describe('USE_HINT / USE_AUDIO', () => {
  it('records hint and audio use without affecting attempts or completion', () => {
    const round = newRound()
    const hinted = roundReducer(round, { type: 'USE_HINT' })
    const heard = roundReducer(hinted, { type: 'USE_AUDIO' })
    const q = getCurrentQuestion(heard)
    expect(q.hintUsed).toBe(true)
    expect(q.audioUsed).toBe(true)
    expect(q.attempts).toBe(0)
    expect(q.selections).toEqual([])
    expect(q.correct).toBe(false)
    expect(getCompletedCount(heard)).toBe(0)
    expect(getFeedback(q)).toBe(null)
    expect(roundReducer(heard, { type: 'NEXT', now: END })).toBe(heard)
  })

  it('repeat use returns the same reference', () => {
    const hinted = roundReducer(newRound(), { type: 'USE_HINT' })
    expect(roundReducer(hinted, { type: 'USE_HINT' })).toBe(hinted)
    const heard = roundReducer(hinted, { type: 'USE_AUDIO' })
    expect(roundReducer(heard, { type: 'USE_AUDIO' })).toBe(heard)
  })

  it('still records hint/audio after the question is correct', () => {
    const correct = selectCorrect(newRound())
    const after = roundReducer(roundReducer(correct, { type: 'USE_HINT' }), { type: 'USE_AUDIO' })
    expect(getCurrentQuestion(after)).toMatchObject({ hintUsed: true, audioUsed: true, attempts: 1 })
  })

  it('applies to the current question only', () => {
    const round = roundReducer(selectCorrect(newRound()), { type: 'NEXT', now: END })
    const hinted = roundReducer(round, { type: 'USE_HINT' })
    expect(hinted.questions[0].hintUsed).toBe(false)
    expect(hinted.questions[1].hintUsed).toBe(true)
  })
})

describe('PAUSE / CONTINUE', () => {
  it('PAUSE then CONTINUE deep-equals the original', () => {
    const mid = roundReducer(newRound(), { type: 'SELECT', word: wrongWords(newRound())[0] })
    const paused = roundReducer(mid, { type: 'PAUSE' })
    expect(paused.paused).toBe(true)
    expect(paused).not.toBe(mid)
    const resumed = roundReducer(paused, { type: 'CONTINUE' })
    expect(resumed).toEqual(mid)
  })

  it('ignores SELECT, NEXT, USE_HINT, USE_AUDIO and explanation actions while paused', () => {
    const round = newRound()
    const paused = roundReducer(round, { type: 'PAUSE' })
    expect(roundReducer(paused, { type: 'SELECT', word: wrongWords(round)[0] })).toBe(paused)
    expect(roundReducer(paused, { type: 'SELECT', word: getCurrentQuestion(round).target })).toBe(
      paused,
    )
    expect(roundReducer(paused, { type: 'USE_HINT' })).toBe(paused)
    expect(roundReducer(paused, { type: 'USE_AUDIO' })).toBe(paused)

    const correctPaused = roundReducer(selectCorrect(round), { type: 'PAUSE' })
    expect(roundReducer(correctPaused, { type: 'NEXT', now: END })).toBe(correctPaused)
    expect(roundReducer(correctPaused, { type: 'SAVE_EXPLANATION', text: 'hi' })).toBe(
      correctPaused,
    )
    expect(roundReducer(correctPaused, { type: 'SKIP_EXPLANATION' })).toBe(correctPaused)
  })

  it('redundant PAUSE / CONTINUE return the same reference', () => {
    const round = newRound()
    expect(roundReducer(round, { type: 'CONTINUE' })).toBe(round)
    const paused = roundReducer(round, { type: 'PAUSE' })
    expect(roundReducer(paused, { type: 'PAUSE' })).toBe(paused)
  })
})

describe('NEXT and completion', () => {
  it('is ignored before a correct answer', () => {
    const round = newRound()
    expect(roundReducer(round, { type: 'NEXT', now: END })).toBe(round)
    const wrong = roundReducer(round, { type: 'SELECT', word: wrongWords(round)[0] })
    expect(roundReducer(wrong, { type: 'NEXT', now: END })).toBe(wrong)
  })

  it('advances one question at a time and completes only after the final NEXT', () => {
    let r = newRound()
    for (let i = 0; i < 5; i += 1) {
      expect(r.currentIndex).toBe(i)
      expect(isRoundComplete(r)).toBe(false)
      r = selectCorrect(r)
      expect(getCompletedCount(r)).toBe(i + 1)
      if (i === 4) {
        // All five correct but no final NEXT yet.
        expect(isRoundComplete(r)).toBe(false)
        expect(r.completedAt).toBe(null)
      }
      r = roundReducer(r, { type: 'NEXT', now: END })
    }
    expect(isRoundComplete(r)).toBe(true)
    expect(r.status).toBe('completed')
    expect(r.completedAt).toBe(END)
    expect(r.currentIndex).toBe(4)
    expect(r.startedAt).toBe(START)
  })

  it('is a no-op on a completed round, and so are other actions', () => {
    const done = playAll(newRound())
    expect(roundReducer(done, { type: 'NEXT', now: '2030-01-01T00:00:00.000Z' })).toBe(done)
    expect(roundReducer(done, { type: 'SELECT', word: getCurrentQuestion(done).target })).toBe(done)
    expect(roundReducer(done, { type: 'USE_HINT' })).toBe(done)
    expect(roundReducer(done, { type: 'USE_AUDIO' })).toBe(done)
    expect(roundReducer(done, { type: 'SAVE_EXPLANATION', text: 'late' })).toBe(done)
    expect(roundReducer(done, { type: 'SKIP_EXPLANATION' })).toBe(done)
    expect(roundReducer(done, { type: 'PAUSE' })).toBe(done)
  })

  it('final NEXT sets completedAt to its own now and stays on the last index', () => {
    let r = newRound()
    for (let i = 0; i < 4; i += 1) r = roundReducer(selectCorrect(r), { type: 'NEXT', now: START })
    const last = selectCorrect(r)
    expect(last.currentIndex).toBe(4)
    const finalNow = '2026-10-22T10:07:30.000Z'
    const done = roundReducer(last, { type: 'NEXT', now: finalNow })
    expect(done.status).toBe('completed')
    expect(done.completedAt).toBe(finalNow)
    expect(done.currentIndex).toBe(4)
    expect(roundReducer(done, { type: 'NEXT', now: END })).toBe(done)
  })

  it('unknown actions return the same reference', () => {
    const round = newRound()
    expect(roundReducer(round, { type: 'NOPE' })).toBe(round)
    expect(roundReducer(round, {})).toBe(round)
  })
})

describe('retries and completed count', () => {
  it('never counts more than the correctly answered questions, across many seeds', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const rng = createRng(seed + 1000)
      let r = newRound(seed)
      let correctSoFar = 0
      while (!isRoundComplete(r)) {
        const q = getCurrentQuestion(r)
        // Random action stream, including many retries.
        const roll = rng()
        if (roll < 0.5) {
          const word = q.options[Math.floor(rng() * 3)]
          const wasCorrect = q.correct
          r = roundReducer(r, { type: 'SELECT', word })
          if (!wasCorrect && word === q.target) correctSoFar += 1
        } else if (roll < 0.6) {
          r = roundReducer(r, { type: 'USE_HINT' })
        } else if (roll < 0.7) {
          r = roundReducer(r, { type: 'PAUSE' })
          r = roundReducer(r, { type: 'SELECT', word: q.target })
          r = roundReducer(r, { type: 'CONTINUE' })
        } else {
          r = roundReducer(r, { type: 'NEXT', now: END })
        }
        expect(getCompletedCount(r)).toBe(correctSoFar)
        expect(getCompletedCount(r)).toBeLessThanOrEqual(r.currentIndex + 1)
        for (const question of r.questions) {
          expect(question.attempts).toBe(question.selections.length)
        }
      }
      expect(getCompletedCount(r)).toBe(5)
      expect(r.questions.filter((q) => q.correct)).toHaveLength(5)
      for (const q of r.questions) {
        expect(q.selections.at(-1)).toBe(q.target)
        expect(q.selections.filter((w) => w === q.target)).toHaveLength(1)
      }
    }
  })

  it('a completed round with retries has exactly 5 correct questions', () => {
    const done = playAll(newRound(3), { wrongFirst: 2 })
    expect(isRoundComplete(done)).toBe(true)
    expect(getCompletedCount(done)).toBe(5)
    for (const q of done.questions) expect(q.attempts).toBe(3)
  })
})

describe('explanations', () => {
  it('SAVE_EXPLANATION saves trimmed text and marks done', () => {
    const correct = selectCorrect(newRound())
    const saved = roundReducer(correct, { type: 'SAVE_EXPLANATION', text: '  It starts with c  ' })
    expect(getCurrentQuestion(saved).explanation).toBe('It starts with c')
    expect(getCurrentQuestion(saved).explanationDone).toBe(true)
    expect(roundReducer(saved, { type: 'SAVE_EXPLANATION', text: 'again' })).toBe(saved)
    expect(roundReducer(saved, { type: 'SKIP_EXPLANATION' })).toBe(saved)
  })

  it('empty or whitespace text saves nothing but marks done', () => {
    const correct = selectCorrect(newRound())
    for (const text of ['', '   ', '\n\t ', undefined]) {
      const r = roundReducer(correct, { type: 'SAVE_EXPLANATION', text })
      expect(getCurrentQuestion(r).explanation).toBe(null)
      expect(getCurrentQuestion(r).explanationDone).toBe(true)
    }
  })

  it('SKIP_EXPLANATION saves nothing and marks done', () => {
    const correct = selectCorrect(newRound())
    const skipped = roundReducer(correct, { type: 'SKIP_EXPLANATION' })
    expect(getCurrentQuestion(skipped).explanation).toBe(null)
    expect(getCurrentQuestion(skipped).explanationDone).toBe(true)
    expect(roundReducer(skipped, { type: 'SAVE_EXPLANATION', text: 'late' })).toBe(skipped)
  })

  it('neither is allowed before the question is correct', () => {
    const round = newRound()
    const wrong = roundReducer(round, { type: 'SELECT', word: wrongWords(round)[0] })
    for (const r of [round, wrong]) {
      expect(roundReducer(r, { type: 'SAVE_EXPLANATION', text: 'guess' })).toBe(r)
      expect(roundReducer(r, { type: 'SKIP_EXPLANATION' })).toBe(r)
    }
  })

  it('explanations do not affect attempts or completion', () => {
    const correct = selectCorrect(newRound())
    const saved = roundReducer(correct, { type: 'SAVE_EXPLANATION', text: 'because' })
    expect(getCurrentQuestion(saved).attempts).toBe(1)
    expect(getCompletedCount(saved)).toBe(1)
    expect(roundReducer(saved, { type: 'NEXT', now: END }).currentIndex).toBe(1)
  })
})

describe('getFeedback', () => {
  it('maps question state to feedback', () => {
    expect(getFeedback({ attempts: 0, correct: false })).toBe(null)
    expect(getFeedback({ attempts: 2, correct: false })).toBe('incorrect')
    expect(getFeedback({ attempts: 2, correct: true })).toBe('correct')
    expect(getFeedback(undefined)).toBe(null)
  })
})
