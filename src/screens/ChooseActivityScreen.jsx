import { useState } from 'react'
import { getAudioSupport, playClip } from '../audio/player.js'
import { describeActivity } from '../audio/clips.js'
import Icon from '../components/Icon.jsx'
import Picture from '../components/Picture.jsx'
import ScreenHeading from '../components/ScreenHeading.jsx'
import TopBar from '../components/TopBar.jsx'
import { MATCH_THE_WORD, PRACTICE_TRICKY_WORDS } from '../content/activities.js'

// One game: picture, title, description with a Hear button, and Start / Keep going.
function GameCard({
  activity,
  pictureId,
  note,
  hasRoundInProgress,
  onStart,
  starting,
  audioAvailable,
}) {
  const titleId = `${activity.id}-title`
  return (
    <section className="activity-card" aria-labelledby={titleId}>
      <Picture pictureId={pictureId} decorative className="activity-card__picture" />
      <h2 id={titleId} className="activity-card__title">
        {activity.title}
      </h2>
      <div className="activity-card__about">
        <p className="activity-card__text">{activity.description}</p>
        <button
          type="button"
          className="btn btn--secondary speaker-button"
          onClick={() => playClip(describeActivity(activity))}
          disabled={!audioAvailable}
        >
          <Icon name="speaker" />
          <span>Hear</span>
          <span className="visually-hidden"> about {activity.title}</span>
        </button>
      </div>
      {note && <p className="activity-card__note">{note}</p>}
      {hasRoundInProgress && (
        <p className="activity-card__note">You can pick up where you left off.</p>
      )}
      <button
        type="button"
        className="btn btn--primary btn--huge"
        onClick={onStart}
        aria-disabled={starting || undefined}
      >
        <Icon name="play" size={36} />
        <span>{hasRoundInProgress ? 'Keep going' : 'Start'}</span>
      </button>
    </section>
  )
}

// `practiceWords`: recently tricky words. The Tricky Words card shows when there are
// some, or when a practice round is already in progress.
export default function ChooseActivityScreen({
  inProgress,
  practiceWords,
  onStart,
  starting,
  error,
  onBack,
  focusHeading,
}) {
  const [audioAvailable] = useState(() => getAudioSupport() === 'available')
  const showPractice = practiceWords.length > 0 || inProgress[PRACTICE_TRICKY_WORDS.id]
  const practiceCount = Math.min(practiceWords.length, PRACTICE_TRICKY_WORDS.questionCount)

  return (
    <>
      <TopBar
        onBack={onBack}
        helpTip="Press Start to begin. Look at the picture, then pick the word."
      />
      <main className="screen screen--center">
        <ScreenHeading focusOnMount={focusHeading}>Choose a game</ScreenHeading>
        {!audioAvailable && (
          <p className="audio-note">
            <Icon name="muted" />
            <span>Audio unavailable</span>
          </p>
        )}
        <p className="screen-error" role="alert">
          {error}
        </p>
        <div className="activity-cards">
          <GameCard
            activity={MATCH_THE_WORD}
            pictureId="cat"
            hasRoundInProgress={inProgress[MATCH_THE_WORD.id]}
            onStart={() => onStart(MATCH_THE_WORD.id)}
            starting={starting}
            audioAvailable={audioAvailable}
          />
          {showPractice && (
            <GameCard
              activity={PRACTICE_TRICKY_WORDS}
              pictureId="dog"
              note={
                !inProgress[PRACTICE_TRICKY_WORDS.id] &&
                `${practiceCount} ${practiceCount === 1 ? 'word' : 'words'} to practice`
              }
              hasRoundInProgress={inProgress[PRACTICE_TRICKY_WORDS.id]}
              onStart={() => onStart(PRACTICE_TRICKY_WORDS.id)}
              starting={starting}
              audioAvailable={audioAvailable}
            />
          )}
        </div>
      </main>
    </>
  )
}
