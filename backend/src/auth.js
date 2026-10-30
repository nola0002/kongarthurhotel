import { timingSafeEqual } from 'node:crypto'
import { AppError } from './errors.js'

export function requireSession(req, res, next) {
  if (!req.session?.userId) throw new AppError('UNAUTHORIZED', 'Du skal være logget ind')
  next()
}

// Every API key is checked here, so the booking system key and the BI key can never be checked differently
function isValidKey(key, envName) {
  const given = Buffer.from(key)
  const expected = Buffer.from(process.env[envName] ?? '')
  // Fails closed: a missing or short key in .env rejects every key instead of accepting a guessable one
  return expected.length >= 32 && given.length === expected.length && timingSafeEqual(given, expected)
}

// Only mounted on POST, PUT and DELETE of bookings: the external booking system may create, change and delete
// bookings, but never read them (KB-T10, 004 FR-013). req.bookingSource is only used by POST; an update keeps the source.
export function allowBookingSystemKey(req, res, next) {
  const key = req.get('X-API-Key')
  if (key === undefined) {
    req.bookingSource = 'backoffice'
    return requireSession(req, res, next)
  }
  if (!isValidKey(key, 'BOOKING_SYSTEM_API_KEY')) throw new AppError('UNAUTHORIZED', 'Ugyldig API-nøgle')
  req.bookingSource = 'booking_system'
  next()
}

// Only mounted on the GET-only /analytics routes, so Tableau's key can read KPIs but never change data (FR-014/FT17).
// The session is still accepted so Swagger's "Try it out" works for a logged-in user.
export function allowBiKey(req, res, next) {
  const header = req.get('Authorization')
  if (header === undefined) return requireSession(req, res, next)
  const key = /^Bearer (.+)$/.exec(header)?.[1]
  if (!key || !isValidKey(key, 'BI_API_KEY')) throw new AppError('UNAUTHORIZED', 'Ugyldig API-nøgle')
  next()
}
