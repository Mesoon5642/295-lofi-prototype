// Runs async work one at a time per key (e.g. one round), so two requests can't read
// the same round and both write. In-process only: with more than one API process,
// replace this with a database-level check (e.g. a revision field on each round).
const tails = new Map()

export function withLock(key, task) {
  const previous = tails.get(key) ?? Promise.resolve()
  const result = previous.then(task)
  const tail = result.catch(() => {})
  tails.set(key, tail)
  tail.then(() => {
    if (tails.get(key) === tail) tails.delete(key)
  })
  return result
}
