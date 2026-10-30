import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { AppError } from '../errors.js'

const scrypt = promisify(scryptCallback)
const KEY_LENGTH = 64

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = await scrypt(password, salt, KEY_LENGTH)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export async function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$')
  const expected = Buffer.from(hashHex ?? '', 'hex')
  if (scheme !== 'scrypt' || !saltHex || expected.length !== KEY_LENGTH) return false
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), KEY_LENGTH)
  return timingSafeEqual(actual, expected)
}

export function createAuthService({ userRepo }) {
  // An unknown user is checked against a throwaway hash, so the response time does not reveal it either
  const dummyHash = hashPassword(randomBytes(16).toString('hex'))

  return {
    async login(username, password) {
      const user = await userRepo.findByUsername(username)
      // Same message for unknown user and wrong password, so usernames cannot be probed (FR-015)
      const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyHash))
      if (!user || !valid) {
        throw new AppError('UNAUTHORIZED', 'Forkert brugernavn eller adgangskode')
      }
      return { id: user.id, username: user.username }
    },

    // The account is not in the seed, so no password hash ever lands in git (R6)
    async ensureSeedUser() {
      if ((await userRepo.countUsers()) > 0) return
      const passwordHash = await hashPassword(process.env.SEED_PASSWORD)
      await userRepo.insertUser({ username: process.env.SEED_USERNAME, passwordHash })
    },
  }
}
