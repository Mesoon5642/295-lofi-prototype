import { createContext } from 'react'

// Reading settings (text size, font, word audio, "how did you choose" prompt) plus a
// function that saves changes.
export const SettingsContext = createContext({
  settings: { textSize: 'standard', font: 'standard', wordAudio: 'on', explanations: 'off' },
  updateSettings: () => {},
})
