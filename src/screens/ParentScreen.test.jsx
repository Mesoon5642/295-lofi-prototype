import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SEED_ROUNDS } from '../../server/seed/seedData.js'
import { DEFAULT_SETTINGS } from '../content/settings.js'
import { recentPracticeWords, summarizeRound } from '../game/index.js'
import { renderWithRouter } from '../test/renderWithRouter.jsx'
import ParentScreen from './ParentScreen.jsx'

// The screen takes rounds newest first.
const ROUNDS = [...SEED_ROUNDS].sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1))

function renderParent({ onOpenRound, onBack = () => {} } = {}) {
  return renderWithRouter(
    <ParentScreen
      child={{ id: 'child-alex', name: 'Alex' }}
      rounds={ROUNDS}
      settings={DEFAULT_SETTINGS}
      onSettingsChange={() => {}}
      onBack={onBack}
      onOpenRound={onOpenRound}
    />,
  )
}

const roundButtons = () => screen.getAllByRole('button', { name: /View details/ })

describe('ParentScreen', () => {
  it('lists every sample round with a "Sample data" badge', () => {
    renderParent()

    expect(screen.getByRole('heading', { level: 1, name: 'Alex’s reading' })).toBeTruthy()
    const buttons = roundButtons()
    expect(buttons).toHaveLength(SEED_ROUNDS.length)
    buttons.forEach((button, i) => {
      expect(within(button).getByText('Sample data')).toBeTruthy()
      const { practiceWords } = summarizeRound(ROUNDS[i])
      expect(button.textContent).toContain(`Practice: ${practiceWords.join(', ')}`)
    })
  })

  it('shows the words to practice from recent rounds', () => {
    renderParent()

    const section = screen.getByRole('region', { name: 'Words to practice' })
    const items = within(section).getAllByRole('listitem')
    const expected = recentPracticeWords(ROUNDS)
    expect(expected.length).toBeGreaterThan(0)
    expect(items).toHaveLength(expected.length)
    items.forEach((item, i) => {
      const { word, roundsNeedingPractice } = expected[i]
      const unit = roundsNeedingPractice === 1 ? 'round' : 'rounds'
      expect(item.textContent).toBe(`${word}took more than one try in ${roundsNeedingPractice} ${unit}`)
    })
  })

  it('opens a round: detail table marks words that took more than one try', async () => {
    const opened = []
    const { user } = renderParent({ onOpenRound: (id) => opened.push(id) })
    const round = ROUNDS[0]

    await user.click(roundButtons()[0])

    expect(opened).toEqual([round.id])
    expect(screen.getByRole('heading', { level: 1, name: 'Alex’s round' })).toBeTruthy()
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    const { words } = summarizeRound(round)
    expect(rows).toHaveLength(words.length)
    expect(words.some((w) => w.needsPractice)).toBe(true)
    expect(words.some((w) => !w.needsPractice)).toBe(true)

    rows.forEach((row, i) => {
      const word = words[i]
      expect(within(row).getByRole('rowheader').textContent).toBe(word.word)
      const cells = within(row).getAllByRole('cell')
      expect(cells[0].textContent).toBe(String(word.attempts))
      expect(cells.at(-1).textContent).toBe(word.attempts > 1 ? 'Needs practice' : 'No')
    })
  })

  it('returns to the round list with Back', async () => {
    const backs = []
    const { user } = renderParent({ onBack: () => backs.push('back') })

    await user.click(roundButtons()[1])
    expect(screen.getByRole('table')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Alex’s reading' })).toBeTruthy()
    expect(roundButtons()).toHaveLength(SEED_ROUNDS.length)
    // Back from the detail stays on this screen; it doesn't leave the parent view.
    expect(backs).toEqual([])
  })
})
