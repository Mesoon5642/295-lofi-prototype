import { useRef } from 'react'
import { signIn } from '../api/auth.js'
import CredentialsForm from '../components/CredentialsForm.jsx'
import ScreenHeading from '../components/ScreenHeading.jsx'

// Shown when this device isn't signed in. A parent or teacher signs in once; children
// then play under that sign-in until a grown-up signs out from the parent/teacher view.
export default function SignInScreen({ onSignIn, focusHeading }) {
  const firstFieldRef = useRef(null)
  return (
    <main className="screen screen--center">
      <ScreenHeading focusOnMount={focusHeading}>Grown-up sign in</ScreenHeading>
      <p className="lead">A parent or teacher signs in on this device, then the child can play.</p>
      <div className="sign-in-card">
        <CredentialsForm
          withUsername
          submitLabel="Sign in"
          check={signIn}
          onSuccess={onSignIn}
          firstFieldRef={firstFieldRef}
        />
      </div>
    </main>
  )
}
