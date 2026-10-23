export function needsPractice(question) {
  return question.attempts > 1
}

export function summarizeRound(round) {
  const words = round.questions.map((q) => ({
    word: q.target,
    attempts: q.attempts,
    selections: [...q.selections],
    hintUsed: q.hintUsed,
    audioUsed: q.audioUsed,
    explanation: q.explanation,
    needsPractice: needsPractice(q),
  }))
  return {
    roundId: round.id,
    isSample: round.isSample,
    startedAt: round.startedAt,
    completedAt: round.completedAt,
    totalWords: round.questions.length,
    words,
    practiceWords: words.filter((w) => w.needsPractice).map((w) => w.word),
    hintCount: words.filter((w) => w.hintUsed).length,
    audioCount: words.filter((w) => w.audioUsed).length,
  }
}

function roundTime(round) {
  return round.completedAt ?? round.startedAt ?? ''
}

// Counts, per word, how many of the newest `limit` completed rounds flagged it.
export function recentPracticeWords(rounds, { limit = 5 } = {}) {
  const recent = rounds
    .filter((round) => round.status === 'completed')
    .sort((a, b) => {
      const ta = roundTime(a)
      const tb = roundTime(b)
      if (ta === tb) return 0
      return ta < tb ? 1 : -1
    })
    .slice(0, Math.max(0, limit))

  const counts = new Map()
  for (const round of recent) {
    const flagged = new Set(round.questions.filter(needsPractice).map((q) => q.target))
    for (const word of flagged) counts.set(word, (counts.get(word) ?? 0) + 1)
  }

  return [...counts]
    .map(([word, roundsNeedingPractice]) => ({ word, roundsNeedingPractice }))
    .sort((a, b) => {
      if (a.roundsNeedingPractice !== b.roundsNeedingPractice) {
        return b.roundsNeedingPractice - a.roundsNeedingPractice
      }
      if (a.word === b.word) return 0
      return a.word < b.word ? -1 : 1
    })
}
