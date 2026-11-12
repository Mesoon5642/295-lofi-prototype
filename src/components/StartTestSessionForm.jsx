import { useEffect, useId, useRef, useState } from 'react'
import { TEST_TASKS } from '../content/testTasks.js'
import Icon from './Icon.jsx'

// Starts a usability test session on the parent/teacher view: tester label, which
// tasks to run (required ones always), and which child plays. `profiles`: [{ id, name }].
// `onStart({ testerLabel, childId, taskIds })` resolves once the session exists, or
// rejects with an ApiError (409 one already running, 400 bad label, 403 locked, 0 offline).
// `activeSession` ({ id, testerLabel } | null) is a session still running; starting
// first asks to end it, then calls `onEndActive()` before trying again.
export default function StartTestSessionForm({ initialLabel, profiles, activeSession, onStart, onEndActive }) {
  const labelId = useId()
  const childFieldId = useId()
  const [testerLabel, setTesterLabel] = useState(initialLabel)
  const [optionalIds, setOptionalIds] = useState([])
  const [childId, setChildId] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const labelRef = useRef(null)
  const confirmRef = useRef(null)
  const submitRef = useRef(null)
  const wasConfirming = useRef(false)

  const defaultChild = profiles.find((child) => child.name === 'Alex') ?? profiles[0]
  const selectedChildId = childId ?? defaultChild?.id ?? ''

  useEffect(() => {
    if (confirming) confirmRef.current?.focus()
    else if (wasConfirming.current) submitRef.current?.focus()
    wasConfirming.current = confirming
  }, [confirming])

  function toggleTask(taskId, checked) {
    setOptionalIds((current) => (checked ? [...current, taskId] : current.filter((id) => id !== taskId)))
  }

  // Leaves `saving` on after a start: the route moves on to Who's playing?.
  async function start() {
    setSaving(true)
    setMessage('')
    try {
      await onStart({
        testerLabel: testerLabel.trim(),
        childId: selectedChildId,
        taskIds: TEST_TASKS.filter((task) => task.required || optionalIds.includes(task.id)).map(
          (task) => task.id,
        ),
      })
    } catch (error) {
      setSaving(false)
      if (error?.status === 409) setConfirming(true)
      else if (error?.status === 400) setMessage(error.message)
      else if (error?.status === 403) setMessage('Grown-up access timed out. Go Back and open Parent or Teacher again.')
      else setMessage('We couldn’t reach the game server. Please try again.')
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (saving || selectedChildId === '') return
    if (testerLabel.trim() === '') {
      setMessage('Please type a tester label.')
      labelRef.current?.focus()
      return
    }
    if (activeSession) setConfirming(true)
    else start()
  }

  async function handleEndAndStart() {
    if (saving) return
    setConfirming(false)
    setSaving(true)
    try {
      await onEndActive()
    } catch (error) {
      setSaving(false)
      setMessage(
        error?.status === 403
          ? 'Grown-up access timed out. Go Back and open Parent or Teacher again.'
          : 'We couldn’t reach the game server. Please try again.',
      )
      return
    }
    await start()
  }

  return (
    <form className="test-start" onSubmit={handleSubmit} noValidate>
      <label className="field" htmlFor={labelId}>
        Tester label
        <input
          ref={labelRef}
          id={labelId}
          className="field__input"
          type="text"
          autoComplete="off"
          maxLength={60}
          value={testerLabel}
          onChange={(event) => setTesterLabel(event.target.value)}
        />
      </label>

      <fieldset className="test-start__tasks">
        <legend className="test-start__legend">Tasks</legend>
        {TEST_TASKS.map((task) => (
          <label key={task.id} className="test-start__task">
            <input
              type="checkbox"
              checked={task.required || optionalIds.includes(task.id)}
              disabled={task.required}
              onChange={(event) => toggleTask(task.id, event.target.checked)}
            />
            <span>
              Task {task.number}: {task.title}
              {task.required && ' (required)'}
            </span>
          </label>
        ))}
      </fieldset>

      {profiles.length > 0 && (
        <label className="field" htmlFor={childFieldId}>
          Child who plays
          <select
            id={childFieldId}
            className="field__input"
            value={selectedChildId}
            onChange={(event) => setChildId(event.target.value)}
          >
            {profiles.map((child) => (
              <option key={child.id} value={child.id}>
                {child.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {confirming ? (
        <div className="confirm" role="group" aria-label="Confirm new session">
          <p>
            {activeSession
              ? `A session for ${activeSession.testerLabel} is still running. End it and start a new one?`
              : 'A session is still running. End it and start a new one?'}
          </p>
          <div className="button-row">
            <button ref={confirmRef} type="button" className="btn btn--primary" onClick={handleEndAndStart}>
              End it and start
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="button-row">
          <button
            ref={submitRef}
            type="submit"
            className="btn btn--primary"
            aria-disabled={saving || profiles.length === 0 || undefined}
          >
            <Icon name="play" />
            <span>{saving ? 'Starting…' : 'Start Session'}</span>
          </button>
        </div>
      )}

      <p className="status test-start__message" role="status">
        {profiles.length === 0 ? 'Add a child above before starting a session.' : message}
      </p>
    </form>
  )
}
