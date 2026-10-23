// Deterministic randomness helpers. Pure: no Math.random() except as a default.

// mulberry32: small, fast, deterministic PRNG returning values in [0, 1).
export function createRng(seed) {
  let state = Number(seed) >>> 0
  return function rng() {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Integer in [0, n). Clamped so an rng that returns exactly 1 can't overflow.
export function randomInt(n, rng = Math.random) {
  return Math.min(n - 1, Math.floor(rng() * n))
}

// Fisher-Yates shuffle into a new array; the input is not modified.
export function shuffle(array, rng = Math.random) {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1, rng)
    const tmp = result[i]
    result[i] = result[j]
    result[j] = tmp
  }
  return result
}
