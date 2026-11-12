import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SEED_WORDS } from '../../server/seed/words.js'
import { MATCH_THE_WORD } from '../content/activities.js'
import { DEFAULT_SETTINGS } from '../content/settings.js'
import { createRng, startRound } from '../game/index.js'
import { renderWithRouter } from '../test/renderWithRouter.jsx'
import ActivityScreen from './ActivityScreen.jsx'

const START = '2026-10-22T10:00:00.000Z'
const ITEMS = SEED_WORDS.map(({ word, pictureId, hint }) => ({ word, pictureId, hint }))

function makeRound(seed = 7) {
  return startRound({
    id: 'round-test',
    childId: 'child-alex',
    activity: MATCH_THE_WORD,
    items: ITEMS,
    now: START,
    rng: createRng(seed),
  })
}

// Hand-written stand-ins: each records what it was given.
function recordSends() {
  const sent = []
  const sendAction = (roundId, action) => {
    sent.push({ roundId, action })
    return Promise.resolve()
  }
  return { sent, sendAction }
}

function recordAudio() {
  const played = []
  const playAudio = (text) => {
    played.push(text)
    return true
  }
  return { played, playAudio }
}

function renderActivity({
  round = makeRound(),
  sendAction = recordSends().sendAction,
  playAudio = recordAudio().playAudio,
  audioSupport = () => 'available',
  onComplete = () => {},
  settings = DEFAULT_SETTINGS,
} = {}) {
  const view = renderWithRouter(
    <ActivityScreen
      initialRound={round}
      onBack={() => {}}
      onComplete={onComplete}
      sendAction={sendAction}
      playAudio={playAudio}
      audioSupport={audioSupport}
    />,
    { settings },
  )
  return { ...view, round }
}

const types = (sent) => sent.map((entry) => entry.action.type)
const wordButton = (word) => screen.getByRole('button', { name: word })
// The speaker button reads "Hear" plus a visually hidden " <word>". jsdom's name
// computation drops the space between the two spans, so allow either.
const hearName = (word) => new RegExp(`^Hear\\s*${word}$`)

describe('ActivityScreen', () => {
  it('shows "Let\'s try again" after a wrong answer and keeps the question open', async () => {
    const { sent, sendAction } = recordSends()
    const { user, round } = renderActivity({ sendAction })
    const question = round.questions[0]
    const [wrong, otherWrong] = question.options.filter((w) => w !== question.target)

    await user.click(wordButton(wrong))

    expect(screen.getByText("Let's try again")).toBeTruthy()
    expect(screen.queryByText('Nice work!')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
    for (const word of question.options) {
      expect(wordButton(word).hasAttribute('aria-disabled')).toBe(false)
    }
    expect(sent).toEqual([{ roundId: 'round-test', action: { type: 'SELECT', word: wrong } }])

    // Another option still works.
    await user.click(wordButton(otherWrong))
    expect(sent.at(-1).action).toEqual({ type: 'SELECT', word: otherWrong })
    expect(screen.getByText("Let's try again")).toBeTruthy()
  })

  it('locks every word, says "Nice work!" and shows Next after a correct answer', async () => {
    const { user, round } = renderActivity()
    const question = round.questions[0]

    await user.click(wordButton(question.target))

    expect(screen.getByText('Nice work!')).toBeTruthy()
    for (const word of question.options) {
      expect(wordButton(word).getAttribute('aria-disabled')).toBe('true')
    }
    expect(screen.getByRole('button', { name: 'Next' }).disabled).toBe(false)
  })

  it('shows the current hint and sends USE_HINT when Help is pressed', async () => {
    const { sent, sendAction } = recordSends()
    const { user, round } = renderActivity({ sendAction })

    expect(screen.queryByText(round.questions[0].hint)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Help' }))

    expect(screen.getByText(round.questions[0].hint)).toBeTruthy()
    expect(sent).toEqual([{ roundId: 'round-test', action: { type: 'USE_HINT' } }])
  })

  it('plays a word with Hear and sends USE_AUDIO', async () => {
    const { sent, sendAction } = recordSends()
    const { played, playAudio } = recordAudio()
    const { user, round } = renderActivity({ sendAction, playAudio })
    const word = round.questions[0].options[1]

    await user.click(screen.getByRole('button', { name: hearName(word) }))

    expect(played).toEqual([word])
    expect(sent).toEqual([{ roundId: 'round-test', action: { type: 'USE_AUDIO' } }])
  })

  it('disables Hear when audio is unavailable', async () => {
    const { played, playAudio } = recordAudio()
    const { round } = renderActivity({ playAudio, audioSupport: () => 'unavailable' })

    for (const word of round.questions[0].options) {
      expect(screen.getByRole('button', { name: hearName(word) }).disabled).toBe(true)
    }
    expect(screen.getByRole('button', { name: 'Hear Instructions' }).disabled).toBe(true)
    expect(screen.getByText('Audio unavailable')).toBeTruthy()
    expect(played).toEqual([])
  })

  it('shows the Paused dialog and closes it with Continue', async () => {
    const { sent, sendAction } = recordSends()
    const { user } = renderActivity({ sendAction })

    await user.click(screen.getByRole('button', { name: 'Pause' }))

    // jsdom has no showModal(), so the <dialog> stays closed (display: none) and
    // only `hidden: true` queries reach it. A real browser opens it as a modal.
    const dialog = screen.getByRole('dialog', { hidden: true })
    expect(within(dialog).getByRole('heading', { name: 'Paused', hidden: true })).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Continue', hidden: true }))

    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull()
    expect(types(sent)).toEqual(['PAUSE', 'CONTINUE'])
  })

  describe('with "Ask how they chose" on', () => {
    const settings = { ...DEFAULT_SETTINGS, explanations: 'on' }

    it('saves the typed explanation and thanks the child', async () => {
      const { sent, sendAction } = recordSends()
      const { user, round } = renderActivity({ sendAction, settings })

      expect(screen.queryByLabelText('Tell us how you chose')).toBeNull()
      await user.click(wordButton(round.questions[0].target))

      await user.type(screen.getByLabelText('Tell us how you chose'), 'I looked at the first letter')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(sent.at(-1)).toEqual({
        roundId: 'round-test',
        action: { type: 'SAVE_EXPLANATION', text: 'I looked at the first letter' },
      })
      expect(screen.getByText('Thanks for telling us!')).toBeTruthy()
      expect(screen.queryByLabelText('Tell us how you chose')).toBeNull()
    })

    it('hides the form and sends SKIP_EXPLANATION on Skip', async () => {
      const { sent, sendAction } = recordSends()
      const { user, round } = renderActivity({ sendAction, settings })

      await user.click(wordButton(round.questions[0].target))
      await user.click(screen.getByRole('button', { name: 'Skip' }))

      expect(sent.at(-1).action).toEqual({ type: 'SKIP_EXPLANATION' })
      expect(screen.queryByLabelText('Tell us how you chose')).toBeNull()
      expect(screen.queryByText('Thanks for telling us!')).toBeNull()
      expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy()
    })
  })

  it('says progress is not being saved when sendAction fails', async () => {
    const sendAction = () => Promise.reject(new Error('offline'))
    const { user, round } = renderActivity({ sendAction })

    expect(screen.queryByText(/Progress isn.t being saved/)).toBeNull()
    await user.click(wordButton(round.questions[0].target))

    expect(await screen.findByText(/Progress isn.t being saved/)).toBeTruthy()
  })

  it('calls onComplete with a completed round after all five questions', async () => {
    const completed = []
    const { sent, sendAction } = recordSends()
    const { user, round } = renderActivity({ sendAction, onComplete: (r) => completed.push(r) })
    expect(round.questions).toHaveLength(5)

    for (const question of round.questions) {
      expect(completed).toEqual([])
      await user.click(wordButton(question.target))
      await user.click(screen.getByRole('button', { name: 'Next' }))
    }

    expect(completed).toHaveLength(1)
    expect(completed[0].status).toBe('completed')
    expect(completed[0].id).toBe('round-test')
    expect(completed[0].questions.every((q) => q.correct && q.attempts === 1)).toBe(true)
    expect(types(sent).filter((type) => type === 'NEXT')).toHaveLength(5)
  })
})
