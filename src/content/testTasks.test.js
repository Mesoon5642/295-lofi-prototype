import { describe, expect, it } from 'vitest'
import { SEED_WORDS } from '../../server/seed/words.js'
import { MATCH_THE_WORD, PRACTICE_TRICKY_WORDS } from './activities.js'
import { createRng } from '../game/random.js'
import { getCurrentQuestion, roundReducer, startRound } from '../game/round.js'
import { createTestSession, deriveSignals } from '../game/testSession.js'
import {
  DEFAULT_TESTER_LABEL,
  OUTCOMES,
  OUTCOME_IDS,
  REQUIRED_TASK_IDS,
  SEVERITIES,
  SEVERITY_VALUES,
  TEST_TASKS,
  TEST_TASK_IDS,
  findTestTask,
  nextTesterLabel,
} from './testTasks.js'

const NOW = '2026-11-12T10:00:00.000Z'

// Scenario text, word for word from the brief.
const BRIEF_SCENARIOS = [
  'You are setting up a reading game for a child named Alex. Get Alex into a round of Match the Word.',
  "Play the round the way Alex would, and keep going until the game tells you you're done.",
  'Start another round. Pretend Alex is not sure about a word. Give a wrong answer, get a hint, hear a word read aloud, then pause the game and come back to it.',
  "Now you are Alex's parent. Find out how Alex did in the last round and which words were hard.",
  'Alex wants to practice the words that were hard. Start a round that does that.',
  'Alex finds the words too small. Make them bigger.',
]

// The app's button labels. A scenario states a goal and never names one of these.
const BUTTON_LABELS = [
  'Help',
  'Pause',
  'Continue',
  'Next',
  'Hear',
  'Hear Instructions',
  'Settings',
  'Play',
  'Start',
  'Back',
  'Parent or Teacher',
  'Tricky Words',
  'Larger text',
  'Save',
  'Skip',
]

// The brief's own scenario text starts sentences with "Play" and "Start", which are
// also button labels. The scenario text wins (it is word for word from the brief), so
// these pairs are left out of the check and flagged with the it.todo below.
const BRIEF_CONFLICTS = new Set([
  'finish-round:Play',
  'get-help:Start',
  'practice-tricky-words:Start',
])

function namesLabel(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`).test(text)
}

describe('TEST_TASKS', () => {
  it('has 6 tasks numbered 1–6 with unique ids', () => {
    expect(TEST_TASKS).toHaveLength(6)
    expect(TEST_TASKS.map((task) => task.number)).toEqual([1, 2, 3, 4, 5, 6])
    expect(new Set(TEST_TASK_IDS).size).toBe(6)
    expect(TEST_TASK_IDS).toEqual(TEST_TASKS.map((task) => task.id))
  })

  it('exactly tasks 1–4 are required', () => {
    expect(TEST_TASKS.filter((task) => task.required).map((task) => task.number)).toEqual([
      1, 2, 3, 4,
    ])
    expect(REQUIRED_TASK_IDS).toEqual(TEST_TASKS.slice(0, 4).map((task) => task.id))
  })

  it('every scenario matches the brief text exactly', () => {
    expect(TEST_TASKS.map((task) => task.scenario)).toEqual(BRIEF_SCENARIOS)
  })

  it('no scenario names a button (whole word, case-sensitive)', () => {
    for (const task of TEST_TASKS) {
      for (const label of BUTTON_LABELS) {
        if (BRIEF_CONFLICTS.has(`${task.id}:${label}`)) continue
        expect(namesLabel(task.scenario, label), `${task.id} names "${label}"`).toBe(false)
      }
    }
  })

  it('the only label matches are the known brief conflicts', () => {
    const found = []
    for (const task of TEST_TASKS) {
      for (const label of BUTTON_LABELS) {
        if (namesLabel(task.scenario, label)) found.push(`${task.id}:${label}`)
      }
    }
    expect(new Set(found)).toEqual(BRIEF_CONFLICTS)
  })

  it.todo(
    'no scenario names a button: scenarios 2, 3 and 5 (verbatim from the brief) contain "Play" / "Start"',
  )

  it('every signal is handled by deriveSignals', () => {
    const rng = createRng(1)
    let helpRound = startRound({
      id: 'round-help',
      childId: 'child-alex',
      activity: MATCH_THE_WORD,
      items: SEED_WORDS,
      now: NOW,
      rng,
    })
    const q = getCurrentQuestion(helpRound)
    helpRound = [
      { type: 'SELECT', word: q.options.find((w) => w !== q.target) },
      { type: 'USE_HINT' },
      { type: 'USE_AUDIO' },
      { type: 'SELECT', word: q.target },
    ].reduce(roundReducer, helpRound)
    const trickyRound = startRound({
      id: 'round-tricky',
      childId: 'child-alex',
      activity: PRACTICE_TRICKY_WORDS,
      items: SEED_WORDS,
      now: NOW,
      rng,
      targets: ['cat'],
    })
    const base = createTestSession({
      id: 'test-1',
      testerLabel: 'Tester 1',
      adultId: 'adult-1',
      childId: 'child-alex',
      taskIds: TEST_TASK_IDS,
      now: NOW,
    })
    const event = (taskId, fields) => ({ at: NOW, taskId, ...fields })
    const session = {
      ...base,
      events: [
        event('start-round', { type: 'route', path: '/play/round-a', roundId: 'round-a' }),
        event('finish-round', { type: 'route', path: '/summary/round-a', roundId: 'round-a' }),
        event('get-help', { type: 'route', path: '/play/round-help', roundId: 'round-help' }),
        event('review-as-parent', { type: 'signal', signal: 'round-detail-opened' }),
        event('practice-tricky-words', {
          type: 'route',
          path: '/play/round-tricky',
          roundId: 'round-tricky',
        }),
        event('bigger-text', { type: 'signal', signal: 'text-size-large' }),
      ],
    }
    const result = deriveSignals(session, { rounds: [helpRound, trickyRound] })
    expect(Object.keys(result)).toEqual(TEST_TASK_IDS)
    for (const task of TEST_TASKS) {
      expect(result[task.id].seen, `${task.id} (${task.signal})`).toBe(true)
    }
    expect(deriveSignals(base)).toEqual(
      Object.fromEntries(TEST_TASK_IDS.map((id) => [id, { seen: false, at: null }])),
    )
  })
})

describe('OUTCOMES / SEVERITIES', () => {
  it('lists the three outcomes with display labels', () => {
    expect(OUTCOMES).toEqual([
      { id: 'completed_unaided', label: 'Completed Unaided' },
      { id: 'completed_with_hesitation', label: 'Completed With Hesitation' },
      { id: 'failed', label: 'Failed' },
    ])
    expect(OUTCOME_IDS).toEqual(['completed_unaided', 'completed_with_hesitation', 'failed'])
  })

  it('lists severities 1–3 with display labels', () => {
    expect(SEVERITIES).toEqual([
      { value: 1, label: '1 minor' },
      { value: 2, label: '2 recovered' },
      { value: 3, label: '3 blocked' },
    ])
    expect(SEVERITY_VALUES).toEqual([1, 2, 3])
  })
})

describe('findTestTask', () => {
  it('finds a task by id, or returns null', () => {
    expect(findTestTask('get-help')).toBe(TEST_TASKS[2])
    expect(findTestTask('bigger-text').number).toBe(6)
    expect(findTestTask('nope')).toBe(null)
    expect(findTestTask(undefined)).toBe(null)
  })
})

describe('nextTesterLabel', () => {
  it('increments a trailing number', () => {
    expect(nextTesterLabel('Tester 1')).toBe('Tester 2')
    expect(nextTesterLabel('Tester 9')).toBe('Tester 10')
  })

  it('adds " 2" to a label without a trailing number', () => {
    expect(nextTesterLabel('Pilot')).toBe('Pilot 2')
  })

  it('falls back to Tester 1 for an empty or missing label', () => {
    expect(DEFAULT_TESTER_LABEL).toBe('Tester 1')
    expect(nextTesterLabel('')).toBe('Tester 1')
    expect(nextTesterLabel('   ')).toBe('Tester 1')
    expect(nextTesterLabel(undefined)).toBe('Tester 1')
  })

  it('trims whitespace', () => {
    expect(nextTesterLabel('  Tester 3  ')).toBe('Tester 4')
    expect(nextTesterLabel(' Pilot ')).toBe('Pilot 2')
  })
})
