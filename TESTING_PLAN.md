# Testing and Usability Prototype: code and testing plan

Source: *Testing and Usability Prototype Design Brief*. This file covers every code and test change. Work outside the code (running sessions, manual checks, reviews, demo prep, follow-ups) is in [REVIEW_PLAN.md](REVIEW_PLAN.md).

## Overview

The work lands as **two commits** on a feature branch. The repo is currently on `main`, so branch first.

| Commit | Contents | Must pass before committing |
| --- | --- | --- |
| **C1: Functionality** (usability test mode) | Task definitions, session reducer, TestSession model, repository functions, `/api/test-sessions` routes, `src/api/testing.js`, Start test session, Task card, `/facilitator` console and results, route and signal logging, feature docs. **No new tests and no new dev dependencies.** | `npm test` (existing suite unchanged and green), `npm run lint`, manual smoke of the existing flows |
| **C2: Testing layer** | Dev dependencies, Vitest setup, Playwright config and `test:e2e`, small testability props, every new unit, API, component, accessibility and e2e test (including tests for C1), the accessibility checklist doc, test docs | `npm test`, `npm run lint`, `npm run test:e2e` |

Each section below is tagged **[C1]** or **[C2]**.

### Ground rules (from the brief and `docs/ARCHITECTURE.md`)

- Tests live beside the code they cover and are named `*.test.js`. Component tests that contain JSX are named `*.test.jsx`. The brief says `*.test.js`, but JSX needs the `.jsx` extension under Vite; flag this to the team. Vitest's default include pattern picks up both.
- **No mocks, spies, stubbed modules or fake timers.** Pass stand-ins in through parameters or props, as the existing tests do (for example the fake `Howl` class in `src/audio/player.test.js`).
- Timestamps (`now`) and random seeds (`createRng(seed)`) are always arguments. Nothing reads `Date.now()` or `Math.random()` except as a default argument.
- Server tests start with `// @vitest-environment node` and run against a throwaway embedded MongoDB and a real HTTP server, as `server/app.test.js` does.
- Playwright files live in `e2e/` and run **only** through `npm run test:e2e`, never through `npm test`.
- Existing screens, game rules and word content don't change unless this plan says so.
- Out of scope: real tester accounts, video or audio recording, charts, and any change to word content.

---

## 1. Design conflicts to settle before building [C1]

The brief leaves three points that would break the feature if built literally. The recommended resolution comes first in each; confirm it with the team (see REVIEW_PLAN.md §2).

1. **Access to `/api/test-sessions` vs. a locked tester window.** The brief says the routes use the elevated-access middleware. But once Alex is picked, the tester's window is *locked*, so it couldn't read the active session (needed for the Task card) or post route-change events.
   - **Recommendation:** split access.
     - Facilitator actions (start, start task, outcome, next task, note, end, list, New Tester Reset) use `requireSession` + `requireElevated`.
     - `GET /api/test-sessions/active` and `POST /api/test-sessions/active/events` use `requireSession` only and are scoped to the signed-in grown-up's own active session.
2. **The facilitator console loses its unlock.** A second window in the same browser shares the `rg_session` cookie. When the tester's window returns to child screens, `AppLayout` calls `lock()`, which locks the console too. The 10-minute unlock also expires mid-session.
   - **Recommendation:**
     - Run the console in a separate browser profile, private window, or second device, signed in as the same grown-up. That gives it a separate `Session` with the same `adultId`, so "one session per grown-up" still holds.
     - On a 403 the console shows the existing `GrownUpGateScreen` and keeps its state when it reloads.
     - Add `/facilitator` to `isGrownUpPath` in `src/routes/routeComponents.jsx` so the console never triggers the auto-lock.
3. **Text size carries over between testers.** `resetDemoData` keeps settings, so a tester who completes Task 6 leaves Alex on large text for the next tester.
   - **Recommendation:** New Tester Reset (and Start Session) also restores `DEFAULT_SETTINGS` for the session's child. This is a test-mode-only behaviour; Reset Demo Data itself doesn't change.

---

## 2. Feature code: usability test mode [C1]

Follow the module boundaries in `docs/ARCHITECTURE.md`: content, game behaviour and storage stay separate.

### 2.1 Content: `src/content/testTasks.js` (new)

- Export `TEST_TASKS`, an ordered array of `{ id, number, title, scenario, required, signal }`. The six tasks and their scenario text come word for word from the brief.
  - Required: 1 Start a round, 2 Finish a round, 3 Get help, 4 Review as a parent.
  - Optional: 5 Practice tricky words, 6 Make the text bigger.
- `signal` is a key that `deriveSignals` understands (`round-created`, `round-summary`, `help-used`, `round-detail-opened`, `tricky-round-created`, `text-size-large`).
- Export `SEVERITIES` (`1 minor`, `2 recovered`, `3 blocked`) and `OUTCOMES` (`completed_unaided`, `completed_with_hesitation`, `failed`), with display labels.
- Export `nextTesterLabel(label)`: `Tester 1` → `Tester 2`, and anything without a trailing number gets ` 2`.

### 2.2 Session logic: `src/game/testSession.js` (new, pure)

The module has no React, DOM or network code and is shared by the browser and the server (like `round.js`). Add it to `src/game/index.js`.

- `createTestSession({ id, testerLabel, adultId, childId, taskIds, now })` → `{ id, testerLabel, adultId, childId, status: 'active', startedAt: now, endedAt: null, currentTaskIndex: 0, tasks: [{ taskId, startedAt: null, endedAt: null, outcome: null }], events: [], notes: [] }`.
- `testSessionReducer(session, action)` returns the **same reference** for a no-op (matching `roundReducer`).

  | Action | Effect |
  | --- | --- |
  | `START_TASK { now }` | Sets the current task's `startedAt` if it isn't set yet. |
  | `SET_OUTCOME { outcome, now }` | Needs a started task and a known outcome. Sets `outcome` and stops the timer (`endedAt = now`). Can be changed later; `endedAt` stays at the first choice. |
  | `NEXT_TASK` | Moves `currentTaskIndex` to the next *included* task. On the last task it's a no-op. |
  | `LOG_EVENT { event: { type, path?, signal?, at } }` | Appends to `events`, tagged with the current task id. Drops any field other than `type`, `path`, `screen`, `signal`, `roundId` and `at`, so explanation text can never get in. |
  | `ADD_NOTE { text, severity, screen, now }` | Trimmed text, which must not be empty; `severity` must be 1, 2 or 3. Stored with the current task id, screen and time. |
  | `END { now }` | `status = 'ended'`, `endedAt = now`. All later actions are no-ops. |

- Selectors:
  - `getCurrentTask(session)`
  - `getElapsedMs(task, now)`
  - `getCurrentScreen(session)`: the latest route event's screen name
  - `taskPosition(session)` → `{ number, total }` for "Task 2 of 6"
  - `summarizeSession(session)` → one row per task (outcome, time on task, notes) plus the list of all notes
  - `sessionAsText(session)` for Copy as Text
- `screenName(pathname)`: maps routes to readable names (`/play/:id` → `Activity`, `/parent/:childId` → `Parent child view`, and so on).
- `deriveSignals(session, { rounds, settings })` → `{ [taskId]: firstSignalTime | null }`. It reads the logged events and the existing round data (attempts, `hintUsed`, `audioUsed`); for example, Task 3 needs a question with `attempts > 1`, `hintUsed` and `audioUsed`. This is a timing aid only. The facilitator's outcome button decides completion.

### 2.3 Storage

- **`server/models/TestSession.js`** (new; register it in `server/models/index.js`, and use the `toJSON.js` helper so the JSON has a string `id`):
  - `_id: 'test-<uuid>'`, `testerLabel` (1–60 characters after trimming), `adultId` (indexed), `childId`
  - `status: 'active' | 'ended'`, `startedAt: Date`, `endedAt: Date | null`, `currentTaskIndex`
  - `tasks: [{ taskId (enum of TEST_TASKS ids), startedAt, endedAt, outcome (enum | null) }]`
  - `events: [{ at, taskId, type: 'route' | 'signal', path, screen, signal, roundId }]` (cap at around 2,000 entries)
  - `notes: [{ at, taskId, screen, text (≤ 500), severity (1 | 2 | 3) }]`
  - Partial unique index on `{ adultId: 1 }` where `status: 'active'`, so the database enforces one active session per grown-up.
- **`server/repository.js`** (the only place that reads or writes; add functions here only):
  - Start, look up and end:
    - `startTestSession(adultId, { testerLabel, childId, taskIds }, { now })` throws 409 when there's already an active session (the client then offers to end it), and 400 when a required task is missing or there's an unknown task or an empty label. It also runs `resetDemoData` and restores default settings for the child.
    - `getActiveTestSession(adultId)` and `getTestSession(adultId, id)` (null or 404 when it belongs to another grown-up).
    - `listTestSessions(adultId)`, newest first: `[{ id, testerLabel, status, startedAt, endedAt }]`.
    - `endTestSession(adultId, id, { now })`.
  - Task actions: `applyTestSessionAction(adultId, id, action, { now })` runs `testSessionReducer`, validates and saves, under `withLock('test:<id>')` (`server/locks.js`).
  - Event logging: `logTestSessionEvent(adultId, event, { now })` appends to the active session. It's a no-op when there's none, and the server sets the time.
  - New Tester Reset: `newTesterReset(adultId, id, { now })` ends the session, runs `resetDemoData` with the grown-up's `childIds`, restores default settings, and returns `{ nextLabel }`. Sample rounds stay `isSample: true` because `SEED_ROUNDS` is reused unchanged.
- **`server/routes/testSessions.js`** (new; mounted in `server/app.js` as `app.use('/api/test-sessions', testSessionsRouter)`):

  | Method | Path | Access | Body |
  | --- | --- | --- | --- |
  | GET | `/api/test-sessions` | unlocked | (none) |
  | POST | `/api/test-sessions` | unlocked | `{ testerLabel, childId, taskIds }` |
  | GET | `/api/test-sessions/active` | session | (none) |
  | POST | `/api/test-sessions/active/events` | session | `{ type, path?, signal?, roundId? }` |
  | GET | `/api/test-sessions/:id` | unlocked | (none) |
  | POST | `/api/test-sessions/:id/actions` | unlocked | one of `START_TASK`, `SET_OUTCOME`, `NEXT_TASK`, `ADD_NOTE` |
  | POST | `/api/test-sessions/:id/end` | unlocked | (none) |
  | POST | `/api/test-sessions/:id/new-tester` | unlocked | (none) |

  - `childId` goes through `assertChildUsable`.
  - The server always sets the times.
  - Unknown action types and extra fields are rejected, as `applyRoundAction` does.
  - The `GET /active` response for the tester window is trimmed to `{ active, taskNumber, taskTotal, scenario }`, with no notes, outcomes or labels.
- **`src/api/testing.js`** (new; the only browser code for these routes). It uses `request()` from `src/api/http.js` and exports:
  - `listTestSessions`, `startTestSession`, `getActiveTestSession`, `getTestSession`
  - `sendTestSessionAction`, `endTestSession`, `newTesterReset`
  - `logTestEvent`: fire-and-forget through `createQueue()`, swallowing errors so the child's play is never affected.

### 2.4 Screens and wiring

- **Start test session** (on the Parent or Teacher view):
  - Add a **Start Usability Test** button to `src/screens/ParentHomeScreen.jsx`, near Reset Demo Data. It opens a new `StartTestSessionForm` component (new file in `src/components/`):
    - a tester label field, pre-filled from `nextTesterLabel` of the newest past session or `Tester 1`
    - a checkbox per task, with required tasks checked and disabled
    - a child picker that defaults to Alex
  - If a session is already active, the form asks "End the current session first?" and only then starts the new one.
  - **Start Session** calls `startTestSession`, then navigates to `/players` (Who's playing?).
  - Also show a "Past sessions" list (tester labels) with links to their results, and an "Open facilitator console" link to `/facilitator`.
  - New props on `ParentHomeRoute` / `ParentHomeScreen` are `onStartTestSession` and `testSessions`. `parentHomeLoader` in `src/routes/loaders.js` also loads `listTestSessions()`.
- **Task card** (`src/components/TaskCard.jsx`, new):
  - Renders inside `ChildLayout` (`src/routes/routeComponents.jsx`) only while `childLoader` reports an active session. Extend `childLoader` to call `getActiveTestSession()`, and treat a failure as "no session".
  - It's a collapsible panel showing "Task N of M" and the scenario text only, with no hints, steps or timers.
  - It's placed in its own region **after** `<main>` in DOM order, so the child's focus order is unchanged. It's positioned so it never covers the word buttons, Help, Pause or Next (for example a bottom-left dock that reserves its own space).
  - Styling follows the child rules: plain background, sans-serif text of about 24 px or more, a toggle at least 48 px tall with visible focus, and no animation or flashing.
  - When collapsed, the body has `hidden` (so it's out of the accessibility tree) and the toggle keeps an accessible name, for example "Show task".
  - It doesn't change `data-text-size` or `data-font`.
  - It updates "at once" when the task changes: it re-polls `GET /active` every couple of seconds while mounted and on window `focus`. This is a polling interval, not a visible timer.
- **Facilitator console** (`/facilitator`):
  - Add the route to `src/router.js` under the root layout (a sibling of `parent`), with `facilitatorLoader` (unlocked → active session plus past sessions; 403 → gate) and `FacilitatorRoute`.
  - Add it to `isGrownUpPath` so it uses the standard look and never locks the session.
  - The new `src/screens/FacilitatorScreen.jsx` shows:
    - the tester label, the current task and its scenario
    - elapsed time since Start Task, computed from `startedAt` and the console's own clock
    - the screen the tester is on, from `getCurrentScreen`
  - Buttons: Start Task, Completed Unaided, Completed With Hesitation, Failed and Next Task. The outcome buttons are disabled until the task has started.
  - A note box with a severity picker (radio group: 1 minor, 2 recovered, 3 blocked) and Save note. The note records the current task, screen and time.
  - End Session (with a confirmation) switches to results.
  - Polls `GET /:id` so the tester's screen updates, and survives a refresh because everything comes from the server.
- **Session results** (part of `FacilitatorScreen`, also reachable from Past sessions):
  - One row per task with its outcome, time on task and notes. Below that, a list of all notes with their screen and severity.
  - **Copy as Text** uses `navigator.clipboard.writeText(sessionAsText(session))`.
  - **Download JSON** uses a Blob plus an `<a download>` link.
  - **New Tester Reset** calls `newTesterReset`, then navigates to the Start test session form with the next label filled in.
  - A past sessions list shows each tester label.
- **Logging (tester window):**
  - In `AppLayout`, a `useEffect` on `pathname` calls `logTestEvent({ type: 'route', path })` when a session is active. The server tags the event with the active task and the time.
  - Signals that aren't routes:
    - **Round detail opened:** add an optional `onOpenRound(roundId)` prop to `src/screens/ParentScreen.jsx`. It's called next to the existing state change and defaults to doing nothing. `ParentChildResults` logs `{ type: 'signal', signal: 'round-detail-opened' }`.
    - **Text size changed:** `useChildSettings` logs `{ type: 'signal', signal: 'text-size-large' }` when `partial.textSize === 'large'`.
    - **Rounds created or reaching the summary:** taken from route events (`/play/:id` and `/summary/:id`) plus round data in `deriveSignals`. No changes to the rounds routes.
  - **Never** log explanation text. `ExplanationForm` content isn't touched by any logging path, and the server's `LOG_EVENT` allowlist drops unknown fields.
  - Pause isn't stored, so the facilitator confirms Pause and Continue by observation.
- **Child experience unchanged:** apart from the Task card, no timers, labels or messages are added to child screens. With no active session, the rendered output of every existing screen is the same as before.

### 2.5 Docs [C1]

- `docs/ARCHITECTURE.md`:
  - add `testTasks.js`, `testSession.js`, the TestSession schema, the repository functions, the HTTP table rows, the `/facilitator` routing row and the Task card UI convention
  - record the access decision from §1.
- `README.md`: add a "Usability test mode" demo scenario, and a note to open `/facilitator` in a second browser profile or device.

### 2.6 C1 completion check

- `npm test` and `npm run lint` pass with the existing suite untouched.
- Smoke test by hand: README demo scenarios 0–7 behave as before with no session active, then run a short session (Tasks 1–2) to check the wiring.

---

## 3. Test infrastructure [C2]

- **Dev dependencies:** `npm i -D @testing-library/react @testing-library/user-event vitest-axe @playwright/test`, then `npx playwright install chromium`. Check that `vitest-axe` works with Vitest 5 and React 19. If it doesn't, use `axe-core` directly with a small hand-written `toHaveNoViolations` matcher in the setup file; that isn't a mock.
- **`vite.config.js`:**
  ```js
  test: {
    environment: 'jsdom',
    hookTimeout: 120_000,
    setupFiles: ['src/test/setup.js'],
    exclude: ['**/node_modules/**', 'e2e/**', 'dist/**'],
  }
  ```
- **`src/test/setup.js`** (new): register `cleanup()` from `@testing-library/react` in `afterEach`, because Vitest globals are off, and run `expect.extend(matchers)` with `vitest-axe/matchers`. It has to work in the `node` environment too (server tests), so guard the DOM-only parts with `typeof document !== 'undefined'`.
- **`src/test/renderWithRouter.jsx`** (new helper): builds a `createMemoryRouter` with the given route objects, wraps it in `SettingsContext` with real `DEFAULT_SETTINGS` (or provided settings), renders through `RouterProvider`, and returns `{ user: userEvent.setup(), router, ...renderResult }`. This uses a real router and real components.
- **Testability props (small, with no visible change).** In `src/screens/ActivityScreen.jsx`, add optional props `sendAction = sendRoundAction` and `playAudio = playClip` (and `audioSupport = getAudioSupport()`), and use them in place of the direct calls. Tests pass hand-written stand-ins, for example a `sendAction` that records actions into an array and resolves. This matches the existing "stand-ins through parameters" pattern, and production behaviour is the same.
- **`package.json` scripts:** `"test:e2e": "playwright test"`. `npm test` stays `vitest run` and never touches `e2e/`.
- **`playwright.config.js`** (new, at the root):
  - `testDir: 'e2e'`, `fullyParallel: false`, `workers: 1` (shared demo data), Chromium only, and `baseURL: 'http://localhost:5173'`
  - `webServer`: `npm run dev` with `env: { MONGODB_DATA_DIR: '.data/e2e', PORT: '3001' }`, `url: 'http://localhost:5173'`, `reuseExistingServer: !process.env.CI` and a generous timeout for the first MongoDB download.
  - `.data/` is already git-ignored. Add `test-results/` and `playwright-report/` to `.gitignore`.

---

## 4. Unit tests [C2]

These are pure and deterministic, beside the code, with `now` and seeds passed in.

| File | Status | Cases to add or confirm |
| --- | --- | --- |
| `src/game/round.test.js` | exists; audit | The brief's list is mostly covered already: wrong answers, locked correct answers, Next on the last question, Pause and Continue. Add any missing explicit case: Next on the last question sets `completedAt` to the passed `now` and leaves `currentIndex` on the last index; a second Next is a no-op (same reference). |
| `src/game/questions.test.js` | exists; audit | Three unique options and varying positions are covered. Add: the correct answer appears in every position across a set of seeds for Tricky Words targets. |
| `src/game/summary.test.js` | exists; audit | Covered (`needsPractice` when attempts > 1). Add an edge case: a word with exactly one attempt and a hint is still *not* flagged. |
| `src/content/testTasks.test.js` | **new** | 6 tasks numbered 1–6 with unique ids; exactly tasks 1–4 are required; every scenario matches the brief text; no scenario names a button (check against the app's button labels: Help, Pause, Continue, Next, Hear, Parent or Teacher, Settings, Start, Play, Tricky Words…); every `signal` is known to `deriveSignals`; `nextTesterLabel` cases. |
| `src/content/activities.test.js`, `settings.test.js` | **new, small** | `DEFAULT_SETTINGS` values are in `SETTING_VALUES`; `FEEDBACK` has the "Let's try again" text the component tests rely on. |
| `src/game/testSession.test.js` | **new** | `createTestSession` with the included tasks only. `START_TASK` sets `startedAt` once. `SET_OUTCOME` before start is a no-op; it sets the outcome and `endedAt`, and changing it keeps the first `endedAt`. `NEXT_TASK` follows included tasks only and is a no-op on the last. `LOG_EVENT` tags the current task and drops unknown fields (an `explanation` field never appears). `ADD_NOTE` rejects empty text and severity outside 1–3. `END` makes every later action a no-op (same reference). Selectors: `getElapsedMs`, `taskPosition` ("2 of 6"), `getCurrentScreen`, `screenName` for every route, `summarizeSession` and `sessionAsText` output. `deriveSignals` for each of the six signals, using real rounds built with `startRound` and `roundReducer` from a seed. |

---

## 5. API and integration tests [C2]

Put these in a new `server/testSessions.test.js` (node environment) that reuses the `client()` / `signedIn()` pattern from `server/app.test.js`. Move those two helpers into a shared `server/testClient.js` so both files use them; this is a refactor only. Also add repository-level cases to `server/repository.test.js`.

- **Existing areas to confirm or extend** (brief: sign-in and lockout, child access rules, round creation and actions, Reset Demo Data):
  - Most are already in `app.test.js`.
  - Add: Reset Demo Data restores exactly the `SEED_ROUNDS` ids with `isSample: true` and removes non-sample rounds, and another grown-up's children are untouched. Check that this isn't already asserted at line ~387 before adding it.
- **`/api/test-sessions`:**
  - Access:
    - 401 when signed out.
    - 403 for facilitator routes when locked.
    - `GET /active` and `POST /active/events` work while locked with a child playing.
  - Starting:
    - Start returns 201 with the required tasks included even if they're left out of the body, or 400 if that's the decision.
    - Start resets demo data and default settings.
    - A second start for the same grown-up gives 409. A second start from **another device's session** of the same grown-up also gives 409.
    - Another grown-up (`addTeacher`) can start their own session at the same time.
  - Facilitator actions:
    - `START_TASK` → `SET_OUTCOME` → `NEXT_TASK` persist across a fresh `GET` (proves persistence).
    - Notes with a severity and the current task persist. Severity 4 or empty text gives 400.
    - Unknown action or extra fields give 400.
    - End sets `status: 'ended'`; later actions don't change it.
    - `GET /:id` for another grown-up's session gives 404.
  - Event logging:
    - Events are tagged with the active task, and the server sets the time.
    - Posting a body containing `explanation: 'secret'` stores no such field.
    - Play a real round with `SAVE_EXPLANATION { text: 'secret' }`, then fetch the session and assert `'secret'` appears nowhere in it (`JSON.stringify`).
  - New Tester Reset: ends the session, sample rounds come back marked sample, non-sample rounds are gone, Alex's settings are back to default, and the response contains `nextLabel: 'Tester 2'`.
  - List: past sessions show their tester labels, newest first.

---

## 6. Component tests [C2]

These use React Testing Library, user-event and a real `createMemoryRouter` (the `renderWithRouter` helper). Rounds come from `startRound` with a fixed seed and the seed words, so the target and options are known. There's no network: `sendAction`, `playAudio` and callbacks are hand-written stand-ins passed as props.

| File | Cases |
| --- | --- |
| `src/screens/ActivityScreen.test.jsx` | A wrong answer shows "Let's try again" and the other options stay enabled. A correct answer locks every choice (`disabled` or `aria-disabled`) and enables Next. Help shows the question's hint. Hear calls the `playAudio` stand-in with the word and records `USE_AUDIO` through `sendAction`. Pause shows the Continue overlay, and Continue returns to the question. With "Ask how they chose" on, the explanation form's Save stores trimmed text and Skip hides the form (assert on `sendAction` calls). Next on question 5 calls `onComplete` with a completed round. |
| `src/screens/ParentScreen.test.jsx` | With real `SEED_ROUNDS` (or a reduced round), the parent view marks words that took more than one try. Opening a round shows `RoundDetail` and calls `onOpenRound`. |
| `src/screens/ChooseActivityScreen.test.jsx`, `StartScreen.test.jsx`, `SummaryScreen.test.jsx` | Light coverage for the a11y pass: they render, show the heading, and call their callbacks. |
| `src/components/TaskCard.test.jsx` | Shows "Task 2 of 6" and the scenario text only, with no button names, timers or hints. Collapse sets `hidden` on the body, and the toggle keeps its accessible name and `aria-expanded`. It's placed after `<main>` in DOM order: tabbing through the activity screen reaches every word button, Help, Pause and Next before the Task card toggle. |
| `src/screens/FacilitatorScreen.test.jsx` | Shows the tester label, task and tester's screen. Outcome buttons are disabled until Start Task. Elapsed time is computed from a passed-in `now` prop, not timers. Saving a note sends `ADD_NOTE` with the chosen severity. End Session asks for confirmation. The results view shows rows per task and the notes list. Copy as Text and Download JSON receive stand-ins through props (`copyText`, `download`). |
| `src/components/StartTestSessionForm.test.jsx` | Required tasks are checked and can't be unchecked. The label is pre-filled. The form submits the label, child and task ids. |

---

## 7. Accessibility tests [C2]

**Automated (jsdom, `vitest-axe`)**: add an `a11y` `describe` block in each screen's component test file, or one `src/screens/a11y.test.jsx` that renders each screen in turn:

- `expect(await axe(container)).toHaveNoViolations()` for Sign in, Who's playing?, Start, Choose a game, Activity (normal, after a wrong answer, paused, explanation prompt), Summary, the Parent overview, Parent child view, the round detail, Grown-up gate, Start test session, the Facilitator console, Session results, and the Task card expanded and collapsed.
  - Disable only the `color-contrast` rule here, because jsdom can't compute it. Contrast is covered by the manual checklist.
- Exactly one `h1` (`getAllByRole('heading', { level: 1 })`) per screen.
- Focus moves to the heading on arrival: render with `focusHeading` true (or navigate within the memory router) and assert `document.activeElement` is the `h1`.
- Every icon-only button has an accessible name (`getAllByRole('button')` all have a non-empty accessible name).
- **Keyboard-only round:** in `ActivityScreen.test.jsx`, complete all five questions using only `user.tab()` and `user.keyboard('{Enter}')` / `' '`, including a Pause and Continue round trip, and assert `onComplete` is called.

**Real browser (Playwright, `e2e/layout.spec.js`)**: jsdom can't check layout, so this runs in Chromium:

- Child word and instruction text has a computed `font-size` of at least ~24 px (assert ≥ 22 px to allow for "around").
- Every visible `button` on the child screens is at least 48 px tall (`boundingBox().height`).
- Visible focus: after a Tab, the focused element has a non-`none` `outline` or `box-shadow`.
- The Task card doesn't overlap the word buttons, Help, Pause or Next: compare bounding boxes with an active session at 1280×800 and at a tablet size (768×1024).

**Manual checklist (`docs/ACCESSIBILITY_CHECKLIST.md`, new file)**: a short checklist for text size and zoom to 200%, colour contrast (WCAG AA), screen reader reading order on each child screen (NVDA or Narrator), the Task card hidden from the screen reader when collapsed, and no flashing. When and by whom it runs is in REVIEW_PLAN.md.

---

## 8. End-to-end tests (Playwright) [C2]

All files are in `e2e/` and run only via `npm run test:e2e`. They run serially against the running app.

- **`e2e/helpers.js`:**
  - `resetDemo(request)` signs in as `admin` / `admin` through the API (`POST /api/auth/sign-in`, which starts unlocked) and calls `POST /api/demo/reset`. It ends any active test session and `PATCH`es Alex's settings back to `DEFAULT_SETTINGS`. The API is at `http://localhost:3001`, so writes send `Content-Type: application/json`.
  - `signInAndPickAlex(page)` uses the real UI: sign in, Who's playing?, Alex.
  - `beforeEach` in every spec calls `resetDemo`. Avoid wrong-password steps, or keep them under five, so lockout never trips.
- **Specs:**
  - `independent-practice.spec.js` (README scenario 1): Play, Match the Word, Start, answer all five (read the target from the round via `GET /api/rounds/:id`, or pick by trial until "Let's try again" disappears), then "You finished 5 words!".
  - `use-support.spec.js` (scenario 2): wrong word, then "Let's try again", Help shows the hint, Hear (assert the request to `/audio/<word>.wav`), the right word, Pause and Continue, then Next. **Refresh mid-round** after two answers and check the round resumes on question 3 (scenario 4).
  - `adult-review.spec.js` (scenario 5): finish a round with a multi-try word, **refresh after completion** (it stays on the summary), then Parent or Teacher with password `admin`. The overview's Alex count is sample rounds + 1. Open the newest round: attempts, hint and audio use are shown, the word is marked, and **the new round appears exactly once**.
  - `layout.spec.js`: see §7.
  - `usability-session.spec.js` (demo check 3, automated): two browser contexts, one tester and one facilitator, both signed in as `admin`.
    - The facilitator starts a session from the Parent view and the tester sees Task 1 on the Task card.
    - The tester completes Tasks 1–4 while the facilitator clicks Start Task and an outcome per task, and adds notes with severities 1, 2 and 3.
    - The console shows the tester's current screen.
    - Refresh both pages: the session, outcomes and notes are still there.
    - End Session: the results rows and notes are correct, and Download JSON produces a file with the same data.
    - New Tester Reset: the form shows `Tester 2`, sample rounds are back, and the next session starts with no outcomes or notes.

---

## 9. Regression gate and completion checks [C2]

- **Before every merge:** `npm test` and `npm run lint`.
- **Before a release:** `npm run test:e2e` as well, plus the manual accessibility checklist (see REVIEW_PLAN.md).
- **Demo check 1 – automated tests pass:**
  1. `npm test` shows the existing and new unit, API, component and accessibility files all passing, and `npm run lint` is clean.
  2. Break the round reducer on purpose: in `src/game/round.js`, make `SELECT` ignore the "already correct" lock, or stop incrementing `attempts`.
  3. Run `npm test` and show the failures in `round.test.js` and `ActivityScreen.test.jsx`.
  4. Revert with `git checkout src/game/round.js` and run the tests again until green.
- **Demo check 2 – end-to-end flows pass:** `npm run test:e2e` (optionally `--headed`) shows the three scenarios, including the mid-round refresh and the "new round appears once" assertion.
- **Demo check 3 – facilitator session:** run it by hand as described in REVIEW_PLAN.md §5; `usability-session.spec.js` is the automated version.
- **Existing behaviour unchanged:** the existing tests pass without changes (other than the helper move in §5), and README scenarios 0–7 still work by hand.

---

## 10. Commit checklist

Branch first: `git switch -c usability-testing`.

**C1: `Add usability test mode (task card, facilitator console, test sessions API)`**
- New: `src/content/testTasks.js`, `src/game/testSession.js`, `server/models/TestSession.js`, `server/routes/testSessions.js`, `src/api/testing.js`, `src/components/TaskCard.jsx`, `src/components/StartTestSessionForm.jsx`, `src/screens/FacilitatorScreen.jsx`
- Changed: `src/game/index.js`, `server/models/index.js`, `server/repository.js`, `server/app.js`, `src/router.js`, `src/routes/loaders.js`, `src/routes/routeComponents.jsx`, `src/screens/ParentHomeScreen.jsx`, `src/screens/ParentScreen.jsx` (optional `onOpenRound`), `src/index.css`, `docs/ARCHITECTURE.md`, `README.md`
- Check: `npm test`, `npm run lint`, and the manual smoke test from §2.6.

**C2: `Add testing layer: component, accessibility, API and end-to-end tests`**
- New:
  - `src/test/setup.js`, `src/test/renderWithRouter.jsx`, `playwright.config.js`
  - `e2e/*.spec.js`, `e2e/helpers.js`, `server/testClient.js`, `server/testSessions.test.js`
  - every new `*.test.js` / `*.test.jsx` from §4, §6 and §7
  - `docs/ACCESSIBILITY_CHECKLIST.md`
- Changed: `package.json` / `package-lock.json` (dev dependencies, `test:e2e`), `vite.config.js`, `.gitignore`, `src/screens/ActivityScreen.jsx` (stand-in props), `server/app.test.js` (helpers moved to `testClient.js`), `server/repository.test.js`, the existing `src/game/*.test.js` (gap cases), `README.md` and `docs/ARCHITECTURE.md` (a test-layers section and the `test:e2e` script)
- Check: `npm test`, `npm run lint`, `npm run test:e2e`, and demo checks 1–3.
