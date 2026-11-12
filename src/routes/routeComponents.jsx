// The component for each route: reads loader data, wires up navigation, and renders
// a screen. Loaders are in loaders.js; the route table is in ../router.js.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Outlet,
  useLoaderData,
  useLocation,
  useNavigate,
  useNavigation,
  useRevalidator,
  useRouteError,
  useRouteLoaderData,
  useSearchParams,
} from 'react-router'
import { lock, selectChild, signOut } from '../api/auth.js'
import { ApiError } from '../api/http.js'
import {
  createChild,
  getChild,
  resetDemoData,
  saveSettings,
  startRound,
  whenSaved,
} from '../api/progress.js'
import {
  endTestSession,
  getActiveTestSession,
  logTestEvent,
  newTesterReset,
  sendTestSessionAction,
  startTestSession,
} from '../api/testing.js'
import TaskCard from '../components/TaskCard.jsx'
import { SettingsContext } from '../components/settingsContext.js'
import { DEFAULT_SETTINGS } from '../content/settings.js'
import { deriveSignals, getCurrentTask } from '../game/index.js'
import ActivityScreen from '../screens/ActivityScreen.jsx'
import ChooseActivityScreen from '../screens/ChooseActivityScreen.jsx'
import FacilitatorScreen from '../screens/FacilitatorScreen.jsx'
import GrownUpGateScreen from '../screens/GrownUpGateScreen.jsx'
import ParentHomeScreen from '../screens/ParentHomeScreen.jsx'
import ParentScreen from '../screens/ParentScreen.jsx'
import PlayersScreen from '../screens/PlayersScreen.jsx'
import SignInScreen from '../screens/SignInScreen.jsx'
import StartScreen from '../screens/StartScreen.jsx'
import SummaryScreen from '../screens/SummaryScreen.jsx'

const SERVER_TROUBLE = 'We couldn’t reach the game server. Please try again.'
const STANDARD_LOOK = { textSize: 'standard', font: 'standard' }

// Only move focus to headings after the first navigation, not on page load.
function useFocusHeading() {
  return useLocation().key !== 'default'
}

function isGrownUpPath(pathname) {
  return (
    pathname.startsWith('/players') ||
    pathname.startsWith('/parent') ||
    pathname.startsWith('/facilitator')
  )
}

// Saves a child's setting change, showing it right away; if saving fails, falls back
// to what the server has. Choosing large text is a usability test signal.
function useChildSettings(child) {
  const [settings, setSettings] = useState(child?.settings ?? DEFAULT_SETTINGS)
  const childId = child?.id ?? null
  const updateSettings = useCallback(
    (partial) => {
      if (partial.textSize === 'large') logTestEvent({ type: 'signal', signal: 'text-size-large' })
      setSettings((current) => ({ ...current, ...partial }))
      saveSettings(childId, partial)
        .catch(() => getChild(childId).then((saved) => setSettings(saved.settings)))
        .catch((error) => console.error('Could not save settings', error))
    },
    [childId],
  )
  return [settings, updateSettings]
}

// Asks the server to start a round of `activityId` for the child (it returns the
// game's in-progress round if there is one) and opens it. Event handlers only.
function useStartRound(childId) {
  const navigate = useNavigate()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  async function start(activityId) {
    if (starting) return
    setStarting(true)
    setError('')
    try {
      const round = await startRound(childId, activityId)
      navigate(`/play/${round.id}`)
    } catch {
      setError(SERVER_TROUBLE)
      setStarting(false)
    }
  }

  return { start, starting, error }
}

function useSignOut() {
  const navigate = useNavigate()
  return async () => {
    await signOut()
    navigate('/sign-in', { replace: true })
  }
}

// Root layout

// While a child screen is showing, the child's settings apply (text size, font, and
// the SettingsContext the child screens read). Grown-up screens always look standard.
function ChildLook({ child, busy }) {
  const [settings, updateSettings] = useChildSettings(child)
  const settingsValue = useMemo(
    () => ({ childId: child?.id ?? null, settings, updateSettings }),
    [child, settings, updateSettings],
  )
  const look = child ? settings : STANDARD_LOOK
  return (
    <SettingsContext value={settingsValue}>
      <div className="app" data-text-size={look.textSize} data-font={look.font} aria-busy={busy || undefined}>
        <Outlet />
      </div>
    </SettingsContext>
  )
}

export function AppLayout() {
  const child = useRouteLoaderData('child')?.child ?? null
  const navigation = useNavigation()
  const { pathname } = useLocation()
  const inGrownUpArea = isGrownUpPath(pathname)
  const wasInGrownUpArea = useRef(inGrownUpArea)

  // The password is asked for every time: going from the grown-up screens back to the
  // child's screens locks grown-up actions again.
  useEffect(() => {
    if (wasInGrownUpArea.current && !inGrownUpArea) lock()
    wasInGrownUpArea.current = inGrownUpArea
  }, [inGrownUpArea])

  // Usability test: each screen change goes to the session log (ignored by the server
  // when no session runs). The facilitator console may be open in another window
  // under the same sign-in, so its own routes aren't logged.
  useEffect(() => {
    if (!pathname.startsWith('/facilitator')) logTestEvent({ type: 'route', path: pathname })
  }, [pathname])

  return <ChildLook key={child?.id ?? 'grown-up'} child={child} busy={navigation.state !== 'idle'} />
}

const NO_TEST_SESSION = { active: false }
const TEST_SESSION_POLL_MS = 3000

// The usability test session for the task card. It starts from the loader's copy and
// asks again on each screen change (the layout's loader doesn't rerun between child
// screens), when the window gets focus, and every few seconds while a session runs,
// so a new task shows at once. Only the newest answer is kept.
function useTestSession(initial) {
  const { pathname } = useLocation()
  const [testSession, setTestSession] = useState(initial)
  const latestRequest = useRef(0)
  const shownPath = useRef(pathname)

  const refresh = useCallback(() => {
    const request = ++latestRequest.current
    getActiveTestSession()
      .catch(() => NO_TEST_SESSION)
      .then((latest) => {
        if (request === latestRequest.current) setTestSession(latest)
      })
  }, [])

  useEffect(() => {
    if (shownPath.current === pathname) return
    shownPath.current = pathname
    refresh()
  }, [pathname, refresh])

  useEffect(() => {
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [refresh])

  const active = testSession.active
  useEffect(() => {
    if (!active) return undefined
    const timer = setInterval(refresh, TEST_SESSION_POLL_MS)
    return () => clearInterval(timer)
  }, [active, refresh])

  return testSession
}

// Pathless layout around the child's screens; its loader finds the child playing.
// During a usability test for this child, the task card follows the screen.
export function ChildLayout() {
  const { child, testSession: loadedTestSession } = useLoaderData()
  const testSession = useTestSession(loadedTestSession)
  const showTask = testSession.active && testSession.childId === child.id
  return (
    <>
      <Outlet />
      {showTask && (
        <TaskCard
          key={testSession.taskNumber}
          taskNumber={testSession.taskNumber}
          taskTotal={testSession.taskTotal}
          scenario={testSession.scenario}
        />
      )}
    </>
  )
}

export function ErrorScreen() {
  const error = useRouteError()
  const offline = error instanceof ApiError && error.status === 0
  const signedOut = error instanceof ApiError && error.status === 401
  if (!offline && !signedOut) console.error(error)
  let heading = 'Something went wrong'
  let text = 'Please try again.'
  if (offline) {
    heading = 'Can’t reach the game'
    text = 'The game server isn’t answering. Ask a grown-up to check that it is running.'
  } else if (signedOut) {
    heading = 'Please sign in again'
    text = 'A grown-up needs to sign in on this device.'
  }
  return (
    <div className="app">
      <main className="screen screen--center">
        <h1 className="screen-heading">{heading}</h1>
        <p className="lead">{text}</p>
        <button
          type="button"
          className="btn btn--primary btn--big"
          onClick={() => window.location.assign(signedOut ? '/sign-in' : '/')}
        >
          {signedOut ? 'Sign in' : 'Try again'}
        </button>
      </main>
    </div>
  )
}

export function LoadingScreen() {
  return (
    <div className="app">
      <main className="screen screen--center">
        <p className="lead">Loading…</p>
      </main>
    </div>
  )
}

// Sign in (outside the root layout: no session yet)

export function SignInRoute() {
  const navigate = useNavigate()
  const focusHeading = useFocusHeading()
  return (
    <div className="app">
      <SignInScreen onSignIn={() => navigate('/players', { replace: true })} focusHeading={focusHeading} />
    </div>
  )
}

// Grown-up screens: each shows the password gate when its unlock has timed out.

function Gate({ session }) {
  const revalidator = useRevalidator()
  const focusHeading = useFocusHeading()
  const handleSignOut = useSignOut()
  return (
    <GrownUpGateScreen
      username={session.adult.username}
      onUnlocked={() => revalidator.revalidate()}
      onSignOut={handleSignOut}
      focusHeading={focusHeading}
    />
  )
}

export function PlayersRoute() {
  const { locked, session } = useLoaderData()
  const navigate = useNavigate()
  const revalidator = useRevalidator()
  const focusHeading = useFocusHeading()
  const handleSignOut = useSignOut()
  if (locked) return <Gate session={session} />

  return (
    <PlayersScreen
      profiles={session.children}
      onPick={async (childId) => {
        await selectChild(childId)
        navigate('/')
      }}
      onAddChild={async (name) => {
        await createChild(name)
        await revalidator.revalidate()
      }}
      onParentView={() => navigate('/parent')}
      onSignOut={handleSignOut}
      focusHeading={focusHeading}
    />
  )
}

export function ParentHomeRoute() {
  const data = useLoaderData()
  const navigate = useNavigate()
  const revalidator = useRevalidator()
  const focusHeading = useFocusHeading()
  const handleSignOut = useSignOut()
  // ?startTest=1&label=… comes from the facilitator's New Tester Reset.
  const [searchParams] = useSearchParams()
  const startOpen = searchParams.get('startTest') === '1'
  if (data.locked) return <Gate session={data.session} />

  return (
    <ParentHomeScreen
      username={data.session.adult.username}
      profiles={data.profiles}
      onOpenChild={(childId) => navigate(`/parent/${childId}`)}
      onAddChild={async (name) => {
        await createChild(name)
        await revalidator.revalidate()
      }}
      onChoosePlayer={() => navigate('/players')}
      onReset={async () => {
        await resetDemoData()
        await revalidator.revalidate()
      }}
      onSignOut={handleSignOut}
      onBack={() => navigate(data.session.activeChildId ? '/' : '/players')}
      focusHeading={focusHeading}
      testSessions={data.testSessions}
      onStartTestSession={async (details) => {
        try {
          await startTestSession(details)
        } catch (error) {
          // Another session is running: reload so the form can name it and end it.
          if (error instanceof ApiError && error.status === 409) await revalidator.revalidate()
          throw error
        }
        navigate('/players')
      }}
      onEndTestSession={async (id) => {
        await endTestSession(id)
        await revalidator.revalidate()
      }}
      onOpenFacilitator={() => navigate('/facilitator')}
      onOpenTestSession={(id) => navigate(`/facilitator?session=${encodeURIComponent(id)}`)}
      startOpen={startOpen}
      initialTesterLabel={(startOpen && searchParams.get('label')) || undefined}
    />
  )
}

function ParentChildResults({ child, rounds }) {
  const navigate = useNavigate()
  const focusHeading = useFocusHeading()
  const [settings, updateSettings] = useChildSettings(child)
  return (
    <ParentScreen
      child={child}
      rounds={rounds}
      settings={settings}
      onSettingsChange={updateSettings}
      onOpenRound={(roundId) => logTestEvent({ type: 'signal', signal: 'round-detail-opened', roundId })}
      onBack={() => navigate('/parent')}
      focusHeading={focusHeading}
    />
  )
}

export function ParentChildRoute() {
  const data = useLoaderData()
  if (data.locked) return <Gate session={data.session} />
  return <ParentChildResults key={data.child.id} child={data.child} rounds={data.rounds} />
}

const FACILITATOR_POLL_MS = 2000
const nowIso = () => new Date().toISOString()

// The facilitator console keeps the timer's clock (ticking each second while the
// current task runs) and re-reads the session every couple of seconds while it is
// active, so the tester's screen and signals update. Everything else comes from the
// server, so a refresh loses nothing.
function FacilitatorConsole({ testSession, pastSessions, rounds, childSettings, childName }) {
  const navigate = useNavigate()
  const { revalidate, state: revalidation } = useRevalidator()
  const focusHeading = useFocusHeading()
  const [now, setNow] = useState(nowIso)
  const active = testSession?.status === 'active'
  const task = active ? getCurrentTask(testSession) : null
  const running = Boolean(task?.startedAt) && !task.outcome

  useEffect(() => {
    if (!running) return undefined
    const timer = setInterval(() => setNow(nowIso()), 1000)
    return () => clearInterval(timer)
  }, [running])

  // One poll at a time: the next starts a moment after the last one finished.
  useEffect(() => {
    if (!active || revalidation !== 'idle') return undefined
    const timer = setTimeout(revalidate, FACILITATOR_POLL_MS)
    return () => clearTimeout(timer)
  }, [active, revalidation, revalidate])

  const signals = useMemo(
    () => (testSession ? deriveSignals(testSession, { rounds, settings: childSettings }) : {}),
    [testSession, rounds, childSettings],
  )
  const sessionId = testSession?.id ?? null

  return (
    <FacilitatorScreen
      key={`${sessionId}:${testSession?.status}`}
      testSession={testSession}
      pastSessions={pastSessions}
      signals={signals}
      childName={childName}
      now={now}
      onAction={async (action) => {
        await sendTestSessionAction(sessionId, action)
        setNow(nowIso())
        await revalidate()
      }}
      onEnd={async () => {
        await endTestSession(sessionId)
        // Without ?session= the console shows the active session, and this one has ended.
        await navigate(`/facilitator?session=${encodeURIComponent(sessionId)}`, { replace: true })
      }}
      onNewTester={async () => {
        const { nextLabel } = await newTesterReset(sessionId)
        await navigate(`/parent?startTest=1&label=${encodeURIComponent(nextLabel)}`)
      }}
      onOpenSession={(id) => navigate(`/facilitator?session=${encodeURIComponent(id)}`)}
      onBack={() => navigate('/parent')}
      focusHeading={focusHeading}
    />
  )
}

export function FacilitatorRoute() {
  const data = useLoaderData()
  if (data.locked) return <Gate session={data.session} />
  return (
    <FacilitatorConsole
      testSession={data.testSession}
      pastSessions={data.pastSessions}
      rounds={data.rounds}
      childSettings={data.childSettings}
      childName={data.childName}
    />
  )
}

// Child screens

export function StartRoute() {
  const { child } = useRouteLoaderData('child')
  const navigate = useNavigate()
  const focusHeading = useFocusHeading()
  return (
    <StartScreen
      childName={child.name}
      onPlay={() => navigate('/games')}
      onParent={() => navigate('/parent')}
      focusHeading={focusHeading}
    />
  )
}

export function ChooseRoute() {
  const { child } = useRouteLoaderData('child')
  const { trickyWords, inProgress } = useLoaderData()
  const navigate = useNavigate()
  const focusHeading = useFocusHeading()
  const { start, starting, error } = useStartRound(child.id)
  return (
    <ChooseActivityScreen
      inProgress={Object.fromEntries(
        Object.entries(inProgress).map(([activityId, id]) => [activityId, id !== null]),
      )}
      practiceWords={trickyWords}
      onStart={start}
      starting={starting}
      error={error}
      onBack={() => navigate('/')}
      focusHeading={focusHeading}
    />
  )
}

export function PlayRoute() {
  const { round } = useLoaderData()
  const navigate = useNavigate()
  const focusHeading = useFocusHeading()

  // ActivityScreen has already sent the last action; wait for the server to finish it.
  const handleComplete = useCallback(
    async (finished) => {
      await whenSaved()
      navigate(`/summary/${finished.id}`, { replace: true })
    },
    [navigate],
  )

  return (
    <ActivityScreen
      key={round.id}
      initialRound={round}
      onBack={() => navigate('/games')}
      onComplete={handleComplete}
      focusHeading={focusHeading}
    />
  )
}

export function SummaryRoute() {
  const { round } = useLoaderData()
  const navigate = useNavigate()
  const focusHeading = useFocusHeading()
  const { start, starting, error } = useStartRound(round.childId)
  return (
    <SummaryScreen
      round={round}
      onPlayAgain={() => start(round.activityId)}
      starting={starting}
      error={error}
      onHome={() => navigate('/')}
      focusHeading={focusHeading}
    />
  )
}
