import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OUTCOMES, REQUIRED_TASK_IDS, findTestTask } from '../content/testTasks.js'
import { createTestSession, deriveSignals, sessionAsText, testSessionReducer } from '../game/index.js'
import { renderWithRouter } from '../test/renderWithRouter.jsx'
import FacilitatorScreen from './FacilitatorScreen.jsx'

const T0 = '2026-11-12T15:00:00.000Z'
const T1 = '2026-11-12T15:01:00.000Z'
const T1_PLUS_65S = '2026-11-12T15:02:05.000Z'
const T2 = '2026-11-12T15:03:00.000Z'
const T2_PLUS_30S = '2026-11-12T15:03:30.000Z'
const T_END = '2026-11-12T15:10:00.000Z'

function newSession() {
  return createTestSession({
    id: 'ts-1',
    testerLabel: 'Tester 1',
    adultId: 'adult-1',
    childId: 'child-alex',
    taskIds: [],
    now: T0,
  })
}

const apply = (session, ...actions) => actions.reduce(testSessionReducer, session)
const route = (path, screenName, at) => ({ type: 'LOG_EVENT', event: { type: 'route', path, screen: screenName, at } })

// Two tasks done with outcomes and a note each, then ended.
function endedSession() {
  return apply(
    newSession(),
    route('/games', 'Choose a game', T0),
    { type: 'START_TASK', now: T1 },
    { type: 'SET_OUTCOME', outcome: 'completed_unaided', now: T1_PLUS_65S },
    { type: 'ADD_NOTE', text: 'Found Play quickly', severity: 1, screen: 'Start', now: T1_PLUS_65S },
    { type: 'NEXT_TASK' },
    { type: 'START_TASK', now: T2 },
    { type: 'SET_OUTCOME', outcome: 'failed', now: T2_PLUS_30S },
    { type: 'ADD_NOTE', text: 'Missed the Next button', severity: 3, screen: 'Activity', now: T2_PLUS_30S },
    { type: 'END', now: T_END },
  )
}

// Every callback records its call and resolves.
function renderConsole({ testSession, now = T0, pastSessions = [] } = {}) {
  const calls = []
  const record = (name) => (...args) => {
    calls.push([name, ...args])
    return Promise.resolve()
  }
  const view = renderWithRouter(
    <FacilitatorScreen
      testSession={testSession}
      pastSessions={pastSessions}
      signals={testSession ? deriveSignals(testSession) : {}}
      childName="Alex"
      now={now}
      onAction={record('action')}
      onEnd={record('end')}
      onNewTester={record('newTester')}
      onOpenSession={record('open')}
      onBack={record('back')}
      copyText={record('copy')}
      download={record('download')}
    />,
  )
  return { ...view, calls }
}

// The <dd> after a <dt> in the facts list.
const fact = (term) => screen.getByText(term, { selector: 'dt' }).nextElementSibling.textContent
const outcomeButton = (label) => screen.getByRole('button', { name: label })

describe('FacilitatorScreen: active session', () => {
  it('shows the tester, the task and the tester’s screen', () => {
    const session = apply(newSession(), route('/games', 'Choose a game', T0))
    const task = findTestTask(REQUIRED_TASK_IDS[0])
    renderConsole({ testSession: session })

    expect(screen.getByRole('heading', { level: 1, name: 'Facilitator console' })).toBeTruthy()
    expect(screen.getByText(/^Tester 1 · Started /)).toBeTruthy()
    expect(
      screen.getByRole('heading', { level: 2, name: `Task 1 of ${REQUIRED_TASK_IDS.length}: ${task.title}` }),
    ).toBeTruthy()
    expect(screen.getByText(task.scenario)).toBeTruthy()
    expect(fact('Tester’s screen')).toBe('Choose a game')
    expect(fact('Time on task')).toBe('Not started')
  })

  it('disables the outcome buttons until the task starts', () => {
    renderConsole({ testSession: newSession() })

    expect(screen.getByRole('button', { name: 'Start Task' }).disabled).toBe(false)
    for (const outcome of OUTCOMES) expect(outcomeButton(outcome.label).disabled).toBe(true)
  })

  it('enables the outcome buttons once the task has started', () => {
    renderConsole({ testSession: apply(newSession(), { type: 'START_TASK', now: T1 }), now: T1 })

    expect(screen.getByRole('button', { name: 'Start Task' }).disabled).toBe(true)
    for (const outcome of OUTCOMES) expect(outcomeButton(outcome.label).disabled).toBe(false)
  })

  it('computes elapsed time from the now prop', () => {
    renderConsole({ testSession: apply(newSession(), { type: 'START_TASK', now: T1 }), now: T1_PLUS_65S })

    expect(fact('Time on task')).toBe('1:05')
  })
})

describe('FacilitatorScreen: actions', () => {
  it('sends START_TASK from Start Task', async () => {
    const { user, calls } = renderConsole({ testSession: newSession() })

    await user.click(screen.getByRole('button', { name: 'Start Task' }))

    expect(calls).toEqual([['action', { type: 'START_TASK' }]])
  })

  it('sends SET_OUTCOME from an outcome button', async () => {
    const { user, calls } = renderConsole({
      testSession: apply(newSession(), { type: 'START_TASK', now: T1 }),
      now: T1,
    })

    await user.click(outcomeButton('Completed With Hesitation'))

    expect(calls).toEqual([['action', { type: 'SET_OUTCOME', outcome: 'completed_with_hesitation' }]])
  })

  it('enables Next Task before the last task and disables it on the last', () => {
    const first = renderConsole({ testSession: newSession() })
    expect(screen.getByRole('button', { name: 'Next Task' }).disabled).toBe(false)
    first.unmount()

    const nexts = REQUIRED_TASK_IDS.slice(1).map(() => ({ type: 'NEXT_TASK' }))
    renderConsole({ testSession: apply(newSession(), ...nexts) })
    const n = REQUIRED_TASK_IDS.length
    expect(screen.getByRole('heading', { level: 2, name: new RegExp(`^Task ${n} of ${n}:`) })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Next Task' }).disabled).toBe(true)
  })

  it('sends ADD_NOTE with the text and the chosen severity', async () => {
    const { user, calls } = renderConsole({ testSession: newSession() })

    await user.type(screen.getByRole('textbox', { name: 'Note' }), 'Could not find Play')
    await user.click(screen.getByRole('radio', { name: '3 blocked' }))
    await user.click(screen.getByRole('button', { name: 'Save note' }))

    expect(calls).toEqual([['action', { type: 'ADD_NOTE', text: 'Could not find Play', severity: 3 }]])
    expect(screen.getByText('Note saved.')).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Note' }).value).toBe('')
  })

  it('asks before ending the session', async () => {
    const { user, calls } = renderConsole({ testSession: newSession() })

    await user.click(screen.getByRole('button', { name: 'End Session' }))
    const confirm = screen.getByRole('group', { name: 'Confirm End Session' })
    expect(calls).toEqual([])

    await user.click(within(confirm).getByRole('button', { name: 'Yes, end session' }))
    expect(calls).toEqual([['end']])
  })

  it('does not end the session when the confirmation is cancelled', async () => {
    const { user, calls } = renderConsole({ testSession: newSession() })

    await user.click(screen.getByRole('button', { name: 'End Session' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('group', { name: 'Confirm End Session' })).toBeNull()
    expect(calls).toEqual([])
  })
})

describe('FacilitatorScreen: ended session results', () => {
  it('shows one row per task with its outcome and time', () => {
    const session = endedSession()
    renderConsole({ testSession: session })

    expect(screen.getByRole('heading', { level: 2, name: 'Results: Tester 1' })).toBeTruthy()
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(session.tasks.length)

    const cells = rows.map((row) => {
      const [outcome, time] = within(row).getAllByRole('cell').map((cell) => cell.textContent)
      return [within(row).getByRole('rowheader').textContent, outcome, time]
    })
    const tasks = REQUIRED_TASK_IDS.map(findTestTask)
    expect(cells).toEqual([
      [`1. ${tasks[0].title}`, 'Completed Unaided', '1:05'],
      [`2. ${tasks[1].title}`, 'Failed', '0:30'],
      [`3. ${tasks[2].title}`, 'No outcome', '—'],
      [`4. ${tasks[3].title}`, 'No outcome', '—'],
    ])
  })

  it('lists every note with its screen and severity', () => {
    renderConsole({ testSession: endedSession() })

    const notes = within(screen.getByRole('region', { name: 'All notes' })).getAllByRole('listitem')
    expect(notes).toHaveLength(2)
    expect(notes[0].textContent).toContain('Task 1 · Start · Severity 1 minor')
    expect(notes[0].textContent).toContain('Found Play quickly')
    expect(notes[1].textContent).toContain('Task 2 · Activity · Severity 3 blocked')
    expect(notes[1].textContent).toContain('Missed the Next button')
  })

  it('copies the results as text', async () => {
    const session = endedSession()
    const { user, calls } = renderConsole({ testSession: session })

    await user.click(screen.getByRole('button', { name: 'Copy as Text' }))

    expect(calls).toEqual([['copy', sessionAsText(session)]])
    expect(await screen.findByText('Copied.')).toBeTruthy()
  })

  it('downloads the session as JSON', async () => {
    const session = endedSession()
    const { user, calls } = renderConsole({ testSession: session })

    await user.click(screen.getByRole('button', { name: 'Download JSON' }))

    expect(calls).toHaveLength(1)
    const [name, filename, text] = calls[0]
    expect(name).toBe('download')
    expect(filename).toBe('usability-tester-1-2026-11-12.json')
    expect(JSON.parse(text)).toEqual(session)
    expect(screen.getByText(`Downloaded ${filename}.`)).toBeTruthy()
  })

  it('asks before New Tester Reset, then calls onNewTester', async () => {
    const { user, calls } = renderConsole({ testSession: endedSession() })

    await user.click(screen.getByRole('button', { name: 'New Tester Reset' }))
    const confirm = screen.getByRole('group', { name: 'Confirm New Tester Reset' })
    expect(calls).toEqual([])

    await user.click(within(confirm).getByRole('button', { name: 'Yes, reset' }))
    expect(calls).toEqual([['newTester']])
  })
})

describe('FacilitatorScreen: lists', () => {
  const PAST = [
    { id: 'ts-2', testerLabel: 'Tester 2', status: 'active', startedAt: T2 },
    { id: 'ts-1', testerLabel: 'Tester 1', status: 'ended', startedAt: T0 },
  ]

  it('lists past sessions and opens one', async () => {
    const { user, calls } = renderConsole({ testSession: null, pastSessions: PAST })

    const list = within(screen.getByRole('region', { name: 'Past sessions' }))
    const buttons = list.getAllByRole('button')
    expect(buttons.map((b) => b.querySelector('.round-list__date').textContent)).toEqual(['Tester 2', 'Tester 1'])
    expect(buttons[0].textContent).toContain('Open console')
    expect(buttons[1].textContent).toContain('View results')

    await user.click(buttons[1])
    expect(calls).toEqual([['open', 'ts-1']])
  })

  it('says no session is running when there is none', () => {
    renderConsole({ testSession: null })

    expect(screen.getByText('No session is running. Start one from the Parent or Teacher view.')).toBeTruthy()
    expect(screen.getByText('No sessions yet.')).toBeTruthy()
  })
})
