// Real-browser layout rules for the child screens (TESTING_PLAN.md §7): jsdom can't
// compute sizes, so these run in Chromium at a laptop and a tablet size.
import { expect, test } from '@playwright/test'
import {
  answerCorrectly,
  apiStartTestSession,
  getRound,
  nextButton,
  pageHeading,
  resetDemo,
  signInAndPickAlex,
  startMatchTheWordFromChooser,
} from './helpers.js'

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 768, height: 1024 },
]
const MIN_TEXT_PX = 22
const MIN_BUTTON_PX = 48

async function fontSize(locator) {
  return locator.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
}

async function expectLargeText(locator, what) {
  const count = await locator.count()
  expect(count, `${what} on screen`).toBeGreaterThan(0)
  for (let i = 0; i < count; i += 1) {
    expect(await fontSize(locator.nth(i)), `${what} #${i + 1} font-size`).toBeGreaterThanOrEqual(
      MIN_TEXT_PX,
    )
  }
}

async function expectTallButtons(page, screen) {
  const buttons = await page.getByRole('button').all()
  expect(buttons.length).toBeGreaterThan(0)
  for (const button of buttons) {
    if (!(await button.isVisible())) continue
    const box = await button.boundingBox()
    const name = (await button.textContent())?.trim()
    expect(box, `${screen}: "${name}" has a box`).not.toBeNull()
    expect(box.height, `${screen}: "${name}" height`).toBeGreaterThanOrEqual(MIN_BUTTON_PX)
  }
}

// Tabs through `count` focusable elements; each must show a focus ring. Tabbing past
// the last element leaves the document (focus on <body>) before wrapping to the top,
// so those stops are skipped.
async function expectVisibleFocus(page, screen, count = 3) {
  let checked = 0
  for (let i = 0; checked < count; i += 1) {
    expect(i, `${screen}: ${count} focusable elements within ${count * 3} Tabs`).toBeLessThan(count * 3)
    await page.keyboard.press('Tab')
    const focus = await page.evaluate(() => {
      const el = document.activeElement
      const style = getComputedStyle(el)
      return {
        tag: el.tagName,
        text: el.textContent?.trim().slice(0, 40),
        outlineStyle: style.outlineStyle,
        outlineWidth: parseFloat(style.outlineWidth) || 0,
        boxShadow: style.boxShadow,
      }
    })
    if (focus.tag === 'BODY') continue
    checked += 1
    const outlined = focus.outlineStyle !== 'none' && focus.outlineWidth > 0
    const shadowed = focus.boxShadow !== 'none'
    expect(outlined || shadowed, `${screen}: focus ring on ${focus.tag} "${focus.text}"`).toBe(true)
  }
}

function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

async function expectNoOverlap(card, controls) {
  const cardBox = await card.boundingBox()
  expect(cardBox).not.toBeNull()
  for (const [name, locator] of controls) {
    const count = await locator.count()
    expect(count, `${name} on screen`).toBeGreaterThan(0)
    for (let i = 0; i < count; i += 1) {
      const box = await locator.nth(i).boundingBox()
      expect(box, `${name} #${i + 1} has a box`).not.toBeNull()
      expect(overlaps(cardBox, box), `task card overlaps ${name} #${i + 1}`).toBe(false)
    }
  }
}

const wordButtons = (page) => page.locator('.word-button')

test.beforeEach(async ({ request }) => {
  await resetDemo(request)
})

for (const viewport of VIEWPORTS) {
  test.describe(`at ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport })

    test('child screens have large text, tall buttons and visible focus', async ({ page }) => {
      await signInAndPickAlex(page)

      // Start
      await expectLargeText(page.locator('.lead'), 'Start lead text')
      await expectTallButtons(page, 'Start')
      await expectVisibleFocus(page, 'Start')

      // Choose a game
      await page.getByRole('button', { name: 'Play', exact: true }).click()
      await expect(pageHeading(page, 'Choose a game')).toBeVisible()
      await expectLargeText(page.locator('.activity-card__text'), 'game description')
      await expectTallButtons(page, 'Choose a game')
      await expectVisibleFocus(page, 'Choose a game')

      // Activity
      await startMatchTheWordFromChooser(page)
      await expectLargeText(page.locator('.question__prompt'), 'instruction')
      await expectLargeText(wordButtons(page), 'word button')
      await expect(wordButtons(page)).toHaveCount(3)
      await expectTallButtons(page, 'Activity')
      await expectVisibleFocus(page, 'Activity', 5)
    })

    test('the task card never covers the word buttons, Help, Pause or Next', async ({
      page,
      request,
    }) => {
      await apiStartTestSession(request, 'Layout check')
      await signInAndPickAlex(page)
      const card = page.getByRole('complementary', { name: 'Usability test task' })
      await expect(card.getByRole('button', { name: 'Task 1 of 4' })).toBeVisible()
      await expectTallButtons(page, 'Start with task card')

      await page.getByRole('button', { name: 'Play', exact: true }).click()
      await expect(pageHeading(page, 'Choose a game')).toBeVisible()
      await expect(card).toBeVisible()
      await startMatchTheWordFromChooser(page)
      await expect(card).toBeVisible()
      await expectTallButtons(page, 'Activity with task card')

      const controls = [
        ['word button', wordButtons(page)],
        ['Help', page.getByRole('button', { name: 'Help', exact: true })],
        ['Pause', page.getByRole('button', { name: 'Pause', exact: true })],
      ]
      await expectNoOverlap(card, controls)

      // After a correct answer Next shows too.
      const round = await getRound(page.request, new URL(page.url()).pathname.split('/').pop())
      await answerCorrectly(page, round, 0)
      await expectNoOverlap(card, [...controls, ['Next', nextButton(page)]])

      // Collapsed, the toggle keeps its name and the scenario leaves the page.
      const toggle = card.getByRole('button', { name: 'Task 1 of 4' })
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await expect(card.locator('.task-card__body')).toBeHidden()
      await expectNoOverlap(card, [...controls, ['Next', nextButton(page)]])
    })
  })
}
