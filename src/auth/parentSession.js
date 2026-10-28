// Whether a grown-up just signed in for the parent/teacher view. Kept only in memory:
// a page refresh, or leaving the view, means signing in again.
let signedIn = false

export function startParentSession() {
  signedIn = true
}

export function endParentSession() {
  signedIn = false
}

export function hasParentSession() {
  return signedIn
}
