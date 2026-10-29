// The component for each route: reads loader data, wires up navigation, and renders
// a screen. Loaders are in loaders.js; the route table is in ../router.js.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Outlet,
  useLoaderData,
  useLocation,
  useMatch,
  useNavigate,
  useNavigation,
  useRevalidator,
  useRouteError,
  useRouteLoaderData,
} from 'react-router'
import { lock, signOut } from '../api/auth.js'
import { ApiError } from '../api/http.js'
import { getChild, resetDemoData, saveSettings, startRound, whenSaved } from '../api/progress.js'
import { SettingsContext } from '../components/settingsContext.js'
import ActivityScreen from '../screens/ActivityScreen.jsx'
import ChooseActivityScreen from '../screens/ChooseActivityScreen.jsx'
import ParentScreen from '../screens/ParentScreen.jsx'
import SignInScreen from '../screens/SignInScreen.jsx'
import StartScreen from '../screens/StartScreen.jsx'
import SummaryScreen from '../screens/SummaryScreen.jsx'

const SERVER_TROUBLE = 'We couldn’t reach the game server. Please try again.'

// Only move focus to headings after the first navigation, not on page load.
function useFocusHeading() {
  return useLocation().key !== 'default'
}

// Asks the server to start a round of `activityId` (it returns the game's in-progress
// round if there is one) and opens it. Called from event handlers only.
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

// Root layout: the session, the child, and their settings, shared by every screen.

export function AppLayout() {
  const { child } = useLoaderData()
  const [settings, setSettings] = useState(child?.settings)
  const navigation = useNavigation()
  const inParentView = useMatch('/parent') !== null
  const wasInParentView = useRef(inParentView)

  // Changes show right away; if saving fails, fall back to what the server has.
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
  const settingsValue = useMemo(
    () => ({ childId, settings, updateSettings }),
    [childId, settings, updateSettings],
  )

  // The password is asked for every time: leaving the parent/teacher view locks
  // grown-up actions again.
  useEffect(() => {
    if (wasInParentView.current && !inParentView) lock()
    wasInParentView.current = inParentView
  }, [inParentView])

  if (!child) return <NoChildScreen />

  // The settings are for the child's screens; the parent/teacher view always looks standard.
  const look = inParentView ? { textSize: 'standard', font: 'standard' } : settings

  return (
    <SettingsContext value={settingsValue}>
      <div
        className="app"
        data-text-size={look.textSize}
        data-font={look.font}
        aria-busy={navigation.state !== 'idle' || undefined}
      >
        <Outlet />
      </div>
    </SettingsContext>
  )
}

function NoChildScreen() {
  const navigate = useNavigate()
  return (
    <div className="app">
      <main className="screen screen--center">
        <h1 className="screen-heading">No child to play yet</h1>
        <p className="lead">This grown-up account isn’t linked to a child profile.</p>
        <button
          type="button"
          className="btn btn--secondary btn--big"
          onClick={async () => {
            await signOut()
            navigate('/sign-in')
          }}
        >
          Sign out
        </button>
      </main>
    </div>
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

// Sign in (outside the root layout: no child yet)

export function SignInRoute() {
  const navigate = useNavigate()
  const focusHeading = useFocusHeading()
  return (
    <div className="app">
      <SignInScreen onSignIn={() => navigate('/', { replace: true })} focusHeading={focusHeading} />
    </div>
  )
}

// Start

export function StartRoute() {
  const { child } = useRouteLoaderData('root')
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

// Choose a game

export function ChooseRoute() {
  const { child } = useRouteLoaderData('root')
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

// Play

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

// Summary

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

// Parent/teacher view

export function ParentRoute() {
  const { child, session } = useRouteLoaderData('root')
  const { rounds } = useLoaderData()
  const navigate = useNavigate()
  const revalidator = useRevalidator()
  const focusHeading = useFocusHeading()

  async function handleReset() {
    await resetDemoData()
    await revalidator.revalidate()
  }

  async function handleSignOut() {
    await signOut()
    navigate('/sign-in', { replace: true })
  }

  return (
    <ParentScreen
      child={child}
      username={session.adult.username}
      rounds={rounds}
      onReset={handleReset}
      onSignOut={handleSignOut}
      onBack={() => navigate('/')}
      focusHeading={focusHeading}
    />
  )
}
