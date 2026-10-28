// Where the Express API lives. Override with VITE_API_URL (see .env.example).
export const API_BASE = (import.meta.env?.VITE_API_URL ?? 'http://localhost:3001').replace(/\/+$/, '')

// Speech clips are served by the API at /audio/<clip name>.wav.
export const AUDIO_BASE = `${API_BASE}/audio`

// The child who plays on this device, until there is a way to pick a child.
export const ACTIVE_CHILD_ID = 'child-alex'
