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

On first start the API writes the demo data into the database: child profile **Alex**, the grown-up account **`admin` / `admin`**, and three sample rounds. After that, data persists between restarts in `.data/mongo/` (git-ignored).

To run the two halves separately (e.g. in two terminals): `npm run dev:server` and `npm run dev:web`.

### All scripts

```sh
npm run dev             # API + React app together
npm run dev:server      # API only, with auto-restart
npm run dev:web         # React app only (needs the API running)
npm start               # API only, no auto-restart
npm test                # all tests (Vitest; server tests use a throwaway embedded MongoDB)
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

If you change `PORT`, change `VITE_API_URL` to match. If you serve the React app from a different port, add that origin to `CLIENT_ORIGIN`.

### Database

Mongoose schemas are in `server/models/`. Collections:

- `childProfiles`: a child's name plus their reading settings
- `adults`: parent/teacher accounts. Passwords are stored only as scrypt hashes.
- `rounds`: every round played, including each answer chosen

Looking at the data:
- With `MONGODB_URI` set, use MongoDB Compass or `mongosh` as usual.
- The embedded database only runs while the API runs, on a random port. Its connection string isn't printed, so the easiest way to inspect it is to point `MONGODB_URI` at a real MongoDB instead.

Resetting:
- **Reset Demo Data** (in the parent/teacher view) or `POST /api/demo/reset` removes all rounds and restores the sample rounds. Settings are kept.
- `npm run db:seed` wipes everything, settings and accounts included, and writes the demo data again. **Stop the API first** when using the embedded database, because only one process can open `.data/mongo` at a time.
- To start completely fresh, stop the API and delete `.data/`.

### Audio clips

Howler.js plays audio files, not text, so every spoken phrase is a pre-generated `.wav` in `server/audio/`, served by the API at `/audio/<name>.wav`:
- Each file is named after its text (`clipName` in `src/audio/clips.js`). For example, "Pick the word that matches the picture." becomes `pick-the-word-that-matches-the-picture.wav`.
- The committed clips use the Windows built-in voice as a placeholder. To use a real recording, save it over the file with the same name. No code change is needed.
- **After adding or changing words, instructions, or game descriptions** in `src/content/activities.js`, run `npm run audio:generate` on Windows, or add the new clips by hand on macOS/Linux. A test (`server/app.test.js`) fails if any phrase is missing a clip.

### Troubleshooting

- **"Can't reach the game" in the browser:** the API isn't running or `VITE_API_URL` is wrong. Check the `api` output in the terminal.
- **API exits with `EADDRINUSE`:** something else is using port 3001. Stop it or set `PORT` (and `VITE_API_URL`).
- **Embedded MongoDB won't start:** another API or `db:seed` process still has `.data/mongo` open. Stop it (or end any stray `mongod` process), then try again.
- **Hear buttons do nothing:** open the browser console. A "Could not load the … clip" warning means the clip file is missing or the API isn't reachable.
- **CORS errors in the console:** the page's origin isn't in `CLIENT_ORIGIN`.

## Structure

```
src/                 React app
  router.js            routes (React Router data mode)
  routes/              route loaders (fetch data) and route components (wire screens)
  screens/, components/  React UI
  api/                 the ONLY browser code that talks to the API (fetch)
  audio/               Howler.js clip player + clip naming
  content/             activity words, hints, feedback text, settings options. Pure data,
                       shared with the server.
  game/                pure game logic: question generation, round reducer, summaries
server/              Express API
  app.js               routes, CORS, static audio, error handling
  index.js             starts the API (connect DB → seed if empty → listen)
  db.js                MONGODB_URI or embedded MongoDB
  models/              Mongoose schemas
  repository.js        all database reads and writes
  routes/              /api/children, /api/rounds, /api/auth, /api/demo
  seed/                demo data and seeding
  scripts/             db:seed, audio:generate
  audio/               speech clips (.wav)
```

The API endpoints, data shapes, and module contracts are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Demo scenarios

1. **Independent practice:** Play → Match the Word → Start → answer all five → "You finished 5 words!"
2. **Using support:** choose a wrong word ("Let's try again") → Help (shows the first-letter hint) → a word's Hear button → choose the right word → Pause / Continue → Next. (The "Tell us how you chose" note is off by default; turn on **Ask how they chose** in Settings to try it.)
3. **Adult review:** Home → Parent or Teacher (top-left of the top bar) → sign in with `admin` / `admin` → open the newest round → check attempts, help and audio use, and the note → refresh the page (you'll need to sign in again) and confirm the round is still listed once.
4. **Tricky words:** Play → on the **Tricky Words** card press Hear to hear what it is → Start. The round only uses words that took more than one try in recent rounds.
5. **Resume:** start a round, answer two words, refresh the page. The round reloads from the database where you left off.

**Reset Demo Data** (in the adult view) removes real rounds and restores the three "Sample data" rounds.
