// Route loaders: fetch from the Express API before a screen shows. Loaders that read
// rounds wait for pending game actions first, so they never see an older copy.
import { redirect } from 'react-router'
import { loadSession } from '../api/auth.js'
import { ApiError } from '../api/http.js'
import { getChild, getCompletedRounds, getGames, getRound, whenSaved } from '../api/progress.js'

// The child who plays on this device: the signed-in grown-up's first child, until
// there is a way to pick one.
async function activeChildId() {
  const session = await loadSession()
  return session?.children[0]?.id ?? null
}

// Signed out → the sign-in screen. Otherwise { session, child } (child is null when
// the grown-up has no children linked yet).
export async function rootLoader() {
  const session = await loadSession()
  if (!session) return redirect('/sign-in')
  const childId = session.children[0]?.id
  return { session, child: childId ? await getChild(childId) : null }
}

export async function signInLoader() {
  return (await loadSession()) ? redirect('/') : null
}

export async function chooseLoader() {
  await whenSaved()
  const childId = await activeChildId()
  if (!childId) return redirect('/')
  return getGames(childId)
}

export async function playLoader({ params }) {
  await whenSaved()
  const round = await getRound(params.roundId)
  if (!round) return redirect('/games')
  if (round.status === 'completed') return redirect(`/summary/${round.id}`)
  return { round }
}

export async function summaryLoader({ params }) {
  await whenSaved()
  const round = await getRound(params.roundId)
  if (!round) return redirect('/games')
  if (round.status !== 'completed') return redirect(`/play/${round.id}`)
  return { round }
}

// Only after the grown-up re-entered their password (the server answers 403 otherwise).
export async function parentLoader() {
  await whenSaved()
  const childId = await activeChildId()
  if (!childId) return redirect('/')
  try {
    return { rounds: await getCompletedRounds(childId) }
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return redirect('/')
    throw error
  }
}
