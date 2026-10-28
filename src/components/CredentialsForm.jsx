import { useId, useRef, useState } from 'react'
import { checkCredentials, checkParentPassword } from '../auth/credentials.js'

// Password form for grown-ups. With `withUsername` it asks for a username and
// password (sign in); without, just the parent/teacher password (unlock).
// `firstFieldRef` is attached to the first input so the dialog can focus it.
export default function CredentialsForm({ withUsername = false, submitLabel, onSuccess, firstFieldRef }) {
  const passwordRef = useRef(null)
  const usernameId = useId()
  const passwordId = useId()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [failedAttempts, setFailedAttempts] = useState(0)

  function handleSubmit(event) {
    event.preventDefault()
    const ok = withUsername ? checkCredentials(username, password) : checkParentPassword(password)
    if (ok) {
      onSuccess()
      return
    }
    setFailedAttempts((count) => count + 1)
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
        {failedAttempts > 0 &&
          (withUsername
            ? 'That username or password is not right. Please try again.'
            : 'That password is not right. Please try again.')}
      </p>
      <button type="submit" className="btn btn--primary btn--big">
        {submitLabel}
      </button>
    </form>
  )
}
