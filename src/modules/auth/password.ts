import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scrypt = promisify(_scrypt)

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derived = (await scrypt(password, salt, 64)) as Buffer
  return `scrypt$${salt}$${derived.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, salt, hash] = stored.split('$')
  if (algo !== 'scrypt' || !salt || !hash) return false
  const derived = (await scrypt(password, salt, 64)) as Buffer
  const hashBuf = Buffer.from(hash, 'hex')
  if (hashBuf.length !== derived.length) return false
  return timingSafeEqual(hashBuf, derived)
}
