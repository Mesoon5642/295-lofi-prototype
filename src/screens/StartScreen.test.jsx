import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithRouter } from '../test/renderWithRouter.jsx'
import StartScreen from './StartScreen.jsx'

describe('StartScreen', () => {
  it('greets the child and calls onPlay', async () => {
    const calls = []
    const { user } = renderWithRouter(
      <StartScreen childName="Alex" onPlay={() => calls.push('play')} onParent={() => calls.push('parent')} />,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Hi, Alex!' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Play' }))

    expect(calls).toEqual(['play'])
  })

  it('asks for the grown-up password before calling onParent', async () => {
    const calls = []
    const { user } = renderWithRouter(
      <StartScreen childName="Alex" onPlay={() => calls.push('play')} onParent={() => calls.push('parent')} />,
    )

    await user.click(screen.getByRole('button', { name: 'Parent or Teacher' }))

    // jsdom has no showModal(), so the dialog stays closed and needs `hidden: true`.
    expect(screen.getByRole('heading', { name: 'Parent or Teacher', hidden: true })).toBeTruthy()
    expect(calls).toEqual([])
  })
})
