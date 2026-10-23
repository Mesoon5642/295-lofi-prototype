import { useContext, useId } from 'react'
import Icon from './Icon.jsx'
import { TextSizeContext } from './textSizeContext.js'

const OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'large', label: 'Larger text' },
]

export default function TextSizeToggle() {
  const { textSize, setTextSize } = useContext(TextSizeContext)
  const labelId = useId()
  return (
    <div className="text-size" role="group" aria-labelledby={labelId}>
      <span id={labelId} className="text-size__label">
        <Icon name="text" size={24} />
        <span className="visually-hidden">Text size</span>
      </span>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className="text-size__option"
          aria-pressed={textSize === option.value}
          onClick={() => setTextSize(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
