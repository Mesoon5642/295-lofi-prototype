import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import ScreenHeading from '../components/ScreenHeading.jsx'
import UnlockDialog from '../components/UnlockDialog.jsx'
import TopBar from '../components/TopBar.jsx'

export default function StartScreen({ childName, onPlay, onParent, focusHeading }) {
  const [signingIn, setSigningIn] = useState(false)
  return (
    <>
      <TopBar
        onParent={() => setSigningIn(true)}
        helpTip="Press Play to read words. Grown-ups can sign in with Parent or Teacher at the top."
      />
      <main className="screen screen--center">
        <ScreenHeading focusOnMount={focusHeading}>Hi, {childName}!</ScreenHeading>
        <p className="lead">Ready to read?</p>
        <div className="start-choices">
          <button type="button" className="btn btn--primary btn--huge" onClick={onPlay}>
            <Icon name="play" size={40} />
            <span>Play</span>
          </button>
        </div>
      </main>
      {signingIn && <UnlockDialog onUnlock={onParent} onClose={() => setSigningIn(false)} />}
    </>
  )
}
