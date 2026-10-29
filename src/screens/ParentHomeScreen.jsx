import { useState } from 'react'
import { AddChildForm, DeviceSignIn, ResetDemo } from '../components/GrownUpPanels.jsx'
import Icon from '../components/Icon.jsx'
import ScreenHeading from '../components/ScreenHeading.jsx'
import TopBar from '../components/TopBar.jsx'
import { formatDate } from '../components/formatDate.js'

// The parent/teacher view's front page: every child this grown-up can see, with a way
// into each child's results, plus adding a child, switching who plays, demo reset,
// and signing out. `profiles`: [{ id, name, completedRounds, lastPlayedAt }].
export default function ParentHomeScreen({
  username,
  profiles,
  onOpenChild,
  onAddChild,
  onChoosePlayer,
  onReset,
  onSignOut,
  onBack,
  focusHeading,
}) {
  const [status, setStatus] = useState('')

  async function handleReset() {
    try {
      await onReset()
      setStatus('Demo data was reset.')
    } catch (error) {
      setStatus(
        error?.status === 403
          ? 'Grown-up access timed out. Go Back and open Parent or Teacher again.'
          : 'Could not reset the demo data. Check that the game server is running.',
      )
    }
  }

  return (
    <>
      <TopBar
        onBack={onBack}
        showSettings={false}
        helpTip="Open a child to see their rounds and change their reading settings."
      />
      <main className="screen screen--parent">
        <ScreenHeading focusOnMount={focusHeading}>Parent or Teacher</ScreenHeading>
        <p className="status" role="status">
          {status}
        </p>

        <section className="panel" aria-labelledby="children-title">
          <h2 id="children-title" className="panel__title">
            Children
          </h2>
          {profiles.length === 0 ? (
            <p>No children yet. Add one below.</p>
          ) : (
            <ul className="round-list">
              {profiles.map((child) => (
                <li key={child.id}>
                  <button type="button" className="round-list__button" onClick={() => onOpenChild(child.id)}>
                    <span className="round-list__date">{child.name}</span>
                    <span className="round-list__meta">
                      {child.completedRounds} {child.completedRounds === 1 ? 'round' : 'rounds'} finished
                      {child.lastPlayedAt && ` · Last played ${formatDate(child.lastPlayedAt)}`}
                    </span>
                    <span className="round-list__open">
                      View results
                      <Icon name="next" size={22} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <AddChildForm onAdd={onAddChild} />
        </section>

        <section className="panel" aria-labelledby="player-title">
          <h2 id="player-title" className="panel__title">
            Who&rsquo;s playing
          </h2>
          <p>Choose which child plays on this device next.</p>
          <button type="button" className="btn btn--secondary" onClick={onChoosePlayer}>
            <Icon name="play" />
            <span>Choose who&rsquo;s playing</span>
          </button>
        </section>

        <ResetDemo onReset={handleReset} />
        <DeviceSignIn username={username} onSignOut={onSignOut} />
      </main>
    </>
  )
}
