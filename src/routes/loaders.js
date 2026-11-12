// Route loaders: fetch from the Express API before a screen shows. Loaders that read
// rounds wait for pending game actions first, so they never see an older copy.
import { redirect } from 'react-router'
import { loadSession } from '../api/auth.js'
import { ApiError } from '../api/http.js'
import {
  getChild,
  getCompletedRounds,
  getGames,
  getRound,
  getRounds,
  listChildren,
  whenSaved,
} from '../api/progress.js'
import { getActiveTestSession, getTestSession, listTestSessions } from '../api/testing.js'

function isStatus(error, status) {
  return error instanceof ApiError && error.status === status
}

// Root: signed out → the sign-in screen. Otherwise { session }.
export async function rootLoader() {
  const session = await loadSession()
  if (!session) return redirect('/sign-in')
  return { session }
}

export async function signInLoader() {
  return (await loadSession()) ? redirect('/players') : null
}

// Grown-up screens. When the unlock has timed out they return { locked: true, session }
// and the screen asks for the password instead (GrownUpGateScreen).

export async function playersLoader() {
  const session = await loadSession()
  if (!session) return redirect('/sign-in')
  return session.elevated ? { locked: false, session } : { locked: true, session }
}

export async function parentHomeLoader() {
  const session = await loadSession()
  if (!session) return redirect('/sign-in')
  try {
    const [profiles, testSessions] = await Promise.all([listChildren(), listTestSessions()])
    return { locked: false, session, profiles, testSessions }
  } catch (error) {
    if (isStatus(error, 403)) return { locked: true, session }
    throw error
  }
}

export async function parentChildLoader({ params }) {
  await whenSaved()
  const session = await loadSession()
  if (!session) return redirect('/sign-in')
  try {
    const [child, rounds] = await Promise.all([
      getChild(params.childId),
      getCompletedRounds(params.childId),
    ])
    return { locked: false, session, child, rounds }
  } catch (error) {
    if (isStatus(error, 403)) return { locked: true, session }
    if (isStatus(error, 404)) return redirect('/parent')
    throw error
  }
}

async function getTestSessionOrNull(id) {
  try {
    return await getTestSession(id)
  } catch (error) {
    if (isStatus(error, 404)) return null
    throw error
  }
}

// Facilitator console: ?session=<id> (e.g. a past session's results), else the active
// session, else none (an unknown id also shows none). Also loads the session child's
// rounds (any status) and settings, for the logged signals (deriveSignals).
export async function facilitatorLoader({ request }) {
  await whenSaved()
  const session = await loadSession()
  if (!session) return redirect('/sign-in')
  try {
    const pastSessions = await listTestSessions()
    const id =
      new URL(request.url).searchParams.get('session') ||
      pastSessions.find((past) => past.status === 'active')?.id
    const testSession = id ? await getTestSessionOrNull(id) : null
    if (!testSession) {
      const none = { testSession: null, rounds: [], childSettings: null, childName: null }
      return { locked: false, session, pastSessions, ...none }
    }
    const [rounds, child] = await Promise.all([
      getRounds(testSession.childId),
      getChild(testSession.childId),
    ])
    return {
      locked: false,
      session,
      testSession,
      pastSessions,
      rounds,
      childSettings: child.settings,
      childName: child.name,
    }
  } catch (error) {
    if (isStatus(error, 403)) return { locked: true, session }
    throw error
  }
}

const NO_TEST_SESSION = { active: false }

// Child screens (Start, Choose a game, Play, Summary) all sit under this loader. It
// finds the child playing on this device; with none picked yet, the grown-up picks one.
// It also reads the usability test session for the task card; any failure there just
// means no session, so it never stops the child's game.
export async function childLoader() {
  const session = await loadSession()
  if (!session) return redirect('/sign-in')
  if (!session.activeChildId) return redirect('/players')
  const [child, testSession] = await Promise.all([
    getChild(session.activeChildId),
    getActiveTestSession().catch(() => NO_TEST_SESSION),
  ])
  return { child, testSession }
}

export async function chooseLoader() {
  await whenSaved()
  const session = await loadSession()
  if (!session?.activeChildId) return redirect('/players')
  return getGames(session.activeChildId)
}

// A round of another child (403/404) sends the player back to their own games.
async function loadRoundOrRedirect(roundId) {
  await whenSaved()
  try {
    return await getRound(roundId)
  } catch (error) {
    if (isStatus(error, 403)) return null
    throw error
  }
}

export async function playLoader({ params }) {
  const round = await loadRoundOrRedirect(params.roundId)
  if (!round) return redirect('/games')
  if (round.status === 'completed') return redirect(`/summary/${round.id}`)
  return { round }
}

export async function summaryLoader({ params }) {
  const round = await loadRoundOrRedirect(params.roundId)
  if (!round) return redirect('/games')
  if (round.status !== 'completed') return redirect(`/play/${round.id}`)
  return { round }
}
