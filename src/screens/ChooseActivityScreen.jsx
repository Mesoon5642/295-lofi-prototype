import Icon from '../components/Icon.jsx'
import Picture from '../components/Picture.jsx'
import ScreenHeading from '../components/ScreenHeading.jsx'
import TopBar from '../components/TopBar.jsx'
import { MATCH_THE_WORD } from '../content/activities.js'

export default function ChooseActivityScreen({ hasRoundInProgress, onStart, onBack, focusHeading }) {
  return (
    <>
      <TopBar
        onBack={onBack}
        helpTip="Press Start to begin. Look at the picture, then pick the word."
      />
      <main className="screen screen--center">
        <ScreenHeading focusOnMount={focusHeading}>Choose a game</ScreenHeading>
        <section className="activity-card" aria-labelledby="activity-title">
          <Picture pictureId="cat" decorative className="activity-card__picture" />
          <h2 id="activity-title" className="activity-card__title">
            {MATCH_THE_WORD.title}
          </h2>
          <p className="activity-card__text">{MATCH_THE_WORD.instruction}</p>
          {hasRoundInProgress && (
            <p className="activity-card__note">You can pick up where you left off.</p>
          )}
          <button type="button" className="btn btn--primary btn--huge" onClick={onStart}>
            <Icon name="play" size={36} />
            <span>{hasRoundInProgress ? 'Keep going' : 'Start'}</span>
          </button>
        </section>
      </main>
    </>
  )
}
