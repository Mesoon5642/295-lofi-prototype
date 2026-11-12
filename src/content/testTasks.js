// Usability test mode content: the task set a tester works through, plus the outcome
// and severity choices the facilitator records. Pure data, shared with the server.
// Scenarios state a goal and never name a button; the task card shows them as-is.

export const TEST_TASKS = [
  {
    id: 'start-round',
    number: 1,
    title: 'Start a round',
    scenario:
      'You are setting up a reading game for a child named Alex. Get Alex into a round of Match the Word.',
    required: true,
    signal: 'round-created',
  },
  {
    id: 'finish-round',
    number: 2,
    title: 'Finish a round',
    scenario: "Play the round the way Alex would, and keep going until the game tells you you're done.",
    required: true,
    signal: 'round-summary',
  },
  {
    id: 'get-help',
    number: 3,
    title: 'Get help',
    scenario:
      'Start another round. Pretend Alex is not sure about a word. Give a wrong answer, get a hint, hear a word read aloud, then pause the game and come back to it.',
    required: true,
    signal: 'help-used',
  },
  {
    id: 'review-as-parent',
    number: 4,
    title: 'Review as a parent',
    scenario: "Now you are Alex's parent. Find out how Alex did in the last round and which words were hard.",
    required: true,
    signal: 'round-detail-opened',
  },
  {
    id: 'practice-tricky-words',
    number: 5,
    title: 'Practice tricky words',
    scenario: 'Alex wants to practice the words that were hard. Start a round that does that.',
    required: false,
    signal: 'tricky-round-created',
  },
  {
    id: 'bigger-text',
    number: 6,
    title: 'Make the text bigger',
    scenario: 'Alex finds the words too small. Make them bigger.',
    required: false,
    signal: 'text-size-large',
  },
]

export const TEST_TASK_IDS = TEST_TASKS.map((task) => task.id)
export const REQUIRED_TASK_IDS = TEST_TASKS.filter((task) => task.required).map((task) => task.id)

export function findTestTask(taskId) {
  return TEST_TASKS.find((task) => task.id === taskId) ?? null
}

// The facilitator's outcome buttons. The outcome, not the logged signal, decides
// whether a task counts as completed.
export const OUTCOMES = [
  { id: 'completed_unaided', label: 'Completed Unaided' },
  { id: 'completed_with_hesitation', label: 'Completed With Hesitation' },
  { id: 'failed', label: 'Failed' },
]

export const OUTCOME_IDS = OUTCOMES.map((outcome) => outcome.id)

export const SEVERITIES = [
  { value: 1, label: '1 minor' },
  { value: 2, label: '2 recovered' },
  { value: 3, label: '3 blocked' },
]

export const SEVERITY_VALUES = SEVERITIES.map((severity) => severity.value)

export const DEFAULT_TESTER_LABEL = 'Tester 1'

// 'Tester 1' → 'Tester 2'. A label without a trailing number gets ' 2'.
export function nextTesterLabel(label) {
  const trimmed = typeof label === 'string' ? label.trim() : ''
  if (trimmed === '') return DEFAULT_TESTER_LABEL
  const match = /^(.*?)(\d+)$/.exec(trimmed)
  if (!match) return `${trimmed} 2`
  return `${match[1]}${Number(match[2]) + 1}`
}
