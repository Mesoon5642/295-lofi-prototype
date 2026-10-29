import mongoose from 'mongoose'
import { toJSON } from './toJSON.js'

const { Schema } = mongoose

// One word in the word list. `_id` is the word itself ('cat'), so each word appears once.
// Rounds copy the word, hint, and pictureId into their questions when they start.
const wordSchema = new Schema(
  {
    _id: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z][a-z' -]*$/ },
    hint: { type: String, required: true, trim: true, maxlength: 200 },
    pictureId: { type: String, required: true, ref: 'Image' },
  },
  {
    toJSON: {
      ...toJSON,
      transform(_doc, ret) {
        ret.word = ret._id
        delete ret._id
        delete ret.id
        return ret
      },
    },
  },
)

export const Word = mongoose.model('Word', wordSchema, 'words')
