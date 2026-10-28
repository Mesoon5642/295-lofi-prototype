import Icon from './Icon.jsx'

// One answer word plus a speaker button that reads just that word.
// Grown-ups can turn word audio off (`showSpeaker={false}`) so the child reads unaided.
export default function WordChoice({
  word,
  locked,
  isAnswer,
  onSelect,
  onSpeak,
  audioAvailable,
  showSpeaker = true,
}) {
  return (
    <li className="word-choice">
      <button
        type="button"
        className={`word-button${isAnswer ? ' is-answer' : ''}`}
        aria-disabled={locked || undefined}
        onClick={() => {
          if (!locked) onSelect(word)
        }}
      >
        {isAnswer && <Icon name="check" size={36} />}
        <span>{word}</span>
      </button>
      {showSpeaker && (
        <button
          type="button"
          className="btn btn--secondary speaker-button"
          onClick={() => onSpeak(word)}
          disabled={!audioAvailable}
        >
          <Icon name="speaker" />
          <span>Hear</span>
          <span className="visually-hidden"> {word}</span>
        </button>
      )}
    </li>
  )
}
