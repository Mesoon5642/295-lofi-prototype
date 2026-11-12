import { Router } from 'express'
import { findTestTask } from '../../src/content/testTasks.js'
import { getCurrentTask, taskPosition } from '../../src/game/testSession.js'
import { assertChildUsable, requireElevated, requireSession } from '../auth/middleware.js'
import {
  applyTestSessionAction,
  endTestSession,
  getActiveTestSession,
  getTestSession,
  listTestSessions,
  logTestSessionEvent,
  newTesterReset,
  startTestSession,
} from '../repository.js'
import { notFound } from './errors.js'

export const testSessionsRouter = Router()

testSessionsRouter.use(requireSession)

// The tester's window runs locked (a child is playing), so these two only need a
// session. They reach only the signed-in grown-up's active session, and the read
// gives just what the task card shows: no notes, outcomes, or tester label.
testSessionsRouter.get('/active', async (req, res) => {
  const session = await getActiveTestSession(req.auth.adult.id)
  if (!session) return res.json({ active: false })
  const task = findTestTask(getCurrentTask(session)?.taskId)
  const { number, total } = taskPosition(session)
  res.json({
    active: true,
    childId: session.childId,
    taskId: task?.id ?? null,
    taskNumber: number,
    taskTotal: total,
    scenario: task?.scenario ?? '',
  })
})

// Body: { type: 'route', path } or { type: 'signal', signal, roundId? }.
testSessionsRouter.post('/active/events', async (req, res) => {
  res.json(await logTestSessionEvent(req.auth.adult.id, req.body))
})

// Everything else is the facilitator's, and needs the password entered recently.
testSessionsRouter.use(requireElevated)

// [{ id, testerLabel, childId, status, startedAt, endedAt }], newest first.
testSessionsRouter.get('/', async (req, res) => {
  res.json(await listTestSessions(req.auth.adult.id))
})

// Body: { testerLabel, childId, taskIds }. Resets demo data and starts a session (201);
// 409 when one is already active.
testSessionsRouter.post('/', async (req, res) => {
  assertChildUsable(req.auth, req.body?.childId)
  const session = await startTestSession(req.auth.adult.id, req.body, {
    childIds: req.auth.adult.childIds,
  })
  res.status(201).json(session)
})

testSessionsRouter.get('/:id', async (req, res) => {
  const session = await getTestSession(req.auth.adult.id, req.params.id)
  if (!session) throw notFound('No test session with that id')
  res.json(session)
})

// Body: one of START_TASK, SET_OUTCOME { outcome }, NEXT_TASK, ADD_NOTE { text, severity }.
testSessionsRouter.post('/:id/actions', async (req, res) => {
  const session = await applyTestSessionAction(req.auth.adult.id, req.params.id, req.body)
  if (!session) throw notFound('No test session with that id')
  res.json(session)
})

testSessionsRouter.post('/:id/end', async (req, res) => {
  const session = await endTestSession(req.auth.adult.id, req.params.id)
  if (!session) throw notFound('No test session with that id')
  res.json(session)
})

// Ends the session, resets demo data and the child's settings: { session, nextLabel }.
testSessionsRouter.post('/:id/new-tester', async (req, res) => {
  const result = await newTesterReset(req.auth.adult.id, req.params.id, {
    childIds: req.auth.adult.childIds,
  })
  if (!result) throw notFound('No test session with that id')
  res.json(result)
})
