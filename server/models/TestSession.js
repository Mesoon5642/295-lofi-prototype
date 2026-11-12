import mongoose from 'mongoose'
import { OUTCOME_IDS, SEVERITY_VALUES, TEST_TASK_IDS } from '../../src/content/testTasks.js'
import { EVENT_SIGNALS, EVENT_TYPES, MAX_EVENTS, MAX_NOTE_LENGTH } from '../../src/game/testSession.js'
import { toJSON } from './toJSON.js'

const { Schema } = mongoose

// One task in a session: when the facilitator started it, when the outcome stopped it.
const taskSchema = new Schema(
  {
    taskId: { type: String, required: true, enum: TEST_TASK_IDS },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    outcome: { type: String, default: null, enum: [...OUTCOME_IDS, null] },
  },
  { _id: false, id: false },
)

// A route change or app signal from the tester's window. Never holds typed text.
const eventSchema = new Schema(
  {
    at: { type: Date, required: true },
    taskId: { type: String, default: null },
    type: { type: String, required: true, enum: EVENT_TYPES },
    path: { type: String, maxlength: 300 },
    screen: { type: String, maxlength: 100 },
    signal: { type: String, enum: EVENT_SIGNALS },
    roundId: { type: String, maxlength: 100 },
  },
  { _id: false, id: false },
)

const noteSchema = new Schema(
  {
    at: { type: Date, required: true },
    taskId: { type: String, default: null },
    screen: { type: String, default: null, maxlength: 100 },
    text: { type: String, required: true, minlength: 1, maxlength: MAX_NOTE_LENGTH },
    severity: { type: Number, required: true, enum: SEVERITY_VALUES },
  },
  { _id: false, id: false },
)

// A usability test session run by a facilitator (see docs/ARCHITECTURE.md). Only one
// session per grown-up can be active at a time; a partial unique index enforces it.
const testSessionSchema = new Schema(
  {
    _id: { type: String, required: true },
    testerLabel: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
    adultId: { type: String, required: true, index: true },
    childId: { type: String, required: true, ref: 'ChildProfile' },
    status: { type: String, required: true, enum: ['active', 'ended'] },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    currentTaskIndex: { type: Number, min: 0, default: 0 },
    tasks: {
      type: [taskSchema],
      validate: {
        validator: (tasks) => tasks.length > 0,
        message: 'A session needs at least one task',
      },
    },
    events: {
      type: [eventSchema],
      validate: {
        validator: (events) => events.length <= MAX_EVENTS,
        message: `A session keeps at most ${MAX_EVENTS} events`,
      },
    },
    notes: { type: [noteSchema], default: [] },
  },
  { toJSON },
)

testSessionSchema.index(
  { adultId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' }, name: 'one_active_per_adult' },
)

export const TestSession = mongoose.model('TestSession', testSessionSchema, 'testSessions')
