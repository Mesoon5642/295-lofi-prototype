import { readFile } from 'node:fs/promises'
import { hashPassword } from '../auth/passwords.js'
import { Adult, ChildProfile, Image, Round, Session, Word } from '../models/index.js'
import { resetDemoData } from '../repository.js'
import { SEED_ADULTS, SEED_CHILD } from './seedData.js'
import { SEED_IMAGES, SEED_WORDS } from './words.js'

const IMAGE_DIR = new URL('./images/', import.meta.url)

async function insertImages() {
  await Image.insertMany(
    await Promise.all(
      SEED_IMAGES.map(async ({ id, file, contentType, description }) => ({
        _id: id,
        contentType,
        description,
        data: await readFile(new URL(file, IMAGE_DIR)),
      })),
    ),
  )
}

async function insertWords() {
  await Word.insertMany(SEED_WORDS.map(({ word, ...rest }) => ({ _id: word, ...rest })))
}

// Profile, grown-up account, and sample rounds.
async function insertPeople() {
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

// Writes the demo data into whichever parts of the database are empty: images, the
// word list, and (when there are no child profiles) the profile, grown-up account,
// and sample rounds. Safe to call on every server start, and fills in collections
// added since an older database was created. Resolves with what it wrote.
export async function seedIfEmpty() {
  // Exact counts: the estimated count can read 0 after an unclean shutdown.
  const wrote = []
  if ((await Image.countDocuments()) === 0) {
    await insertImages()
    wrote.push('images')
  }
  if ((await Word.countDocuments()) === 0) {
    await insertWords()
    wrote.push('words')
  }
  if ((await ChildProfile.countDocuments()) === 0) {
    await insertPeople()
    wrote.push('profiles, accounts, sample rounds')
  }
  return wrote
}

// Wipes every collection (signing everyone out) and writes the demo data again.
export async function reseed() {
  const models = [ChildProfile, Adult, Round, Session, Word, Image]
  await Promise.all(models.map((model) => model.deleteMany({})))
  await insertImages()
  await insertWords()
  await insertPeople()
}
