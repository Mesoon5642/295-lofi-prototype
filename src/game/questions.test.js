import { describe, expect, it } from 'vitest'
import { SEED_WORDS } from '../../server/seed/words.js'
import { generateQuestions } from './questions.js'
import { createRng } from './random.js'

const ITEMS = SEED_WORDS
const WORDS = ITEMS.map((item) => item.word)
const SEEDS = Array.from({ length: 300 }, (_, i) => i)

describe('generateQuestions', () => {
  it('builds one question per item by default with picture and hint copied', () => {
    const questions = generateQuestions(ITEMS, { rng: createRng(1) })
    expect(questions).toHaveLength(ITEMS.length)
    for (const q of questions) {
      const item = ITEMS.find((i) => i.word === q.target)
      expect(q.pictureId).toBe(item.pictureId)
      expect(q.hint).toBe(item.hint)
      expect(Object.keys(q).sort()).toEqual(['hint', 'options', 'pictureId', 'target'])
    }
  })

  it('gives 3 unique options from the word set that include the target', () => {
    for (const seed of SEEDS) {
      for (const q of generateQuestions(ITEMS, { rng: createRng(seed), count: 5 })) {
        expect(q.options).toHaveLength(3)
        expect(new Set(q.options).size).toBe(3)
        expect(q.options).toContain(q.target)
        for (const option of q.options) expect(WORDS).toContain(option)
      }
    }
  })

  it('uses each word as the target exactly once', () => {
    for (const seed of SEEDS) {
      const targets = generateQuestions(ITEMS, { rng: createRng(seed), count: 5 }).map(
        (q) => q.target,
      )
      expect([...targets].sort()).toEqual([...WORDS].sort())
    }
  })

  it('uses every correct-answer position at least once in a 5-question round', () => {
    for (const seed of SEEDS) {
      const questions = generateQuestions(ITEMS, { rng: createRng(seed), count: 5 })
      const positions = new Set(questions.map((q) => q.options.indexOf(q.target)))
      expect(positions).toEqual(new Set([0, 1, 2]))
    }
  })

  it('varies target order across seeds', () => {
    const orders = new Set(
      SEEDS.map((seed) =>
        generateQuestions(ITEMS, { rng: createRng(seed) })
          .map((q) => q.target)
          .join(','),
      ),
    )
    expect(orders.size).toBeGreaterThan(10)
  })

  it('returns the same output for the same seed', () => {
    for (const seed of [0, 5, 123, 99999]) {
      expect(generateQuestions(ITEMS, { rng: createRng(seed) })).toEqual(
        generateQuestions(ITEMS, { rng: createRng(seed) }),
      )
    }
  })

  it('respects count and never exceeds the number of items', () => {
    expect(generateQuestions(ITEMS, { rng: createRng(3), count: 3 })).toHaveLength(3)
    expect(generateQuestions(ITEMS, { rng: createRng(3), count: 50 })).toHaveLength(5)
    for (const seed of SEEDS) {
      const questions = generateQuestions(ITEMS, { rng: createRng(seed), count: 3 })
      expect(new Set(questions.map((q) => q.target)).size).toBe(3)
      expect(new Set(questions.map((q) => q.options.indexOf(q.target)))).toEqual(
        new Set([0, 1, 2]),
      )
    }
  })

  it('does not mutate the items', () => {
    const copy = JSON.parse(JSON.stringify(ITEMS))
    generateQuestions(ITEMS, { rng: createRng(4) })
    expect(ITEMS).toEqual(copy)
  })

  it('works with the default Math.random rng', () => {
    const questions = generateQuestions(ITEMS)
    expect(questions).toHaveLength(5)
    expect(new Set(questions.map((q) => q.options.indexOf(q.target)))).toEqual(new Set([0, 1, 2]))
  })

  it('limits targets to the given words but draws distractors from every item', () => {
    for (const seed of SEEDS) {
      const questions = generateQuestions(ITEMS, {
        rng: createRng(seed),
        count: 5,
        targets: ['dog', 'bus'],
      })
      expect(questions.map((q) => q.target).sort()).toEqual(['bus', 'dog'])
      for (const q of questions) {
        expect(q.options).toHaveLength(3)
        expect(new Set(q.options).size).toBe(3)
        expect(q.options).toContain(q.target)
        for (const option of q.options) expect(WORDS).toContain(option)
      }
    }
  })

  it('builds a single question when only one target word is given', () => {
    const questions = generateQuestions(ITEMS, { rng: createRng(2), targets: ['hat'] })
    expect(questions).toHaveLength(1)
    expect(questions[0].target).toBe('hat')
    expect(questions[0].options).toHaveLength(3)
  })

  it('ignores target words that are not in the items', () => {
    expect(generateQuestions(ITEMS, { rng: createRng(2), targets: ['zebra'] })).toEqual([])
  })

  it('throws when there are fewer than 3 distinct words', () => {
    expect(() => generateQuestions(ITEMS.slice(0, 2), { rng: createRng(1) })).toThrow()
  })
})
