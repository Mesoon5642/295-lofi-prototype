// npm run db:seed: wipes the database and writes the demo data again
// (profile Alex, the admin/admin grown-up account, and the sample rounds).
import { connectDatabase, disconnectDatabase } from '../db.js'
import { reseed } from '../seed/seed.js'

await connectDatabase()
await reseed()
console.log('Database reset to the demo data.')
await disconnectDatabase()
