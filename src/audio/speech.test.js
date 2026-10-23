import { describe, expect, it } from 'vitest'
import { SPEECH_RATE, getSpeechSupport, speak } from './speech.js'

// A small hand-written stand-in for the browser's speech API.
function createFakeWindow() {
  const calls = []
  class FakeUtterance {
    constructor(text) {
      this.text = text
      this.rate = 1
    }
  }
  return {
    calls,
    SpeechSynthesisUtterance: FakeUtterance,
    speechSynthesis: {
      cancel() {
        calls.push({ type: 'cancel' })
      },
      speak(utterance) {
        calls.push({ type: 'speak', text: utterance.text, rate: utterance.rate })
      },
    },
  }
}

describe('getSpeechSupport', () => {
  it('reports unavailable in jsdom', () => {
    expect(getSpeechSupport()).toBe('unavailable')
  })

  it('reports available when speechSynthesis and the utterance constructor exist', () => {
    expect(getSpeechSupport(createFakeWindow())).toBe('available')
  })

  it('reports unavailable when either piece is missing', () => {
    expect(getSpeechSupport({ speechSynthesis: {} })).toBe('unavailable')
    expect(getSpeechSupport({ SpeechSynthesisUtterance: class {} })).toBe('unavailable')
    expect(getSpeechSupport({ speechSynthesis: {}, SpeechSynthesisUtterance: 'nope' })).toBe(
      'unavailable',
    )
    expect(getSpeechSupport(null)).toBe('unavailable')
  })
})

describe('speak', () => {
  it('returns false and does nothing in jsdom', () => {
    expect(speak('cat')).toBe(false)
  })

  it('cancels current speech, then speaks slowly', () => {
    const win = createFakeWindow()
    expect(speak('cat', win)).toBe(true)
    expect(win.calls).toEqual([
      { type: 'cancel' },
      { type: 'speak', text: 'cat', rate: SPEECH_RATE },
    ])
    expect(SPEECH_RATE).toBe(0.85)
  })

  it('does not speak empty text', () => {
    const win = createFakeWindow()
    expect(speak('   ', win)).toBe(false)
    expect(win.calls).toEqual([])
  })
})
