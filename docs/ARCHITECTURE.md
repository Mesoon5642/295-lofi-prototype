# Match the Word: architecture and module contracts

Stack: Vite + React 19, plain JavaScript (ES modules, `.js` / `.jsx`), plain CSS, Vitest + jsdom, oxlint.
No router or state library. No TypeScript. No extra runtime dependencies.

```
src/
  content/activities.js      pure data (SAMPLE_CHILD, MATCH_THE_WORD, ACTIVITIES, FEEDBACK)
  game/                      pure functions + reducer; no React, DOM, or storage
    random.js                createRng(seed)
    questions.js             generateQuestions(items, { rng, count })
    round.js                 createRound, roundReducer, selectors
    summary.js               summarizeRound, needsPractice, recentPracticeWords
  storage/                   the ONLY code that touches localStorage
    progressRepository.js
    seedData.js
  audio/speech.js            getSpeechSupport, speak
  auth/credentials.js        checkCredentials, checkParentPassword (placeholder grown-up checks)
  components/                presentational React pieces
  screens/                   one file per screen
  App.jsx                    screen state machine (no router)
```

Tests live beside the code as `*.test.js`. They use no mocks, spies, stubbed modules, or fake timers.

## Data model

### Round (this is both the game state and the stored record)

```js
{
  id: 'round-…',                 // string
  childId: 'child-alex',
  activityId: 'match-the-word',
  startedAt: '2026-10-22T…Z',     // ISO string
  completedAt: null | ISO string,
  status: 'in_progress' | 'completed',
  isSample: false,                // true only for seeded records
  currentIndex: 0,                // 0..4, index of the question on screen
  paused: false,                  // UI-only flag, does not affect results
  questions: [Question × 5],
}
```

### Question

```js
{
  target: 'cat',                  // correct word
  pictureId: 'cat',
  hint: 'Look at the first letter. …',
  options: ['hat', 'cat', 'bus'], // 3 unique words, includes target
  selections: ['hat', 'cat'],     // every selected answer, in order
  attempts: 2,                    // === selections.length
  correct: false | true,          // true once target was selected (locks the question)
  hintUsed: false,
  audioUsed: false,               // any audio requested while on this question
  explanation: null | string,     // trimmed, non-empty note, or null
  explanationDone: false,         // true after Save or Skip (hides the prompt)
}
```

## game/ API (pure: state in, state out)

All time values are passed in (`now` = ISO string). Nothing reads `Date.now()` or `Math.random()` except as default arguments.

- `createRng(seed: number) => () => number`: deterministic PRNG (mulberry32) returning values in [0, 1).
- `generateQuestions(items, { rng = Math.random, count = items.length } = {}) => Array<{ target, pictureId, hint, options }>`
  - Each item is the target exactly once (order shuffled), up to `count`.
  - Options are the target plus 2 distinct distractors from the other items, with no duplicates.
  - The correct answer's position varies. Across a round of ≥3 questions, every one of the three positions is used at least once.
- `createRound({ id, childId, activityId, questions, now }) => Round`: builds a fresh round from generated questions, with all tracking fields zeroed.
- `startRound({ id, childId, activity, now, rng }) => Round`: convenience wrapper combining generateQuestions(activity.items, { rng, count: activity.questionCount }) and createRound.
- `roundReducer(round, action) => Round`. If an action is a no-op, it **returns the same object reference**:
  - `{ type: 'SELECT', word }`: ignored if the round is paused or completed, the current question is already correct, or the word is not in options. Otherwise it appends to selections and does attempts += 1. If word === target, it sets correct = true.
  - `{ type: 'USE_HINT' }`: current question hintUsed = true (ignored when paused/completed).
  - `{ type: 'USE_AUDIO' }`: current question audioUsed = true (ignored when paused/completed).
  - `{ type: 'SAVE_EXPLANATION', text }`: only if the current question is correct and not explanationDone. Trimmed text, if non-empty, goes into explanation. Always sets explanationDone = true. Empty text behaves like Skip.
  - `{ type: 'SKIP_EXPLANATION' }`: only if correct and not explanationDone. Sets explanationDone = true and leaves explanation null.
  - `{ type: 'PAUSE' }` / `{ type: 'CONTINUE' }`: toggles `paused`. PAUSE then CONTINUE yields a round deep-equal to the original.
  - `{ type: 'NEXT', now }`: only if the current question is correct and the round is not paused or completed. If not on the last question, currentIndex += 1. On the last question it sets status = 'completed' and completedAt = now (currentIndex stays at the last index). Already completed rounds are returned unchanged.
- Selectors:
  - `getCurrentQuestion(round)`
  - `getCompletedCount(round)`: number of questions with correct === true
  - `isRoundComplete(round)`: status === 'completed'
  - `getFeedback(question)`: `'correct'` if correct, `'incorrect'` if attempts > 0 and not correct, else `null`

### summary.js

- `needsPractice(question) => boolean`: attempts > 1
- `summarizeRound(round) => { roundId, isSample, startedAt, completedAt, totalWords, words: [{ word, attempts, selections, hintUsed, audioUsed, explanation, needsPractice }], practiceWords: string[], hintCount, audioCount }`
- `recentPracticeWords(rounds, { limit = 5 } = {}) => Array<{ word, roundsNeedingPractice }>`: across the given completed rounds (newest first, up to `limit` rounds), the words flagged for practice, sorted by count descending, then alphabetically.

## storage/ API (progressRepository.js)

Backed by `globalThis.localStorage` under a single versioned key `'reading-game:v1'`, holding `{ version: 1, profiles: [...], rounds: [...], settings: {...} }`.
All functions are synchronous and return plain JSON-safe copies, so callers can't mutate the store by accident. Later the same function names can become async API calls.

- `ensureSeeded()`: if there's no data, or it's corrupt, writes seed data (profile Alex plus sample rounds). Safe to call repeatedly. Every other function calls it implicitly.
- `getChildProfile(childId = SAMPLE_CHILD.id) => { id, name } | null`
- `createRoundId() => string`: unique (uses crypto.randomUUID when available, otherwise a timestamp plus counter fallback)
- `saveRound(round) => Round`: upserts by id. **Idempotent completion:** if the stored copy is already `completed`, the stored record wins (it's never downgraded, and completedAt never changes). Saving the same round repeatedly never creates duplicates.
- `getRound(id) => Round | null`
- `getRounds({ childId, status } = {}) => Round[]`: newest first (by completedAt ?? startedAt)
- `getInProgressRound(childId, activityId) => Round | null`: the most recent in-progress round
- `getSettings() => { textSize: 'standard' | 'large', font: 'standard' | 'dyslexic', wordAudio: 'on' | 'off' }` and `saveSettings(partial) => settings` (invalid values are ignored; missing keys get defaults)
- `resetDemoData()`: removes all real rounds and restores seed data. Settings are kept.

seedData.js exports `SEED_ROUNDS` (2–3 completed rounds for Alex with `isSample: true`, ids prefixed `sample-`, past dates, a mix of 1-attempt and multi-attempt words, at least one explanation note, some hint/audio use), plus `createSeedState()`.

## audio/speech.js

- `getSpeechSupport(win = globalThis) => 'available' | 'unavailable'`. Returns available only if `win.speechSynthesis` exists and `win.SpeechSynthesisUtterance` is a function. jsdom returns 'unavailable'.
- `speak(text, win = globalThis) => boolean`: cancels any current speech, then speaks at a slightly slow rate (0.85). Returns false and does nothing when unavailable.

## UI conventions

- Resume on refresh: Start on the Choose activity screen resumes the existing in-progress round for Alex if there is one, otherwise starts a new round. The activity screen saves through `saveRound` after every state change.
- "Play Again" always starts a new round.
- Picture accessibility: `role="img"` with `aria-label="Mystery picture"` (doesn't reveal the answer).
- Help is in the top-right and Back is in the top-left of a shared top bar on every screen. On the child's screens the middle holds a Settings button.
- Parent/teacher access: a "Parent or Teacher" button (same quiet style as Back and Help) sits in the top bar on the Start screen (where Back would be). It opens a sign-in modal that only its X button closes (backdrop clicks and Escape do nothing). `checkCredentials(username, password)` in `auth/credentials.js` accepts `admin` / `admin` until there is a backend. Sign-in is asked for every time.
- Reading settings (text size; font: Standard / OpenDyslexic; read words aloud: On / Off) are for the child's screens. With word audio off, the Hear button beside each answer word is hidden; Hear Instructions is always available. The settings are for the child, but children can't change them directly. Grown-ups change them in two places: the "Reading settings" panel in the parent/teacher view, or the top bar's Settings button, which opens a modal behind the parent/teacher password (`checkParentPassword`, `admin` for now) and applies changes live, mid-round. That modal closes the same way as the sign-in modal (X only), and asks for the password every time.
- The parent/teacher view always uses standard text size and the standard font, and has no Settings button.
