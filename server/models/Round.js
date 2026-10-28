import mongoose from 'mongoose'
import { ACTIVITIES } from '../../src/content/activities.js'
import { OPTION_COUNT } from '../../src/game/questions.js'
import { toJSON } from './toJSON.js'

const { Schema } = mongoose

// One word in a round, with everything the child did on it.
const questionSchema = new Schema(
  {
    target: { type: String, required: true },
    pictureId: { type: String, required: true },
    hint: { type: String, required: true },
    options: {
      type: [String],
      validate: {
        validator: (options) => options.length === OPTION_COUNT,
        message: `A question needs exactly ${OPTION_COUNT} options`,
      },
    },
    selections: { type: [String], default: [] },
    attempts: { type: Number, min: 0, default: 0 },
    correct: { type: Boolean, default: false },
    hintUsed: { type: Boolean, default: false },
    audioUsed: { type: Boolean, default: false },
    explanation: { type: String, default: null, maxlength: 200 },
    explanationDone: { type: Boolean, default: false },
  },
  { _id: false, id: false },
)

// A round is both the live game state and the stored record (see docs/ARCHITECTURE.md).
// `_id` is the client-made round id ('round-…', or 'sample-…' for seed data).
const roundSchema = new Schema(
  {
    _id: { type: String, required: true },
    childId: { type: String, required: true, ref: 'ChildProfile', index: true },
    activityId: { type: String, required: true, enum: ACTIVITIES.map((a) => a.id) },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    status: { type: String, required: true, enum: ['in_progress', 'completed'] },
    isSample: { type: Boolean, default: false },
    currentIndex: { type: Number, min: 0, default: 0 },
    paused: { type: Boolean, default: false },
    questions: {
      type: [questionSchema],
      validate: {
        validator: (questions) => questions.length > 0,
        message: 'A round needs at least one question',
      },
    },
  },
  { toJSON },
)

export const Round = mongoose.model('Round', roundSchema, 'rounds')
