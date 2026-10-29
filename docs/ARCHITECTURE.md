# Match the Word: architecture and module contracts

Stack:
- **Browser:** Vite + React 19, React Router 8 (data mode), Howler.js for audio, plain CSS.
- **API:** Node.js + Express 5 with CORS; MongoDB through Mongoose.
- **Everywhere:** plain JavaScript (ES modules, `.js` / `.jsx`), Vitest, oxlint. No TypeScript, no state library.

Flow: React route loaders and event handlers call `src/api/*` → `fetch` with the session cookie (CORS with credentials) → Express routes → auth middleware → `server/repository.js` → Mongoose models → MongoDB. The server owns rounds: it creates them from the `words` collection and applies each game action with the shared reducer. Pictures come from the `images` collection. Speech clips are static `.wav` files served by Express and played by Howler.

```
src/                         React app
  main.jsx                   <RouterProvider router={router} />
  router.js                  route table (createBrowserRouter)
  routes/loaders.js          route loaders: fetch through api/ before a screen shows
  routes/routeComponents.jsx one component per route: loader data + navigation → a screen
  api/                       the ONLY browser code that calls the API
    config.js                API_BASE (VITE_API_URL), AUDIO_BASE, imageUrl(pictureId)
    http.js                  request() (sends the cookie), ApiError, createQueue()
    auth.js                  loadSession, signIn, signOut, unlock, lock
    auth.js                  (also) selectChild
    progress.js              listChildren, createChild, getChild, saveSettings, getGames,
                             startRound, getRound, sendRoundAction, whenSaved,
                             getCompletedRounds, resetDemoData
  audio/
    clips.js                 clipName, describeActivity, spokenPhrases (pure; shared with the server)
    player.js                getAudioSupport, createClipPlayer, playClip (Howler.js)
  content/                   pure data, shared with the server
    activities.js            MATCH_THE_WORD, PRACTICE_TRICKY_WORDS, ACTIVITIES, FEEDBACK
    settings.js              SETTING_VALUES, DEFAULT_SETTINGS
  game/                      pure functions + reducer; no React, DOM, or network.
                             The server uses them to create rounds and apply actions.
    random.js                createRng(seed)
    questions.js             generateQuestions(items, { rng, count, targets })
    round.js                 createRound, startRound, roundReducer, selectors
    summary.js               summarizeRound, needsPractice, recentPracticeWords
  components/                presentational React pieces
  screens/                   one file per screen
server/                      Express API
  index.js                   connect DB → seed if empty → listen (PORT, default 3001)
  app.js                     createApp({ clientOrigins }): CORS, cookies, JSON, /audio, /api routes, errors
  db.js                      connectDatabase / disconnectDatabase (MONGODB_URI or embedded)
  models/                    Mongoose schemas: ChildProfile, Adult, Session, Word, Image, Round
  repository.js              the ONLY server code that reads/writes children, words, images, rounds
  locks.js                   withLock(key, task): one-at-a-time work per round / child
  auth/
    passwords.js             scrypt hashPassword / verifyPassword
    sessions.js              signIn, findSession, unlock, lock, signOut, sign-in lockout
    middleware.js            requireSession, requireElevated, requireChildAccess, requireJsonWrites
  routes/                    auth, children, rounds, words + images, demo routers; HttpError
  seed/
    seedData.js              SEED_CHILD, SEED_ADULTS, SEED_ROUNDS
    words.js                 SEED_WORDS, SEED_IMAGES
    images/*.svg             seed pictures
    seed.js                  seedIfEmpty, reseed
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
  pictureId: 'cat',               // id in the images collection
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
- `startRound({ id, childId, activity, items, now, rng, targets }) => Round`: convenience wrapper combining generateQuestions(items, { rng, count: activity.questionCount, targets }) and createRound. `items` is the word list: `[{ word, pictureId, hint }]`.
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

Every model's JSON output drops `__v` and uses a string `id` instead of `_id` (Word uses `word`), so API responses match the shapes above.

- **ChildProfile** (`childProfiles`): `_id: String` ('child-alex' for the seed, 'child-<uuid>' when made in the app), `name` (required, 1–60 after trimming), `settings: { textSize, font, wordAudio, explanations }`, `createdAt`. Each setting is an enum from `SETTING_VALUES`, defaulting to `DEFAULT_SETTINGS`. Who can see a child is stored on each Adult (`childIds`), not on the child, so several grown-ups can share one child (many-to-many).
- **Adult** (`adults`): `username` (unique), `role` ('parent' | 'teacher'), `childIds: [String]` (the children this grown-up may see), `passwordHash`, `passwordSalt` (scrypt). The hash and salt are never included in JSON.
- **Session** (`sessions`): `_id` = SHA-256 of the cookie token (the token itself is never stored), `adultId`, `createdAt`, `expiresAt` (TTL index: MongoDB deletes expired sessions), `elevatedUntil: Date | null`, `activeChildId: String | null` (the child playing on this device).
- **Word** (`words`): `_id` = the word itself (lowercase letters, spaces, `'` or `-`), `hint` (≤ 200), `pictureId` (refs Image). JSON: `{ word, hint, pictureId }`.
- **Image** (`images`): `_id` (lowercase letters, digits, `-`), `contentType` ('image/svg+xml' | 'image/png' | 'image/jpeg' | 'image/webp'), `data: Buffer` (1 byte–1 MB), `description` (for grown-ups only). JSON leaves out `data`.
- **Round** (`rounds`): `_id: String` ('round-<uuid>', made by the server), `childId` (indexed, refs ChildProfile), `activityId` (enum of `ACTIVITIES` ids), `startedAt: Date`, `completedAt: Date | null`, `status` ('in_progress' | 'completed'), `isSample`, `currentIndex` (≥ 0), `paused`, `questions: [Question]` (at least one).
- **Question** (embedded in Round, no `_id`): the Question fields above. `options` must have exactly 3 entries, `attempts` ≥ 0, `explanation` ≤ 200 chars. A question copies its word's hint and pictureId when the round starts, so later word-list edits don't change old rounds.

Seed data is written on first start, when there are no child profiles:
- `SEED_IMAGES` / `SEED_WORDS` (`server/seed/words.js`, pictures in `server/seed/images/`): cat, sun, dog, hat, bus.
- `SEED_CHILD`: Alex, with default settings.
- `SEED_ADULTS`: `admin` / `admin`, a parent of Alex. The password is hashed on insert.
- `SEED_ROUNDS`: 2–3 completed rounds for Alex with `isSample: true`, ids prefixed `sample-`, and past dates. They have a mix of 1-attempt and multi-attempt words, at least one explanation note, and some hint/audio use.

## Server repository (server/repository.js)

All functions are async and return plain JSON-safe objects. They throw `HttpError` (400/409) for bad input, and Mongoose ValidationError when a result would break a schema.

- `getChild(childId) => { id, name, settings } | null`. Missing settings keys get defaults.
- `listChildren(childIds) => [{ id, name, completedRounds, lastPlayedAt }]`, sorted by name (case-insensitive). The counts come from one aggregation over completed rounds.
- `createChild(adultId, name) => { id, name, settings }`: trims the name and links the new child to that grown-up (`$addToSet` on `childIds`). It throws 400 when the name is blank and 409 when the grown-up already has a child with that name (ignoring case).
- `saveSettings(childId, partial) => settings | null`. Only known keys with allowed values are saved; anything else is ignored.
- `listWords() => [{ word, hint, pictureId }]`, alphabetical. `getImage(id) => { contentType, data } | null`.
- `getRound(id)`, `getRounds({ childId, status, activityId })`: the latter is newest first (by completedAt ?? startedAt).
- `getTrickyWords(childId) => string[]`: `recentPracticeWords` over the child's completed rounds, keeping only words still in the word list.
- `getGames(childId) => { trickyWords, inProgress: { [activityId]: roundId | null } }`
- `createRound(childId, activityId, { rng, now }) => { round, created }`:
  - If the game already has an in-progress round, it returns that one (`created: false`), so a double tap can't start two.
  - Otherwise it builds the round from the `words` collection with `startRound`. Tricky Words uses `getTrickyWords` as targets. With none, it falls back to Match the Word (and returns its in-progress round if there is one).
  - Errors: 400 for an unknown activity, 409 if the word list has fewer than 3 words.
  - Runs under `withLock('start:<childId>')`.
- `applyRoundAction(roundId, action, { now }) => Round | null`:
  - Accepts only `SELECT { word }`, `USE_HINT`, `USE_AUDIO`, `SAVE_EXPLANATION { text }`, `SKIP_EXPLANATION`, `PAUSE`, `CONTINUE`, `NEXT`. Anything else, and any extra fields, are rejected or dropped. The server sets `NEXT`'s time itself.
  - Runs `roundReducer`, validates the result, and saves it, under `withLock('round:<id>')`.
  - A completed round never changes: the reducer ignores actions on it, and the save filters on `status != completed`.
- `resetDemoData(childIds?)`: removes the rounds of those children (all children when omitted) and restores their `SEED_ROUNDS`. Children, accounts, words, images, and settings are kept.

## Sign-in (server/auth/)

- **Device sign-in.** A grown-up signs in once on a device (`POST /api/auth/sign-in`):
  - The server creates a Session and sets cookie `rg_session`: a 32-byte random token, `HttpOnly`, `SameSite=Lax`, `Path=/api`, `Secure` in production, lasting 30 days.
  - Signing in again on the same device replaces the old session.
  - The new session starts **unlocked**, because the password was just entered.
- **Who's playing.** The grown-up picks one of their children (`POST /api/auth/active-child`, unlocked only). This sets `activeChildId` and **locks** the session, since the device is being handed over. The child then plays under that session.
- **Unlocking (elevated).** Grown-up-only endpoints also need the session unlocked: listing or adding children, picking the player, round history, settings changes, and demo reset. The signed-in grown-up re-enters their password (`POST /api/auth/unlock`). It lasts 10 minutes, or until `POST /api/auth/lock`. The app locks when you go from the grown-up screens back to a child's screens, or close the Settings dialog, so the password is asked every time.
- **Child access** (`assertChildUsable`), for every child or round endpoint:
  - 404 when the grown-up isn't linked to the child (so other ids aren't confirmed).
  - 403 when it's one of their children but the session is locked and that child isn't `activeChildId`. So a child playing on a locked device can only reach their own games and rounds.
  - When unlocked, any of the grown-up's children.
- **Sharing.** Several grown-ups can hold the same child id in `childIds`, and they all see that child's results. There's no API yet for inviting another grown-up or setting access levels; that's the follow-up.
- **Lockout.** Five wrong passwords for one username (sign-in) or one session (unlock) within 15 minutes give 429 until the window passes. This is in memory and resets on restart.
- **CSRF.** Every `/api` write must be `Content-Type: application/json` (415 otherwise). Browsers can't send that cross-site without a CORS preflight, and CORS only allows `CLIENT_ORIGIN`.

## HTTP API (server/app.js)

JSON in and out. Errors come back as `{ error }`: 400 for validation, cast, or malformed-JSON problems, 401 when signed out (or a wrong password), 403 when the session isn't unlocked, 404 for unknown or other people's resources, 409 for too few words, 415 for non-JSON writes, 429 when locked out, 500 otherwise.

Access: **public**, **session** (signed in), or **unlocked** (signed in + password entered recently). `/api/children/:childId/*` and `/api/rounds/:roundId/*` also go through the child access rule above: a locked session only reaches its active child.

| Method | Path | Access | Body | Response |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | public | | `{ ok: true }` |
| POST | `/api/auth/sign-in` | public | `{ username, password }` | session view; sets the cookie |
| GET | `/api/auth/session` | session | | `{ adult: { username, role }, children: [{ id, name }], activeChildId, elevated }` |
| POST | `/api/auth/unlock` | session | `{ password }` | session view (`elevated: true`) |
| POST | `/api/auth/lock` | session | | session view (`elevated: false`) |
| POST | `/api/auth/sign-out` | session | | `{ ok: true }`; clears the cookie |
| POST | `/api/auth/active-child` | unlocked | `{ childId }` | session view (`activeChildId` set, `elevated: false`) |
| GET | `/api/children` | unlocked | | `[{ id, name, completedRounds, lastPlayedAt }]` |
| POST | `/api/children` | unlocked | `{ name }` | 201 `{ id, name, settings }` |
| GET | `/api/children/:childId` | session | | `{ id, name, settings }` |
| PATCH | `/api/children/:childId/settings` | unlocked | partial settings | full settings |
| GET | `/api/children/:childId/games` | session | | `{ trickyWords, inProgress }` |
| POST | `/api/children/:childId/rounds` | session | `{ activityId }` | Round (201 new, 200 existing in-progress) |
| GET | `/api/children/:childId/rounds?status=&activityId=` | unlocked | | `Round[]` newest first |
| GET | `/api/rounds/:roundId` | session | | Round |
| POST | `/api/rounds/:roundId/actions` | session | one action | Round after the action |
| GET | `/api/words` | session | | `[{ word, hint, pictureId }]` |
| GET | `/api/images/:imageId` | public | | image bytes, with a sandboxing CSP and `nosniff` |
| POST | `/api/demo/reset` | unlocked | | `{ ok: true }` |
| GET | `/audio/:name.wav` | public | | speech clip |

**Known limits:**
- Locks and lockout counters live in one process. Running several API processes needs a shared store (e.g. a revision field on rounds, and Mongo-backed failure counts).
- Children can be created, but not renamed or removed yet. There's no sign-up, password change, sharing a child with another grown-up, or word and image upload.

## Browser API layer (src/api/)

- `request(path, { method, body })` sends `credentials: 'include'`. Writes always carry a JSON body. It rejects with `ApiError`, whose `status` is the HTTP status, or **0 when the server can't be reached**.
- `loadSession()` is cached and shared by loaders until signIn or signOut. It resolves `null` when signed out.
- `signIn` and `unlock` resolve `true`/`false` (wrong password). Other failures reject with ApiError, e.g. 429.
- `sendRoundAction` and `saveSettings` go through `createQueue()`, so they reach the server one at a time, in order. `whenSaved()` resolves when every pending action has settled. Loaders that read rounds await it first.
- `startRound(childId, activityId)` asks the server for a round (new or in-progress). The browser no longer builds rounds.

## Audio (src/audio/)

Howler.js plays files, not text, so every spoken phrase has a pre-generated clip:
- `clipName(text)` gives the file name: lowercase, with runs of anything else turned into `-`. For example, 'cat' becomes `cat.wav`.
- `spokenPhrases(activities, words)` lists every phrase the app can say: each game's `describeActivity` text (title + description), each instruction, and each word. `npm run audio:generate` writes a clip for every `ACTIVITIES` phrase and every word in `SEED_WORDS` (Windows System.Speech, rate −2, 22 kHz mono). A server test checks they all exist. Words added to the database later need their clip added by hand.
- `getAudioSupport(howler = Howler)` returns `'available'` unless Howler reports `noAudio`.
- `createClipPlayer({ HowlClass, howler, baseUrl }) => play(text)` makes one Howl per clip on first use and stops the current clip before playing another. It returns false, and does nothing, when audio is unavailable or the text has no clip name. Load and play errors are logged as console warnings. `playClip` is the app's shared instance.

## Routing (React Router data mode)

| Path | Loader | Screen |
| --- | --- | --- |
| `/sign-in` | session (signed in → `/players`) | Grown-up sign in (then → `/players`) |
| `/` (root layout) | session (signed out → `/sign-in`) | AppLayout: applies the playing child's text size/font and SettingsContext on child screens, the standard look on grown-up screens |
| `/players` | session (locked → password gate) | Who's playing? (pick, add a child, parent view, sign out) |
| `/parent` | `listChildren` (403 → password gate) | Parent/teacher overview: children, add child, switch player, demo reset, sign out |
| `/parent/:childId` | the child + completed rounds (403 → gate; 404 → `/parent`) | One child's reading settings, practice words, rounds |
| (pathless `child` layout) | `activeChildId` (none → `/players`) + `getChild` | wraps the child screens below |
| `/` (index) | | Start |
| `/games` | `getGames` | Choose a game |
| `/play/:roundId` | the round (completed → `/summary/:roundId`; missing or another child's → `/games`) | Activity |
| `/summary/:roundId` | the round (not completed → `/play/:roundId`) | Summary |
| `*` | redirect to `/` | |

The route ErrorBoundary shows one of three messages, each with a button:
- "Can't reach the game" when the server is unreachable.
- "Please sign in again" on a 401 mid-session, with a Sign in button.
- "Something went wrong" for anything else, with Try again.

`HydrateFallback` shows "Loading…" on first load. Headings take focus after navigation, but not on the first page load.

## UI conventions

- Resume: Start on a Choose a game card asks the server for a round, and the server returns that game's in-progress round if there is one. A refresh on `/play/:roundId` reloads the round from the database. The activity screen runs each action through the reducer locally (so taps feel instant) and sends it to the server, which applies the same reducer to the stored round. If sending fails, it shows a quiet "Progress isn't being saved right now" note.
- "Play Again" always starts a new round of the same game.
- Choose a game shows a card per game. Each card's description has a Hear button that reads the title and description aloud (disabled when audio is unavailable; not affected by the word-audio setting).
- Tricky Words (`PRACTICE_TRICKY_WORDS`) is a custom Match the Word round whose targets are the words from `recentPracticeWords` over the child's completed rounds (up to `questionCount`). Its card only appears when there are such words or a Tricky Words round is in progress. It resumes separately from Match the Word. If no tricky words remain when one starts, a regular Match the Word round starts instead. The parent view labels these rounds "Tricky Words".
- Pictures are `<img src="/api/images/<pictureId>">`. Question pictures have `alt="Mystery picture"` (it doesn't reveal the answer); card and summary pictures are decorative (`alt=""`).
- Help is in the top-right and Back is in the top-left of a shared top bar on every screen. On the child's screens the middle holds a Settings button.
- Parent/teacher access: a "Parent or Teacher" button (same quiet style as Back and Help) sits in the top bar on the Start screen (where Back would be). It opens a password modal (`UnlockDialog`) that only its X button closes (backdrop clicks and Escape do nothing). The signed-in grown-up's password unlocks the session on the server (`POST /api/auth/unlock`) and opens `/parent`. Going back to the child's screens locks it again, so the password is asked every time. Grown-up screens whose unlock has timed out (or after a refresh) show `GrownUpGateScreen`, which asks for the password and then reloads the screen.
- Who's playing? (`/players`) comes right after sign-in and is reachable from the parent/teacher view ("Choose who's playing"). Each child is a large button showing their initial and name. Picking one sets the device's player and opens Start. The parent/teacher view's Back returns to Start when a child is playing, otherwise to Who's playing?.
- Reading settings belong to each child. `ReadingSettings` takes `settings` and `onChange` props: the Settings dialog edits the playing child (through SettingsContext), and `/parent/:childId` edits that child.
- Reading settings (text size; font: Standard / OpenDyslexic; read words aloud: On / Off; ask how they chose: Off / On) are for the child's screens. With word audio off, the Hear button beside each answer word is hidden; Hear Instructions is always available. The "Tell us how you chose" prompt after a correct answer is off by default and only appears once a grown-up turns on "Ask how they chose". Settings are stored on the child's profile in MongoDB. They apply right away on screen and are then saved through the API. The settings are for the child, but children can't change them directly. Grown-ups change them in two places: the "Reading settings" panel in the parent/teacher view, or the top bar's Settings button, which opens a modal behind the signed-in grown-up's password (`unlock`) and applies changes live, mid-round. That modal closes the same way (X only), asks for the password every time, and locks the session again when it closes.
- The grown-up screens (sign-in, Who's playing?, the parent/teacher view) always use standard text size and the standard font, and have no Settings button.
