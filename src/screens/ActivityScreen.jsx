import { useContext, useEffect, useId, useReducer, useRef, useState } from 'react'
import { getSpeechSupport, speak } from '../audio/speech.js'
import ExplanationForm from '../components/ExplanationForm.jsx'
import Icon from '../components/Icon.jsx'
import PauseDialog from '../components/PauseDialog.jsx'
import Picture from '../components/Picture.jsx'
import ProgressDots from '../components/ProgressDots.jsx'
import ScreenHeading from '../components/ScreenHeading.jsx'
import { SettingsContext } from '../components/settingsContext.js'
import TopBar from '../components/TopBar.jsx'
import WordChoice from '../components/WordChoice.jsx'
import { FEEDBACK, MATCH_THE_WORD } from '../content/activities.js'
import { getCurrentQuestion, getFeedback, roundReducer } from '../game/index.js'
import { saveRound } from '../storage/index.js'

function Feedback({ kind, attempts }) {
  if (kind === 'correct') {
    return (
      <p className="feedback feedback--correct">
        <Icon name="check" size={36} />
        <span>{FEEDBACK.correct}</span>
      </p>
    )
  }
  if (kind === 'incorrect') {
    // Keyed by attempts so a repeated "try again" is announced again.
    return (
      <p key={attempts} className="feedback feedback--retry">
        <Icon name="retry" size={36} />
        <span>{FEEDBACK.incorrect}</span>
      </p>
    )
  }
  return null
}

export default function ActivityScreen({ initialRound, onBack, onComplete, focusHeading }) {
  const [round, dispatch] = useReducer(roundReducer, initialRound)
  const [audioAvailable] = useState(() => getSpeechSupport() === 'available')
  const { settings } = useContext(SettingsContext)
  const question = getCurrentQuestion(round)
  const feedback = getFeedback(question)
  const total = round.questions.length
  const promptId = useId()

  const promptRef = useRef(null)
  const nextRef = useRef(null)
  const pauseRef = useRef(null)
  const shownIndex = useRef(round.currentIndex)
  const wasPaused = useRef(round.paused)

  // Save after every change so a refresh keeps the child's progress.
  useEffect(() => {
    saveRound(round)
  }, [round])

  useEffect(() => {
    if (round.status === 'completed') onComplete(round)
  }, [round, onComplete])

  // After Next, move focus to the new question for keyboard users.
  useEffect(() => {
    if (shownIndex.current !== round.currentIndex) {
      shownIndex.current = round.currentIndex
      promptRef.current?.focus()
    }
  }, [round.currentIndex])

  // After the pause dialog closes, return focus to the Pause button.
  useEffect(() => {
    if (wasPaused.current && !round.paused) pauseRef.current?.focus()
    wasPaused.current = round.paused
  }, [round.paused])

  function say(text) {
    if (speak(text)) dispatch({ type: 'USE_AUDIO' })
  }

  function finishExplanation(action) {
    dispatch(action)
    nextRef.current?.focus()
  }

  function handleContinue() {
    if (round.paused) dispatch({ type: 'CONTINUE' })
  }

  const helpProps = question.correct
    ? { helpTip: 'You found it! Press Next for a new word.' }
    : { onHelp: () => dispatch({ type: 'USE_HINT' }) }

  return (
    <>
      <TopBar key={`${round.currentIndex}-${question.correct}`} onBack={onBack} {...helpProps} />
      <main className="screen screen--activity">
        <div className="activity-head">
          <ScreenHeading focusOnMount={focusHeading} className="screen-heading--small">
            {MATCH_THE_WORD.title}
          </ScreenHeading>
          <ProgressDots current={round.currentIndex + 1} total={total} />
        </div>

        <div className="tool-row">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => say(MATCH_THE_WORD.instruction)}
            disabled={!audioAvailable}
          >
            <Icon name="speaker" />
            <span>Hear Instructions</span>
          </button>
          {!audioAvailable && (
            <p className="audio-note">
              <Icon name="muted" />
              <span>Audio unavailable</span>
            </p>
          )}
          <button
            ref={pauseRef}
            type="button"
            className="btn btn--secondary tool-row__pause"
            onClick={() => dispatch({ type: 'PAUSE' })}
          >
            <Icon name="pause" />
            <span>Pause</span>
          </button>
        </div>

        <section className="question" aria-labelledby={promptId}>
          <h2 id={promptId} ref={promptRef} tabIndex={-1} className="question__prompt">
            <span className="visually-hidden">
              Word {round.currentIndex + 1} of {total}.{' '}
            </span>
            {MATCH_THE_WORD.instruction}
          </h2>
          <div className="question__body">
            <Picture pictureId={question.pictureId} className="question__picture" />
            <ul className="word-list">
              {question.options.map((word) => (
                <WordChoice
                  key={`${round.currentIndex}-${word}`}
                  word={word}
                  locked={question.correct}
                  isAnswer={question.correct && word === question.target}
                  onSelect={(w) => dispatch({ type: 'SELECT', word: w })}
                  onSpeak={say}
                  audioAvailable={audioAvailable}
                  showSpeaker={settings.wordAudio === 'on'}
                />
              ))}
            </ul>
          </div>
        </section>

        <div className="feedback-region" aria-live="polite">
          <Feedback kind={feedback} attempts={question.attempts} />
        </div>

        <div className="hint-region" aria-live="polite">
          {question.hintUsed && !question.correct && (
            <p className="hint">
              <Icon name="bulb" />
              <span>{question.hint}</span>
            </p>
          )}
        </div>

        {question.correct && !question.explanationDone && (
          <ExplanationForm
            key={round.currentIndex}
            onSave={(text) => finishExplanation({ type: 'SAVE_EXPLANATION', text })}
            onSkip={() => finishExplanation({ type: 'SKIP_EXPLANATION' })}
          />
        )}
        {question.correct && question.explanationDone && question.explanation && (
          <p className="thanks">Thanks for telling us!</p>
        )}

        {question.correct && (
          <div className="next-row">
            <button
              ref={nextRef}
              type="button"
              className="btn btn--primary btn--big"
              onClick={() => dispatch({ type: 'NEXT', now: new Date().toISOString() })}
            >
              <span>Next</span>
              <Icon name="next" size={32} />
            </button>
          </div>
        )}

        {round.paused && <PauseDialog onContinue={handleContinue} />}
      </main>
    </>
  )
}
