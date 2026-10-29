// Sign-in sessions for grown-ups. A grown-up signs in on a device, picks which of their
// children is playing (the session's active child), and the child then plays under
// that session. Grown-up-only actions (parent/teacher view, picking or adding a child,
// changing settings, resetting demo data) also need the session to be "unlocked": the
// password was entered within ELEVATED_MS (signing in counts) and it hasn't been locked.

import { createHash, randomBytes } from 'node:crypto'
import { Adult, ChildProfile, Session } from '../models/index.js'
import { verifyPassword } from './passwords.js'

export const SESSION_COOKIE = 'rg_session'
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
export const ELEVATED_MS = 10 * 60 * 1000 // 10 minutes

// Too many wrong passwords for one key (username, or session for unlock) in the
// window means a short lockout. Kept in memory, so it resets when the server restarts.
const MAX_FAILURES = 5
const FAILURE_WINDOW_MS = 15 * 60 * 1000
const failures = new Map()

export function isLockedOut(key, now = Date.now()) {
  const entry = failures.get(key)
  if (!entry || now - entry.first > FAILURE_WINDOW_MS) return false
  return entry.count >= MAX_FAILURES
}

function recordFailure(key, now = Date.now()) {
  const entry = failures.get(key)
  if (!entry || now - entry.first > FAILURE_WINDOW_MS) failures.set(key, { first: now, count: 1 })
  else entry.count += 1
}

export function clearFailures() {
  failures.clear()
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

// What the browser is told about its session.
async function describe(session, adult) {
  const children = await ChildProfile.find({ _id: { $in: adult.childIds } })
    .collation({ locale: 'en' })
    .sort({ name: 1 })
  const childIds = children.map((child) => child.id)
  return {
    adult: { username: adult.username, role: adult.role },
    children: children.map((child) => ({ id: child.id, name: child.name })),
    activeChildId: childIds.includes(session.activeChildId) ? session.activeChildId : null,
    elevated: session.elevatedUntil != null && session.elevatedUntil > new Date(),
  }
}

export class AuthError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// Checks the username and password and starts a session, already unlocked (the
// password was just entered) so the grown-up can pick a child or open their view.
// Resolves with { token, expiresAt, view }; rejects with AuthError (401 wrong,
// 429 locked out).
export async function signIn(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string') {
    throw new AuthError(401, 'That username or password is not right.')
  }
  const key = `user:${username.trim()}`
  if (isLockedOut(key)) throw new AuthError(429, 'Too many tries. Please wait a few minutes.')
  const adult = await Adult.findOne({ username: username.trim() })
  if (!adult || !(await verifyPassword(password, adult))) {
    recordFailure(key)
    throw new AuthError(401, 'That username or password is not right.')
  }
  failures.delete(key)

  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_MS)
  const session = await Session.create({
    _id: hashToken(token),
    adultId: adult._id,
    expiresAt,
    elevatedUntil: new Date(Date.now() + ELEVATED_MS),
  })
  return { token, expiresAt, view: await describe(session, adult) }
}

// The session and grown-up for a cookie token, or null if it's missing or expired.
export async function findSession(token) {
  if (typeof token !== 'string' || token === '') return null
  const session = await Session.findById(hashToken(token))
  if (!session || session.expiresAt <= new Date()) return null
  const adult = await Adult.findById(session.adultId)
  return adult ? { session, adult } : null
}

export function describeSession({ session, adult }) {
  return describe(session, adult)
}

export function isElevated({ session }) {
  return session.elevatedUntil != null && session.elevatedUntil > new Date()
}

// The grown-up is linked to this child (owns it or has been given access).
export function canAccessChild({ adult }, childId) {
  return typeof childId === 'string' && adult.childIds.includes(childId)
}

// What a session may do with a child's games and rounds: the child who is playing
// on this device, or (when unlocked) any of the grown-up's children.
export function canUseChild(auth, childId) {
  return canAccessChild(auth, childId) && (isElevated(auth) || auth.session.activeChildId === childId)
}

// Sets which child plays on this device and locks grown-up actions, since the
// device is about to be handed to the child. Needs an unlocked session.
export async function selectChild(auth, childId) {
  if (!canAccessChild(auth, childId)) throw new AuthError(404, 'No child with that id')
  auth.session.activeChildId = childId
  auth.session.elevatedUntil = null
  await auth.session.save()
  return describe(auth.session, auth.adult)
}

// Re-checks the signed-in grown-up's password and unlocks grown-up actions.
export async function unlock(auth, password) {
  const key = `session:${auth.session.id}`
  if (isLockedOut(key)) throw new AuthError(429, 'Too many tries. Please wait a few minutes.')
  if (!(await verifyPassword(password, auth.adult))) {
    recordFailure(key)
    throw new AuthError(401, 'That password is not right.')
  }
  failures.delete(key)
  auth.session.elevatedUntil = new Date(Date.now() + ELEVATED_MS)
  await auth.session.save()
  return describe(auth.session, auth.adult)
}

export async function lock(auth) {
  auth.session.elevatedUntil = null
  await auth.session.save()
  return describe(auth.session, auth.adult)
}

export async function signOut(auth) {
  await Session.deleteOne({ _id: auth.session.id })
}
