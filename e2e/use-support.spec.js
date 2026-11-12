// README demo scenarios 2 (using support) and 4 (resume after a refresh).
import { expect, test } from '@playwright/test'
import {
  answerCorrectly,
  getRound,
  nextButton,
  pressNext,
  progressText,
  resetDemo,
  signInAndPickAlex,
  startMatchTheWord,
  wordButton,
  wrongWord,
} from './helpers.js'

test.beforeEach(async ({ request }) => {
  await resetDemo(request)
})

test('wrong word, Help, Hear, the right word, Pause and Continue, then Next', async ({ page }) => {
  await signInAndPickAlex(page)
  const roundId = await startMatchTheWord(page)
  const round = await getRound(page.request, roundId)
  const question = round.questions[0]

  // A wrong word: gentle retry feedback, and the other words stay available.
  const wrong = wrongWord(question)
  await wordButton(page, wrong).click()
  await expect(page.getByText("Let's try again")).toBeVisible()
  await expect(wordButton(page, question.target)).toBeEnabled()
  await expect(nextButton(page)).toHaveCount(0)

  // Help shows the question's hint.
  await page.getByRole('button', { name: 'Help', exact: true }).click()
  await expect(page.getByText(question.hint)).toBeVisible()

  // A word's Hear button asks the API for that word's clip.
  const clipRequest = page.waitForRequest(
    (request) => new URL(request.url()).pathname === `/audio/${question.target}.wav`,
  )
  await page.getByRole('button', { name: `Hear ${question.target}`, exact: true }).click()
  await clipRequest

  // The right word locks the question and shows Next.
  await wordButton(page, question.target).click()
  await expect(page.getByText('Nice work!')).toBeVisible()
  for (const word of question.options) await expect(wordButton(page, word)).toBeDisabled()
  await expect(nextButton(page)).toBeVisible()

  // Pause and Continue.
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const paused = page.getByRole('dialog', { name: 'Paused' })
  await expect(paused).toBeVisible()
  await expect(paused.getByText('Take a break. Your place is saved.')).toBeVisible()
  await paused.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(paused).toBeHidden()

  await pressNext(page, round, 0)

  // The server stored the support used on the first word.
  await expect
    .poll(async () => {
      const saved = await getRound(page.request, roundId)
      const first = saved.questions[0]
      return {
        currentIndex: saved.currentIndex,
        paused: saved.paused,
        selections: first.selections,
        hintUsed: first.hintUsed,
        audioUsed: first.audioUsed,
      }
    })
    .toEqual({
      currentIndex: 1,
      paused: false,
      selections: [wrong, question.target],
      hintUsed: true,
      audioUsed: true,
    })
})

test('a refresh mid-round resumes on the third word', async ({ page }) => {
  await signInAndPickAlex(page)
  const roundId = await startMatchTheWord(page)
  const round = await getRound(page.request, roundId)

  for (const index of [0, 1]) {
    await answerCorrectly(page, round, index)
    await pressNext(page, round, index)
  }
  await expect(progressText(page, 3)).toBeVisible()
  // Wait until the server has both Nexts before reloading.
  await expect.poll(async () => (await getRound(page.request, roundId)).currentIndex).toBe(2)

  await page.reload()

  await expect(page).toHaveURL(new RegExp(`/play/${roundId}$`))
  await expect(progressText(page, 3)).toBeVisible()
  for (const word of round.questions[2].options) await expect(wordButton(page, word)).toBeVisible()
  await answerCorrectly(page, round, 2)
})
