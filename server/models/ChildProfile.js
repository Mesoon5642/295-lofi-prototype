import mongoose from 'mongoose'
import { DEFAULT_SETTINGS, SETTING_VALUES } from '../../src/content/settings.js'
import { toJSON } from './toJSON.js'

const { Schema } = mongoose

// Reading settings for the child's screens (text size, font, word audio, the
// "Tell us how you chose" prompt). Grown-ups change them; the child can't.
const settingsSchema = new Schema(
  Object.fromEntries(
    Object.entries(SETTING_VALUES).map(([key, values]) => [
      key,
      { type: String, enum: values, default: DEFAULT_SETTINGS[key] },
    ]),
  ),
  { _id: false, id: false },
)

// A child who plays the game. `_id` is a string such as 'child-alex' (seed) or
// 'child-<uuid>' (created in the app). Which grown-ups can see the child is stored on
// each Adult (`childIds`), so a child can have several parents or teachers.
const childProfileSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
    settings: { type: settingsSchema, default: () => ({}) },
    createdAt: { type: Date, default: Date.now },
  },
  { toJSON },
)

export const ChildProfile = mongoose.model('ChildProfile', childProfileSchema, 'childProfiles')
