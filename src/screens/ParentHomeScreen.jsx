import { useId, useState } from 'react'
import { AddChildForm, DeviceSignIn, ResetDemo } from '../components/GrownUpPanels.jsx'
import Icon from '../components/Icon.jsx'
import ScreenHeading from '../components/ScreenHeading.jsx'
import StartTestSessionForm from '../components/StartTestSessionForm.jsx'
import TopBar from '../components/TopBar.jsx'
import { formatDate } from '../components/formatDate.js'
import { DEFAULT_TESTER_LABEL, nextTesterLabel } from '../content/testTasks.js'

// The parent/teacher view's front page: every child this grown-up can see, with a way
// into each child's results, plus adding a child, switching who plays, demo reset,
// usability testing, and signing out. `profiles`: [{ id, name, completedRounds, lastPlayedAt }].
// `testSessions`: [{ id, testerLabel, status, startedAt }], newest first. `startOpen`
// shows the start form at once (the facilitator's New Tester Reset sends us here).
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
  testSessions = [],
  onStartTestSession,
  onEndTestSession,
  onOpenFacilitator,
  onOpenTestSession,
  startOpen = false,
  initialTesterLabel,
}) {
  const [status, setStatus] = useState('')
  const [startShown, setStartShown] = useState(startOpen)
  const startFormId = useId()
  const activeSession = testSessions.find((session) => session.status === 'active') ?? null
  const testerLabel =
    initialTesterLabel ??
    (testSessions.length > 0 ? nextTesterLabel(testSessions[0].testerLabel) : DEFAULT_TESTER_LABEL)

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

        <section className="panel" aria-labelledby="testing-title">
          <h2 id="testing-title" className="panel__title">
            Usability testing
          </h2>
          <div className="button-row">
            <button
              type="button"
              className="btn btn--secondary"
              aria-expanded={startShown}
              aria-controls={startFormId}
              onClick={() => setStartShown((shown) => !shown)}
            >
              <Icon name="play" />
              <span>Start Usability Test</span>
            </button>
            <button type="button" className="btn btn--secondary" onClick={onOpenFacilitator}>
              <Icon name="sliders" />
              <span>Open facilitator console</span>
            </button>
          </div>
          <div id={startFormId} hidden={!startShown}>
            {startShown && (
              <StartTestSessionForm
                initialLabel={testerLabel}
                profiles={profiles}
                activeSession={activeSession}
                onStart={onStartTestSession}
                onEndActive={async () => {
                  if (activeSession) await onEndTestSession(activeSession.id)
                }}
              />
            )}
          </div>

          <h3 className="test-sessions__title">Past sessions</h3>
          {testSessions.length === 0 ? (
            <p>No sessions yet.</p>
          ) : (
            <ul className="round-list">
              {testSessions.map((session) => (
                <li key={session.id}>
                  <button
                    type="button"
                    className="round-list__button"
                    onClick={() => onOpenTestSession(session.id)}
                  >
                    <span className="round-list__date">{session.testerLabel}</span>
                    <span className="round-list__meta">
                      {session.status === 'active' ? 'Running' : 'Ended'} · Started{' '}
                      {formatDate(session.startedAt)}
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
        </section>

        <ResetDemo onReset={handleReset} />
        <DeviceSignIn username={username} onSignOut={onSignOut} />
      </main>
    </>
  )
}
