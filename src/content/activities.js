// Activity content: pure data, no logic. Shared by the React app and the server.
// The words and pictures each round uses live in MongoDB (the `words` and `images`
// collections); this file only describes the games themselves.

export const MATCH_THE_WORD = {
  id: 'match-the-word',
  title: 'Match the Word',
  instruction: 'Pick the word that matches the picture.',
  description: 'Look at the picture, then pick the word that matches it.',
  // Image shown on the game's card (an id in the `images` collection).
  pictureId: 'cat',
  questionCount: 5,
}

// A custom Match the Word round built only from words that took more than one try
// in recent rounds. Distractors still come from the full word list.
export const PRACTICE_TRICKY_WORDS = {
  id: 'practice-tricky-words',
  title: 'Tricky Words',
  instruction: MATCH_THE_WORD.instruction,
  description: 'Practice the words that were tricky last time.',
  pictureId: 'dog',
  questionCount: MATCH_THE_WORD.questionCount,
}

export const ACTIVITIES = [MATCH_THE_WORD, PRACTICE_TRICKY_WORDS]

export const FEEDBACK = {
  correct: 'Nice work!',
  incorrect: "Let's try again",
  explanationPrompt: 'Tell us how you chose',
  finished: (count) => `You finished ${count} words!`,
}
