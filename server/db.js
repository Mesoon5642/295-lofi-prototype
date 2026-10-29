import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'

const DEFAULT_DATA_DIR = fileURLToPath(new URL('../.data/mongo', import.meta.url))

let embedded = null

// Connects Mongoose. Uses MONGODB_URI when set (a local install or Atlas). Otherwise it
// starts an embedded MongoDB (mongodb-memory-server) that saves to .data/mongo, so the
// app runs with no database setup. Pass `persist: false` for a throwaway database (tests).
export async function connectDatabase({ uri = process.env.MONGODB_URI, persist = true } = {}) {
  let target = uri
  if (!target) {
    const { MongoMemoryServer } = await import('mongodb-memory-server')
    const instance = { dbName: 'reading-game' }
    if (persist) {
      const dbPath = path.resolve(process.env.MONGODB_DATA_DIR ?? DEFAULT_DATA_DIR)
      await mkdir(dbPath, { recursive: true })
      Object.assign(instance, { dbPath, storageEngine: 'wiredTiger' })
    }
    embedded = await MongoMemoryServer.create({ instance })
    target = embedded.getUri()
  }
  await mongoose.connect(target, { dbName: uri ? undefined : 'reading-game' })
  return { uri: target, embedded: embedded !== null, dbPath: embedded?.instanceInfo?.dbPath ?? null }
}

export async function disconnectDatabase() {
  await mongoose.disconnect()
  if (embedded) {
    await embedded.stop()
    embedded = null
  }
}
