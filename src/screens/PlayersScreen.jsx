import { useState } from 'react'
import { AddChildForm } from '../components/GrownUpPanels.jsx'
import Icon from '../components/Icon.jsx'
import ScreenHeading from '../components/ScreenHeading.jsx'
import TopBar from '../components/TopBar.jsx'

// "Who's playing?": shown to the grown-up after signing in (and from the parent/teacher
// view). Picking a child hands the device to them; the grown-up can also add a child or
// go straight to the parent/teacher view. `profiles`: [{ id, name }].
export default function PlayersScreen({
  profiles,
  onPick,
  onAddChild,
  onParentView,
  onSignOut,
  focusHeading,
}) {
  const [picking, setPicking] = useState(null)
  const [error, setError] = useState('')

  async function handlePick(child) {
    if (picking) return
    setPicking(child.id)
    setError('')
    try {
      await onPick(child.id)
    } catch {
      setError('We couldn’t reach the game server. Please try again.')
      setPicking(null)
    }
  }

  return (
    <>
      <TopBar
        showSettings={false}
        helpTip="Pick the child who will play now. They can play until a grown-up switches player."
      />
      <main className="screen screen--center">
        <ScreenHeading focusOnMount={focusHeading}>Who&rsquo;s playing?</ScreenHeading>
        <p className="screen-error" role="alert">
          {error}
        </p>
        {profiles.length === 0 ? (
          <p className="lead">Add a child below to get started.</p>
        ) : (
          <ul className="player-list">
            {profiles.map((child) => (
              <li key={child.id}>
                <button
                  type="button"
                  className="player-button"
                  onClick={() => handlePick(child)}
                  aria-disabled={picking !== null || undefined}
                >
                  <span className="player-button__initial" aria-hidden="true">
                    {child.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="player-button__name">{child.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <section className="panel players-panel" aria-labelledby="add-child-title">
          <h2 id="add-child-title" className="panel__title">
            Add a child
          </h2>
          <AddChildForm onAdd={onAddChild} />
        </section>

        <div className="button-row button-row--center">
          <button type="button" className="btn btn--secondary btn--big" onClick={onParentView}>
            <Icon name="people" />
            <span>Parent or teacher view</span>
          </button>
          <button type="button" className="btn btn--quiet" onClick={onSignOut}>
            <Icon name="back" />
            <span>Sign out</span>
          </button>
        </div>
      </main>
    </>
  )
}
