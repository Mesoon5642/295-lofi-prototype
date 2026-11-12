// Automated accessibility checks for every screen (TESTING_PLAN.md §7): axe in jsdom,
// one h1 per screen, focus on the heading on arrival, and a name on every button.
// Plus a keyboard-only round and the Task card's place in the focus order.
// Layout (text size, 48px targets, visible focus) is in e2e/layout.spec.js, and
// what neither can check is in docs/ACCESSIBILITY_CHECKLIST.md.
// No mocks: rounds and sessions come from the real game code, data from the seed
// files, and callbacks are hand-written stand-ins passed as props.
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import TaskCard from '../components/TaskCard.jsx'
import { MATCH_THE_WORD } from '../content/activities.js'
import { DEFAULT_SETTINGS } from '../content/settings.js'
import { TEST_TASKS } from '../content/testTasks.js'
import {
  createRng,
  createTestSession,
  deriveSignals,
  recentPracticeWords,
  roundReducer,
  startRound,
  testSessionReducer,
} from '../game/index.js'
import { renderWithRouter } from '../test/renderWithRouter.jsx'
import { SEED_CHILD, SEED_ROUNDS } from '../../server/seed/seedData.js'
import { SEED_WORDS } from '../../server/seed/words.js'
import ActivityScreen from './ActivityScreen.jsx'
import ChooseActivityScreen from './ChooseActivityScreen.jsx'
import FacilitatorScreen from './FacilitatorScreen.jsx'
import GrownUpGateScreen from './GrownUpGateScreen.jsx'
import ParentHomeScreen from './ParentHomeScreen.jsx'
import ParentScreen from './ParentScreen.jsx'
import PlayersScreen from './PlayersScreen.jsx'
import SignInScreen from './SignInScreen.jsx'
import StartScreen from './StartScreen.jsx'
import SummaryScreen from './SummaryScreen.jsx'

// jsdom can't compute colours; contrast is on the manual checklist.
const AXE_OPTIONS = { rules: { 'color-contrast': { enabled: false } } }

const NOW = '2026-11-12T10:00:00.000Z'
const noop = () => {}
const resolved = () => Promise.resolve()

// Seeded rounds, so every target and option list is known.
function newRound(seed = 7) {
  return startRound({
    id: `round-${seed}`,
    childId: SEED_CHILD.id,
    activity: MATCH_THE_WORD,
    items: SEED_WORDS,
    now: NOW,
    rng: createRng(seed),
  })
}

// Plays a round to the end with the reducer: right answer, then Next, five times.
function completedRound(seed = 7) {
  let round = newRound(seed)
  while (round.status !== 'completed') {
    const question = round.questions[round.currentIndex]
    round = roundReducer(round, { type: 'SELECT', word: question.target })
    round = roundReducer(round, { type: 'NEXT', now: NOW })
  }
  return round
}

function wrongWord(question) {
  return question.options.find((word) => word !== question.target)
}

// Activity screen props with stand-ins for the network and audio.
function activityProps(round, overrides = {}) {
  return {
    initialRound: round,
    onBack: noop,
    onComplete: noop,
    focusHeading: true,
    sendAction: resolved,
    playAudio: () => true,
    audioSupport: () => 'available',
    ...overrides,
  }
}

// Sessions built with the real reducer.
function activeSession() {
  let session = createTestSession({
    id: 'session-1',
    testerLabel: 'Tester 1',
    adultId: 'adult-admin',
    childId: SEED_CHILD.id,
    taskIds: TEST_TASKS.map((task) => task.id),
    now: NOW,
  })
  session = testSessionReducer(session, { type: 'START_TASK', now: '2026-11-12T10:01:00.000Z' })
  session = testSessionReducer(session, {
    type: 'LOG_EVENT',
    event: { type: 'route', path: '/games', screen: 'Choose a game', at: '2026-11-12T10:01:30.000Z' },
  })
  session = testSessionReducer(session, {
    type: 'ADD_NOTE',
    text: 'Looked for the Play button.',
    severity: 1,
    screen: 'Start',
    now: '2026-11-12T10:01:40.000Z',
  })
  return session
}

function endedSession() {
  let session = activeSession()
  session = testSessionReducer(session, {
    type: 'SET_OUTCOME',
    outcome: 'completed_unaided',
    now: '2026-11-12T10:02:00.000Z',
  })
  return testSessionReducer(session, { type: 'END', now: '2026-11-12T10:03:00.000Z' })
}

function pastSessionRow(session) {
  const { id, testerLabel, status, startedAt } = session
  return { id, testerLabel, status, startedAt }
}

const ROUNDS_NEWEST_FIRST = [...SEED_ROUNDS].sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1))

// --- shared checks ---

async function expectNoAxeViolations(container) {
  expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations()
}

function expectOneH1(view) {
  const headings = view.getAllByRole('heading', { level: 1 })
  expect(headings).toHaveLength(1)
  return headings[0]
}

function expectHeadingFocused(view) {
  expect(document.activeElement).toBe(expectOneH1(view))
}

// Every button (enabled or not) has a non-empty accessible name: the named query
// must find exactly the same buttons as the unnamed one.
function expectNamedButtons(view) {
  const buttons = view.getAllByRole('button')
  const named = new Set(view.getAllByRole('button', { name: /\S/ }))
  const unnamed = buttons.filter((button) => !named.has(button)).map((button) => button.outerHTML)
  expect(unnamed).toEqual([])
}

// Runs all four checks on a screen rendered with focusHeading.
async function expectAccessibleScreen(view) {
  await expectNoAxeViolations(view.container)
  expectHeadingFocused(view)
  expectNamedButtons(view)
}

// --- screens ---

describe('accessibility: child sign-in and start screens', () => {
  it('Sign in', async () => {
    const view = renderWithRouter(<SignInScreen onSignIn={noop} focusHeading />)
    expect(view.getByRole('heading', { level: 1, name: 'Grown-up sign in' })).toBeTruthy()
    await expectAccessibleScreen(view)
  })

  it("Who's playing?", async () => {
    const view = renderWithRouter(
      <PlayersScreen
        profiles={[{ id: SEED_CHILD.id, name: SEED_CHILD.name }]}
        onPick={resolved}
        onAddChild={resolved}
        onParentView={noop}
        onSignOut={noop}
        focusHeading
      />,
    )
    await expectAccessibleScreen(view)
  })

  it('Start', async () => {
    const view = renderWithRouter(
      <StartScreen childName={SEED_CHILD.name} onPlay={noop} onParent={noop} focusHeading />,
    )
    expect(view.getByRole('heading', { level: 1, name: `Hi, ${SEED_CHILD.name}!` })).toBeTruthy()
    await expectAccessibleScreen(view)
  })

  it('Choose a game, without Tricky Words', async () => {
    const view = renderWithRouter(
      <ChooseActivityScreen
        inProgress={{}}
        practiceWords={[]}
        onStart={noop}
        starting={false}
        error=""
        onBack={noop}
        focusHeading
      />,
    )
    expect(view.getAllByRole('heading', { level: 2 })).toHaveLength(1)
    await expectAccessibleScreen(view)
  })

  it('Choose a game, with Tricky Words', async () => {
    const practiceWords = recentPracticeWords(SEED_ROUNDS)
    expect(practiceWords.length).toBeGreaterThan(0)
    const view = renderWithRouter(
      <ChooseActivityScreen
        inProgress={{}}
        practiceWords={practiceWords}
        onStart={noop}
        starting={false}
        error=""
        onBack={noop}
        focusHeading
      />,
    )
    expect(view.getByRole('heading', { level: 2, name: 'Tricky Words' })).toBeTruthy()
    await expectAccessibleScreen(view)
  })
})

describe('accessibility: activity screen', () => {
  it('fresh question', async () => {
    const view = renderWithRouter(<ActivityScreen {...activityProps(newRound())} />)
    await expectAccessibleScreen(view)
  })

  it('after a wrong answer, with the hint shown', async () => {
    const round = newRound()
    const question = round.questions[0]
    const view = renderWithRouter(<ActivityScreen {...activityProps(round)} />)
    expectHeadingFocused(view)

    await view.user.click(view.getByRole('button', { name: wrongWord(question) }))
    await view.user.click(view.getByRole('button', { name: 'Help' }))
    expect(view.getByText(question.hint)).toBeTruthy()

    await expectNoAxeViolations(view.container)
    expectOneH1(view)
    expectNamedButtons(view)
  })

  it('paused', async () => {
    const view = renderWithRouter(<ActivityScreen {...activityProps(newRound())} />)
    expectHeadingFocused(view)

    await view.user.click(view.getByRole('button', { name: 'Pause' }))
    const dialog = view.container.querySelector('dialog')
    // jsdom has no showModal(), so the dialog stays closed and its content hidden.
    // Set `open` as showModal() would, so axe and the role queries see the content.
    // (Focus trapping is a browser feature: see the manual checklist.)
    expect(dialog.open).toBe(false)
    dialog.setAttribute('open', '')
    const continueButton = view.getByRole('button', { name: 'Continue' })
    expect(document.activeElement).toBe(continueButton)
    expect(view.getByRole('dialog', { name: 'Paused' })).toBeTruthy()

    await expectNoAxeViolations(view.container)
    expectOneH1(view)
    expectNamedButtons(view)
  })

  it('with the explanation prompt (explanations on)', async () => {
    const round = newRound()
    const view = renderWithRouter(<ActivityScreen {...activityProps(round)} />, {
      settings: { ...DEFAULT_SETTINGS, explanations: 'on' },
    })
    expectHeadingFocused(view)

    await view.user.click(view.getByRole('button', { name: round.questions[0].target }))
    expect(view.getByRole('textbox', { name: 'Tell us how you chose' })).toBeTruthy()

    await expectNoAxeViolations(view.container)
    expectOneH1(view)
    expectNamedButtons(view)
  })
})

describe('accessibility: summary', () => {
  it('Summary', async () => {
    const round = completedRound()
    const view = renderWithRouter(
      <SummaryScreen round={round} onPlayAgain={noop} starting={false} error="" onHome={noop} focusHeading />,
    )
    expect(view.getByRole('heading', { level: 1, name: 'You finished 5 words!' })).toBeTruthy()
    await expectAccessibleScreen(view)
  })
})

describe('accessibility: grown-up screens', () => {
  it('Parent or Teacher overview, with the start form open and a past session', async () => {
    const past = endedSession()
    const view = renderWithRouter(
      <ParentHomeScreen
        username="admin"
        profiles={[
          {
            id: SEED_CHILD.id,
            name: SEED_CHILD.name,
            completedRounds: SEED_ROUNDS.length,
            lastPlayedAt: ROUNDS_NEWEST_FIRST[0].completedAt,
          },
        ]}
        onOpenChild={noop}
        onAddChild={resolved}
        onChoosePlayer={noop}
        onReset={resolved}
        onSignOut={noop}
        onBack={noop}
        testSessions={[pastSessionRow(past)]}
        onStartTestSession={resolved}
        onEndTestSession={resolved}
        onOpenFacilitator={noop}
        onOpenTestSession={noop}
        startOpen
        focusHeading
      />,
    )
    expect(view.getByRole('textbox', { name: 'Tester label' }).value).toBe('Tester 2')
    expect(view.getByRole('button', { name: /Tester 1/ })).toBeTruthy()
    await expectAccessibleScreen(view)
  })

  it('Parent child view: list', async () => {
    const view = renderWithRouter(
      <ParentScreen
        child={SEED_CHILD}
        rounds={ROUNDS_NEWEST_FIRST}
        settings={DEFAULT_SETTINGS}
        onSettingsChange={noop}
        onBack={noop}
        focusHeading
      />,
    )
    await expectAccessibleScreen(view)
  })

  it('Parent child view: round detail', async () => {
    const view = renderWithRouter(
      <ParentScreen
        child={SEED_CHILD}
        rounds={ROUNDS_NEWEST_FIRST}
        settings={DEFAULT_SETTINGS}
        onSettingsChange={noop}
        onBack={noop}
        focusHeading
      />,
    )
    await view.user.click(view.getAllByRole('button', { name: /View details/ })[0])
    // The detail heading takes focus whenever it opens.
    expect(view.getByRole('heading', { level: 1, name: `${SEED_CHILD.name}’s round` })).toBeTruthy()
    await expectAccessibleScreen(view)
  })

  it('Grown-up gate', async () => {
    const view = renderWithRouter(
      <GrownUpGateScreen username="admin" onUnlocked={noop} onSignOut={noop} focusHeading />,
    )
    await expectAccessibleScreen(view)
  })
})

describe('accessibility: facilitator console', () => {
  function renderConsole(testSession, pastSessions) {
    return renderWithRouter(
      <FacilitatorScreen
        testSession={testSession}
        pastSessions={pastSessions}
        signals={testSession ? deriveSignals(testSession, { rounds: SEED_ROUNDS }) : {}}
        childName={SEED_CHILD.name}
        now="2026-11-12T10:02:30.000Z"
        onAction={resolved}
        onEnd={resolved}
        onNewTester={resolved}
        onOpenSession={noop}
        onBack={noop}
        focusHeading
        copyText={resolved}
        download={noop}
      />,
    )
  }

  it('active session', async () => {
    const session = activeSession()
    const view = renderConsole(session, [pastSessionRow(session)])
    expect(view.getByRole('heading', { level: 2, name: /^Task 1 of 6/ })).toBeTruthy()
    await expectAccessibleScreen(view)
  })

  it('ended session results', async () => {
    const session = endedSession()
    const view = renderConsole(session, [pastSessionRow(session)])
    expect(view.getByRole('table')).toBeTruthy()
    await expectAccessibleScreen(view)
  })

  it('no session', async () => {
    const view = renderConsole(null, [pastSessionRow(endedSession())])
    expect(view.getByText(/No session is running/)).toBeTruthy()
    await expectAccessibleScreen(view)
  })
})

describe('accessibility: task card', () => {
  const task = TEST_TASKS[1]

  function renderCard() {
    return renderWithRouter(
      <>
        <main>
          <p>Screen content</p>
        </main>
        <TaskCard taskNumber={task.number} taskTotal={TEST_TASKS.length} scenario={task.scenario} />
      </>,
    )
  }

  it('expanded', async () => {
    const view = renderCard()
    const toggle = view.getByRole('button', { name: `Task ${task.number} of ${TEST_TASKS.length}` })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    await expectNoAxeViolations(view.container)
    expectNamedButtons(view)
  })

  it('collapsed', async () => {
    const view = renderCard()
    const toggle = view.getByRole('button', { name: `Task ${task.number} of ${TEST_TASKS.length}` })
    await view.user.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    await expectNoAxeViolations(view.container)
    expectNamedButtons(view)
  })
})

// --- keyboard ---

// Presses Tab until `matches(document.activeElement)`, failing after `limit` presses.
// Returns every element focused on the way, in order.
async function tabUntil(user, matches, limit = 40) {
  const visited = []
  for (let i = 0; i < limit; i += 1) {
    await user.tab()
    visited.push(document.activeElement)
    if (matches(document.activeElement)) return visited
  }
  throw new Error(`Tab never reached the element (last focus: ${document.activeElement?.outerHTML})`)
}

const isWordButton = (word) => (el) => el.classList.contains('word-button') && el.textContent === word
const isButtonNamed = (name) => (el) => el.tagName === 'BUTTON' && el.textContent.trim() === name

describe('accessibility: keyboard only', () => {
  it('completes a full round, with a Pause and Continue, using only Tab, Enter and Space', async () => {
    const round = newRound(11)
    const completed = []
    const view = renderWithRouter(
      <ActivityScreen {...activityProps(round, { onComplete: (done) => completed.push(done) })} />,
    )
    const { user } = view
    expectHeadingFocused(view)

    for (const [index, question] of round.questions.entries()) {
      // On the first word, try a wrong answer first, then pause and continue.
      if (index === 0) {
        await tabUntil(user, isWordButton(wrongWord(question)))
        await user.keyboard('{Enter}')
        expect(view.getByText("Let's try again")).toBeTruthy()

        await tabUntil(user, isButtonNamed('Pause'))
        await user.keyboard('{Enter}')
        // The dialog moves focus to Continue itself. jsdom has no showModal(), so
        // the closed <dialog> counts as hidden for role queries: hence `hidden: true`.
        const continueButton = view.getByRole('button', { name: 'Continue', hidden: true })
        expect(document.activeElement).toBe(continueButton)
        await user.keyboard(' ')
        expect(view.queryByRole('button', { name: 'Continue', hidden: true })).toBeNull()
        expect(document.activeElement).toBe(view.getByRole('button', { name: 'Pause' }))
      }

      await tabUntil(user, isWordButton(question.target))
      // Alternate the two activation keys.
      await user.keyboard(index % 2 === 0 ? '{Enter}' : ' ')
      expect(view.getByText('Nice work!')).toBeTruthy()

      await tabUntil(user, isButtonNamed('Next'))
      await user.keyboard('{Enter}')
    }

    expect(completed).toHaveLength(1)
    expect(completed[0].status).toBe('completed')
    expect(completed[0].questions.every((q) => q.correct)).toBe(true)
    expect(completed[0].questions[0].attempts).toBe(2)
  })

  it('reaches every word button, Help and Pause before the Task card toggle', async () => {
    const round = newRound()
    const task = TEST_TASKS[0]
    const view = renderWithRouter(
      <>
        {/* No heading focus, so Tab starts at the top of the page. */}
        <ActivityScreen {...activityProps(round, { focusHeading: false })} />
        <TaskCard taskNumber={task.number} taskTotal={TEST_TASKS.length} scenario={task.scenario} />
      </>,
    )
    const toggleName = `Task ${task.number} of ${TEST_TASKS.length}`
    const toggle = view.getByRole('button', { name: toggleName })
    // The card comes after <main> in the DOM.
    const main = view.getByRole('main')
    expect(main.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const visited = await tabUntil(view.user, (el) => el === toggle)
    const before = visited.slice(0, -1)
    const required = [
      view.getByRole('button', { name: 'Help' }),
      view.getByRole('button', { name: 'Pause' }),
      ...round.questions[0].options.map((word) => view.getByRole('button', { name: word })),
    ]
    for (const button of required) expect(before).toContain(button)
  })
})
