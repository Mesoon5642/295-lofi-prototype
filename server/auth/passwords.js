// Password hashing with Node's built-in scrypt, so no extra dependency is needed.
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)
const KEY_LENGTH = 64

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = await scryptAsync(password, salt, KEY_LENGTH)
  return { passwordHash: hash.toString('hex'), passwordSalt: salt }
}

export async function verifyPassword(password, { passwordHash, passwordSalt }) {
  if (typeof password !== 'string' || !passwordHash || !passwordSalt) return false
  const expected = Buffer.from(passwordHash, 'hex')
  const actual = await scryptAsync(password, passwordSalt, KEY_LENGTH)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
