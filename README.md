# Match the Word: reading game prototype

A browser-based reading game for young beginning readers, including children with dyslexia or other learning differences. A child plays a five-word "Match the Word" round and gets encouraging feedback. A parent or teacher can then review the results.

## Run it

```sh
npm install
npm run dev       # start the dev server (http://localhost:5173)
npm test          # unit tests (Vitest + jsdom)
npm run lint      # oxlint
npm run build     # production build in dist/
npm run preview   # serve the production build
```

## Structure

```
src/content/   activity data (words, hints, feedback text). Pure data.
src/game/      pure game logic: question generation, round reducer, summaries
src/storage/   progress repository (localStorage today, API calls later) + seed data
src/audio/     speechSynthesis availability check and speak()
src/components/ and src/screens/   React UI
```

Screens talk only to `storage/`, never to localStorage. To move to the planned Express + MongoDB backend, swap the internals of `src/storage/progressRepository.js` for API calls and keep its function names. Data shapes and module contracts are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Demo scenarios

1. **Independent practice:** Play → Start → answer all five → "You finished 5 words!"
2. **Using support:** choose a wrong word ("Let's try again") → Help (shows the first-letter hint) → a word's Hear button → choose the right word → Pause / Continue → Next. (The "Tell us how you chose" note is off by default; turn on **Ask how they chose** in Settings to try it.)
3. **Adult review:** Home → Parent or Teacher (top-left of the top bar) → sign in with `admin` / `admin` → open the newest round → check attempts, help and audio use, and the note → refresh the page and confirm the round is still listed once.

4. **Tricky words:** Play → on the **Tricky Words** card press Hear to hear what it is → Start. The round only uses words that took more than one try in recent rounds.

**Reset Demo Data** (in the adult view) removes real rounds and restores the three "Sample data" rounds.
