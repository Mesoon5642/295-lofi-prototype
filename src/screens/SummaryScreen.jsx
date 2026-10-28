import Icon from '../components/Icon.jsx'
import Picture from '../components/Picture.jsx'
import ScreenHeading from '../components/ScreenHeading.jsx'
import TopBar from '../components/TopBar.jsx'
import { FEEDBACK } from '../content/activities.js'
import { summarizeRound } from '../game/index.js'

// Celebrates finishing and effort. No scores, stars, or speed.
export default function SummaryScreen({
  round,
  onPlayAgain,
  starting,
  error,
  onHome,
  focusHeading,
}) {
  const summary = summarizeRound(round)
  return (
    <>
      <TopBar
        onBack={onHome}
        helpTip="Press Play Again to read more words, or Home to go back."
      />
      <main className="screen screen--center">
        {/* One badge, always the same: a celebration, not a rating. */}
        <div className="celebrate" aria-hidden="true">
          <Icon name="star" size={72} />
        </div>
        <ScreenHeading focusOnMount={focusHeading}>
          {FEEDBACK.finished(summary.totalWords)}
        </ScreenHeading>
        <p className="lead">You kept trying. Great reading!</p>

        <h2 className="section-title">Words you read</h2>
        <ul className="read-words">
          {summary.words.map((w, i) => (
            <li key={`${w.word}-${i}`} className="read-words__item">
              <Picture pictureId={round.questions[i].pictureId} decorative />
              <span>{w.word}</span>
            </li>
          ))}
        </ul>

        <p className="screen-error" role="alert">
          {error}
        </p>
        <div className="button-row button-row--center">
          <button
            type="button"
            className="btn btn--primary btn--big"
            onClick={onPlayAgain}
            aria-disabled={starting || undefined}
          >
            <Icon name="play" size={32} />
            <span>Play Again</span>
          </button>
          <button type="button" className="btn btn--secondary btn--big" onClick={onHome}>
            <Icon name="home" size={32} />
            <span>Home</span>
          </button>
        </div>
      </main>
    </>
  )
}
