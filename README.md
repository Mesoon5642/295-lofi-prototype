# Match the Word: reading game prototype

A browser-based reading game for young beginning readers, including children with dyslexia or other learning differences. A child plays a five-word "Match the Word" round (or a "Tricky Words" round of words they found hard) and gets encouraging feedback. A parent or teacher can then review the results.

**Stack:** React 19 + React Router (Vite) in the browser, Howler.js for audio, an Express API with CORS, and MongoDB through Mongoose.

```
React app (localhost:5173)  ──fetch + CORS──▶  Express API (localhost:3001)  ──Mongoose──▶  MongoDB
        │                                              │
        └──── Howler.js plays /audio/*.wav ◀───────────┘ (static speech clips)
```

## Local development

### Prerequisites

- **Node.js 22.22 or newer** (React Router 8 requires it). Check with `node --version`.
- **No MongoDB install is needed.** Without `MONGODB_URI`, the API starts an embedded MongoDB (via `mongodb-memory-server`). The first run downloads a MongoDB binary (about 100 MB) into your npm cache, so it needs internet access once.

### First run

```sh
npm install
npm run dev
```

`npm run dev` starts both processes in one terminal (output is prefixed `api` / `web`):

| Process | URL | Notes |
| --- | --- | --- |
| React app (Vite) | http://localhost:5173 | Open this one. |
| Express API | http://localhost:3001 | Restarts on server file changes (`node --watch`). |

On first start the API writes the demo data into the database: the word list and its pictures, child profile **Alex**, the grown-up account **`admin` / `admin`**, and three sample rounds. After that, data persists between restarts in `.data/mongo/` (git-ignored).

Open http://localhost:5173 and **sign in as `admin` / `admin`**. Next comes **Who's playing?**: pick a child to hand the device to them, add a child, or open the parent/teacher view. The sign-in lasts 30 days or until someone signs out. The chosen child keeps playing on that device until a grown-up switches player.

To run the two halves separately (e.g. in two terminals): `npm run dev:server` and `npm run dev:web`.

### All scripts

```sh
npm run dev             # API + React app together
npm run dev:server      # API only, with auto-restart
npm run dev:web         # React app only (needs the API running)
npm start               # API only, no auto-restart
npm test                # unit, API, component and accessibility tests (Vitest)
npm run test:e2e        # end-to-end tests in a real browser (Playwright; not part of npm test)
npm run lint            # oxlint
npm run build           # production build of the React app in dist/
npm run preview         # serve the production build (http://localhost:4173)
npm run db:seed         # wipe the database and write the demo data again
npm run audio:generate  # regenerate the speech clips in server/audio/ (Windows only)
```

### Configuration (optional)

Copy `.env.example` to `.env` and change what you need. The API reads it through Node's `--env-file-if-exists`, and Vite reads the `VITE_` values.

| Variable | Default | Used by |
| --- | --- | --- |
| `PORT` | `3001` | API port |
| `CLIENT_ORIGIN` | `http://localhost:5173,http://localhost:4173` | Origins the API allows through CORS |
| `MONGODB_URI` | *(unset → embedded MongoDB)* | A local install (`mongodb://localhost:27017/reading-game`) or a MongoDB Atlas connection string |
| `MONGODB_DATA_DIR` | `.data/mongo` | Where the embedded MongoDB keeps its files |
| `VITE_API_URL` | `http://localhost:3001` | Where the React app finds the API |
| `COOKIE_SECURE` | `false` (`true` when `NODE_ENV=production`) | Send the session cookie over HTTPS only |

If you change `PORT`, change `VITE_API_URL` to match. If you serve the React app from a different port, add that origin to `CLIENT_ORIGIN`.

**Keep the app and the API on the same site.** The session cookie is `SameSite=Lax`, so the browser only sends it when the React app and the API share a site: `localhost` on any ports counts. If you deploy them on different domains, put them under one domain (e.g. `app.example.com` and `api.example.com`) or serve the API from the same origin.

### Database

Mongoose schemas are in `server/models/`. Collections:

- `childProfiles`: a child's name plus their reading settings. Grown-ups create these in the app.
- `adults`: parent/teacher accounts and which children they can see. Passwords are stored only as scrypt hashes.
- `sessions`: signed-in browsers, including which child is playing on each one. Only a hash of each cookie token is stored, and MongoDB deletes expired sessions automatically.
- `words`: the word list (word, hint, picture). New rounds draw from it.
- `images`: the pictures, stored as bytes (SVG, PNG, JPEG, or WebP; up to 1 MB each) and served at `/api/images/<id>`
- `rounds`: every round played, including each answer chosen. The server creates rounds and applies each game action.
- `testSessions`: usability test sessions: tester label, each task's outcome and timing, logged route changes, and the facilitator's notes. A child's typed explanations are never copied here.

Looking at the data:
- With `MONGODB_URI` set, use MongoDB Compass or `mongosh` as usual.
- The embedded database only runs while the API runs, on a random port. Its connection string isn't printed, so the easiest way to inspect it is to point `MONGODB_URI` at a real MongoDB instead.

Resetting:
- **Reset Demo Data** (in the parent/teacher view) or `POST /api/demo/reset` removes the rounds of the signed-in grown-up's children and restores the sample rounds. Child profiles and settings are kept, and other grown-ups' children aren't touched.
- `npm run db:seed` wipes everything, settings and accounts included, and writes the demo data again. **Stop the API first** when using the embedded database, because only one process can open `.data/mongo` at a time.
- To start completely fresh, stop the API and delete `.data/`.
- On every start the API fills in any collection that is empty (images, words, or profiles and accounts). An older database therefore picks up the word list and pictures without losing its rounds.

Adding words: there is no word editor yet. Until parent/child management lands, either add them to `server/seed/words.js` (with an SVG in `server/seed/images/`) and run `npm run db:seed`, or insert into the `words` and `images` collections directly. A word needs a matching speech clip (see below).

### Audio clips

Howler.js plays audio files, not text, so every spoken phrase is a pre-generated `.wav` in `server/audio/`, served by the API at `/audio/<name>.wav`:
- Each file is named after its text (`clipName` in `src/audio/clips.js`). For example, "Pick the word that matches the picture." becomes `pick-the-word-that-matches-the-picture.wav`.
- The committed clips use the Windows built-in voice as a placeholder. To use a real recording, save it over the file with the same name. No code change is needed.
- **After adding or changing words** (`server/seed/words.js`) **or instructions/game descriptions** (`src/content/activities.js`), run `npm run audio:generate` on Windows, or add the new clips by hand on macOS/Linux. A test (`server/app.test.js`) fails if any seed phrase is missing a clip. Words added straight to the database need a clip added by hand, otherwise their Hear button logs a "Could not load" warning.

### Tests

| Kind | Where | Run with |
| --- | --- | --- |
| Unit | `src/game`, `src/content`, `src/audio` (`*.test.js` beside the code) | `npm test` |
| API and integration | `server/*.test.js`: real Express server on a throwaway embedded MongoDB | `npm test` |
| Component | `src/screens`, `src/components` (`*.test.jsx`): React Testing Library + user-event in jsdom, with a real router | `npm test` |
| Accessibility | `src/screens/a11y.test.jsx` (axe, headings, focus, keyboard-only round) and the manual [checklist](docs/ACCESSIBILITY_CHECKLIST.md) | `npm test`, then by hand |
| End-to-end | `e2e/*.spec.js`: the demo scenarios, layout rules and a usability session in Chromium | `npm run test:e2e` |

No test uses mocks, spies, stubbed modules or fake timers. Stand-ins are passed in as parameters or props.

- Run `npm test` and `npm run lint` before every merge, and `npm run test:e2e` before a release.
- **First e2e run:** run `npx playwright install chromium` once. The e2e run starts its own API (on `.data/e2e`) and Vite unless they are already running on ports 3001 and 5173, and it resets the demo data before each test.

### Troubleshooting

- **"Can't reach the game" in the browser:** the API isn't running or `VITE_API_URL` is wrong. Check the `api` output in the terminal.
- **API exits with `EADDRINUSE`:** something else is using port 3001. Stop it or set `PORT` (and `VITE_API_URL`).
- **Embedded MongoDB won't start:** another API or `db:seed` process still has `.data/mongo` open. Stop it (or end any stray `mongod` process), then try again.
- **Hear buttons do nothing:** open the browser console. A "Could not load the … clip" warning means the clip file is missing or the API isn't reachable.
- **CORS errors in the console:** the page's origin isn't in `CLIENT_ORIGIN`.
- **Stuck on the sign-in screen, or "Please sign in again":** the session cookie isn't being sent. Check that the app and the API are on the same site (see Configuration), and that `COOKIE_SECURE` isn't `true` on plain `http://`. `npm run db:seed` also signs everyone out.
- **"Too many tries":** five wrong passwords for one username (or one unlock) locks it for 15 minutes. Restarting the API clears this.

## Structure

```
src/                 React app
  router.js            routes (React Router data mode)
  routes/              route loaders (fetch data) and route components (wire screens)
  screens/, components/  React UI
  api/                 the ONLY browser code that talks to the API (fetch)
  audio/               Howler.js clip player + clip naming
  content/             game titles/instructions, feedback text, settings options. Pure data,
                       shared with the server.
  game/                pure game logic: question generation, round reducer, summaries.
                       The server runs it to create rounds and apply actions; the browser
                       runs the reducer too so taps show instantly.
server/              Express API
  app.js               routes, CORS, static audio, error handling
  index.js             starts the API (connect DB → seed if empty → listen)
  db.js                MONGODB_URI or embedded MongoDB
  models/              Mongoose schemas
  repository.js        child, word, image, and round reads and writes
  auth/                sessions, password hashing, auth middleware
  routes/              /api/auth, /api/children, /api/rounds, /api/words, /api/images, /api/demo,
                       /api/test-sessions
  seed/                demo data, seed word list, and seed pictures (images/*.svg)
  scripts/             db:seed, audio:generate
  audio/               speech clips (.wav)
```

The API endpoints, data shapes, and module contracts are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Demo scenarios

0. **Sign in and pick a player:** open the app → sign in as `admin` / `admin` (a wrong password shows an error) → **Who's playing?** → add a child (e.g. "Sam") → pick **Alex**.
1. **Independent practice:** Play → Match the Word → Start → answer all five → "You finished 5 words!"
2. **Using support:** choose a wrong word ("Let's try again") → Help (shows the first-letter hint) → a word's Hear button → choose the right word → Pause / Continue → Next. (The "Tell us how you chose" note is off by default; turn on **Ask how they chose** in Settings to try it.)
3. **Tricky words:** Play → on the **Tricky Words** card press Hear to hear what it is → Start. The round only uses words that took more than one try in Alex's recent rounds.
4. **Resume:** start a round, answer two words, refresh the page. The round reloads from the database where you left off.
5. **Adult review:** Home → Parent or Teacher (top-left of the top bar) → enter the password `admin` → the overview lists every child with their finished rounds → View results for Alex → open the newest round → check attempts, help and audio use, and the note. Go Back to the child's screens and the password is asked again next time.
6. **Results per child:** in the parent/teacher view → Choose who's playing → pick Sam → play a round. Sam has no Tricky Words card yet, and Sam's round shows only under Sam's results.
7. **Sign out:** parent/teacher view → This device → Sign out. The app returns to the sign-in screen.

**Reset Demo Data** (in the parent/teacher view) removes your children's rounds and restores the three "Sample data" rounds.

## Usability test mode

For task-based usability sessions with a think-aloud tester and a facilitator who observes without helping. The facilitator's script and checklists are in [REVIEW_PLAN.md](REVIEW_PLAN.md).

1. **Start a session:** parent/teacher view → **Usability testing** → **Start Usability Test** → enter a tester label (e.g. "Tester 1") and pick the optional tasks (Tasks 1–4 are required) → **Start Session**. This resets the demo data (and Alex's reading settings) and returns to **Who's playing?**, ready to hand over.
2. **Open the facilitator console** at http://localhost:5173/facilitator **in a separate browser profile, a private window, or another device**, signed in as the same grown-up. A second window in the *same* browser profile shares the sign-in, and it locks whenever the tester goes back to the child's screens.
3. **Run the tasks:** the tester sees a small **task card** under each child screen ("Task 2 of 6" and the scenario only). On the console: **Start Task** → watch → **Completed Unaided / Completed With Hesitation / Failed** → **Next Task**. The console shows the elapsed time, the tester's current screen, and whether the task's signal was seen (a timing aid only). Add notes with a severity (1 minor, 2 recovered, 3 blocked).
4. **End Session** → results: one row per task (outcome, time on task, notes) plus every note. **Copy as Text** or **Download JSON**, then **New Tester Reset** for the next tester (label filled in, demo data reset).

Sessions are saved in MongoDB (`testSessions`), so either window can be refreshed. Only one session per grown-up can be active at a time.
