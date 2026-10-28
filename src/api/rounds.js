// Starting rounds. Questions are generated in the browser (game/), then saved
// through the API before the round is shown.
import { MATCH_THE_WORD, PRACTICE_TRICKY_WORDS } from '../content/activities.js'
import { recentPracticeWords, startRound } from '../game/index.js'
import { createRoundId, getRounds, saveRound } from './progress.js'

// Words that took more than one try in recent completed rounds, most often tricky first.
export async function getTrickyWords(childId) {
  const completed = await getRounds({ childId, status: 'completed' })
  return recentPracticeWords(completed).map(({ word }) => word)
}

// A Tricky Words round uses the child's recent tricky words as targets. With none left,
// it falls back to a regular Match the Word round.
export async function startNewRound(childId, activityId = MATCH_THE_WORD.id) {
  const trickyWords =
    activityId === PRACTICE_TRICKY_WORDS.id ? await getTrickyWords(childId) : []
  const round = startRound({
    id: createRoundId(),
    childId,
    activity: trickyWords.length > 0 ? PRACTICE_TRICKY_WORDS : MATCH_THE_WORD,
    now: new Date().toISOString(),
    rng: Math.random,
    targets: trickyWords.length > 0 ? trickyWords : undefined,
  })
  return saveRound(round)
}
