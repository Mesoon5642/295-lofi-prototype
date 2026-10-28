// Names for the pre-recorded speech clips. Pure functions, shared by the app (which
// plays clips with Howler.js) and server/scripts/generateAudio.js (which makes them).

// 'Pick the word that matches the picture.' -> 'pick-the-word-that-matches-the-picture'
export function clipName(text) {
  if (typeof text !== 'string') return ''
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// What the Hear button on a game card says.
export function describeActivity(activity) {
  return `${activity.title}. ${activity.description}`
}

// Every phrase the app can speak for these activities, with no duplicates (by clip name).
export function spokenPhrases(activities) {
  const phrases = new Map()
  const add = (text) => {
    const name = clipName(text)
    if (name && !phrases.has(name)) phrases.set(name, text)
  }
  for (const activity of activities) {
    add(describeActivity(activity))
    add(activity.instruction)
    for (const item of activity.items) add(item.word)
  }
  return [...phrases].map(([name, text]) => ({ name, text }))
}
