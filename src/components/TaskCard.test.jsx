import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TEST_TASKS } from '../content/testTasks.js'
import { renderWithRouter } from '../test/renderWithRouter.jsx'
import TaskCard from './TaskCard.jsx'

const TASK = TEST_TASKS[1]

function renderCard() {
  return renderWithRouter(
    <TaskCard taskNumber={TASK.number} taskTotal={TEST_TASKS.length} scenario={TASK.scenario} />,
  )
}

describe('TaskCard', () => {
  it('shows "Task 2 of 6" and the scenario, and nothing else', () => {
    renderCard()

    const card = screen.getByRole('complementary', { name: 'Usability test task' })
    expect(card.textContent).toBe(`Task 2 of 6${TASK.scenario}`)
    // Only the toggle: no hint, timer or other controls.
    expect(within(card).getAllByRole('button').map((b) => b.textContent)).toEqual(['Task 2 of 6'])
    expect(within(card).getByText(TASK.scenario).tagName).toBe('P')
  })

  it('collapses and expands, keeping the toggle name', async () => {
    const { user } = renderCard()
    const toggle = screen.getByRole('button', { name: 'Task 2 of 6' })
    const body = document.getElementById(toggle.getAttribute('aria-controls'))

    expect(body).not.toBeNull()
    expect(body.textContent).toBe(TASK.scenario)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(body.hidden).toBe(false)

    await user.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(body.hidden).toBe(true)
    expect(screen.getByRole('button', { name: 'Task 2 of 6' })).toBe(toggle)

    await user.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(body.hidden).toBe(false)
    expect(screen.getByText(TASK.scenario)).toBe(body)
  })
})
