import mongoose from 'mongoose'
import { toJSON } from './toJSON.js'

const { Schema } = mongoose

export const IMAGE_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp']
export const MAX_IMAGE_BYTES = 1024 * 1024

// A picture stored in MongoDB (served at GET /api/images/:id). `_id` is a readable
// string such as 'cat'. `description` is for grown-ups; the child never sees it,
// because the picture's accessible name must not give the answer away.
const imageSchema = new Schema(
  {
    _id: { type: String, required: true, match: /^[a-z0-9-]+$/ },
    contentType: { type: String, required: true, enum: IMAGE_TYPES },
    data: {
      type: Buffer,
      required: true,
      validate: {
        validator: (data) => data.length > 0 && data.length <= MAX_IMAGE_BYTES,
        message: `An image must be between 1 byte and ${MAX_IMAGE_BYTES} bytes`,
      },
    },
    description: { type: String, default: '', maxlength: 200 },
  },
  {
    toJSON: {
      ...toJSON,
      transform(_doc, ret) {
        delete ret._id
        delete ret.data
        return ret
      },
    },
  },
)

export const Image = mongoose.model('Image', imageSchema, 'images')
