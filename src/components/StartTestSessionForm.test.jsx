import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { REQUIRED_TASK_IDS, TEST_TASKS } from '../content/testTasks.js'
import { renderWithRouter } from '../test/renderWithRouter.jsx'
import StartTestSessionForm from './StartTestSessionForm.jsx'

const PROFILES = [
  { id: 'child-sam', name: 'Sam' },
  { id: 'child-alex', name: 'Alex' },
]

const REQUIRED = TEST_TASKS.filter((task) => task.required)
const OPTIONAL = TEST_TASKS.filter((task) => !task.required)
const taskName = (task) => `Task ${task.number}: ${task.title}${task.required ? ' (required)' : ''}`
const taskBox = (task) => screen.getByRole('checkbox', { name: taskName(task) })

// `onStart` and `onEndActive` record each call; `startResults` lists what each
// onStart call does in turn ('ok' resolves, anything else is thrown).
function renderForm({ initialLabel = 'Tester 1', activeSession = null, startResults = [] } = {}) {
  const calls = []
  let startCount = 0
  const onStart = (input) => {
    calls.push(['start', input])
    const result = startResults[startCount] ?? 'ok'
    startCount += 1
    return result === 'ok' ? Promise.resolve() : Promise.reject(result)
  }
  const onEndActive = () => {
    calls.push(['endActive'])
    return Promise.resolve()
  }
  const view = renderWithRouter(
    <StartTestSessionForm
      initialLabel={initialLabel}
      profiles={PROFILES}
      activeSession={activeSession}
      onStart={onStart}
      onEndActive={onEndActive}
    />,
  )
  return { ...view, calls }
}

describe('StartTestSessionForm', () => {
  it('checks the required tasks and does not let them be unchecked', async () => {
    const { user } = renderForm()

    for (const task of REQUIRED) {
      const box = taskBox(task)
      expect(box.checked).toBe(true)
      expect(box.disabled).toBe(true)
      await user.click(box)
      expect(box.checked).toBe(true)
    }
  })

  it('toggles the optional tasks', async () => {
    const { user } = renderForm()

    for (const task of OPTIONAL) {
      const box = taskBox(task)
      expect(box.checked).toBe(false)
      await user.click(box)
      expect(box.checked).toBe(true)
      await user.click(box)
      expect(box.checked).toBe(false)
    }
  })

  it('pre-fills the label and picks Alex by default', () => {
    renderForm({ initialLabel: 'Tester 4' })

    expect(screen.getByRole('textbox', { name: 'Tester label' }).value).toBe('Tester 4')
    const select = screen.getByRole('combobox', { name: 'Child who plays' })
    expect(select.value).toBe('child-alex')
  })

  it('submits the trimmed label, child and checked task ids', async () => {
    const { user, calls } = renderForm()
    const label = screen.getByRole('textbox', { name: 'Tester label' })

    await user.clear(label)
    await user.type(label, '  Tester 7  ')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Child who plays' }), 'child-sam')
    await user.click(taskBox(OPTIONAL[1]))
    await user.click(screen.getByRole('button', { name: 'Start Session' }))

    expect(calls).toEqual([
      ['start', { testerLabel: 'Tester 7', childId: 'child-sam', taskIds: [...REQUIRED_TASK_IDS, OPTIONAL[1].id] }],
    ])
  })

  it('asks for a label instead of starting when it is blank', async () => {
    const { user, calls } = renderForm()
    const label = screen.getByRole('textbox', { name: 'Tester label' })

    await user.clear(label)
    await user.type(label, '   ')
    await user.click(screen.getByRole('button', { name: 'Start Session' }))

    expect(screen.getByText('Please type a tester label.')).toBeTruthy()
    expect(calls).toEqual([])
  })

  it('offers to end a running session after a 409, then starts again', async () => {
    const { user, calls } = renderForm({ startResults: [{ status: 409, message: 'Busy' }, 'ok'] })

    await user.click(screen.getByRole('button', { name: 'Start Session' }))

    expect(screen.getByRole('group', { name: 'Confirm new session' })).toBeTruthy()
    expect(screen.getByText('A session is still running. End it and start a new one?')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'End it and start' }))

    const input = { testerLabel: 'Tester 1', childId: 'child-alex', taskIds: REQUIRED_TASK_IDS }
    expect(calls).toEqual([['start', input], ['endActive'], ['start', input]])
  })

  it('confirms up front when a session is already running', async () => {
    const { user, calls } = renderForm({ activeSession: { id: 'ts-1', testerLabel: 'Tester 3' } })

    await user.click(screen.getByRole('button', { name: 'Start Session' }))

    expect(calls).toEqual([])
    expect(
      screen.getByText('A session for Tester 3 is still running. End it and start a new one?'),
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'End it and start' }))

    expect(calls.map(([name]) => name)).toEqual(['endActive', 'start'])
  })
})
