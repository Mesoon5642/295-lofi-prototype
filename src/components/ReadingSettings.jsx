import ToggleGroup from './ToggleGroup.jsx'

const TEXT_SIZES = [
  { value: 'standard', label: 'Standard' },
  { value: 'large', label: 'Larger text' },
]

// Each font option is drawn in its own typeface so the choice previews itself.
const FONTS = [
  { value: 'standard', label: 'Standard font', className: 'font-standard' },
  { value: 'dyslexic', label: 'OpenDyslexic', className: 'font-dyslexic' },
]

const WORD_AUDIO = [
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
]

const EXPLANATIONS = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On' },
]

// Text size, font, word audio, and the "Tell us how you chose" prompt for one child's
// screens. Only grown-ups see this: in the parent/teacher view and in the
// password-protected settings dialog. `onChange(partial)` saves a change.
export default function ReadingSettings({ settings, onChange: updateSettings }) {
  return (
    <div className="reading-settings">
      <div className="setting-row">
        <span className="setting-row__label" aria-hidden="true">
          Text size
        </span>
        <ToggleGroup
          label="Text size"
          options={TEXT_SIZES}
          value={settings.textSize}
          onChange={(textSize) => updateSettings({ textSize })}
        />
      </div>
      <div className="setting-row">
        <span className="setting-row__label" aria-hidden="true">
          Font
        </span>
        <ToggleGroup
          label="Font"
          options={FONTS}
          value={settings.font}
          onChange={(font) => updateSettings({ font })}
        />
      </div>
      <div className="setting-row">
        <span className="setting-row__label" aria-hidden="true">
          Read words aloud
        </span>
        <ToggleGroup
          label="Read words aloud"
          options={WORD_AUDIO}
          value={settings.wordAudio}
          onChange={(wordAudio) => updateSettings({ wordAudio })}
        />
      </div>
      <p className="setting-row__note">
        Off hides the Hear button next to each word. Hear Instructions always stays.
      </p>
      <div className="setting-row">
        <span className="setting-row__label" aria-hidden="true">
          Ask how they chose
        </span>
        <ToggleGroup
          label="Ask how they chose"
          options={EXPLANATIONS}
          value={settings.explanations}
          onChange={(explanations) => updateSettings({ explanations })}
        />
      </div>
      <p className="setting-row__note">
        On shows &ldquo;Tell us how you chose&rdquo; after each right answer, so a grown-up can
        type the child&rsquo;s reason.
      </p>
    </div>
  )
}
