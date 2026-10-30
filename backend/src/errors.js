const STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  ROOM_TYPE_FULLY_BOOKED: 409,
  CAPACITY_EXCEEDED: 422,
  PRICE_NOT_CONFIGURED: 422,
  BOOKING_NOT_IN_HOUSE: 422,
  BOOKING_NOT_DEPARTED: 422,
}

const FIELD_LABELS = {
  firstName: 'Fornavn',
  familyName: 'Efternavn',
  countryCode: 'Land',
  roomTypeId: 'Værelsestype',
  checkIn: 'Ankomst',
  checkOut: 'Afrejse',
  guestCount: 'Antal gæster',
  drinkId: 'Drink',
  quantity: 'Antal',
  bookingId: 'Booking',
  date: 'Dato',
  view: 'Visning',
  limit: 'Antal rækker',
  q: 'Søgning',
  id: 'Id',
  excludeBookingId: 'Booking',
  username: 'Brugernavn',
  password: 'Adgangskode',
  from: 'Fra',
  days: 'Antal dage',
  score: 'Tilfredshed',
}

export class AppError extends Error {
  constructor(code, message, { field, status } = {}) {
    super(message)
    this.code = code
    this.field = field
    this.status = status ?? STATUS[code] ?? 500
  }
}

// Validator, Express and body-parser errors never reach the client raw: everything uses the contract's Error format
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, field: err.field } })
  }
  const status = err.status ?? err.statusCode
  if (status >= 400 && status < 500) {
    if (status === 404) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Findes ikke' } })
    if (status === 401)
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Du skal være logget ind' } })
    const path = err.errors?.[0]?.path ?? ''
    const field = /^\/(body|query|params)\//.test(path) ? path.split('/').pop() : undefined
    const message = field ? `Ugyldig værdi i feltet ${FIELD_LABELS[field] ?? field}` : 'Ugyldig forespørgsel'
    return res.status(status).json({ error: { code: 'VALIDATION_ERROR', message, field } })
  }
  console.error(err)
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Der skete en fejl. Prøv igen.' } })
}
