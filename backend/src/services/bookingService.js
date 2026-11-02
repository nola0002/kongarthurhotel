import { AppError } from '../errors.js'
import { toKr } from '../money.js'
import { allocateRevenue } from './analyticsService.js'
import { toApi as toApiSale } from './barService.js'
import { calculateStayPrice, eachNight, periodOn } from './pricing.js'

const DAY_MS = 86_400_000

export const nights = (checkIn, checkOut) => (Date.parse(checkOut) - Date.parse(checkIn)) / DAY_MS

// The only definition of "the guest stays at the hotel on day d" (R12)
export const isInHouseOn = (booking, d) => booking.checkIn <= d && d < booking.checkOut

// A stay that began before today counts as checked in and one that ended before today as checked out, because
// only today's arrivals and departures are ever registered (005 FR-003, R3)
export function deriveStatus({ checkIn, checkOut, checkedInAt, checkedOutAt }, today) {
  if (today < checkIn) return 'upcoming'
  if (today === checkIn && !checkedInAt) return 'arriving'
  if (today < checkOut) return 'in_house'
  if (today === checkOut) return checkedOutAt ? 'checked_out' : 'departing'
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
  checkedInAt: row.checkedInAt,
  checkedOutAt: row.checkedOutAt,
  createdAt: row.createdAt,
})

const notFound = () => new AppError('NOT_FOUND', 'Bookingen findes ikke længere')

export function createBookingService({
  bookingRepo,
  roomRepo,
  pricingRepo,
  referenceRepo,
  barRepo,
  withTransaction,
  today,
}) {
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

  async function findOrFail(id) {
    const row = await bookingRepo.findById(id)
    if (!row) throw notFound()
    return row
  }

  const getBooking = async (id) => toApi(await findOrFail(id), today())

  // 005 FR-003: a registration is only valid on the day itself, so the status decides
  async function register(id, requiredStatus, mark, message) {
    if (deriveStatus(await findOrFail(id), today()) !== requiredStatus) throw new AppError('INVALID_STATUS', message)
    if ((await mark(id)) === 0) throw notFound()
    return getBooking(id)
  }

  return {
    getBooking,

    // 005 FR-005–FR-007: counts use every filter except the view, so the tabs show what each view would hold
    async listBookings({ q, date, view, roomTypeId, countryCode, from, to, sort, order, page, pageSize }) {
      const day = today()
      // A number may be a booking id or a room number, so the command palette finds both (005 FR-016)
      const searchNumber = /^\d+$/.test(q ?? '') ? q : undefined
      const bounds = tightest(date ? viewToDateBounds('in_house', date) : {}, {
        checkInOnOrBefore: to,
        checkOutAfter: from,
      })
      const filtersFor = (v) => ({
        q,
        searchNumber,
        roomTypeId,
        countryCode,
        ...tightest(bounds, viewToDateBounds(v, day)),
      })
      const activeView = q || date ? 'all' : view
      const [summary, upcoming, inHouse, departed] = await Promise.all([
        bookingRepo.summary(filtersFor(activeView)),
        ...['upcoming', 'in_house', 'departed'].map((v) => bookingRepo.count(filtersFor(v))),
      ])
      const pageCount = Math.max(1, Math.ceil(summary.total / pageSize))
      // A page after the last gives the last page, e.g. when a filter shrinks the result (contract)
      const currentPage = Math.min(page, pageCount)
      const rows = await bookingRepo.list({
        ...filtersFor(activeView),
        sort,
        order: sort === 'nearest' ? 'asc' : (order ?? (activeView === 'departed' ? 'desc' : 'asc')),
        today: day,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      })
      return {
        total: summary.total,
        totalPrice: toKr(summary.totalPriceOre),
        counts: { upcoming, in_house: inHouse, departed, all: upcoming + inHouse + departed },
        page: currentPage,
        pageSize,
        pageCount,
        items: rows.map((row) => toApi(row, day)),
      }
    },

    // 005 FR-008, FR-009: the guest's folio, i.e. the stay night by night, the bar sales and the bill
    async getFolio(id) {
      const row = await findOrFail(id)
      const [[periods, prices], sales] = await Promise.all([
        withTransaction((conn) =>
          Promise.all([
            pricingRepo.getPeriods(conn, row.checkIn, row.checkOut),
            pricingRepo.getPrices(conn, row.roomTypeId),
          ]),
        ),
        barRepo.listSales({ bookingId: id }),
      ])
      const dates = [...eachNight(row.checkIn, row.checkOut)]
      const seasons = dates.map((date) => periodOn(periods, date))
      // R6: same split as BI (002 FR-015), so the nights sum to the frozen price even when the price list changed
      const shares = allocateRevenue(
        row.totalPriceOre,
        seasons.map((period) => prices.get(period?.seasonId) ?? 0),
      )
      return {
        booking: toApi(row, today()),
        nights: dates.map((date, i) => ({
          date,
          season: seasons[i]?.seasonName ?? null,
          price: toKr(shares[i]),
        })),
        barSales: { total: toKr(sales.totalOre), items: sales.rows.map(toApiSale) },
        bill: {
          stay: toKr(row.totalPriceOre),
          bar: toKr(sales.totalOre),
          total: toKr(row.totalPriceOre + sales.totalOre),
        },
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
      const existing = await findOrFail(id)
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

    checkIn: (id) =>
      register(id, 'arriving', bookingRepo.markCheckedIn, 'Kun en booking, der ankommer i dag, kan tjekkes ind'),
    checkOut: (id) =>
      register(id, 'departing', bookingRepo.markCheckedOut, 'Kun en booking, der rejser i dag, kan tjekkes ud'),

    // The guest can only rate the stay once it is over: on or after the departure day, checked out or not
    // (FR-011 (003), 005 R3)
    async registerSatisfaction(id, score) {
      const booking = await findOrFail(id)
      if (today() < booking.checkOut) {
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
