import { createContext } from 'react'

// Reading settings (text size, font, word audio) plus a function that saves changes.
export const SettingsContext = createContext({
  settings: { textSize: 'standard', font: 'standard', wordAudio: 'on' },
  updateSettings: () => {},
})
