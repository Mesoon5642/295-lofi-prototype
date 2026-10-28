import { useId, useRef, useState } from 'react'

// Password form for grown-ups. With `withUsername` it asks for a username and
// password (sign in); without, just the parent/teacher password (unlock).
// `check(username, password)` asks the server and resolves true or false; it rejects
// when the server can't be reached. `firstFieldRef` is attached to the first input
// so the dialog can focus it.
export default function CredentialsForm({
  withUsername = false,
  submitLabel,
  check,
  onSuccess,
  firstFieldRef,
}) {
  const passwordRef = useRef(null)
  const usernameId = useId()
  const passwordId = useId()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (checking) return
    setChecking(true)
    let ok = false
    try {
      ok = await check(username, password)
    } catch {
      setChecking(false)
      setFailedAttempts((count) => count + 1)
      setError('We couldn’t reach the game server. Please try again.')
      return
    }
    setChecking(false)
    if (ok) {
      onSuccess()
      return
    }
    setFailedAttempts((count) => count + 1)
    setError(
      withUsername
        ? 'That username or password is not right. Please try again.'
        : 'That password is not right. Please try again.',
    )
    setPassword('')
    passwordRef.current?.focus()
  }

  function attachPassword(node) {
    passwordRef.current = node
    if (!withUsername && firstFieldRef) firstFieldRef.current = node
  }

  return (
    <form className="dialog-form" onSubmit={handleSubmit} noValidate>
      {withUsername && (
        <label className="field" htmlFor={usernameId}>
          Username
          <input
            ref={firstFieldRef}
            id={usernameId}
            className="field__input"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
      )}
      <label className="field" htmlFor={passwordId}>
        {withUsername ? 'Password' : 'Parent or teacher password'}
        <input
          ref={attachPassword}
          id={passwordId}
          className="field__input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {/* Keyed by attempts so a repeated error is announced again. */}
      <p key={failedAttempts} className="dialog-form__error" role="alert">
        {failedAttempts > 0 && error}
      </p>
      <button type="submit" className="btn btn--primary btn--big" aria-disabled={checking || undefined}>
        {checking ? 'Checking…' : submitLabel}
      </button>
    </form>
  )
}
