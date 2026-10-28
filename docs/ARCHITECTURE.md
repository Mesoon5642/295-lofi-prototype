# Match the Word: architecture and module contracts

Stack:
- **Browser:** Vite + React 19, React Router 8 (data mode), Howler.js for audio, plain CSS.
- **API:** Node.js + Express 5 with CORS; MongoDB through Mongoose.
- **Everywhere:** plain JavaScript (ES modules, `.js` / `.jsx`), Vitest, oxlint. No TypeScript, no state library.

Flow: React route loaders and event handlers call `src/api/*` → `fetch` (CORS) → Express routes → `server/repository.js` → Mongoose models → MongoDB. Speech clips are static `.wav` files served by Express and played by Howler.

```
src/                         React app
  main.jsx                   <RouterProvider router={router} />
  router.js                  route table (createBrowserRouter)
  routes/loaders.js          route loaders: fetch through api/ before a screen shows
  routes/routeComponents.jsx one component per route: loader data + navigation → a screen
  api/                       the ONLY browser code that calls the API
    config.js                API_BASE (VITE_API_URL), AUDIO_BASE, ACTIVE_CHILD_ID
    http.js                  request(), ApiError, createQueue()
    progress.js              profile, settings, rounds (same names as the old localStorage repository, now async)
    rounds.js                getTrickyWords, startNewRound
    auth.js                  checkCredentials, checkParentPassword
  auth/parentSession.js      in-memory "just signed in" flag for /parent
  audio/
    clips.js                 clipName, describeActivity, spokenPhrases (pure; shared with the server)
    player.js                getAudioSupport, createClipPlayer, playClip (Howler.js)
  content/                   pure data, shared with the server
    activities.js            MATCH_THE_WORD, PRACTICE_TRICKY_WORDS, ACTIVITIES, FEEDBACK
    settings.js              SETTING_VALUES, DEFAULT_SETTINGS
  game/                      pure functions + reducer; no React, DOM, or network
    random.js                createRng(seed)
    questions.js             generateQuestions(items, { rng, count, targets })
    round.js                 createRound, startRound, roundReducer, selectors
    summary.js               summarizeRound, needsPractice, recentPracticeWords
  components/                presentational React pieces
  screens/                   one file per screen
server/                      Express API
  index.js                   connect DB → seed if empty → listen (PORT, default 3001)
  app.js                     createApp({ clientOrigins }): CORS, JSON, /audio static, /api routes, errors
  db.js                      connectDatabase / disconnectDatabase (MONGODB_URI or embedded)
  models/                    Mongoose schemas: ChildProfile, Round, Adult
  repository.js              the ONLY server code that reads/writes rounds, profiles, settings, accounts
  routes/                    children, rounds, auth, demo routers + HttpError
  auth/passwords.js          scrypt hashPassword / verifyPassword
  seed/seedData.js           SEED_CHILD, SEED_ADULTS, SEED_ROUNDS
  seed/seed.js               seedIfEmpty, reseed
  scripts/                   seed.js (npm run db:seed), generateAudio.js (npm run audio:generate)
  audio/                     <clip name>.wav
```

Tests live beside the code as `*.test.js`. They use no mocks, spies, stubbed modules, or fake timers. Server tests (`// @vitest-environment node`) start a real throwaway embedded MongoDB and, for routes, a real HTTP server on a random port. Hand-written stand-ins are passed in through parameters where needed (e.g. a fake `Howl` class).

## Data model

### Round (this is both the game state and the stored record)

```js
{
  id: 'round-…',                 // string
  childId: 'child-alex',
  activityId: 'match-the-word',  // or 'practice-tricky-words'
  startedAt: '2026-10-22T…Z',     // ISO string (a Date in MongoDB; JSON turns it back into the string)
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
- `generateQuestions(items, { rng = Math.random, count = items.length, targets } = {}) => Array<{ target, pictureId, hint, options }>`
  - Each item is the target exactly once (order shuffled), up to `count`.
  - `targets` (optional array of words) limits which items can be the target. Distractors still come from all items, so even one target word gives a full 3-option question.
  - Options are the target plus 2 distinct distractors from the other items, with no duplicates.
  - The correct answer's position varies. Across a round of ≥3 questions, every one of the three positions is used at least once.
- `createRound({ id, childId, activityId, questions, now }) => Round`: builds a fresh round from generated questions, with all tracking fields zeroed.
- `startRound({ id, childId, activity, now, rng, targets }) => Round`: convenience wrapper combining generateQuestions(activity.items, { rng, count: activity.questionCount, targets }) and createRound.
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

## MongoDB schemas (server/models/)

Every model's JSON output uses a string `id` instead of `_id` and drops `__v`, so API responses match the shapes above.

- **ChildProfile** (collection `childProfiles`): `_id: String` ('child-alex'), `name: String` (required, ≤ 60), `settings: { textSize, font, wordAudio, explanations }`. Each setting is an enum from `SETTING_VALUES`, defaulting to `DEFAULT_SETTINGS`.
- **Round** (collection `rounds`): `_id: String` (the client-made round id), `childId` (indexed, refs ChildProfile), `activityId` (enum of `ACTIVITIES` ids), `startedAt: Date`, `completedAt: Date | null`, `status` ('in_progress' | 'completed'), `isSample`, `currentIndex` (≥ 0), `paused`, `questions: [Question]` (at least one).
- **Question** (embedded in Round, no `_id`): the Question fields above. `options` must have exactly 3 entries, `attempts` ≥ 0, `explanation` ≤ 200 chars.
- **Adult** (collection `adults`): `username` (unique), `role` ('parent' | 'teacher'), `childIds: [String]`, `passwordHash`, `passwordSalt` (scrypt). The hash and salt are never included in JSON.

Seed data (`server/seed/seedData.js`) is written on first start when there are no child profiles:
- `SEED_CHILD`: Alex, with default settings.
- `SEED_ADULTS`: `admin` / `admin`, a parent of Alex. The password is hashed on insert.
- `SEED_ROUNDS`: 2–3 completed rounds for Alex with `isSample: true`, ids prefixed `sample-`, and past dates. They have a mix of 1-attempt and multi-attempt words, at least one explanation note, and some hint/audio use.

## Server repository (server/repository.js)

All functions are async and return plain JSON-safe objects.

- `getChildProfile(childId) => { id, name } | null`
- `getSettings(childId) => settings | null`. Missing keys get defaults.
- `saveSettings(childId, partial) => settings | null`. Only known keys with allowed values are saved; anything else is ignored.
- `saveRound(round) => Round`: validates against the schema (rejects with a Mongoose ValidationError), then upserts by id. **Idempotent completion:** if the stored copy is already `completed`, the stored record wins (it's never downgraded, and completedAt never changes). Saving the same round repeatedly never creates duplicates. This is done atomically: a replace filtered on `status != completed`, and a duplicate-key result means "keep the stored one".
- `getRound(id) => Round | null`
- `getRounds({ childId, status, activityId } = {}) => Round[]`: newest first (by completedAt ?? startedAt)
- `resetDemoData()`: removes all rounds and restores `SEED_ROUNDS`. Profiles, accounts, and settings are kept.
- `signIn(username, password) => Adult | null`: the username is trimmed, the password is not.
- `checkParentPassword(childId, password) => boolean`: true if any grown-up linked to that child has that password.

## HTTP API (server/app.js)

JSON in and out. Errors come back as `{ error }`: 400 for validation, cast, or malformed-JSON problems, 404 for unknown resources, 500 otherwise. CORS allows only `CLIENT_ORIGIN` (default `http://localhost:5173,http://localhost:4173`).

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/api/health` | | `{ ok: true }` |
| GET | `/api/children/:childId` | | `{ id, name }` or 404 |
| GET | `/api/children/:childId/settings` | | settings or 404 |
| PATCH | `/api/children/:childId/settings` | partial settings | full settings or 404 |
| GET | `/api/rounds?childId=&status=&activityId=` | | `Round[]` newest first (all filters optional) |
| GET | `/api/rounds/:roundId` | | Round or 404 |
| PUT | `/api/rounds/:roundId` | Round (its `id` must match the URL) | the stored Round |
| POST | `/api/auth/sign-in` | `{ username, password }` | `{ username, role, childIds }` or 401 |
| POST | `/api/auth/check-password` | `{ childId, password }` | `{ ok: true }` or 401 |
| POST | `/api/demo/reset` | | `{ ok: true }` |
| GET | `/audio/:name.wav` | | speech clip, or 404 |

**Known gap:** the auth endpoints only answer yes/no. They don't issue a session or token, so the other endpoints are not protected yet. Add sessions before this runs anywhere but a local machine.

## Browser API layer (src/api/)

- `request(path, { method, body })` rejects with `ApiError`. Its `status` is the HTTP status, or **0 when the server can't be reached**.
- `saveRound` and `saveSettings` go through `createQueue()`, so writes reach the server one at a time, in order. `whenSaved()` resolves when every pending round save has settled. Loaders that read rounds await it first.
- `getRound(id)` resolves `null` on 404. `getInProgressRound(childId, activityId)` returns the newest in-progress round, or null.
- `createRoundId()`: unique ids. It uses crypto.randomUUID when available, otherwise a timestamp plus counter.
- `startNewRound(childId, activityId)` generates questions in the browser (`startRound`), saves the round, and resolves with the stored copy.

## Audio (src/audio/)

Howler.js plays files, not text, so every spoken phrase has a pre-generated clip:
- `clipName(text)` gives the file name: lowercase, with runs of anything else turned into `-`. For example, 'cat' becomes `cat.wav`.
- `spokenPhrases(ACTIVITIES)` lists every phrase the app can say: each game's `describeActivity` text (title + description), each instruction, and each word. `npm run audio:generate` writes a clip for every one (Windows System.Speech, rate −2, 22 kHz mono). A server test checks that every phrase has a clip.
- `getAudioSupport(howler = Howler)` returns `'available'` unless Howler reports `noAudio`.
- `createClipPlayer({ HowlClass, howler, baseUrl }) => play(text)` makes one Howl per clip on first use and stops the current clip before playing another. It returns false, and does nothing, when audio is unavailable or the text has no clip name. Load and play errors are logged as console warnings. `playClip` is the app's shared instance.

## Routing (React Router data mode)

| Path | Loader | Screen |
| --- | --- | --- |
| `/` (root layout) | child profile + settings | AppLayout: SettingsContext, text size/font, `<Outlet />` |
| `/` (index) | | Start |
| `/games` | tricky words, in-progress round ids per game | Choose a game |
| `/play/:roundId` | the round (completed → redirect to `/summary/:roundId`; missing → `/games`) | Activity |
| `/summary/:roundId` | the round (not completed → redirect to `/play/:roundId`) | Summary |
| `/parent` | completed rounds (redirects to `/` unless just signed in) | Parent/teacher view |
| `*` | redirect to `/` | |

The root route has an ErrorBoundary. When the API can't be reached it shows "Can't reach the game"; other errors show "Something went wrong". Both have a Try again button. `HydrateFallback` shows "Loading…" on first load. Headings take focus after navigation, but not on the first page load.

## UI conventions

- Resume: Start on a Choose a game card opens that game's in-progress round if there is one, otherwise it starts a new round. A refresh on `/play/:roundId` reloads the round from the database. The activity screen saves through `saveRound` after every state change. If a save fails, it shows a quiet "Progress isn't being saved right now" note.
- "Play Again" always starts a new round of the same game.
- Choose a game shows a card per game. Each card's description has a Hear button that reads the title and description aloud (disabled when audio is unavailable; not affected by the word-audio setting).
- Tricky Words (`PRACTICE_TRICKY_WORDS`) is a custom Match the Word round whose targets are the words from `recentPracticeWords` over the child's completed rounds (up to `questionCount`). Its card only appears when there are such words or a Tricky Words round is in progress. It resumes separately from Match the Word. If no tricky words remain when one starts, a regular Match the Word round starts instead. The parent view labels these rounds "Tricky Words".
- Picture accessibility: `role="img"` with `aria-label="Mystery picture"` (doesn't reveal the answer).
- Help is in the top-right and Back is in the top-left of a shared top bar on every screen. On the child's screens the middle holds a Settings button.
- Parent/teacher access: a "Parent or Teacher" button (same quiet style as Back and Help) sits in the top bar on the Start screen (where Back would be). It opens a sign-in modal that only its X button closes (backdrop clicks and Escape do nothing). `checkCredentials(username, password)` in `api/auth.js` asks `POST /api/auth/sign-in` (the seeded account is `admin` / `admin`). Sign-in is asked for every time: the "signed in" flag lives only in memory and is cleared when you leave `/parent`, so refreshing or coming back means signing in again.
- Reading settings (text size; font: Standard / OpenDyslexic; read words aloud: On / Off; ask how they chose: Off / On) are for the child's screens. With word audio off, the Hear button beside each answer word is hidden; Hear Instructions is always available. The "Tell us how you chose" prompt after a correct answer is off by default and only appears once a grown-up turns on "Ask how they chose". Settings are stored on the child's profile in MongoDB. They apply right away on screen and are then saved through the API. The settings are for the child, but children can't change them directly. Grown-ups change them in two places: the "Reading settings" panel in the parent/teacher view, or the top bar's Settings button, which opens a modal behind the parent/teacher password (`checkParentPassword(childId, password)` → `POST /api/auth/check-password`) and applies changes live, mid-round. That modal closes the same way as the sign-in modal (X only), and asks for the password every time.
- The parent/teacher view always uses standard text size and the standard font, and has no Settings button.
