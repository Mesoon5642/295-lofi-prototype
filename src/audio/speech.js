// Thin wrapper around the Web Speech API. `win` is injectable so the
// 'available' branch can be exercised without a real browser.

export const SPEECH_RATE = 0.85

export function getSpeechSupport(win = globalThis) {
  return win != null &&
    win.speechSynthesis != null &&
    typeof win.SpeechSynthesisUtterance === 'function'
    ? 'available'
    : 'unavailable'
}

export function speak(text, win = globalThis) {
  if (getSpeechSupport(win) !== 'available') return false
  if (typeof text !== 'string' || text.trim() === '') return false
  try {
    win.speechSynthesis.cancel()
    const utterance = new win.SpeechSynthesisUtterance(text)
    utterance.rate = SPEECH_RATE
    win.speechSynthesis.speak(utterance)
    return true
  } catch {
    return false
  }
}
