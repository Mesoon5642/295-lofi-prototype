// README demo scenario 5: a grown-up reviews the round Alex just finished.
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
  resetDemo,
  signInAndPickAlex,
  startMatchTheWord,
  wordButton,
  wordRow,
  wrongWord,
} from './helpers.js'

test.beforeEach(async ({ request }) => {
  await resetDemo(request)
})

test('the parent view shows the new round once, with the tricky word marked', async ({ page }) => {
  await signInAndPickAlex(page)
  const roundId = await startMatchTheWord(page)
  const round = await getRound(page.request, roundId)
  const tricky = round.questions[0]
  const wrong = wrongWord(tricky)

  // First word: a wrong try, Help, then the right word (two tries, help used).
  await wordButton(page, wrong).click()
  await expect(page.getByText("Let's try again")).toBeVisible()
  await page.getByRole('button', { name: 'Help', exact: true }).click()
  await expect(page.getByText(tricky.hint)).toBeVisible()
  await wordButton(page, tricky.target).click()
  await expect(nextButton(page)).toBeVisible()
  await nextButton(page).click()
  await finishRound(page, round, 1)

  // A refresh after finishing stays on the summary.
  await expect(page).toHaveURL(new RegExp(`/summary/${roundId}$`))
  await page.reload()
  await expect(page).toHaveURL(new RegExp(`/summary/${roundId}$`))
  await expect(pageHeading(page, 'You finished 5 words!')).toBeVisible()

  // Home → Parent or Teacher → password.
  await page.getByRole('main').getByRole('button', { name: 'Home', exact: true }).click()
  await expect(pageHeading(page, 'Hi, Alex!')).toBeVisible()
  await openParentView(page)
  await expect(alexRow(page)).toContainText(`${SAMPLE_ROUND_COUNT + 1} rounds finished`)

  // View results: the new round is listed exactly once, newest first.
  await alexRow(page).click()
  await expect(pageHeading(page, /Alex.s reading/)).toBeVisible()
  const rounds = completedRounds(page)
  await expect(rounds).toHaveCount(SAMPLE_ROUND_COUNT + 1)
  const newRounds = rounds.filter({ hasNotText: 'Sample data' })
  await expect(newRounds).toHaveCount(1)
  await expect(rounds.first()).not.toContainText('Sample data')
  await expect(newRounds.first()).toContainText(`Practice: ${tricky.target}`)

  // Open it: attempts, help and audio, and Needs practice on the tricky word only.
  await newRounds.first().getByRole('button').click()
  await expect(pageHeading(page, /Alex.s round/)).toBeVisible()
  await expect(page.getByText('5 words. Help used on 1. Audio used on 0.')).toBeVisible()

  const trickyCells = wordRow(page, tricky.target).getByRole('cell')
  await expect(trickyCells).toHaveText(['2', 'Yes', 'No', `${wrong}, ${tricky.target}`, '—', 'Needs practice'])

  for (const question of round.questions.slice(1)) {
    await expect(wordRow(page, question.target).getByRole('cell')).toHaveText([
      '1',
      'No',
      'No',
      question.target,
      '—',
      'No',
    ])
  }
})
