// Reading settings for the child's screens: allowed values and defaults. Pure data,
// shared by the React app and the server's MongoDB schema.

export const SETTING_VALUES = {
  textSize: ['standard', 'large'],
  font: ['standard', 'dyslexic'],
  wordAudio: ['on', 'off'],
  explanations: ['off', 'on'],
}

export const DEFAULT_SETTINGS = {
  textSize: 'standard',
  font: 'standard',
  wordAudio: 'on',
  explanations: 'off',
}
