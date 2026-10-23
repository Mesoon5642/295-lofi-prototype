import Icon from '../components/Icon.jsx'
import ScreenHeading from '../components/ScreenHeading.jsx'
import TopBar from '../components/TopBar.jsx'

export default function StartScreen({ childName, onPlay, onParent, focusHeading }) {
  return (
    <>
      <TopBar helpTip="Press Play to read words. Grown-ups can press Parent or Teacher." />
      <main className="screen screen--center">
        <ScreenHeading focusOnMount={focusHeading}>Hi, {childName}!</ScreenHeading>
        <p className="lead">Ready to read?</p>
        <div className="start-choices">
          <button type="button" className="btn btn--primary btn--huge" onClick={onPlay}>
            <Icon name="play" size={40} />
            <span>Play</span>
          </button>
          <button type="button" className="btn btn--secondary btn--big" onClick={onParent}>
            <Icon name="people" size={32} />
            <span>Parent or Teacher</span>
          </button>
        </div>
      </main>
    </>
  )
}
