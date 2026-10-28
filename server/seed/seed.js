import { hashPassword } from '../auth/passwords.js'
import { Adult, ChildProfile, Round } from '../models/index.js'
import { resetDemoData } from '../repository.js'
import { SEED_ADULTS, SEED_CHILD } from './seedData.js'

async function insertSeed() {
  await ChildProfile.create({
    _id: SEED_CHILD.id,
    name: SEED_CHILD.name,
    settings: SEED_CHILD.settings,
  })
  for (const { password, ...adult } of SEED_ADULTS) {
    await Adult.create({ ...adult, ...(await hashPassword(password)) })
  }
  await resetDemoData()
}

// Writes the demo data (profile, grown-up account, sample rounds) if the database has
// no child profiles yet. Safe to call on every server start.
export async function seedIfEmpty() {
  // An exact count: the estimated count can read 0 after an unclean shutdown.
  if ((await ChildProfile.countDocuments()) > 0) return false
  await insertSeed()
  return true
}

// Wipes every collection and writes the demo data again (npm run db:seed).
export async function reseed() {
  await Promise.all([ChildProfile.deleteMany({}), Adult.deleteMany({}), Round.deleteMany({})])
  await insertSeed()
}
