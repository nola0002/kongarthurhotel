import { AppError } from '../errors.js'
import { toKr } from '../money.js'
import { calculateStayPrice } from './pricing.js'

const DAY_MS = 86_400_000

export const nights = (checkIn, checkOut) => (Date.parse(checkOut) - Date.parse(checkIn)) / DAY_MS

// The only definition of "the guest stays at the hotel on day d" (R12)
export const isInHouseOn = (booking, d) => booking.checkIn <= d && d < booking.checkOut

export function deriveStatus(booking, today) {
  if (today < booking.checkIn) return 'upcoming'
  if (today === booking.checkIn) return 'arriving'
  if (isInHouseOn(booking, today)) return 'in_house'
  return 'departed'
}

// The views are disjoint, so upcoming + in_house + departed = all (R12)
const VIEW_BOUNDS = {
  upcoming: (today) => ({ checkInAfter: today }),
  in_house: (today) => ({ checkInOnOrBefore: today, checkOutAfter: today }),
  departed: (today) => ({ checkOutOnOrBefore: today }),
  all: () => ({}),
}
export const viewToDateBounds = (view, today) => VIEW_BOUNDS[view](today)

// ISO dates compare correctly as strings
const later = (a, b) => (!a || (b && b > a) ? b : a)
const earlier = (a, b) => (!a || (b && b < a) ? b : a)
const tightest = (a, b) => ({
  checkInAfter: later(a.checkInAfter, b.checkInAfter),
  checkInOnOrBefore: earlier(a.checkInOnOrBefore, b.checkInOnOrBefore),
  checkOutAfter: later(a.checkOutAfter, b.checkOutAfter),
  checkOutOnOrBefore: earlier(a.checkOutOnOrBefore, b.checkOutOnOrBefore),
})

export const toApi = (row, today) => ({
  id: row.id,
  firstName: row.firstName,
  familyName: row.familyName,
  country: { code: row.countryCode, name: row.countryName },
  roomType: { id: row.roomTypeId, name: row.roomTypeName },
  room: { id: row.roomId, number: row.roomNumber },
  checkIn: row.checkIn,
  checkOut: row.checkOut,
  nights: nights(row.checkIn, row.checkOut),
  guestCount: row.guestCount,
  totalPrice: toKr(row.totalPriceOre),
  source: row.source,
  status: deriveStatus(row, today),
  satisfactionScore: row.satisfactionScore,
  createdAt: row.createdAt,
})

const notFound = () => new AppError('NOT_FOUND', 'Bookingen findes ikke længere')

export function createBookingService({ bookingRepo, roomRepo, pricingRepo, referenceRepo, withTransaction, today }) {
  // quote() skips name and country: the form asks for a price before they are filled in
  async function validate(
    { firstName, familyName, countryCode, roomTypeId, checkIn, checkOut, guestCount },
    { isQuote = false } = {},
  ) {
    const names = { firstName: firstName?.trim(), familyName: familyName?.trim() }
    if (!isQuote && !names.firstName) {
      throw new AppError('VALIDATION_ERROR', 'Fornavn skal udfyldes', { field: 'firstName' })
    }
    if (!isQuote && !names.familyName) {
      throw new AppError('VALIDATION_ERROR', 'Efternavn skal udfyldes', { field: 'familyName' })
    }
    if (checkOut <= checkIn) {
      throw new AppError('VALIDATION_ERROR', 'Afrejse skal være efter ankomst', { field: 'checkOut' })
    }
    if (!isQuote && !(await referenceRepo.countryExists(countryCode))) {
      throw new AppError('VALIDATION_ERROR', 'Ukendt land', { field: 'countryCode' })
    }
    const roomType = await roomRepo.getRoomType(roomTypeId)
    if (!roomType) throw new AppError('VALIDATION_ERROR', 'Ukendt værelsestype', { field: 'roomTypeId' })
    if (guestCount > roomType.capacity) {
      throw new AppError(
        'CAPACITY_EXCEEDED',
        `Antal gæster overstiger værelsestypens kapacitet (${roomType.capacity})`,
        { field: 'guestCount' },
      )
    }
    return { names, roomType }
  }

  async function priceStay(conn, roomTypeId, checkIn, checkOut) {
    const [periods, prices] = await Promise.all([
      pricingRepo.getPeriods(conn, checkIn, checkOut),
      pricingRepo.getPrices(conn, roomTypeId),
    ])
    return calculateStayPrice({ checkIn, checkOut, periods, prices })
  }

  // Must run inside withTransaction: the room lock is what stops two bookings getting the last room (FR-007)
  async function assignRoomAndPrice(conn, { roomType, checkIn, checkOut, excludeBookingId = null, currentRoomId }) {
    const rooms = await roomRepo.lockRoomsOfType(conn, roomType.id)
    const taken = new Set(
      await roomRepo.findOverlappingRoomIds(
        conn,
        rooms.map((room) => room.id),
        checkIn,
        checkOut,
        excludeBookingId,
      ),
    )
    const free = rooms.filter((room) => !taken.has(room.id))
    // Simplification: assigns the lowest free room number; an edited booking keeps its room if still free (FR-016)
    const room = free.find((r) => r.id === currentRoomId) ?? free[0]
    if (!room) {
      throw new AppError('ROOM_TYPE_FULLY_BOOKED', `Ingen ledige værelser af typen ${roomType.name} i perioden`)
    }
    const { totalOre } = await priceStay(conn, roomType.id, checkIn, checkOut)
    return { roomId: room.id, totalPriceOre: totalOre }
  }

  async function getBooking(id) {
    const row = await bookingRepo.findById(id)
    if (!row) throw notFound()
    return toApi(row, today())
  }

  return {
    getBooking,

    async listBookings({ q, date, view, limit }) {
      const day = today()
      const dateBounds = date ? viewToDateBounds('in_house', date) : {}
      const filtersFor = (v) => ({ q, ...tightest(dateBounds, viewToDateBounds(v, day)) })
      const activeView = q || date ? 'all' : view
      const [result, upcoming, inHouse, departed] = await Promise.all([
        bookingRepo.list({ ...filtersFor(activeView), limit, order: activeView === 'departed' ? 'desc' : 'asc' }),
        ...['upcoming', 'in_house', 'departed'].map((v) => bookingRepo.count(filtersFor(v))),
      ])
      return {
        total: result.total,
        totalPrice: toKr(result.totalPriceOre),
        counts: { upcoming, in_house: inHouse, departed, all: upcoming + inHouse + departed },
        items: result.rows.map((row) => toApi(row, day)),
      }
    },

    async listRoomTypes(query) {
      const rows = await roomRepo.listRoomTypes(query)
      return rows.map(({ fromPriceOre, ...row }) => ({ ...row, fromPrice: toKr(fromPriceOre) }))
    },

    listCountries: () => referenceRepo.listCountries(),

    // Never locks and never 409: a sold-out type is shown as availableRooms 0 (contract)
    async quote({ roomTypeId, checkIn, checkOut, guestCount, excludeBookingId }) {
      await validate({ roomTypeId, checkIn, checkOut, guestCount }, { isQuote: true })
      const [price, roomTypes] = await Promise.all([
        withTransaction((conn) => priceStay(conn, roomTypeId, checkIn, checkOut)),
        roomRepo.listRoomTypes({ checkIn, checkOut, excludeBookingId }),
      ])
      return {
        nights: price.nights,
        lines: price.lines.map((line) => ({
          season: line.season,
          nights: line.nights,
          pricePerNight: toKr(line.pricePerNightOre),
          subtotal: toKr(line.subtotalOre),
        })),
        total: toKr(price.totalOre),
        availableRooms: roomTypes.find((type) => type.id === roomTypeId)?.availableRooms ?? 0,
      }
    },

    async createBooking(input, source) {
      const { names, roomType } = await validate(input)
      const { countryCode, checkIn, checkOut, guestCount } = input
      const id = await withTransaction(async (conn) => {
        const assigned = await assignRoomAndPrice(conn, { roomType, checkIn, checkOut })
        return bookingRepo.insertBooking(conn, {
          ...names,
          countryCode,
          checkIn,
          checkOut,
          guestCount,
          ...assigned,
          source,
        })
      })
      return getBooking(id)
    },

    async updateBooking(id, input) {
      const existing = await bookingRepo.findById(id)
      if (!existing) throw notFound()
      const { names, roomType } = await validate(input)
      const { countryCode, checkIn, checkOut, guestCount } = input
      await withTransaction(async (conn) => {
        const assigned = await assignRoomAndPrice(conn, {
          roomType,
          checkIn,
          checkOut,
          excludeBookingId: id,
          currentRoomId: existing.roomId,
        })
        await bookingRepo.updateBooking(conn, id, {
          ...names,
          countryCode,
          checkIn,
          checkOut,
          guestCount,
          ...assigned,
        })
      })
      return getBooking(id)
    },

    // The guest can only rate the stay once it is over: on or after the departure day (FR-011 (003))
    async registerSatisfaction(id, score) {
      const booking = await bookingRepo.findById(id)
      if (!booking) throw notFound()
      if (deriveStatus(booking, today()) !== 'departed') {
        throw new AppError('BOOKING_NOT_DEPARTED', 'Tilfredshed kan først registreres på afrejsedagen', {
          field: 'score',
        })
      }
      if ((await bookingRepo.updateSatisfaction(id, score)) === 0) throw notFound()
      return getBooking(id)
    },

    async deleteBooking(id) {
      if ((await bookingRepo.deleteById(id)) === 0) throw notFound()
    },
  }
}
