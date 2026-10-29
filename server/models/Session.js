import mongoose from 'mongoose'

const { Schema } = mongoose

// A signed-in device. The browser holds a random token in an HTTP-only cookie; only
// its SHA-256 hash is stored here, as `_id`. MongoDB deletes sessions once
// `expiresAt` passes (TTL index). `elevatedUntil` is set when a grown-up signs in or
// re-enters their password. `activeChildId` is the child playing on this device.
const sessionSchema = new Schema({
  _id: { type: String, required: true },
  adultId: { type: Schema.Types.ObjectId, required: true, ref: 'Adult', index: true },
  createdAt: { type: Date, required: true, default: Date.now },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  elevatedUntil: { type: Date, default: null },
  activeChildId: { type: String, default: null, ref: 'ChildProfile' },
})

export const Session = mongoose.model('Session', sessionSchema, 'sessions')
