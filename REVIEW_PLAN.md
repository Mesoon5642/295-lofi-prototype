# Testing and Usability Prototype: review and non-code work plan

Source: *Testing and Usability Prototype Design Brief*. This file covers everything in the brief that isn't writing code: decisions, running usability sessions, manual checks, demo preparation and follow-up work. The code and test changes are in [TESTING_PLAN.md](TESTING_PLAN.md).

## 1. Purpose and roles

The prototype exists to learn how real people use the game: where they hesitate, what they misread, and whether they find help, audio, pause and the parent view **without being told**.

| Role | Who | Responsibilities |
| --- | --- | --- |
| Tester | Peers / volunteers | Act as the child (Alex) for Tasks 1–3 and 5–6, and as Alex's parent or teacher for Task 4. Think aloud the whole time. |
| Facilitator | A team member | Runs the session from the facilitator console, observes without helping, records outcomes and notes. |
| Note-taker (optional) | A second team member | Watches the tester and adds notes when the facilitator is busy. Only one person should press outcome buttons. |
| Checklist owner | A team member | Runs the manual accessibility checklist before each release. |

## 2. Decisions to sign off before building

Settle these as a team before starting commit C1. The recommendations come from TESTING_PLAN.md §1.

- [ ] **Access model for `/api/test-sessions`.**
  - Recommendation: facilitator actions need the unlocked (elevated) session.
  - The tester window only reads the active task and logs events with a normal session, because that window is locked once Alex is picked.
  - This differs from the brief's wording ("use the existing elevated-access middleware"), so record the reason.
- [ ] **Facilitator device setup.**
  - Recommendation: run the console in a separate browser profile, private window, or second device, signed in as the same grown-up.
  - A second window in the *same* browser profile shares the cookie and gets locked whenever the tester returns to child screens.
- [ ] **Resetting settings between testers.** Recommendation: Start Session and New Tester Reset also put Alex's reading settings back to default. Otherwise Task 6 (large text) carries over to the next tester.
- [ ] **Default task set.**
  - Tasks 1–4 are required.
  - Decide whether Tasks 5 (Tricky Words) and 6 (text size) run by default or only when time allows.
  - Task 5 depends on Alex having tricky words, which Task 3's wrong answer and the sample rounds provide.
- [ ] **Tester labels.** Agree on `Tester 1`, `Tester 2`, … with no names or other identifying details in labels or notes.
- [ ] **Component test file naming.** The brief says `*.test.js`, but tests containing JSX need `*.test.jsx`. Confirm that's acceptable.

## 3. Usability study preparation

### 3.1 Facilitator script (write it, then rehearse it)

1. **Welcome:**
   - "We're testing the game, not you. There are no wrong answers."
   - Explain that they'll be asked to think aloud, and that the facilitator can't help or answer questions about the screen.
2. **Role briefing:** "For most tasks, pretend you're Alex, a young child learning to read. For one task you'll be Alex's parent." Don't mention any button names.
3. **Practice think-aloud** on something unrelated, for about 30 seconds.
4. **Per task:**
   - Ask them to read the Task card scenario aloud, then press **Start Task**.
   - Prompt only with neutral phrases: "What are you thinking?" or "What are you looking for?"
   - Never point or hint.
5. **Ending a task:** choose the outcome as soon as the goal is met or abandoned (see the rubric below), then press **Next Task**.
6. **Debrief** (about 3 minutes): what was confusing, what they expected to find, and whether anything was too small or too fast.
7. **Thanks.** Then New Tester Reset.

### 3.2 Outcome and severity rubrics (the same for every facilitator)

| Outcome | Use when |
| --- | --- |
| Completed Unaided | Goal reached with no noticeable hesitation or wrong turns. |
| Completed With Hesitation | Goal reached, but with a pause of more than ~10 s, a wrong turn, backtracking, or the tester saying they're unsure. |
| Failed | The tester gives up, asks for help, or hasn't reached the goal after ~3 minutes. |

| Severity | Meaning | Example |
| --- | --- | --- |
| 1 Minor | Noticed, no real impact | Tester comments that the picture is small |
| 2 Recovered | Caused a mistake or delay, but the tester recovered alone | Tapped Back looking for Help, then found it |
| 3 Blocked | Prevented the task without intervention | Couldn't find the Parent or Teacher entry |

The app's logged signal (for example "a round for Alex is created") is **only a timing aid**. The facilitator's outcome button decides whether a task counts as completed.

### 3.3 Logistics checklist

- [ ] Recruit testers for the prototype round: classmates, friends or team members who haven't seen the app. Aim for 4–5.
- [ ] Book times and plan about 25 minutes per tester (6 tasks plus intro and debrief).
- [ ] Hardware:
  - a tester device, ideally a tablet or touchscreen laptop, since the game targets touch
  - a facilitator device or second browser profile, and working speakers or headphones (Task 3 needs audio)
- [ ] Environment: `npm run dev` running, the tester device signed in as `admin`, and the facilitator console open at `/facilitator`.
- [ ] **Pilot session** with a team member before real testers: check the task wording, timings and the rubrics, and fix the script.
- [ ] Prepare a short consent and verbal-agreement statement: what's recorded (task outcomes, times, screen names, notes), that there's no video or audio recording, and that results are anonymous by tester label.

## 4. Running each session (per-tester checklist)

1. Parent or Teacher view → **Start Usability Test** → confirm the tester label and tasks → **Start Session**. This resets demo data and lands on Who's playing?
2. Hand the tester device over on **Who's playing?**. The tester starts Task 1 from there.
3. Run Tasks 1–4, and 5–6 if included, following the script. Add notes with a severity as issues happen.
4. For Task 3, **watch for Pause and Continue** and note it explicitly. Pause isn't stored, so only the facilitator can confirm it.
5. **End Session** → check that the results rows look right (each outcome, time on task and notes).
6. **Download JSON** and **Copy as Text** into the team's shared notes folder, with the file named after the tester label and date.
7. **New Tester Reset** → confirm the next label is filled in and the sample rounds show "Sample data".

## 5. Final submission demo (completion checks from the brief)

Rehearse all three at least once before the final demo.

- [ ] **Demo 1 – automated tests pass.**
  1. Run `npm test` and `npm run lint` live.
  2. Point out that the new unit, API, component and accessibility tests run alongside the existing ones.
  3. Break the round reducer on purpose (the step is in TESTING_PLAN.md §9), show a test failing, and undo the change.
- [ ] **Demo 2 – end-to-end flows.** Run `npm run test:e2e` (use `--headed` so the audience sees the browser). Point out the refresh mid-round and the check that the adult view shows the new round **once**.
- [ ] **Demo 3 – facilitator session (by hand):**
  1. Open the Parent or Teacher view and start a session.
  2. Open the facilitator console in a second window (separate profile).
  3. Play Tasks 1–4 as the tester, adding notes with severities 1, 2 and 3.
  4. End the session and check the results: outcomes, times and notes are correct.
  5. **Refresh** and verify they remain.
  6. Use **New Tester Reset** and confirm the next session starts clean.
- [ ] **Existing behaviour is unchanged:** walk through README demo scenarios 0–7 with no session active and confirm the child flow and Parent or Teacher view behave as before.
- [ ] **Environment prep on the demo machine:**
  - `npm install`
  - `npx playwright install chromium`
  - one prior `npm run dev` so the MongoDB binary has already downloaded (about 100 MB, needs internet)
  - a closed `.data/mongo` lock if `db:seed` was used
  - the audio clips present.

## 6. Manual accessibility checklist

The checklist itself lives in `docs/ACCESSIBILITY_CHECKLIST.md` (created in commit C2). This section covers how to run it.

- **When:** before each release or demo, and after any change to a child screen or the Task card.
- **Who:** the checklist owner; rotate it so more than one person knows how.
- **What:**
  - **Text size:** child text at default and large settings, and browser zoom at 200% (nothing clipped or overlapping).
  - **Colour contrast:** check text and button colours against WCAG AA (4.5:1 body text, 3:1 large text and UI) with a contrast checker or browser DevTools.
  - **Screen reader reading order:** use NVDA or Windows Narrator on each child screen. Check the reading order (heading → instruction → picture "Mystery picture" → word buttons → Help/Pause/Next), that the collapsed Task card isn't read, and that the expanded card is read after the main content.
  - **Focus:** visible on every control, with no focus traps except the dialogs (and those dialogs can be closed with X).
  - **No flashing or motion, and no timers on child screens.**
- **Record:** the date, who ran it, the browser and screen reader versions, and pass/fail per item, in a short table at the bottom of the checklist or in the release notes.

## 7. Team process

- **Regression rule:** everyone runs `npm test` and `npm run lint` before every merge, and the Playwright suite (`npm run test:e2e`) before a release or demo.
- **Code review:** reviewers check that each PR keeps the "no mocks, spies, stubbed modules or fake timers" rule and keeps tests beside the code.
- **Optional:** a CI job running `npm test` and `npm run lint` on each push. The brief doesn't require it; add it only if time allows.

## 8. After the prototype (next steps from the brief)

1. **Analyse notes:**
   - Merge the exported JSON from all testers and group notes by screen.
   - Rank issues by severity × number of testers who hit them. A simple spreadsheet is enough; the brief says no charts.
2. **Fix the top issues:**
   - Turn the top 3–5 issues into tickets.
   - Each fix ships with a new test that guards it (component, accessibility or e2e, whichever catches it).
3. **Educator review:** have one or more educators (for example a reading specialist or early-years teacher) review the task wording and the in-game hints for age-appropriateness and for learners with dyslexia.
4. **Testing with real children, parents and teachers:**
   - Before involving minors, check what consent is required: written parental consent, child assent, and any university or course ethics or IRB requirements.
   - Plan for shorter sessions and a parent present.
   - This is **after** the prototype; prototype sessions use adult testers role-playing.
5. **Release routine:** add the manual accessibility checklist (§6) to the release checklist so it runs every time, not just for the demo.

## 9. Out of scope for this prototype

- Real tester accounts (sessions use the existing `admin` grown-up and child Alex)
- Video or audio recording of sessions
- Charts or dashboards of results
- Any change to word content, game rules or existing screens beyond what the brief specifies

## 10. Risks and open questions

| Risk / question | Mitigation |
| --- | --- |
| The 10-minute unlock expires during a long session and the console shows the password gate | Expected; re-enter the password. The console reloads with its state intact from the server. Mention it in the facilitator script. |
| Testers see the Task card as part of the game | Introduce the card in the welcome ("instructions from us appear here"). Watch for this in the pilot. |
| Task 5 has no tricky words if earlier tasks went perfectly | Task 3 asks for a wrong answer, and the sample rounds already contain multi-try words. Confirm this in the pilot. |
| Audio doesn't play on the test device | Check speakers in the setup checklist. Hear needs the API to serve `/audio/*.wav`. |
| Embedded MongoDB is slow to start on first run, or blocked by a stray `mongod` process | Start the app before testers arrive; see README Troubleshooting. |
| Time budget before the final submission | C1 (feature) is the riskiest part, so build it first. The e2e and layout specs can be trimmed to the three demo scenarios if time runs short. |
