// Errors with an HTTP status. Express 5 passes errors thrown in async handlers to
// the error handler in app.js.
export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export const badRequest = (message) => new HttpError(400, message)
export const notFound = (message) => new HttpError(404, message)
