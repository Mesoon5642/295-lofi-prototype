import { useRef } from 'react'
import { unlock } from '../api/auth.js'
import AdultDialog from './AdultDialog.jsx'
import CredentialsForm from './CredentialsForm.jsx'

// Asks the signed-in grown-up for their password before the parent/teacher view.
// The server unlocks grown-up actions for a few minutes.
export default function UnlockDialog({ onUnlock, onClose }) {
  const firstFieldRef = useRef(null)
  return (
    <AdultDialog title="Parent or Teacher" onClose={onClose} initialFocusRef={firstFieldRef}>
      <CredentialsForm
        submitLabel="Open"
        check={(_username, password) => unlock(password)}
        onSuccess={onUnlock}
        firstFieldRef={firstFieldRef}
      />
    </AdultDialog>
  )
}
