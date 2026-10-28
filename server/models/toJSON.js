// Shared JSON output for every model: string `id` instead of `_id`, no `__v`.
// Responses then match the shapes the React app already uses.
export const toJSON = {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    delete ret._id
    return ret
  },
}
