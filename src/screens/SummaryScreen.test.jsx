import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SEED_WORDS } from '../../server/seed/words.js'
import { MATCH_THE_WORD } from '../content/activities.js'
import { createRng, getCurrentQuestion, roundReducer, startRound } from '../game/index.js'
import { renderWithRouter } from '../test/renderWithRouter.jsx'
import SummaryScreen from './SummaryScreen.jsx'

const ITEMS = SEED_WORDS.map(({ word, pictureId, hint }) => ({ word, pictureId, hint }))

// A round played to the end with the real reducer.
function completedRound() {
  let round = startRound({
    id: 'round-done',
    childId: 'child-alex',
    activity: MATCH_THE_WORD,
    items: ITEMS,
    now: '2026-10-22T10:00:00.000Z',
    rng: createRng(3),
  })
  for (let i = 0; i < round.questions.length; i += 1) {
    round = roundReducer(round, { type: 'SELECT', word: getCurrentQuestion(round).target })
    round = roundReducer(round, { type: 'NEXT', now: '2026-10-22T10:05:00.000Z' })
  }
  return round
}

function renderSummary() {
  const calls = []
  const round = completedRound()
  const view = renderWithRouter(
    <SummaryScreen
      round={round}
      onPlayAgain={() => calls.push('again')}
      starting={false}
      error=""
      onHome={() => calls.push('home')}
    />,
  )
  return { ...view, calls, round }
}

describe('SummaryScreen', () => {
  it('shows "You finished 5 words!" and every word read', () => {
    const { round } = renderSummary()

    expect(round.status).toBe('completed')
    expect(screen.getByRole('heading', { level: 1, name: 'You finished 5 words!' })).toBeTruthy()
    const list = screen.getByRole('list')
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      round.questions.map((q) => q.target),
    )
  })

  it('calls onPlayAgain and onHome', async () => {
    const { user, calls } = renderSummary()

    await user.click(screen.getByRole('button', { name: 'Play Again' }))
    await user.click(screen.getByRole('button', { name: 'Home' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(calls).toEqual(['again', 'home', 'home'])
  })
})
