import { useEffect, useId, useRef, useState } from 'react'
import Icon from './Icon.jsx'

// Panels used on the grown-up screens (Who's playing? and the parent/teacher view).

// Name field + Add button. `onAdd(name)` resolves once the child exists, or rejects
// with an ApiError (400 blank/too long, 409 duplicate name, 403 locked, 0 offline).
export function AddChildForm({ onAdd }) {
  const inputId = useId()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const inputRef = useRef(null)

  async function handleSubmit(event) {
    event.preventDefault()
    if (saving) return
    if (name.trim() === '') {
      setMessage('Please type a name.')
      inputRef.current?.focus()
      return
    }
    setSaving(true)
    setMessage('')
    try {
      await onAdd(name)
      setMessage(`Added ${name.trim()}.`)
      setName('')
    } catch (error) {
      if (error?.status === 409 || error?.status === 400) setMessage(error.message)
      else if (error?.status === 403) setMessage('Grown-up access timed out. Enter your password again.')
      else setMessage('We couldn’t reach the game server. Please try again.')
      inputRef.current?.focus()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="add-child" onSubmit={handleSubmit} noValidate>
      <label className="field" htmlFor={inputId}>
        Child&rsquo;s first name
        <input
          ref={inputRef}
          id={inputId}
          className="field__input"
          type="text"
          autoComplete="off"
          maxLength={60}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <button type="submit" className="btn btn--secondary" aria-disabled={saving || undefined}>
        <Icon name="people" />
        <span>{saving ? 'Adding…' : 'Add child'}</span>
      </button>
      <p className="add-child__message" role="status">
        {message}
      </p>
    </form>
  )
}

export function ResetDemo({ onReset }) {
  const [confirming, setConfirming] = useState(false)
  const [resetting, setResetting] = useState(false)
  const confirmRef = useRef(null)
  const startRef = useRef(null)
  const wasConfirming = useRef(false)

  useEffect(() => {
    if (confirming) confirmRef.current?.focus()
    else if (wasConfirming.current) startRef.current?.focus()
    wasConfirming.current = confirming
  }, [confirming])

  async function handleConfirm() {
    if (resetting) return
    setResetting(true)
    await onReset()
    setResetting(false)
    setConfirming(false)
  }

  return (
    <section className="panel panel--quiet" aria-labelledby="reset-title">
      <h2 id="reset-title" className="panel__title">
        Demo data
      </h2>
      {confirming ? (
        <div className="confirm" role="group" aria-label="Confirm reset">
          <p>
            Reset demo data? This removes the rounds your children played and restores the sample
            rounds. Child profiles and settings stay.
          </p>
          <div className="button-row">
            <button
              ref={confirmRef}
              type="button"
              className="btn btn--danger"
              onClick={handleConfirm}
              aria-disabled={resetting || undefined}
            >
              {resetting ? 'Resetting…' : 'Yes, reset'}
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button ref={startRef} type="button" className="btn btn--secondary" onClick={() => setConfirming(true)}>
          <Icon name="trash" />
          <span>Reset Demo Data</span>
        </button>
      )}
    </section>
  )
}

export function DeviceSignIn({ username, onSignOut }) {
  return (
    <section className="panel panel--quiet" aria-labelledby="device-title">
      <h2 id="device-title" className="panel__title">
        This device
      </h2>
      <p>
        Signed in as <strong>{username}</strong>. Children can play here until a grown-up signs out.
      </p>
      <button type="button" className="btn btn--secondary" onClick={onSignOut}>
        <Icon name="back" />
        <span>Sign out</span>
      </button>
    </section>
  )
}
