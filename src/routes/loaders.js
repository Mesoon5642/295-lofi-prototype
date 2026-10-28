// Route loaders: fetch from the Express API before a screen shows. Loaders that read
// rounds wait for pending round saves first, so they never see an older copy.
import { redirect } from 'react-router'
import { ACTIVE_CHILD_ID } from '../api/config.js'
import {
  getChildProfile,
  getInProgressRound,
  getRound,
  getRounds,
  getSettings,
  whenSaved,
} from '../api/progress.js'
import { getTrickyWords } from '../api/rounds.js'
import { hasParentSession } from '../auth/parentSession.js'
import { MATCH_THE_WORD, PRACTICE_TRICKY_WORDS } from '../content/activities.js'

export async function rootLoader() {
  const [child, settings] = await Promise.all([
    getChildProfile(ACTIVE_CHILD_ID),
    getSettings(ACTIVE_CHILD_ID),
  ])
  return { child, settings }
}

export async function chooseLoader() {
  await whenSaved()
  const [practiceWords, matchRound, practiceRound] = await Promise.all([
    getTrickyWords(ACTIVE_CHILD_ID),
    getInProgressRound(ACTIVE_CHILD_ID, MATCH_THE_WORD.id),
    getInProgressRound(ACTIVE_CHILD_ID, PRACTICE_TRICKY_WORDS.id),
  ])
  return {
    practiceWords,
    inProgressIds: {
      [MATCH_THE_WORD.id]: matchRound?.id ?? null,
      [PRACTICE_TRICKY_WORDS.id]: practiceRound?.id ?? null,
    },
  }
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

export async function parentLoader() {
  if (!hasParentSession()) return redirect('/')
  await whenSaved()
  return { rounds: await getRounds({ childId: ACTIVE_CHILD_ID, status: 'completed' }) }
}
