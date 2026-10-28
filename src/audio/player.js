// Plays the pre-recorded speech clips with Howler.js. `HowlClass` and `howler` are
// injectable so the player can be exercised without real audio.
import { Howl, Howler } from 'howler'
import { AUDIO_BASE } from '../api/config.js'
import { clipName } from './clips.js'

export const CLIP_FORMAT = 'wav'

export function getAudioSupport(howler = Howler) {
  return howler != null && !howler.noAudio ? 'available' : 'unavailable'
}

// Returns play(text): stops whatever clip is playing, then plays the clip for `text`.
// Each clip gets one Howl, made on first use and reused after that. play returns
// false (and does nothing) when audio is unavailable or the text has no clip name.
export function createClipPlayer({ HowlClass = Howl, howler = Howler, baseUrl = AUDIO_BASE } = {}) {
  const sounds = new Map()
  let current = null

  return function play(text) {
    if (getAudioSupport(howler) !== 'available') return false
    const name = clipName(text)
    if (!name) return false
    let sound = sounds.get(name)
    if (!sound) {
      sound = new HowlClass({
        src: [`${baseUrl}/${name}.${CLIP_FORMAT}`],
        format: [CLIP_FORMAT],
        onloaderror: (_id, error) => console.warn(`Could not load the "${name}" clip`, error),
        onplayerror: (_id, error) => console.warn(`Could not play the "${name}" clip`, error),
      })
      sounds.set(name, sound)
    }
    current?.stop()
    sound.play()
    current = sound
    return true
  }
}

export const playClip = createClipPlayer()
