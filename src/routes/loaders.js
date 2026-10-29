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
  listChildren,
  whenSaved,
} from '../api/progress.js'

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
    return { locked: false, session, profiles: await listChildren() }
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

// Child screens (Start, Choose a game, Play, Summary) all sit under this loader. It
// finds the child playing on this device; with none picked yet, the grown-up picks one.
export async function childLoader() {
  const session = await loadSession()
  if (!session) return redirect('/sign-in')
  if (!session.activeChildId) return redirect('/players')
  return { child: await getChild(session.activeChildId) }
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
