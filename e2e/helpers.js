// Shared helpers for the Playwright end-to-end tests (`npm run test:e2e`).
// The React app runs on http://localhost:5173 (baseURL) and the API on
// http://localhost:3001, so API calls use absolute URLs. Writes must be JSON.
import { expect } from '@playwright/test'

export const API = 'http://localhost:3001'
export const ALEX_ID = 'child-alex'
export const SAMPLE_ROUND_COUNT = 3
export const REQUIRED_TASK_IDS = ['start-round', 'finish-round', 'get-help', 'review-as-parent']
export const DEFAULT_SETTINGS = {
  textSize: 'standard',
  font: 'standard',
  wordAudio: 'on',
  explanations: 'off',
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

async function expectOk(response, what) {
  if (!response.ok()) {
    throw new Error(`${what} failed: ${response.status()} ${await response.text()}`)
  }
  return response
}

export async function apiGet(request, path) {
  const response = await expectOk(await request.get(`${API}${path}`), `GET ${path}`)
  return response.json()
}

export async function apiPost(request, path, data = {}) {
  const response = await expectOk(
    await request.post(`${API}${path}`, { headers: JSON_HEADERS, data }),
    `POST ${path}`,
  )
  return response.json()
}

// Signs `request` (an APIRequestContext) in as admin. A fresh sign-in starts unlocked.
// Always the right password, so the sign-in lockout never trips.
export async function apiSignIn(request) {
  return apiPost(request, '/api/auth/sign-in', { username: 'admin', password: 'admin' })
}

// Puts the demo back the way it starts: no active usability session, only the
// sample rounds, and Alex on default reading settings.
export async function resetDemo(request) {
  await apiSignIn(request)
  const sessions = await apiGet(request, '/api/test-sessions')
  for (const session of sessions) {
    if (session.status === 'active') await apiPost(request, `/api/test-sessions/${session.id}/end`)
  }
  await apiPost(request, '/api/demo/reset')
  await expectOk(
    await request.patch(`${API}/api/children/${ALEX_ID}/settings`, {
      headers: JSON_HEADERS,
      data: DEFAULT_SETTINGS,
    }),
    'PATCH settings',
  )
}

// Starts a usability test session through the API (resets demo data too).
export async function apiStartTestSession(request, testerLabel = 'E2E tester') {
  await apiSignIn(request)
  return apiPost(request, '/api/test-sessions', {
    testerLabel,
    childId: ALEX_ID,
    taskIds: REQUIRED_TASK_IDS,
  })
}

// Reads a round. Pass `page.request` to use the page's own (signed-in) cookies.
export async function getRound(request, roundId) {
  return apiGet(request, `/api/rounds/${encodeURIComponent(roundId)}`)
}

export function pageHeading(page, name) {
  return page.getByRole('heading', { level: 1, name })
}

export const WHOS_PLAYING = /Who.s playing\?/

// Signs in through the real sign-in screen and lands on Who's playing?.
export async function signIn(page) {
  await page.goto('/sign-in')
  await expect(pageHeading(page, 'Grown-up sign in')).toBeVisible()
  await page.getByLabel('Username', { exact: true }).fill('admin')
  await page.getByLabel('Password', { exact: true }).fill('admin')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(pageHeading(page, WHOS_PLAYING)).toBeVisible()
}

// On Who's playing?: hands the device to Alex (the Start screen).
export async function pickAlex(page) {
  await page.getByRole('button', { name: 'Alex', exact: true }).click()
  await expect(pageHeading(page, 'Hi, Alex!')).toBeVisible()
}

export async function signInAndPickAlex(page) {
  await signIn(page)
  await pickAlex(page)
}

// From the Start screen: Play → Choose a game → Match the Word's Start. Returns the
// round id from the URL.
export async function startMatchTheWord(page) {
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(pageHeading(page, 'Choose a game')).toBeVisible()
  await startMatchTheWordFromChooser(page)
  return roundIdFromUrl(page)
}

export async function startMatchTheWordFromChooser(page) {
  await page
    .getByRole('region', { name: 'Match the Word' })
    .getByRole('button', { name: /^(Start|Keep going)$/ })
    .click()
  await expect(page).toHaveURL(/\/play\/[^/]+$/)
  await expect(pageHeading(page, 'Match the Word')).toBeVisible()
}

export function roundIdFromUrl(page) {
  const match = /\/(?:play|summary)\/([^/?#]+)/.exec(new URL(page.url()).pathname)
  if (!match) throw new Error(`No round id in ${page.url()}`)
  return decodeURIComponent(match[1])
}

// An answer word on the activity screen (not its "Hear <word>" button).
export function wordButton(page, word) {
  return page.getByRole('main').getByRole('button', { name: word, exact: true })
}

export function progressText(page, number, total = 5) {
  return page.getByText(`${number} of ${total}`, { exact: true })
}

export function nextButton(page) {
  return page.getByRole('button', { name: 'Next', exact: true })
}

// A word on screen that isn't the answer.
export function wrongWord(question) {
  return question.options.find((word) => word !== question.target)
}

// Picks the right word for question `index` (0-based) and waits for Next.
export async function answerCorrectly(page, round, index) {
  await expect(progressText(page, index + 1, round.questions.length)).toBeVisible()
  await wordButton(page, round.questions[index].target).click()
  await expect(nextButton(page)).toBeVisible()
}

// Presses Next and waits for the next question (or the summary after the last one).
export async function pressNext(page, round, index) {
  await nextButton(page).click()
  if (index + 1 < round.questions.length) {
    await expect(progressText(page, index + 2, round.questions.length)).toBeVisible()
  } else {
    await expect(pageHeading(page, `You finished ${round.questions.length} words!`)).toBeVisible()
  }
}

// Answers questions `from`..last correctly, pressing Next after each.
export async function finishRound(page, round, from = 0) {
  for (let i = from; i < round.questions.length; i += 1) {
    await answerCorrectly(page, round, i)
    await pressNext(page, round, i)
  }
}

// From the Start screen: Parent or Teacher → password → the overview.
export async function openParentView(page) {
  await page.getByRole('button', { name: 'Parent or Teacher', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Parent or Teacher' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Parent or teacher password').fill('admin')
  await dialog.getByRole('button', { name: 'Open', exact: true }).click()
  await expect(pageHeading(page, 'Parent or Teacher')).toBeVisible()
}

// The overview's button for Alex ("Alex  N rounds finished … View results").
export function alexRow(page) {
  return page.getByRole('region', { name: 'Children' }).getByRole('button', { name: /^Alex\b/ })
}

export function completedRounds(page) {
  return page.getByRole('region', { name: 'Completed rounds' }).getByRole('listitem')
}

// Rows of the round detail table, by word.
export function wordRow(page, word) {
  return page
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: word, exact: true }) })
}
