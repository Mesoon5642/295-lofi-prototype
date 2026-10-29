import { useRef } from 'react'
import { unlock } from '../api/auth.js'
import CredentialsForm from '../components/CredentialsForm.jsx'
import ScreenHeading from '../components/ScreenHeading.jsx'

// Shown in place of a grown-up screen when its unlock has timed out (or after a refresh):
// the signed-in grown-up re-enters their password, then `onUnlocked` reloads the screen.
export default function GrownUpGateScreen({ username, onUnlocked, onSignOut, focusHeading }) {
  const firstFieldRef = useRef(null)
  return (
    <main className="screen screen--center">
      <ScreenHeading focusOnMount={focusHeading}>Parent or Teacher</ScreenHeading>
      <p className="lead">
        Enter the password for <strong>{username}</strong> to continue.
      </p>
      <div className="sign-in-card">
        <CredentialsForm
          submitLabel="Continue"
          check={(_username, password) => unlock(password)}
          onSuccess={onUnlocked}
          firstFieldRef={firstFieldRef}
        />
      </div>
      <button type="button" className="btn btn--quiet" onClick={onSignOut}>
        Not {username}? Sign out
      </button>
    </main>
  )
}
