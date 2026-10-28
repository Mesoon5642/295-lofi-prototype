import mongoose from 'mongoose'
import { toJSON } from './toJSON.js'

const { Schema } = mongoose

// A parent or teacher account. Only the scrypt hash and salt of the password are
// stored, and neither ever leaves the server (see `toJSON` below).
const adultSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, maxlength: 60 },
    role: { type: String, required: true, enum: ['parent', 'teacher'] },
    childIds: { type: [String], default: [] },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
  },
  {
    toJSON: {
      ...toJSON,
      transform(_doc, ret) {
        delete ret._id
        delete ret.passwordHash
        delete ret.passwordSalt
        return ret
      },
    },
  },
)

export const Adult = mongoose.model('Adult', adultSchema, 'adults')
