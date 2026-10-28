import { createContext } from 'react'
import { DEFAULT_SETTINGS } from '../content/settings.js'

// The playing child's id, their reading settings (text size, font, word audio, "how did
// you choose" prompt), and a function that saves changes through the API.
export const SettingsContext = createContext({
  childId: null,
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
})
