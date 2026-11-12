// Demo check 3, automated: a facilitator runs a usability session in one browser
// context while a tester works through Tasks 1–4 in another (separate cookies, both
// signed in as admin, as two browser profiles would be).
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import {
  SAMPLE_ROUND_COUNT,
  alexRow,
  completedRounds,
  finishRound,
  getRound,
  nextButton,
  openParentView,
  pageHeading,
  pickAlex,
  resetDemo,
  roundIdFromUrl,
  signIn,
  startMatchTheWord,
  wordButton,
  wrongWord,
} from './helpers.js'

const OUTCOMES = [
  { id: 'completed_unaided', label: 'Completed Unaided' },
  { id: 'completed_with_hesitation', label: 'Completed With Hesitation' },
  { id: 'failed', label: 'Failed' },
  { id: 'completed_unaided', label: 'Completed Unaided' },
]
const TASK_TITLES = ['Start a round', 'Finish a round', 'Get help', 'Review as a parent']
const NOTES = [
  { task: 1, severity: 1, label: '1 minor', text: 'Looked for Play for a moment.' },
  { task: 2, severity: 2, label: '2 recovered', text: 'Tried a word before reading all three.' },
  { task: 3, severity: 3, label: '3 blocked', text: 'Could not find the hint at first.' },
]

test.beforeEach(async ({ request }) => {
  await resetDemo(request)
})

test.afterEach(async ({ request }) => {
  // Leave no session running for whoever uses the app next.
  await resetDemo(request)
})

// Facilitator console pieces.
function consoleParts(page) {
  const facts = page.locator('.facilitator__facts')
  return {
    taskHeading: page.getByRole('heading', { level: 2, name: /^Task \d+ of \d+:/ }),
    testerScreen: facts.locator('dt', { hasText: 'screen' }).locator('xpath=following-sibling::dd[1]'),
    timer: facts.locator('dt', { hasText: 'Time on task' }).locator('xpath=following-sibling::dd[1]'),
    startTask: page.getByRole('button', { name: 'Start Task', exact: true }),
    outcome: (label) =>
      page.getByRole('group', { name: 'Outcome' }).getByRole('button', { name: label, exact: true }),
    nextTask: page.getByRole('button', { name: 'Next Task', exact: true }),
    notesSoFar: page.getByRole('region', { name: 'Notes so far' }),
  }
}

async function startTask(facilitator, number) {
  const parts = consoleParts(facilitator)
  await expect(parts.taskHeading).toHaveText(`Task ${number} of 4: ${TASK_TITLES[number - 1]}`)
  for (const outcome of OUTCOMES.slice(0, 3)) await expect(parts.outcome(outcome.label)).toBeDisabled()
  await parts.startTask.click()
  await expect(parts.startTask).toBeDisabled()
  await expect(parts.outcome(OUTCOMES[number - 1].label)).toBeEnabled()
}

async function chooseOutcome(facilitator, number) {
  const button = consoleParts(facilitator).outcome(OUTCOMES[number - 1].label)
  await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  await expect(consoleParts(facilitator).timer).toContainText('(stopped)')
}

async function addNote(facilitator, note) {
  await facilitator.getByLabel('Note', { exact: true }).fill(note.text)
  await facilitator.getByRole('radio', { name: note.label, exact: true }).check()
  await facilitator.getByRole('button', { name: 'Save note', exact: true }).click()
  await expect(facilitator.getByText('Note saved.')).toBeVisible()
  await expect(consoleParts(facilitator).notesSoFar).toContainText(note.text)
  await expect(consoleParts(facilitator).notesSoFar).toContainText(`Severity ${note.label}`)
}

function taskCardToggle(tester, number) {
  return tester
    .getByRole('complementary', { name: 'Usability test task' })
    .getByRole('button', { name: `Task ${number} of 4`, exact: true })
}

test('a facilitator runs Tasks 1–4 with a tester, then ends, exports and resets', async ({
  browser,
}) => {
  test.setTimeout(240_000)
  const testerContext = await browser.newContext()
  const facilitatorContext = await browser.newContext({ acceptDownloads: true })
  const tester = await testerContext.newPage()
  const facilitator = await facilitatorContext.newPage()
  const fc = consoleParts(facilitator)

  try {
    // The facilitator signs in first, so their own sign-in isn't logged as the tester's.
    await signIn(facilitator)

    // The tester's window starts the session from the parent view.
    await signIn(tester)
    await tester.goto('/parent')
    await expect(pageHeading(tester, 'Parent or Teacher')).toBeVisible()
    const testing = tester.getByRole('region', { name: 'Usability testing' })
    await testing.getByRole('button', { name: 'Start Usability Test' }).click()
    await testing.getByLabel('Tester label').fill('Tester 1')
    for (const title of TASK_TITLES) {
      const box = testing.getByRole('checkbox', { name: `${title} (required)` })
      await expect(box).toBeChecked()
      await expect(box).toBeDisabled()
    }
    await testing.getByRole('button', { name: 'Start Session' }).click()
    await expect(pageHeading(tester, /Who.s playing\?/)).toBeVisible()
    await pickAlex(tester)
    await expect(taskCardToggle(tester, 1)).toBeVisible()
    await expect(tester.getByText('Get Alex into a round of Match the Word.')).toBeVisible()

    // The console shows the session and where the tester is.
    await facilitator.goto('/facilitator')
    await expect(pageHeading(facilitator, 'Facilitator console')).toBeVisible()
    await expect(facilitator.getByText(/^Tester 1 · Started/)).toBeVisible()
    await expect(fc.testerScreen).toHaveText('Start')
    await expect(fc.timer).toHaveText('Not started')

    // Task 1: start a round.
    await startTask(facilitator, 1)
    const firstRoundId = await startMatchTheWord(tester)
    await expect(fc.testerScreen).toHaveText('Activity')
    await chooseOutcome(facilitator, 1)
    await addNote(facilitator, NOTES[0])
    await fc.nextTask.click()
    await expect(fc.taskHeading).toHaveText('Task 2 of 4: Finish a round')
    await expect(taskCardToggle(tester, 2)).toBeVisible()

    // Task 2: finish it.
    await startTask(facilitator, 2)
    const firstRound = await getRound(tester.request, firstRoundId)
    await finishRound(tester, firstRound)
    await expect(fc.testerScreen).toHaveText('Summary')
    await chooseOutcome(facilitator, 2)
    await addNote(facilitator, NOTES[1])
    await fc.nextTask.click()
    await expect(fc.taskHeading).toHaveText('Task 3 of 4: Get help')
    await expect(taskCardToggle(tester, 3)).toBeVisible()

    // Task 3: another round with a wrong answer, Help, Hear, Pause and Continue.
    await startTask(facilitator, 3)
    await tester.getByRole('button', { name: 'Play Again', exact: true }).click()
    await expect(tester).toHaveURL(/\/play\/[^/]+$/)
    const secondRound = await getRound(tester.request, roundIdFromUrl(tester))
    const question = secondRound.questions[0]
    await expect(fc.testerScreen).toHaveText('Activity')
    await wordButton(tester, wrongWord(question)).click()
    await expect(tester.getByText("Let's try again")).toBeVisible()
    await tester.getByRole('button', { name: 'Help', exact: true }).click()
    await expect(tester.getByText(question.hint)).toBeVisible()
    const clip = tester.waitForRequest((r) => new URL(r.url()).pathname === `/audio/${question.target}.wav`)
    await tester.getByRole('button', { name: `Hear ${question.target}`, exact: true }).click()
    await clip
    await wordButton(tester, question.target).click()
    await expect(nextButton(tester)).toBeVisible()
    await tester.getByRole('button', { name: 'Pause', exact: true }).click()
    const paused = tester.getByRole('dialog', { name: 'Paused' })
    await expect(paused).toBeVisible()
    await paused.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(paused).toBeHidden()
    // The console's signal for Task 3 comes from the stored round.
    await expect(facilitator.getByText(/^Seen/)).toBeVisible()
    await chooseOutcome(facilitator, 3)
    await addNote(facilitator, NOTES[2])
    await fc.nextTask.click()
    await expect(fc.taskHeading).toHaveText('Task 4 of 4: Review as a parent')
    await expect(fc.nextTask).toBeDisabled()
    await expect(taskCardToggle(tester, 4)).toBeVisible()

    // Task 4: the parent view, opening the newest round.
    await startTask(facilitator, 4)
    await tester.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(pageHeading(tester, 'Choose a game')).toBeVisible()
    await tester.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(pageHeading(tester, 'Hi, Alex!')).toBeVisible()
    await openParentView(tester)
    await expect(fc.testerScreen).toHaveText('Parent or Teacher')
    await expect(alexRow(tester)).toContainText(`${SAMPLE_ROUND_COUNT + 1} rounds finished`)
    await alexRow(tester).click()
    await expect(pageHeading(tester, /Alex.s reading/)).toBeVisible()
    await expect(fc.testerScreen).toHaveText('Child results')
    const newest = completedRounds(tester).filter({ hasNotText: 'Sample data' })
    await expect(newest).toHaveCount(1)
    await newest.getByRole('button').click()
    await expect(pageHeading(tester, /Alex.s round/)).toBeVisible()
    await expect(facilitator.getByText(/^Seen/)).toBeVisible()
    await chooseOutcome(facilitator, 4)

    // Both windows survive a refresh: the console reads everything from the server.
    await tester.reload()
    await expect(pageHeading(tester, /Alex.s reading/)).toBeVisible()
    await facilitator.reload()
    await expect(pageHeading(facilitator, 'Facilitator console')).toBeVisible()
    await expect(fc.taskHeading).toHaveText('Task 4 of 4: Review as a parent')
    await expect(fc.outcome('Completed Unaided')).toHaveAttribute('aria-pressed', 'true')
    await expect(fc.testerScreen).toHaveText('Child results')
    await expect(fc.notesSoFar.getByRole('listitem')).toHaveCount(3)
    for (const note of NOTES) {
      await expect(fc.notesSoFar).toContainText(note.text)
      await expect(fc.notesSoFar).toContainText(`Task ${note.task} ·`)
    }

    // End Session (with confirmation) → results.
    await facilitator.getByRole('button', { name: 'End Session', exact: true }).click()
    await facilitator
      .getByRole('group', { name: 'Confirm End Session' })
      .getByRole('button', { name: 'Yes, end session' })
      .click()
    await expect(facilitator.getByRole('heading', { level: 2, name: 'Results: Tester 1' })).toBeVisible()
    await expect(facilitator).toHaveURL(/\/facilitator\?session=test-/)

    const results = facilitator.getByRole('region', { name: 'Task results, scrolls sideways' })
    const taskRows = results.getByRole('row').filter({ has: facilitator.getByRole('rowheader') })
    await expect(taskRows).toHaveCount(4)
    for (let i = 0; i < 4; i += 1) {
      const row = taskRows.nth(i)
      await expect(row.getByRole('rowheader')).toHaveText(`${i + 1}. ${TASK_TITLES[i]}`)
      const cells = row.getByRole('cell')
      await expect(cells.nth(0)).toHaveText(OUTCOMES[i].label)
      await expect(cells.nth(1)).toHaveText(/^\d+:\d{2}$/)
      const note = NOTES.find((n) => n.task === i + 1)
      await expect(cells.nth(2)).toHaveText(note ? `(${note.label}) ${note.text}` : '—')
    }
    const allNotes = facilitator.getByRole('region', { name: 'All notes' }).getByRole('listitem')
    await expect(allNotes).toHaveCount(3)
    for (let i = 0; i < NOTES.length; i += 1) {
      await expect(allNotes.nth(i)).toContainText(`Task ${NOTES[i].task} ·`)
      await expect(allNotes.nth(i)).toContainText(`Severity ${NOTES[i].label}`)
      await expect(allNotes.nth(i)).toContainText(NOTES[i].text)
    }

    // Download JSON: the file has the same outcomes and notes.
    const downloading = facilitator.waitForEvent('download')
    await facilitator.getByRole('button', { name: 'Download JSON', exact: true }).click()
    const download = await downloading
    expect(download.suggestedFilename()).toMatch(/^usability-tester-1-\d{4}-\d{2}-\d{2}\.json$/)
    const exported = JSON.parse(await readFile(await download.path(), 'utf8'))
    expect(exported.testerLabel).toBe('Tester 1')
    expect(exported.status).toBe('ended')
    expect(exported.tasks.map((task) => task.outcome)).toEqual(OUTCOMES.map((o) => o.id))
    expect(exported.tasks.every((task) => task.startedAt && task.endedAt)).toBe(true)
    expect(exported.notes.map(({ severity, text }) => ({ severity, text }))).toEqual(
      NOTES.map(({ severity, text }) => ({ severity, text })),
    )

    // New Tester Reset (with confirmation) → the start form for Tester 2.
    await facilitator.getByRole('button', { name: 'New Tester Reset', exact: true }).click()
    await facilitator
      .getByRole('group', { name: 'Confirm New Tester Reset' })
      .getByRole('button', { name: 'Yes, reset' })
      .click()
    await expect(facilitator).toHaveURL(/\/parent\?startTest=1/)
    await expect(pageHeading(facilitator, 'Parent or Teacher')).toBeVisible()
    const nextForm = facilitator.getByRole('region', { name: 'Usability testing' })
    await expect(nextForm.getByLabel('Tester label')).toHaveValue('Tester 2')
    await expect(alexRow(facilitator)).toContainText(`${SAMPLE_ROUND_COUNT} rounds finished`)

    // Only the sample rounds are left (checked in the tester's window, still unlocked).
    await tester.goto('/parent/child-alex')
    await expect(pageHeading(tester, /Alex.s reading/)).toBeVisible()
    await expect(completedRounds(tester)).toHaveCount(SAMPLE_ROUND_COUNT)
    await expect(completedRounds(tester).filter({ hasNotText: 'Sample data' })).toHaveCount(0)

    // The next session starts clean: no outcomes, no notes.
    await nextForm.getByRole('button', { name: 'Start Session' }).click()
    await expect(pageHeading(facilitator, /Who.s playing\?/)).toBeVisible()
    await facilitator.goto('/facilitator')
    await expect(facilitator.getByText(/^Tester 2 · Started/)).toBeVisible()
    await expect(fc.taskHeading).toHaveText('Task 1 of 4: Start a round')
    await expect(fc.timer).toHaveText('Not started')
    for (const outcome of OUTCOMES.slice(0, 3)) {
      await expect(fc.outcome(outcome.label)).toHaveAttribute('aria-pressed', 'false')
    }
    await expect(fc.notesSoFar).toHaveText(/No notes yet\./)
  } finally {
    await testerContext.close()
    await facilitatorContext.close()
  }
})
