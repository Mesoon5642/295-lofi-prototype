import { useContext, useEffect, useRef, useState } from 'react'
import { lock, unlock } from '../api/auth.js'
import AdultDialog from './AdultDialog.jsx'
import CredentialsForm from './CredentialsForm.jsx'
import ReadingSettings from './ReadingSettings.jsx'
import { SettingsContext } from './settingsContext.js'

// Live reading settings during play, behind the signed-in grown-up's password.
// The password is asked for every time the dialog opens, and closing it locks
// grown-up actions again.
export default function SettingsDialog({ onClose }) {
  const { settings, updateSettings } = useContext(SettingsContext)
  const [unlocked, setUnlocked] = useState(false)
  const firstFieldRef = useRef(null)
  const settingsTitleRef = useRef(null)

  useEffect(() => {
    if (!unlocked) return undefined
    settingsTitleRef.current?.focus()
    return () => {
      lock()
    }
  }, [unlocked])

  return (
    <AdultDialog title="Grown-up settings" onClose={onClose} initialFocusRef={firstFieldRef}>
      {unlocked ? (
        <div className="dialog-settings">
          <h3 ref={settingsTitleRef} tabIndex={-1} className="dialog-settings__title">
            Reading settings
          </h3>
          <p className="dialog-settings__note">Changes apply right away.</p>
          <ReadingSettings settings={settings} onChange={updateSettings} />
        </div>
      ) : (
        <CredentialsForm
          submitLabel="Unlock"
          check={(_username, password) => unlock(password)}
          onSuccess={() => setUnlocked(true)}
          firstFieldRef={firstFieldRef}
        />
      )}
    </AdultDialog>
  )
}
