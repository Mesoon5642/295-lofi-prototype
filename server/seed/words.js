// The starting word list and its pictures, written to the `words` and `images`
// collections when the database is seeded. Each picture is an SVG file in ./images/.

export const SEED_IMAGES = [
  { id: 'cat', file: 'cat.svg', contentType: 'image/svg+xml', description: 'An orange cat' },
  { id: 'sun', file: 'sun.svg', contentType: 'image/svg+xml', description: 'A smiling yellow sun' },
  { id: 'dog', file: 'dog.svg', contentType: 'image/svg+xml', description: 'A brown dog' },
  { id: 'hat', file: 'hat.svg', contentType: 'image/svg+xml', description: 'A blue top hat' },
  { id: 'bus', file: 'bus.svg', contentType: 'image/svg+xml', description: 'A yellow school bus' },
]

// `pictureId` is the id of the word's image.
export const SEED_WORDS = [
  { word: 'cat', pictureId: 'cat', hint: 'Look at the first letter. This word starts with c.' },
  { word: 'sun', pictureId: 'sun', hint: 'Look at the first letter. This word starts with s.' },
  { word: 'dog', pictureId: 'dog', hint: 'Look at the first letter. This word starts with d.' },
  { word: 'hat', pictureId: 'hat', hint: 'Look at the first letter. This word starts with h.' },
  { word: 'bus', pictureId: 'bus', hint: 'Look at the first letter. This word starts with b.' },
]
