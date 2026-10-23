import { randomInt, shuffle } from './random.js'

export const OPTION_COUNT = 3

// Builds `count` questions. Each item is the target at most once (order shuffled),
// options are the target plus 2 distinct distractors from the other items, and the
// correct-answer position is spread so every position is used once count >= 3.
export function generateQuestions(items, { rng = Math.random, count = items.length } = {}) {
  const words = [...new Set(items.map((item) => item.word))]
  if (words.length < OPTION_COUNT) {
    throw new Error(`generateQuestions needs at least ${OPTION_COUNT} distinct words`)
  }

  const total = Math.max(0, Math.min(count, items.length))
  const targets = shuffle(items, rng).slice(0, total)

  // Cycle positions 0,1,2 from a random start, then shuffle, so each is used.
  const offset = randomInt(OPTION_COUNT, rng)
  const positions = shuffle(
    Array.from({ length: total }, (_, i) => (i + offset) % OPTION_COUNT),
    rng,
  )

  return targets.map((item, i) => {
    const pool = words.filter((word) => word !== item.word)
    const options = shuffle(pool, rng).slice(0, OPTION_COUNT - 1)
    options.splice(positions[i], 0, item.word)
    return {
      target: item.word,
      pictureId: item.pictureId,
      hint: item.hint,
      options,
    }
  })
}
