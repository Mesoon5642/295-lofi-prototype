// A labelled row of buttons where exactly one option is pressed.
// `label` is the group's accessible name.
export default function ToggleGroup({ label, options, value, onChange }) {
  return (
    <div className="toggle-group" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`toggle-group__option ${option.className ?? ''}`.trim()}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
