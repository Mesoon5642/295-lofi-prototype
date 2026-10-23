import { describe, expect, it } from 'vitest'
import { createRng, randomInt, shuffle } from './random.js'

describe('createRng', () => {
  it('returns the same sequence for the same seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    const seqA = Array.from({ length: 20 }, () => a())
    const seqB = Array.from({ length: 20 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('returns different sequences for different seeds', () => {
    const a = createRng(1)
    const b = createRng(2)
    expect(Array.from({ length: 5 }, () => a())).not.toEqual(Array.from({ length: 5 }, () => b()))
  })

  it('produces values in [0, 1) across many seeds', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const rng = createRng(seed)
      for (let i = 0; i < 50; i += 1) {
        const value = rng()
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThan(1)
      }
    }
  })
})

describe('randomInt', () => {
  it('stays within [0, n) even for an rng returning 1', () => {
    expect(randomInt(3, () => 1)).toBe(2)
    expect(randomInt(3, () => 0)).toBe(0)
    const rng = createRng(7)
    for (let i = 0; i < 500; i += 1) {
      const n = randomInt(5, rng)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(5)
      expect(Number.isInteger(n)).toBe(true)
    }
  })
})

describe('shuffle', () => {
  it('returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5]
    for (let seed = 0; seed < 50; seed += 1) {
      const result = shuffle(input, createRng(seed))
      expect(input).toEqual([1, 2, 3, 4, 5])
      expect(result).not.toBe(input)
      expect([...result].sort()).toEqual([1, 2, 3, 4, 5])
    }
  })

  it('is deterministic for a seeded rng', () => {
    expect(shuffle([1, 2, 3, 4, 5], createRng(9))).toEqual(shuffle([1, 2, 3, 4, 5], createRng(9)))
  })
})
