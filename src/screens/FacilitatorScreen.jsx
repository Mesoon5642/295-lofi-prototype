import { useEffect, useId, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import ScreenHeading from '../components/ScreenHeading.jsx'
import TopBar from '../components/TopBar.jsx'
import { formatDate } from '../components/formatDate.js'
import { OUTCOMES, SEVERITIES, findTestTask } from '../content/testTasks.js'
import {
  MAX_NOTE_LENGTH,
  formatDuration,
  getCurrentScreen,
  getCurrentTask,
  getElapsedMs,
  isLastTask,
  sessionAsText,
  severityLabel,
  summarizeSession,
  taskPosition,
} from '../game/index.js'

// What each task's logged signal means, as a timing aid. The facilitator's outcome,
// not the signal, decides whether a task counts as completed.
const SIGNAL_TEXT = {
  'round-created': (childName) => `A round for ${childName} is created`,
  'round-summary': () => 'The round reaches its summary screen',
  'help-used': () => 'Wrong answer, hint and audio used (confirm Pause and Continue yourself)',
  'round-detail-opened': () => 'A round detail view is opened',
  'tricky-round-created': () => 'A Tricky Words round is created',
  'text-size-large': () => 'Text size changed to large',
}

const TIMED_OUT = 'Grown-up access timed out. Enter your password again.'

function problemMessage(error, what) {
  if (error?.status === 403) return TIMED_OUT
  if (error?.status === 400 || error?.status === 409) return error.message
  return `Could not ${what}. Check that the game server is running.`
}

function formatClock(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'unknown time'
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })
}

// 'Tester 1' started 2026-11-12 → 'usability-tester-1-2026-11-12.json'
function resultsFileName(session) {
  const label = session.testerLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `usability-${label || 'session'}-${(session.startedAt ?? '').slice(0, 10)}.json`
}

function copyToClipboard(text) {
  return navigator.clipboard.writeText(text)
}

// Saves `text` as a file through a Blob and a temporary <a download> link.
function downloadFile(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

// A button that asks first (like Reset Demo Data). `onConfirm` handles its own errors.
function ConfirmAction({ label, icon, question, confirmLabel, busyLabel, onConfirm }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const confirmRef = useRef(null)
  const startRef = useRef(null)
  const wasConfirming = useRef(false)

  useEffect(() => {
    if (confirming) confirmRef.current?.focus()
    else if (wasConfirming.current) startRef.current?.focus()
    wasConfirming.current = confirming
  }, [confirming])

  async function handleConfirm() {
    if (busy) return
    setBusy(true)
    await onConfirm()
    setBusy(false)
    setConfirming(false)
  }

  if (!confirming) {
    return (
      <button ref={startRef} type="button" className="btn btn--secondary" onClick={() => setConfirming(true)}>
        <Icon name={icon} />
        <span>{label}</span>
      </button>
    )
  }
  return (
    <div className="confirm" role="group" aria-label={`Confirm ${label}`}>
      <p>{question}</p>
      <div className="button-row">
        <button
          ref={confirmRef}
          type="button"
          className="btn btn--danger"
          onClick={handleConfirm}
          aria-disabled={busy || undefined}
        >
          {busy ? busyLabel : confirmLabel}
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// Every note so far (input: summarizeSession(session).notes).
function NoteList({ notes }) {
  if (notes.length === 0) return <p>No notes yet.</p>
  return (
    <ul className="note-list">
      {notes.map((note, i) => (
        <li key={`${note.at}-${i}`}>
          <p className="note-list__meta">
            Task {note.taskNumber ?? '?'} · {note.screen ?? 'Unknown screen'} · Severity{' '}
            {severityLabel(note.severity)} · {formatClock(note.at)}
          </p>
          <p>{note.text}</p>
        </li>
      ))}
    </ul>
  )
}

// Note text + severity. `onSave(text, severity)` resolves once the note is stored.
function NoteForm({ onSave }) {
  const inputId = useId()
  const [text, setText] = useState('')
  const [severity, setSeverity] = useState(1)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const inputRef = useRef(null)

  async function handleSubmit(event) {
    event.preventDefault()
    if (saving) return
    if (text.trim() === '') {
      setMessage('Please type a note.')
      inputRef.current?.focus()
      return
    }
    setSaving(true)
    setMessage('')
    try {
      await onSave(text, severity)
      setMessage('Note saved.')
      setText('')
      setSeverity(1)
    } catch (error) {
      setMessage(problemMessage(error, 'save the note'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="note-form" onSubmit={handleSubmit} noValidate>
      <label className="field" htmlFor={inputId}>
        Note
        <textarea
          ref={inputRef}
          id={inputId}
          className="field__input note-form__text"
          rows={3}
          maxLength={MAX_NOTE_LENGTH}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <fieldset className="severity-picker">
        <legend className="severity-picker__legend">Severity</legend>
        <div className="severity-picker__options">
          {SEVERITIES.map((option) => (
            <label key={option.value} className="severity-picker__option">
              <input
                type="radio"
                name={`${inputId}-severity`}
                value={option.value}
                checked={severity === option.value}
                onChange={() => setSeverity(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="button-row">
        <button type="submit" className="btn btn--secondary" aria-disabled={saving || undefined}>
          <Icon name="chat" />
          <span>{saving ? 'Saving…' : 'Save note'}</span>
        </button>
      </div>
      <p className="status" role="status">
        {message}
      </p>
    </form>
  )
}

function signalStatus(signal, task) {
  if (!signal?.seen) return 'Not seen yet'
  if (signal.at && task.startedAt) {
    return `Seen at ${formatDuration(Date.parse(signal.at) - Date.parse(task.startedAt))}`
  }
  return 'Seen'
}

// The running session: current task, timer, the tester's screen, the task's signal,
// task buttons, notes, and End Session.
function ActiveSession({ testSession, signals, childName, now, onAction, onEnd }) {
  const task = getCurrentTask(testSession)
  const info = findTestTask(task.taskId)
  const { number, total } = taskPosition(testSession)
  const started = Boolean(task.startedAt)
  const screen = getCurrentScreen(testSession)
  const signalText = SIGNAL_TEXT[info?.signal]
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [endMessage, setEndMessage] = useState('')

  async function run(action, what) {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      await onAction(action)
    } catch (error) {
      setMessage(problemMessage(error, what))
    } finally {
      setBusy(false)
    }
  }

  async function handleEnd() {
    setEndMessage('')
    try {
      await onEnd()
    } catch (error) {
      setEndMessage(problemMessage(error, 'end the session'))
    }
  }

  let elapsed = 'Not started'
  if (started) elapsed = `${formatDuration(getElapsedMs(task, now))}${task.endedAt ? ' (stopped)' : ''}`

  return (
    <>
      <section className="panel" aria-labelledby="task-title">
        <p className="panel__note">
          {testSession.testerLabel} · Started {formatDate(testSession.startedAt)}
        </p>
        <h2 id="task-title" className="panel__title">
          Task {number} of {total}: {info?.title ?? task.taskId}
        </h2>
        <p className="facilitator__scenario">{info?.scenario}</p>
        <dl className="facilitator__facts">
          <dt>Time on task</dt>
          <dd className="facilitator__timer">{elapsed}</dd>
          <dt>Tester&rsquo;s screen</dt>
          <dd>{screen ?? 'Not seen yet'}</dd>
          <dt>Signal</dt>
          <dd>
            {signalText ? signalText(childName ?? 'the child') : 'None for this task'}
            {signalText && (
              <>
                {' · '}
                <strong>{signalStatus(signals?.[task.taskId], task)}</strong>
              </>
            )}
          </dd>
        </dl>

        <div className="button-row">
          <button
            type="button"
            className="btn btn--primary"
            disabled={started}
            aria-disabled={busy || undefined}
            onClick={() => run({ type: 'START_TASK' }, 'start the task')}
          >
            <Icon name="play" />
            <span>Start Task</span>
          </button>
        </div>
        <div className="button-row" role="group" aria-label="Outcome">
          {OUTCOMES.map((outcome) => {
            const chosen = task.outcome === outcome.id
            return (
              <button
                key={outcome.id}
                type="button"
                className="btn btn--secondary"
                disabled={!started}
                aria-pressed={chosen}
                aria-disabled={busy || undefined}
                onClick={() => run({ type: 'SET_OUTCOME', outcome: outcome.id }, 'save the outcome')}
              >
                {chosen && <Icon name="check" />}
                <span>{outcome.label}</span>
              </button>
            )
          })}
        </div>
        <div className="button-row">
          <button
            type="button"
            className="btn btn--secondary"
            disabled={isLastTask(testSession)}
            aria-disabled={busy || undefined}
            onClick={() => run({ type: 'NEXT_TASK' }, 'move to the next task')}
          >
            <span>Next Task</span>
            <Icon name="next" />
          </button>
        </div>
        <p className="status" role="status">
          {message}
        </p>
      </section>

      <section className="panel" aria-labelledby="note-title">
        <h2 id="note-title" className="panel__title">
          Add a note
        </h2>
        <p className="panel__note">The note records the current task, the tester&rsquo;s screen and the time.</p>
        <NoteForm onSave={(text, severity) => onAction({ type: 'ADD_NOTE', text, severity })} />
      </section>

      <section className="panel" aria-labelledby="notes-title">
        <h2 id="notes-title" className="panel__title">
          Notes so far
        </h2>
        <NoteList notes={summarizeSession(testSession).notes} />
      </section>

      <section className="panel panel--quiet" aria-labelledby="end-title">
        <h2 id="end-title" className="panel__title">
          End the session
        </h2>
        <ConfirmAction
          label="End Session"
          icon="close"
          question="End this session? Outcomes and notes can’t be changed after it ends."
          confirmLabel="Yes, end session"
          busyLabel="Ending…"
          onConfirm={handleEnd}
        />
        <p className="status" role="status">
          {endMessage}
        </p>
      </section>
    </>
  )
}

// An ended session: one row per task, every note, and ways to share and move on.
function SessionResults({ testSession, onNewTester, copyText, download }) {
  const summary = summarizeSession(testSession)
  const [message, setMessage] = useState('')

  async function handleCopy() {
    try {
      await copyText(sessionAsText(testSession))
      setMessage('Copied.')
    } catch {
      setMessage('Could not copy. Use Download JSON instead.')
    }
  }

  function handleDownload() {
    const filename = resultsFileName(testSession)
    download(filename, JSON.stringify(testSession, null, 2))
    setMessage(`Downloaded ${filename}.`)
  }

  async function handleNewTester() {
    setMessage('')
    try {
      await onNewTester()
    } catch (error) {
      setMessage(problemMessage(error, 'reset for the next tester'))
    }
  }

  return (
    <>
      <section className="panel" aria-labelledby="results-title">
        <h2 id="results-title" className="panel__title">
          Results: {summary.testerLabel}
        </h2>
        <p className="panel__note">
          Started {formatDate(summary.startedAt)}
          {summary.endedAt && ` · Ended ${formatDate(summary.endedAt)}`}
        </p>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Task results, scrolls sideways">
          <table className="detail-table">
            <caption className="visually-hidden">Each task in this session</caption>
            <thead>
              <tr>
                <th scope="col">Task</th>
                <th scope="col">Outcome</th>
                <th scope="col">Time on task</th>
                <th scope="col">Notes</th>
              </tr>
            </thead>
            <tbody>
              {summary.tasks.map((task) => (
                <tr key={task.taskId}>
                  <th scope="row">
                    {task.number}. {task.title}
                  </th>
                  <td>{task.outcomeLabel}</td>
                  <td>{task.timeOnTaskMs === null ? '—' : formatDuration(task.timeOnTaskMs)}</td>
                  <td>
                    {task.notes.length === 0 ? (
                      '—'
                    ) : (
                      <ul className="facilitator__cell-notes">
                        {task.notes.map((note, i) => (
                          <li key={`${note.at}-${i}`}>
                            ({severityLabel(note.severity)}) {note.text}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" aria-labelledby="all-notes-title">
        <h2 id="all-notes-title" className="panel__title">
          All notes
        </h2>
        <NoteList notes={summary.notes} />
      </section>

      <section className="panel" aria-labelledby="share-title">
        <h2 id="share-title" className="panel__title">
          Save and reset
        </h2>
        <div className="button-row">
          <button type="button" className="btn btn--secondary" onClick={handleCopy}>
            Copy as Text
          </button>
          <button type="button" className="btn btn--secondary" onClick={handleDownload}>
            Download JSON
          </button>
        </div>
        <ConfirmAction
          label="New Tester Reset"
          icon="retry"
          question="Reset for the next tester? This removes the rounds your children played, restores the sample rounds, and sets reading settings back to default. These results stay under Past sessions."
          confirmLabel="Yes, reset"
          busyLabel="Resetting…"
          onConfirm={handleNewTester}
        />
        <p className="status" role="status">
          {message}
        </p>
      </section>
    </>
  )
}

function PastSessions({ sessions, currentId, onOpen }) {
  return (
    <section className="panel panel--quiet" aria-labelledby="past-title">
      <h2 id="past-title" className="panel__title">
        Past sessions
      </h2>
      {sessions.length === 0 ? (
        <p>No sessions yet.</p>
      ) : (
        <ul className="round-list">
          {sessions.map((past) => {
            const active = past.status === 'active'
            return (
              <li key={past.id}>
                <button
                  type="button"
                  className="round-list__button"
                  aria-current={past.id === currentId || undefined}
                  onClick={() => onOpen(past.id)}
                >
                  <span className="round-list__date">{past.testerLabel}</span>
                  <span className="round-list__meta">
                    {active ? 'Running' : 'Ended'} · Started {formatDate(past.startedAt)}
                  </span>
                  <span className="round-list__open">
                    {active ? 'Open console' : 'View results'}
                    <Icon name="next" size={22} />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// Usability test console for the facilitator (in a second window or device). It
// shows the running session (`testSession.status === 'active'`) or an ended
// session's results; all data comes in through props.
//   signals: deriveSignals output; now: ISO string the timer counts to
//   onAction(action) and onEnd() / onNewTester() resolve once the server is done
//   copyText(text) / download(filename, text) can be replaced (e.g. in tests)
export default function FacilitatorScreen({
  testSession,
  pastSessions,
  signals,
  childName = null,
  now,
  onAction,
  onEnd,
  onNewTester,
  onOpenSession,
  onBack,
  focusHeading,
  copyText = copyToClipboard,
  download = downloadFile,
}) {
  let body = (
    <section className="panel">
      <p>No session is running. Start one from the Parent or Teacher view.</p>
    </section>
  )
  if (testSession?.status === 'active') {
    body = (
      <ActiveSession
        testSession={testSession}
        signals={signals}
        childName={childName}
        now={now}
        onAction={onAction}
        onEnd={onEnd}
      />
    )
  } else if (testSession) {
    body = (
      <SessionResults testSession={testSession} onNewTester={onNewTester} copyText={copyText} download={download} />
    )
  }

  return (
    <>
      <TopBar
        onBack={onBack}
        showSettings={false}
        helpTip="Keep this console in a second browser window or device. The tester’s screen and signals update every couple of seconds."
      />
      <main className="screen screen--parent facilitator">
        <ScreenHeading focusOnMount={focusHeading}>Facilitator console</ScreenHeading>
        {body}
        <PastSessions sessions={pastSessions} currentId={testSession?.id ?? null} onOpen={onOpenSession} />
      </main>
    </>
  )
}
