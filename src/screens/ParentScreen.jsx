import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import RoundDetail from '../components/RoundDetail.jsx'
import SampleBadge from '../components/SampleBadge.jsx'
import ScreenHeading from '../components/ScreenHeading.jsx'
import TopBar from '../components/TopBar.jsx'
import ReadingSettings from '../components/ReadingSettings.jsx'
import { formatDate } from '../components/formatDate.js'
import { PRACTICE_TRICKY_WORDS } from '../content/activities.js'
import { recentPracticeWords, summarizeRound } from '../game/index.js'

function ReadingSettingsPanel({ childName, settings, onChange }) {
  return (
    <section className="panel" aria-labelledby="settings-title">
      <h2 id="settings-title" className="panel__title">
        Reading settings
      </h2>
      <p className="panel__note">Changes how {childName}&rsquo;s reading screens look.</p>
      <ReadingSettings settings={settings} onChange={onChange} />
    </section>
  )
}

function PracticeWords({ rounds }) {
  const words = recentPracticeWords(rounds)
  return (
    <section className="panel" aria-labelledby="practice-title">
      <h2 id="practice-title" className="panel__title">
        Words to practice
      </h2>
      <p className="panel__note">From the {Math.min(rounds.length, 5)} most recent rounds.</p>
      {words.length === 0 ? (
        <p>No words need extra practice right now.</p>
      ) : (
        <ul className="practice-list">
          {words.map(({ word, roundsNeedingPractice }) => (
            <li key={word}>
              <Icon name="flag" size={22} />
              <strong className="practice-list__word">{word}</strong>
              <span>
                took more than one try in {roundsNeedingPractice}{' '}
                {roundsNeedingPractice === 1 ? 'round' : 'rounds'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function RoundList({ rounds, onOpen }) {
  return (
    <section className="panel" aria-labelledby="rounds-title">
      <h2 id="rounds-title" className="panel__title">
        Completed rounds
      </h2>
      {rounds.length === 0 ? (
        <p>No completed rounds yet.</p>
      ) : (
        <ul className="round-list">
          {rounds.map((round) => {
            const summary = summarizeRound(round)
            return (
              <li key={round.id}>
                <button type="button" className="round-list__button" onClick={() => onOpen(round.id)}>
                  <span className="round-list__date">{formatDate(round.completedAt ?? round.startedAt)}</span>
                  <span className="round-list__meta">
                    {round.activityId === PRACTICE_TRICKY_WORDS.id && `${PRACTICE_TRICKY_WORDS.title} · `}
                    {summary.totalWords} {summary.totalWords === 1 ? 'word' : 'words'}
                    {summary.practiceWords.length > 0 &&
                      ` · Practice: ${summary.practiceWords.join(', ')}`}
                  </span>
                  {round.isSample && <SampleBadge />}
                  <span className="round-list__open">
                    View details
                    <Icon name="next" size={22} />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// One child's results for the parent/teacher view. `rounds`: the child's completed
// rounds, newest first. `settings` / `onSettingsChange`: the child's reading settings.
export default function ParentScreen({ child, rounds, settings, onSettingsChange, onBack, focusHeading }) {
  const [openId, setOpenId] = useState(null)
  const openRound = openId ? rounds.find((r) => r.id === openId) : null

  return (
    <>
      <TopBar
        onBack={openRound ? () => setOpenId(null) : onBack}
        showSettings={false}
        helpTip="Pick a round to see each word. Words that took more than one try are marked Needs practice."
      />
      <main className="screen screen--parent">
        {openRound ? (
          <>
            <ScreenHeading key="detail" focusOnMount>
              {child.name}&rsquo;s round
            </ScreenHeading>
            <RoundDetail summary={summarizeRound(openRound)} headingId="round-detail-title" />
          </>
        ) : (
          <>
            <ScreenHeading key="list" focusOnMount={focusHeading}>
              {child.name}&rsquo;s reading
            </ScreenHeading>
            <ReadingSettingsPanel childName={child.name} settings={settings} onChange={onSettingsChange} />
            <PracticeWords rounds={rounds} />
            <RoundList rounds={rounds} onOpen={setOpenId} />
          </>
        )}
      </main>
    </>
  )
}
