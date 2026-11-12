import { describe, expect, it } from 'vitest'
import { ACTIVITIES, FEEDBACK, MATCH_THE_WORD, PRACTICE_TRICKY_WORDS } from './activities.js'

describe('ACTIVITIES', () => {
  it('lists Match the Word and Tricky Words', () => {
    expect(ACTIVITIES).toEqual([MATCH_THE_WORD, PRACTICE_TRICKY_WORDS])
  })

  it('each activity has 5 questions and a unique id', () => {
    for (const activity of ACTIVITIES) expect(activity.questionCount).toBe(5)
    const ids = ACTIVITIES.map((activity) => activity.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('FEEDBACK', () => {
  it('has the wrong-answer text the screens rely on', () => {
    expect(FEEDBACK.incorrect).toBe("Let's try again")
  })

  it('formats the finished message with the word count', () => {
    expect(FEEDBACK.finished(5)).toBe('You finished 5 words!')
  })
})
