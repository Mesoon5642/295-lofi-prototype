// Placeholder grown-up checks until there is a backend: sign-in for the
// parent/teacher view, and the parent/teacher password for live settings.
// Later this can become an API call; callers only need a yes/no answer.

const DEMO_USERNAME = 'admin'
const DEMO_PASSWORD = 'admin'

export function checkCredentials(username, password) {
  return (
    typeof username === 'string' &&
    typeof password === 'string' &&
    username.trim() === DEMO_USERNAME &&
    password === DEMO_PASSWORD
  )
}

export function checkParentPassword(password) {
  return password === DEMO_PASSWORD
}
