# Manual accessibility checklist

Run this by hand before each release or demo, and after any change to a child screen, a dialog or the Task card. It covers what the automated tests can't see. Who runs it and when is in [REVIEW_PLAN.md](../REVIEW_PLAN.md) §6.

| Part | Where | Run with |
| --- | --- | --- |
| Automated (jsdom): axe on every screen, one `h1`, focus on the heading, button names, a keyboard-only round, Task card focus order | `src/screens/a11y.test.jsx` | `npm test` |
| Layout (Chromium): child text size, 48 px buttons, visible focus outline, Task card overlap | `e2e/layout.spec.js` | `npm run test:e2e` |
| Everything else | this checklist | by hand |

**Setup:** `npm run dev`, open http://localhost:5173, sign in as `admin` / `admin` and pick **Alex**. Use Chrome or Edge at 100% zoom unless a step says otherwise. The child screens are **Start**, **Choose a game**, the **Activity** (a round of Match the Word) and the **Summary**. For the Task card steps, start a usability session from the Parent or Teacher view first.

Tick each box, and write anything that fails in the notes column of the results table at the bottom.

## 1. Text size and zoom

- [ ] At the **Standard** text size, child text (instructions, feedback, hints, lead lines) is about 24 px or more, and the answer words are clearly bigger (about 46 px). In DevTools, check the computed `font-size` of the instruction and one word button.
- [ ] Switch Alex to **Larger text** (Parent or Teacher → Alex → Reading settings → Text size). Every child screen grows, and nothing is clipped, cut off or overlapping.
- [ ] At browser zoom **200%** (Ctrl and +), on both text sizes, every child screen still fits: no text is clipped or overlaps, no buttons are hidden, and there's no sideways scrolling except in the grown-up tables (which say "scrolls sideways").
- [ ] At 200% the Task card still sits below the screen's content and never covers the word buttons, Help, Pause or Next.

## 2. Button size

- [ ] Every button on the child screens is at least **48 px** tall and wide enough to hit easily: word buttons, Hear, Hear Instructions, Help, Pause, Next, Continue, Play, Start, Play Again, Home, Back, Settings, and the Task card toggle.
- [ ] Buttons don't sit so close together that a tap on one could hit another (check the word list and the top bar on a tablet-sized window, 768 × 1024).

## 3. Colour contrast (WCAG AA)

Use the [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) with the colours from `:root` in `src/index.css`, or the contrast ratio shown in the DevTools colour picker. The axe extension or Accessibility Insights for Web can scan a whole page.

- [ ] Body text is at least **4.5:1** against its background, including muted text, notes, the hint box, "Let's try again", "Nice work!", the Sample data badge and error messages.
- [ ] Large text (24 px and up, or 19 px bold) is at least **3:1**.
- [ ] Button borders, the focus outline, checkboxes, radio buttons, toggle buttons and the progress dots are at least **3:1** against what's next to them.
- [ ] Nothing is shown by colour alone: a right answer also has a tick, a word that needs practice also has a flag and the words "Needs practice", and the pressed setting also has `aria-pressed`.
- [ ] Repeat a quick spot check with **OpenDyslexic** and **Larger text** on.

## 4. Visible focus

- [ ] Press Tab through every screen (child and grown-up). Every control shows a clear focus outline (a thick dark outline), including word buttons, the Task card toggle, links, inputs, checkboxes, radio buttons and the sideways-scrolling tables.
- [ ] When a new screen or question opens, its heading shows a dashed outline (focus moved there) and the next Tab goes to the next control after it.
- [ ] Focus is never lost to the top of the page after an action: after Next it moves to the new question, after Continue it returns to Pause, after Save or Skip on "Tell us how you chose" it moves to Next.

## 5. Screen reader reading order

Use **NVDA** (with Chrome or Firefox) or **Windows Narrator** (with Edge). Read each child screen from the top with the down arrow (browse/scan mode), then again with Tab.

- [ ] **Start:** "Hi, Alex!" heading → "Ready to read?" → Play. Parent or Teacher, Settings and Help are announced by name.
- [ ] **Choose a game:** "Choose a game" heading → each game's title → its description → "Hear about Match the Word" → Start (or Keep going). The game pictures aren't read.
- [ ] **Activity:** "Match the Word" heading → "1 of 5" → the instruction ("Word 1 of 5. Pick the word that matches the picture.") → "Mystery picture" → each word button and its "Hear *word*" button → Help, Pause, Next. Help sits in the top bar and Pause in the row above the instruction, so in browse mode they come before the heading; check that each is announced once, by name, and that the picture's name never gives away the answer.
- [ ] **Activity feedback:** "Let's try again", "Nice work!" and the hint are announced when they appear, without moving focus. A second wrong answer announces "Let's try again" again.
- [ ] **Summary:** "You finished 5 words!" heading → "You kept trying. Great reading!" → "Words you read" and each word → Play Again, Home. The star and the pictures aren't read.
- [ ] **Task card, expanded:** read after all of the screen's main content, as "Usability test task", then "Task 2 of 6, expanded", then the scenario.
- [ ] **Task card, collapsed:** only the toggle ("Task 2 of 6, collapsed") is read; the scenario is skipped.

## 6. Dialogs

- [ ] **Parent or Teacher** (UnlockDialog, from Start) and **Settings**: focus starts in the password field, Tab and Shift+Tab stay inside the dialog, and the page behind can't be reached or read.
- [ ] They close **only with the X** (Close) button: Escape does nothing and clicking the backdrop does nothing. After X, focus goes back to the button that opened the dialog.
- [ ] **Pause:** focus starts on Continue, Tab stays inside the dialog, and the question behind can't be reached. It closes with **Continue** or **Escape**, and focus returns to Pause. Backdrop clicks do nothing.
- [ ] The screen reader announces each dialog's title ("Parent or Teacher", "Grown-up settings", "Paused") when it opens.

## 7. Motion, flashing and timers

- [ ] Nothing flashes, blinks, slides or auto-plays on any child screen. The only motion is a short colour change on hover.
- [ ] With reduced motion on (Windows: Settings → Accessibility → Visual effects → Animation effects off, or DevTools → Rendering → Emulate `prefers-reduced-motion: reduce`), even the hover colour change is instant.
- [ ] **No timers on child screens:** nothing counts down, moves on by itself or disappears after a delay. Leave the Activity open for two minutes: the question, feedback and hint are all still there. No speed, score or time is ever shown to the child.

## 8. OpenDyslexic font

- [ ] Set Alex's font to **OpenDyslexic** (Reading settings → Font). Every child screen switches: words, instructions, feedback, hints and buttons.
- [ ] It still works with the network off after the page has loaded (the font is bundled in `src/assets/fonts/`), and the letters don't fall back to the standard font.
- [ ] The grown-up dialogs and the Task card stay in the standard font.
- [ ] OpenDyslexic with Larger text at 200% zoom still has no clipping or overlap.

## 9. Keyboard-only round

With the mouse unplugged or out of reach:

- [ ] From Start, reach Play, then Match the Word's Start, using only Tab, Shift+Tab, Enter and Space.
- [ ] Answer all five words, including one wrong answer, Help, a Hear button, and a Pause then Continue (once with Continue and once with Escape).
- [ ] With "Ask how they chose" on, type a reason and Save, and Skip on another word.
- [ ] Reach the Summary, then Play Again and Home. Nothing needs a mouse, and no key gets stuck in a control.

## Results

| Date | Who | Browser (version) | Screen reader (version) | Pass / fail and notes |
| --- | --- | --- | --- | --- |
| | | | | |
| | | | | |
