// Starts the API: connects to MongoDB, seeds demo data on first run, then listens.
import { createApp } from './app.js'
import { connectDatabase, disconnectDatabase } from './db.js'
import { seedIfEmpty } from './seed/seed.js'

const port = Number(process.env.PORT ?? 3001)
const clientOrigins = process.env.CLIENT_ORIGIN?.split(',').map((origin) => origin.trim())

const { embedded, dbPath } = await connectDatabase()
console.log(embedded ? `MongoDB: embedded, saved in ${dbPath}` : 'MongoDB: connected to MONGODB_URI')
const seeded = await seedIfEmpty()
if (seeded.length > 0) console.log(`MongoDB: wrote demo data (${seeded.join('; ')})`)

const server = createApp({ clientOrigins }).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})

async function shutDown() {
  server.close()
  await disconnectDatabase()
  process.exit(0)
}
process.once('SIGINT', shutDown)
process.once('SIGTERM', shutDown)
