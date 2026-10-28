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

// A child who plays the game. `_id` is a readable string such as 'child-alex'.
const childProfileSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    settings: { type: settingsSchema, default: () => ({}) },
  },
  { toJSON },
)

export const ChildProfile = mongoose.model('ChildProfile', childProfileSchema, 'childProfiles')
