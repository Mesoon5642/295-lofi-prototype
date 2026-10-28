import { describe, expect, it } from 'vitest'
import { ApiError, createQueue, request } from './http.js'

describe('createQueue', () => {
  it('runs tasks one at a time in order, even when later ones are faster', async () => {
    const queue = createQueue()
    const log = []
    const task = (name, ms) => () =>
      new Promise((resolve) => {
        log.push(`start ${name}`)
        setTimeout(() => {
          log.push(`end ${name}`)
          resolve(name)
        }, ms)
      })
    const results = await Promise.all([queue.run(task('a', 20)), queue.run(task('b', 1))])
    expect(results).toEqual(['a', 'b'])
    expect(log).toEqual(['start a', 'end a', 'start b', 'end b'])
  })

  it('keeps going after a failed task, and idle() waits for everything', async () => {
    const queue = createQueue()
    const failed = queue.run(() => Promise.reject(new Error('nope')))
    let ran = false
    queue.run(async () => {
      ran = true
    })
    await expect(failed).rejects.toThrow('nope')
    await queue.idle()
    expect(ran).toBe(true)
  })
})

describe('request', () => {
  it('rejects with status 0 when the server cannot be reached', async () => {
    const error = await request('/api/health', { base: 'http://127.0.0.1:1' }).catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(0)
  })
})
