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
import { SettingsContext } from '../components/settingsContext.js'
import { DEFAULT_SETTINGS } from '../content/settings.js'
import ActivityScreen from '../screens/ActivityScreen.jsx'
import ChooseActivityScreen from '../screens/ChooseActivityScreen.jsx'
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
  return pathname.startsWith('/players') || pathname.startsWith('/parent')
}

// Saves a child's setting change, showing it right away; if saving fails, falls back
// to what the server has.
function useChildSettings(child) {
  const [settings, setSettings] = useState(child?.settings ?? DEFAULT_SETTINGS)
  const childId = child?.id ?? null
  const updateSettings = useCallback(
    (partial) => {
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

  return <ChildLook key={child?.id ?? 'grown-up'} child={child} busy={navigation.state !== 'idle'} />
}

// Pathless layout around the child's screens; its loader finds the child playing.
export function ChildLayout() {
  return <Outlet />
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
