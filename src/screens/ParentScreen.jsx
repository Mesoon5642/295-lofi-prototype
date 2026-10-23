import { useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import RoundDetail from '../components/RoundDetail.jsx'
import SampleBadge from '../components/SampleBadge.jsx'
import ScreenHeading from '../components/ScreenHeading.jsx'
import TopBar from '../components/TopBar.jsx'
import { formatDate } from '../components/formatDate.js'
import { recentPracticeWords, summarizeRound } from '../game/index.js'
import { getRounds, resetDemoData } from '../storage/index.js'

function loadRounds(childId) {
  return getRounds({ childId, status: 'completed' })
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
                    {summary.totalWords} words
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

function ResetDemo({ onReset }) {
  const [confirming, setConfirming] = useState(false)
  const confirmRef = useRef(null)
  const startRef = useRef(null)
  const wasConfirming = useRef(false)

  useEffect(() => {
    if (confirming) confirmRef.current?.focus()
    else if (wasConfirming.current) startRef.current?.focus()
    wasConfirming.current = confirming
  }, [confirming])

  function handleConfirm() {
    onReset()
    setConfirming(false)
  }

  return (
    <section className="panel panel--quiet" aria-labelledby="reset-title">
      <h2 id="reset-title" className="panel__title">
        Demo data
      </h2>
      {confirming ? (
        <div className="confirm" role="group" aria-label="Confirm reset">
          <p>Reset demo data? This removes rounds played here and restores the sample rounds.</p>
          <div className="button-row">
            <button ref={confirmRef} type="button" className="btn btn--danger" onClick={handleConfirm}>
              Yes, reset
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button ref={startRef} type="button" className="btn btn--secondary" onClick={() => setConfirming(true)}>
          <Icon name="trash" />
          <span>Reset Demo Data</span>
        </button>
      )}
    </section>
  )
}

export default function ParentScreen({ child, onBack, focusHeading }) {
  const [rounds, setRounds] = useState(() => loadRounds(child.id))
  const [openId, setOpenId] = useState(null)
  const [status, setStatus] = useState('')
  const openRound = openId ? rounds.find((r) => r.id === openId) : null

  function handleReset() {
    resetDemoData()
    setRounds(loadRounds(child.id))
    setOpenId(null)
    setStatus('Demo data was reset.')
  }

  return (
    <>
      <TopBar
        onBack={openRound ? () => setOpenId(null) : onBack}
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
            <p className="status" role="status">
              {status}
            </p>
            <PracticeWords rounds={rounds} />
            <RoundList rounds={rounds} onOpen={setOpenId} />
            <ResetDemo onReset={handleReset} />
          </>
        )}
      </main>
    </>
  )
}
