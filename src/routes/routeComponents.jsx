// The component for each route: reads loader data, wires up navigation, and renders
// a screen. Loaders are in loaders.js; the route table is in ../router.js.
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { ACTIVE_CHILD_ID } from '../api/config.js'
import { ApiError } from '../api/http.js'
import { getSettings, resetDemoData, saveSettings, whenSaved } from '../api/progress.js'
import { startNewRound } from '../api/rounds.js'
import { endParentSession, startParentSession } from '../auth/parentSession.js'
import { SettingsContext } from '../components/settingsContext.js'
import ActivityScreen from '../screens/ActivityScreen.jsx'
import ChooseActivityScreen from '../screens/ChooseActivityScreen.jsx'
import ParentScreen from '../screens/ParentScreen.jsx'
import StartScreen from '../screens/StartScreen.jsx'
import SummaryScreen from '../screens/SummaryScreen.jsx'

const SERVER_TROUBLE = 'We couldn’t reach the game server. Please try again.'

// Only move focus to headings after the first navigation, not on page load.
function useFocusHeading() {
  return useLocation().key !== 'default'
}

// Starts a new round (or resumes `existingId`) and opens it. Rounds are created in
// event handlers, never effects, so StrictMode can't create duplicates.
function useStartRound() {
  const navigate = useNavigate()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  async function start(activityId, existingId = null) {
    if (starting) return
    if (existingId) {
      navigate(`/play/${existingId}`)
      return
    }
    setStarting(true)
    setError('')
    try {
      const round = await startNewRound(ACTIVE_CHILD_ID, activityId)
      navigate(`/play/${round.id}`)
    } catch {
      setError(SERVER_TROUBLE)
      setStarting(false)
    }
  }

  return { start, starting, error }
}

// Root layout: child profile and settings, shared by every screen.

export function AppLayout() {
  const { child, settings: savedSettings } = useLoaderData()
  const [settings, setSettings] = useState(savedSettings)
  const navigation = useNavigation()
  const inParentView = useMatch('/parent') !== null

  // Changes show right away; if saving fails, fall back to what the server has.
  const updateSettings = useCallback(
    (partial) => {
      setSettings((current) => ({ ...current, ...partial }))
      saveSettings(child.id, partial)
        .catch(() => getSettings(child.id).then(setSettings))
        .catch((error) => console.error('Could not save settings', error))
    },
    [child.id],
  )
  const settingsValue = useMemo(
    () => ({ childId: child.id, settings, updateSettings }),
    [child.id, settings, updateSettings],
  )

  // Sign-in is asked for every time: leaving the parent/teacher view ends it.
  useEffect(() => {
    if (!inParentView) endParentSession()
  }, [inParentView])

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

export function ErrorScreen() {
  const error = useRouteError()
  const offline = error instanceof ApiError && error.status === 0
  if (!offline) console.error(error)
  return (
    <div className="app">
      <main className="screen screen--center">
        <h1 className="screen-heading">{offline ? 'Can’t reach the game' : 'Something went wrong'}</h1>
        <p className="lead">
          {offline
            ? 'The game server isn’t answering. Ask a grown-up to check that it is running.'
            : 'Please try again.'}
        </p>
        <button
          type="button"
          className="btn btn--primary btn--big"
          onClick={() => window.location.assign('/')}
        >
          Try again
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

// Start

export function StartRoute() {
  const { child } = useRouteLoaderData('root')
  const navigate = useNavigate()
  const focusHeading = useFocusHeading()
  return (
    <StartScreen
      childName={child.name}
      onPlay={() => navigate('/games')}
      onParent={() => {
        startParentSession()
        navigate('/parent')
      }}
      focusHeading={focusHeading}
    />
  )
}

// Choose a game

export function ChooseRoute() {
  const { practiceWords, inProgressIds } = useLoaderData()
  const navigate = useNavigate()
  const focusHeading = useFocusHeading()
  const { start, starting, error } = useStartRound()
  const inProgress = Object.fromEntries(
    Object.entries(inProgressIds).map(([activityId, id]) => [activityId, id !== null]),
  )
  return (
    <ChooseActivityScreen
      inProgress={inProgress}
      practiceWords={practiceWords}
      onStart={(activityId) => start(activityId, inProgressIds[activityId])}
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

  // ActivityScreen has already queued the save of the finished round.
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
  const { start, starting, error } = useStartRound()
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
  const { child } = useRouteLoaderData('root')
  const { rounds } = useLoaderData()
  const navigate = useNavigate()
  const revalidator = useRevalidator()
  const focusHeading = useFocusHeading()

  async function handleReset() {
    await resetDemoData()
    await revalidator.revalidate()
  }

  return (
    <ParentScreen
      child={child}
      rounds={rounds}
      onReset={handleReset}
      onBack={() => navigate('/')}
      focusHeading={focusHeading}
    />
  )
}
