import { useRef } from 'react'
import AdultDialog from './AdultDialog.jsx'
import CredentialsForm from './CredentialsForm.jsx'

// Sign-in for the parent/teacher view.
export default function SignInDialog({ onSignIn, onClose }) {
  const firstFieldRef = useRef(null)
  return (
    <AdultDialog title="Parent or Teacher sign in" onClose={onClose} initialFocusRef={firstFieldRef}>
      <CredentialsForm withUsername submitLabel="Sign in" onSuccess={onSignIn} firstFieldRef={firstFieldRef} />
    </AdultDialog>
  )
}
