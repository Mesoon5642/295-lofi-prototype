import { useId, useState } from 'react'
import { FEEDBACK } from '../content/activities.js'
import Icon from './Icon.jsx'

// Optional "Tell us how you chose" note. A helper may type the child's words.
export default function ExplanationForm({ onSave, onSkip }) {
  const [text, setText] = useState('')
  const inputId = useId()
  const helpId = useId()

  function handleSubmit(event) {
    event.preventDefault()
    onSave(text)
  }

  return (
    <form className="explain" onSubmit={handleSubmit}>
      <label htmlFor={inputId} className="explain__label">
        <Icon name="chat" />
        <span>{FEEDBACK.explanationPrompt}</span>
      </label>
      <p id={helpId} className="explain__help">
        A grown-up can type what you say.
      </p>
      <input
        id={inputId}
        type="text"
        className="explain__input"
        value={text}
        maxLength={200}
        autoComplete="off"
        aria-describedby={helpId}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="button-row">
        <button type="submit" className="btn btn--secondary">
          Save
        </button>
        <button type="button" className="btn btn--quiet" onClick={onSkip}>
          Skip
        </button>
      </div>
    </form>
  )
}
