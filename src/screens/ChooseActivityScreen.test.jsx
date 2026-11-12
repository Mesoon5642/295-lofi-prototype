import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MATCH_THE_WORD, PRACTICE_TRICKY_WORDS } from '../content/activities.js'
import { renderWithRouter } from '../test/renderWithRouter.jsx'
import ChooseActivityScreen from './ChooseActivityScreen.jsx'

function renderChoose({ practiceWords = [], inProgress = {} } = {}) {
  const calls = []
  const view = renderWithRouter(
    <ChooseActivityScreen
      inProgress={inProgress}
      practiceWords={practiceWords}
      onStart={(activityId) => calls.push(['start', activityId])}
      starting={false}
      error=""
      onBack={() => calls.push(['back'])}
    />,
  )
  return { ...view, calls }
}

describe('ChooseActivityScreen', () => {
  it('shows the heading and starts Match the Word', async () => {
    const { user, calls } = renderChoose()

    expect(screen.getByRole('heading', { level: 1, name: 'Choose a game' })).toBeTruthy()
    const card = screen.getByRole('region', { name: MATCH_THE_WORD.title })
    await user.click(within(card).getByRole('button', { name: 'Start' }))

    expect(calls).toEqual([['start', MATCH_THE_WORD.id]])
  })

  it('calls onBack from the Back button', async () => {
    const { user, calls } = renderChoose()

    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(calls).toEqual([['back']])
  })

  it('hides the Tricky Words card when there are no practice words', () => {
    renderChoose({ practiceWords: [] })

    expect(screen.queryByRole('region', { name: PRACTICE_TRICKY_WORDS.title })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Start' })).toHaveLength(1)
  })

  it('shows the Tricky Words card with practice words and starts it', async () => {
    const { user, calls } = renderChoose({ practiceWords: ['hat', 'dog'] })

    const card = screen.getByRole('region', { name: PRACTICE_TRICKY_WORDS.title })
    expect(within(card).getByText('2 words to practice')).toBeTruthy()
    await user.click(within(card).getByRole('button', { name: 'Start' }))

    expect(calls).toEqual([['start', PRACTICE_TRICKY_WORDS.id]])
  })

  it('offers Keep going for a round in progress', () => {
    renderChoose({ inProgress: { [MATCH_THE_WORD.id]: true } })

    const card = screen.getByRole('region', { name: MATCH_THE_WORD.title })
    expect(within(card).getByRole('button', { name: 'Keep going' })).toBeTruthy()
  })
})
