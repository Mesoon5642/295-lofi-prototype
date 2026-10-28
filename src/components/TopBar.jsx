import { useState } from 'react'
import Icon from './Icon.jsx'
import SettingsDialog from './SettingsDialog.jsx'

// Shared top bar: Back top-left, Settings in the middle, Help top-right.
// Pass `onHelp` to handle Help yourself, or `helpTip` to show a short tip.
// `onParent` shows a Parent or Teacher button where Back would be.
// Settings opens the password-protected reading settings; the parent/teacher
// view passes `showSettings={false}` because it has its own settings panel.
export default function TopBar({ onBack, onHelp, helpTip, onParent, showSettings = true }) {
  const [tipOpen, setTipOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const showsTip = !onHelp

  function handleHelp() {
    if (onHelp) onHelp()
    else setTipOpen((open) => !open)
  }

  return (
    <header className="top-bar">
      <div className="top-bar__back">
        {onBack ? (
          <button type="button" className="btn btn--quiet" onClick={onBack}>
            <Icon name="back" />
            <span>Back</span>
          </button>
        ) : (
          onParent && (
            <button type="button" className="btn btn--quiet" onClick={onParent}>
              <Icon name="people" />
              <span>Parent or Teacher</span>
            </button>
          )
        )}
      </div>
      <div className="top-bar__middle">
        {showSettings && (
          <button type="button" className="btn btn--quiet" onClick={() => setSettingsOpen(true)}>
            <Icon name="sliders" />
            <span>Settings</span>
          </button>
        )}
      </div>
      <div className="top-bar__help">
        <button
          type="button"
          className="btn btn--quiet"
          onClick={handleHelp}
          aria-expanded={showsTip ? tipOpen : undefined}
        >
          <Icon name="help" />
          <span>Help</span>
        </button>
      </div>
      <div className="top-bar__tip" aria-live="polite">
        {showsTip && tipOpen && (
          <p className="tip">
            <Icon name="bulb" />
            <span>{helpTip}</span>
          </p>
        )}
      </div>
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </header>
  )
}
