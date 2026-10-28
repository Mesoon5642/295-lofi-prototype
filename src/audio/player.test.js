import { describe, expect, it } from 'vitest'
import { CLIP_FORMAT, createClipPlayer, getAudioSupport } from './player.js'

// A small hand-written stand-in for Howler's Howl class.
function createFakeHowler({ noAudio = false } = {}) {
  const calls = []
  class FakeHowl {
    constructor(options) {
      this.src = options.src[0]
      calls.push({ type: 'load', src: this.src, format: options.format })
    }
    play() {
      calls.push({ type: 'play', src: this.src })
    }
    stop() {
      calls.push({ type: 'stop', src: this.src })
    }
  }
  return { calls, HowlClass: FakeHowl, howler: { noAudio } }
}

const BASE = 'http://api.test/audio'

describe('getAudioSupport', () => {
  it('reports available unless Howler says there is no audio', () => {
    expect(getAudioSupport({ noAudio: false })).toBe('available')
    expect(getAudioSupport({ noAudio: true })).toBe('unavailable')
    expect(getAudioSupport(null)).toBe('unavailable')
  })
})

describe('createClipPlayer', () => {
  it('plays the clip named after the text from the API', () => {
    const fake = createFakeHowler()
    const play = createClipPlayer({ ...fake, baseUrl: BASE })
    expect(play('Pick the word that matches the picture.')).toBe(true)
    expect(fake.calls).toEqual([
      {
        type: 'load',
        src: `${BASE}/pick-the-word-that-matches-the-picture.wav`,
        format: [CLIP_FORMAT],
      },
      { type: 'play', src: `${BASE}/pick-the-word-that-matches-the-picture.wav` },
    ])
  })

  it('stops the current clip before playing the next, and reuses loaded clips', () => {
    const fake = createFakeHowler()
    const play = createClipPlayer({ ...fake, baseUrl: BASE })
    play('cat')
    play('dog')
    play('cat')
    expect(fake.calls).toEqual([
      { type: 'load', src: `${BASE}/cat.wav`, format: ['wav'] },
      { type: 'play', src: `${BASE}/cat.wav` },
      { type: 'load', src: `${BASE}/dog.wav`, format: ['wav'] },
      { type: 'stop', src: `${BASE}/cat.wav` },
      { type: 'play', src: `${BASE}/dog.wav` },
      { type: 'stop', src: `${BASE}/dog.wav` },
      { type: 'play', src: `${BASE}/cat.wav` },
    ])
  })

  it('does nothing when audio is unavailable or there is nothing to say', () => {
    const muted = createFakeHowler({ noAudio: true })
    expect(createClipPlayer({ ...muted, baseUrl: BASE })('cat')).toBe(false)
    expect(muted.calls).toEqual([])

    const fake = createFakeHowler()
    const play = createClipPlayer({ ...fake, baseUrl: BASE })
    expect(play('   ')).toBe(false)
    expect(play('?!')).toBe(false)
    expect(play(undefined)).toBe(false)
    expect(fake.calls).toEqual([])
  })
})
