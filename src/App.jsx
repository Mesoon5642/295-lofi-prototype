import { useCallback, useMemo, useState } from 'react'
import { SettingsContext } from './components/settingsContext.js'
import { MATCH_THE_WORD, SAMPLE_CHILD } from './content/activities.js'
import { startRound } from './game/index.js'
import ActivityScreen from './screens/ActivityScreen.jsx'
import ChooseActivityScreen from './screens/ChooseActivityScreen.jsx'
import ParentScreen from './screens/ParentScreen.jsx'
import StartScreen from './screens/StartScreen.jsx'
import SummaryScreen from './screens/SummaryScreen.jsx'
import {
  createRoundId,
  getChildProfile,
  getInProgressRound,
  getSettings,
  saveRound,
  saveSettings,
} from './storage/index.js'

// Screens: 'start' | 'choose' | 'activity' | 'summary' | 'parent'

function createNewRound(childId) {
  const round = startRound({
    id: createRoundId(),
    childId,
    activity: MATCH_THE_WORD,
    now: new Date().toISOString(),
    rng: Math.random,
  })
  return saveRound(round) ?? round
}

export default function App() {
  const [child] = useState(() => getChildProfile() ?? SAMPLE_CHILD)
  const [settings, setSettings] = useState(() => getSettings())
  const [screen, setScreen] = useState('start')
  const [round, setRound] = useState(null)
  // Only move focus to headings after the first navigation, not on page load.
  const [navigated, setNavigated] = useState(false)

  const updateSettings = useCallback((partial) => {
    setSettings(saveSettings(partial))
  }, [])
  const settingsValue = useMemo(() => ({ settings, updateSettings }), [settings, updateSettings])

  const go = useCallback((next) => {
    setNavigated(true)
    setScreen(next)
  }, [])

  // Rounds are created in event handlers (never effects) so StrictMode
  // can't create duplicates.
  function resumeOrStart() {
    setRound(getInProgressRound(child.id, MATCH_THE_WORD.id) ?? createNewRound(child.id))
    go('activity')
  }

  function playAgain() {
    setRound(createNewRound(child.id))
    go('activity')
  }

  const handleComplete = useCallback(
    (finished) => {
      setRound(finished)
      go('summary')
    },
    [go],
  )

  let content
  if (screen === 'choose') {
    content = (
      <ChooseActivityScreen
        hasRoundInProgress={getInProgressRound(child.id, MATCH_THE_WORD.id) !== null}
        onStart={resumeOrStart}
        onBack={() => go('start')}
        focusHeading={navigated}
      />
    )
  } else if (screen === 'activity' && round) {
    content = (
      <ActivityScreen
        key={round.id}
        initialRound={round}
        onBack={() => go('choose')}
        onComplete={handleComplete}
        focusHeading={navigated}
      />
    )
  } else if (screen === 'summary' && round) {
    content = (
      <SummaryScreen
        round={round}
        onPlayAgain={playAgain}
        onHome={() => go('start')}
        focusHeading={navigated}
      />
    )
  } else if (screen === 'parent') {
    content = <ParentScreen child={child} onBack={() => go('start')} focusHeading={navigated} />
  } else {
    content = (
      <StartScreen
        childName={child.name}
        onPlay={() => go('choose')}
        onParent={() => go('parent')}
        focusHeading={navigated}
      />
    )
  }

  // The settings are for the child's screens; the parent/teacher view always looks standard.
  const look = screen === 'parent' ? { textSize: 'standard', font: 'standard' } : settings

  return (
    <SettingsContext value={settingsValue}>
      <div className="app" data-text-size={look.textSize} data-font={look.font}>
        {content}
      </div>
    </SettingsContext>
  )
}
