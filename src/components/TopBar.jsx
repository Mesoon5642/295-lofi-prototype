import { useState } from 'react'
import Icon from './Icon.jsx'
import TextSizeToggle from './TextSizeToggle.jsx'

// Shared top bar: Back top-left, text size in the middle, Help top-right.
// Pass `onHelp` to handle Help yourself, or `helpTip` to show a short tip.
export default function TopBar({ onBack, onHelp, helpTip }) {
  const [tipOpen, setTipOpen] = useState(false)
  const showsTip = !onHelp

  function handleHelp() {
    if (onHelp) onHelp()
    else setTipOpen((open) => !open)
  }

  return (
    <header className="top-bar">
      <div className="top-bar__back">
        {onBack && (
          <button type="button" className="btn btn--quiet" onClick={onBack}>
            <Icon name="back" />
            <span>Back</span>
          </button>
        )}
      </div>
      <div className="top-bar__middle">
        <TextSizeToggle />
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
    </header>
  )
}
