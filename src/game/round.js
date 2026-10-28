import { generateQuestions } from './questions.js'

export function createRound({ id, childId, activityId, questions, now }) {
  return {
    id,
    childId,
    activityId,
    startedAt: now,
    completedAt: null,
    status: 'in_progress',
    isSample: false,
    currentIndex: 0,
    paused: false,
    questions: questions.map((q) => ({
      target: q.target,
      pictureId: q.pictureId,
      hint: q.hint,
      options: [...q.options],
      selections: [],
      attempts: 0,
      correct: false,
      hintUsed: false,
      audioUsed: false,
      explanation: null,
      explanationDone: false,
    })),
  }
}

export function startRound({
  id,
  childId,
  activity,
  now = new Date().toISOString(),
  rng = Math.random,
  targets,
}) {
  const questions = generateQuestions(activity.items, {
    rng,
    count: activity.questionCount,
    targets,
  })
  return createRound({ id, childId, activityId: activity.id, questions, now })
}

// Selectors

export function getCurrentQuestion(round) {
  return round.questions[round.currentIndex]
}

export function getCompletedCount(round) {
  return round.questions.filter((q) => q.correct === true).length
}

export function isRoundComplete(round) {
  return round.status === 'completed'
}

export function getFeedback(question) {
  if (!question) return null
  if (question.correct) return 'correct'
  if (question.attempts > 0) return 'incorrect'
  return null
}

// Reducer helpers

function isLocked(round) {
  return round.paused || isRoundComplete(round)
}

function updateCurrent(round, patch) {
  const questions = round.questions.map((q, i) =>
    i === round.currentIndex ? { ...q, ...patch } : q,
  )
  return { ...round, questions }
}

function finishExplanation(round, explanation) {
  const question = getCurrentQuestion(round)
  if (isLocked(round) || !question || !question.correct || question.explanationDone) {
    return round
  }
  return updateCurrent(round, { explanation, explanationDone: true })
}

// No-op actions return the same reference.
export function roundReducer(round, action) {
  const question = getCurrentQuestion(round)

  switch (action?.type) {
    case 'SELECT': {
      if (isLocked(round) || !question || question.correct) return round
      if (!question.options.includes(action.word)) return round
      return updateCurrent(round, {
        selections: [...question.selections, action.word],
        attempts: question.attempts + 1,
        correct: action.word === question.target,
      })
    }

    case 'USE_HINT':
      if (isLocked(round) || !question || question.hintUsed) return round
      return updateCurrent(round, { hintUsed: true })

    case 'USE_AUDIO':
      if (isLocked(round) || !question || question.audioUsed) return round
      return updateCurrent(round, { audioUsed: true })

    case 'SAVE_EXPLANATION': {
      const text = typeof action.text === 'string' ? action.text.trim() : ''
      return finishExplanation(round, text === '' ? null : text)
    }

    case 'SKIP_EXPLANATION':
      return finishExplanation(round, null)

    case 'PAUSE':
      if (round.paused || isRoundComplete(round)) return round
      return { ...round, paused: true }

    case 'CONTINUE':
      if (!round.paused) return round
      return { ...round, paused: false }

    case 'NEXT': {
      if (isLocked(round) || !question || !question.correct) return round
      if (round.currentIndex < round.questions.length - 1) {
        return { ...round, currentIndex: round.currentIndex + 1 }
      }
      return { ...round, status: 'completed', completedAt: action.now }
    }

    default:
      return round
  }
}
