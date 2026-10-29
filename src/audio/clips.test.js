import { describe, expect, it } from 'vitest'
import { SEED_WORDS } from '../../server/seed/words.js'
import { ACTIVITIES, MATCH_THE_WORD, PRACTICE_TRICKY_WORDS } from '../content/activities.js'
import { clipName, describeActivity, spokenPhrases } from './clips.js'

describe('clipName', () => {
  it('makes a lowercase, dash-separated file name', () => {
    expect(clipName('cat')).toBe('cat')
    expect(clipName('Pick the word that matches the picture.')).toBe(
      'pick-the-word-that-matches-the-picture',
    )
    expect(clipName('  Tricky Words. Practice!  ')).toBe('tricky-words-practice')
    expect(clipName('Café')).toBe('cafe')
  })

  it('returns an empty name for text with nothing to say', () => {
    expect(clipName('')).toBe('')
    expect(clipName('?!')).toBe('')
    expect(clipName(null)).toBe('')
  })
})

describe('spokenPhrases', () => {
  it('covers each game description, instruction, and word once', () => {
    const phrases = spokenPhrases(ACTIVITIES, SEED_WORDS)
    const texts = phrases.map((p) => p.text)
    expect(texts).toContain(describeActivity(MATCH_THE_WORD))
    expect(texts).toContain(describeActivity(PRACTICE_TRICKY_WORDS))
    expect(texts).toContain(MATCH_THE_WORD.instruction)
    for (const { word } of SEED_WORDS) expect(texts).toContain(word)
    const names = phrases.map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)
    for (const { name, text } of phrases) expect(name).toBe(clipName(text))
  })
})
