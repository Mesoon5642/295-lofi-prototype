// README demo scenario 1: independent practice.
import { expect, test } from '@playwright/test'
import {
  finishRound,
  getRound,
  pageHeading,
  resetDemo,
  signInAndPickAlex,
  startMatchTheWord,
} from './helpers.js'

test.beforeEach(async ({ request }) => {
  await resetDemo(request)
})

test('Alex plays a Match the Word round and answers all five words', async ({ page }) => {
  await signInAndPickAlex(page)
  const roundId = await startMatchTheWord(page)
  const round = await getRound(page.request, roundId)
  expect(round.questions).toHaveLength(5)

  await finishRound(page, round)

  await expect(page).toHaveURL(new RegExp(`/summary/${roundId}$`))
  await expect(pageHeading(page, 'You finished 5 words!')).toBeVisible()
  await expect(page.getByText('You kept trying. Great reading!')).toBeVisible()

  const saved = await getRound(page.request, roundId)
  expect(saved.status).toBe('completed')
  expect(saved.questions.every((q) => q.correct && q.attempts === 1)).toBe(true)
})
