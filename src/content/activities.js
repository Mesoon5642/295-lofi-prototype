// Activity content: pure data, no logic.

export const SAMPLE_CHILD = { id: 'child-alex', name: 'Alex' }

export const MATCH_THE_WORD = {
  id: 'match-the-word',
  title: 'Match the Word',
  instruction: 'Pick the word that matches the picture.',
  questionCount: 5,
  // pictureId keys into the inline SVG set in components/Picture.jsx.
  items: [
    { word: 'cat', pictureId: 'cat', hint: 'Look at the first letter. This word starts with c.' },
    { word: 'sun', pictureId: 'sun', hint: 'Look at the first letter. This word starts with s.' },
    { word: 'dog', pictureId: 'dog', hint: 'Look at the first letter. This word starts with d.' },
    { word: 'hat', pictureId: 'hat', hint: 'Look at the first letter. This word starts with h.' },
    { word: 'bus', pictureId: 'bus', hint: 'Look at the first letter. This word starts with b.' },
  ],
}

export const ACTIVITIES = [MATCH_THE_WORD]

export const FEEDBACK = {
  correct: 'Nice work!',
  incorrect: "Let's try again",
  explanationPrompt: 'Tell us how you chose',
  finished: (count) => `You finished ${count} words!`,
}
