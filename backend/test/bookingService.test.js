import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createBookingService,
  deriveStatus,
  isInHouseOn,
  nights,
  viewToDateBounds,
} from '../src/services/bookingService.js'
import { orderBy } from '../src/repositories/bookingRepository.js'

const stay = { checkIn: '2026-03-10', checkOut: '2026-03-12' }

const checkedIn = { ...stay, checkedInAt: '2026-03-10T15:02:00' }
const checkedOut = { ...checkedIn, checkedOutAt: '2026-03-12T10:41:00' }

test('005 FR-004: upcoming before the arrival day', () => {
  assert.equal(deriveStatus(stay, '2026-03-09'), 'upcoming')
})

test('005 FR-004: arriving on the arrival day until checked in, then in house', () => {
  assert.equal(deriveStatus(stay, '2026-03-10'), 'arriving')
  assert.equal(deriveStatus(checkedIn, '2026-03-10'), 'in_house')
})

test('005 FR-003: a stay that began before today is in house without a check-in registration', () => {
  assert.equal(deriveStatus(stay, '2026-03-11'), 'in_house')
})

test('005 FR-004: departing on the departure day until checked out, then checked out', () => {
  assert.equal(deriveStatus(checkedIn, '2026-03-12'), 'departing')
  assert.equal(deriveStatus(checkedOut, '2026-03-12'), 'checked_out')
})

test('005 FR-003: departed after the departure day, with or without a check-out registration', () => {
  assert.equal(deriveStatus(stay, '2026-03-13'), 'departed')
  assert.equal(deriveStatus(checkedOut, '2026-03-13'), 'departed')
})

// Mirrors the repository's SQL conditions, so the views can be checked against deriveStatus
const withinBounds = (booking, { checkInAfter, checkInOnOrBefore, checkOutAfter, checkOutOnOrBefore }) =>
  (!checkInAfter || booking.checkIn > checkInAfter) &&
  (!checkInOnOrBefore || booking.checkIn <= checkInOnOrBefore) &&
  (!checkOutAfter || booking.checkOut > checkOutAfter) &&
  (!checkOutOnOrBefore || booking.checkOut <= checkOutOnOrBefore)

test('FR-001: a booking is in exactly one view, the one its status belongs to', () => {
  const viewOfStatus = {
    upcoming: 'upcoming',
    arriving: 'in_house',
    in_house: 'in_house',
    departing: 'departed',
    departed: 'departed',
  }
  for (const today of ['2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13']) {
    const views = ['upcoming', 'in_house', 'departed'].filter((view) =>
      withinBounds(stay, viewToDateBounds(view, today)),
    )
    assert.deepEqual(views, [viewOfStatus[deriveStatus(stay, today)]], `today ${today}`)
  }
})

test('FR-001: 10–12 March is 2 nights', () => {
  assert.equal(nights('2026-03-10', '2026-03-12'), 2)
})

test('FR-002: a guest is in house on the arrival day but not on the departure day', () => {
  assert.equal(isInHouseOn(stay, '2026-03-10'), true)
  assert.equal(isInHouseOn(stay, '2026-03-12'), false)
})

const ONE_SEASON = [{ seasonId: 1, seasonName: 'Lavsæson', startDate: '2026-01-01', endDate: '2026-12-31' }]

// Two rooms of one type (capacity 2), one season at 500 kr; the fakes record what the service asks for
function fakeService({
  overlappingRoomIds = [],
  existing,
  satisfactionRows = 1,
  total = 0,
  periods = ONE_SEASON,
  prices = new Map([[1, 50000]]),
  sales = { totalOre: 0, rows: [] },
} = {}) {
  const calls = { list: [], overlap: [], insert: [], update: [], satisfaction: [], checkIn: [], checkOut: [] }
  const service = createBookingService({
    bookingRepo: {
      list: async (filters) => (calls.list.push(filters), []),
      summary: async () => ({ total, totalPriceOre: 0 }),
      count: async () => 0,
      findById: async (id) => (id === existing?.id ? existing : { id, ...stay }),
      insertBooking: async (conn, booking) => (calls.insert.push(booking), 1),
      updateBooking: async (conn, id, booking) => calls.update.push(booking),
      updateSatisfaction: async (id, score) => (calls.satisfaction.push({ id, score }), satisfactionRows),
      markCheckedIn: async (id) => (calls.checkIn.push(id), 1),
      markCheckedOut: async (id) => (calls.checkOut.push(id), 1),
    },
    roomRepo: {
      getRoomType: async (id) => (id === 1 ? { id: 1, name: 'Dobbeltværelse', capacity: 2 } : null),
      listRoomTypes: async () => [{ id: 1, availableRooms: 2 - overlappingRoomIds.length }],
      lockRoomsOfType: async () => [
        { id: 11, roomNumber: '101' },
        { id: 12, roomNumber: '102' },
      ],
      findOverlappingRoomIds: async (conn, roomIds, checkIn, checkOut, excludeBookingId) => {
        calls.overlap.push({ excludeBookingId })
        return overlappingRoomIds
      },
    },
    pricingRepo: {
      getPeriods: async () => periods,
      getPrices: async () => prices,
    },
    referenceRepo: { countryExists: async (code) => code === 'DK' },
    barRepo: { listSales: async () => sales },
    withTransaction: (fn) => fn({}),
    today: () => '2026-03-01',
  })
  return { service, calls }
}

const input = { firstName: 'Jens', familyName: 'Hansen', countryCode: 'DK', roomTypeId: 1, guestCount: 2, ...stay }

const page = { sort: 'checkIn', page: 1, pageSize: 50 }
const dateBoundsOf = ({ checkInAfter, checkInOnOrBefore, checkOutAfter, checkOutOnOrBefore }) => ({
  checkInAfter,
  checkInOnOrBefore,
  checkOutAfter,
  checkOutOnOrBefore,
})

test('FR-002: q or date ignores the view and date means in house on that date', async () => {
  const { service, calls } = fakeService()
  await service.listBookings({ ...page, date: '2026-03-11', view: 'upcoming' })
  await service.listBookings({ ...page, q: 'jens', view: 'departed' })
  assert.deepEqual(dateBoundsOf(calls.list[0]), {
    checkInAfter: undefined,
    checkInOnOrBefore: '2026-03-11',
    checkOutAfter: '2026-03-11',
    checkOutOnOrBefore: undefined,
  })
  assert.deepEqual(dateBoundsOf(calls.list[1]), dateBoundsOf({}))
  assert.equal(calls.list[1].order, 'asc')
})

test('005 FR-007: the period filter keeps stays overlapping it, i.e. checkIn <= to and checkOut > from', async () => {
  const { service, calls } = fakeService()
  await service.listBookings({ ...page, view: 'all', from: '2026-05-01', to: '2026-05-31' })
  assert.equal(calls.list[0].checkInOnOrBefore, '2026-05-31')
  assert.equal(calls.list[0].checkOutAfter, '2026-05-01')
})

test('005 FR-005: a page after the last gives the last page', async () => {
  // 120 bookings at 50 per page = 3 pages, so page 9 is page 3 from booking 101
  const { service, calls } = fakeService({ total: 120 })
  const result = await service.listBookings({ ...page, view: 'all', page: 9 })
  assert.deepEqual([result.page, result.pageCount], [3, 3])
  assert.deepEqual([calls.list[0].limit, calls.list[0].offset], [50, 100])
})

test('005 FR-005: no matches is still one page', async () => {
  const { service, calls } = fakeService({ total: 0 })
  const result = await service.listBookings({ ...page, view: 'all', page: 2 })
  assert.deepEqual([result.page, result.pageCount], [1, 1])
  assert.equal(calls.list[0].offset, 0)
})

test('005 FR-016: a number in q also searches booking id and room number, a name does not', async () => {
  const { service, calls } = fakeService()
  await service.listBookings({ ...page, q: '305' })
  await service.listBookings({ ...page, q: 'jens 305' })
  assert.equal(calls.list[0].searchNumber, '305')
  assert.equal(calls.list[1].searchNumber, undefined)
})

test('005 FR-006: departed defaults to newest first, and nearest always sorts ascending', async () => {
  const { service, calls } = fakeService()
  await service.listBookings({ ...page, view: 'departed' })
  await service.listBookings({ ...page, view: 'departed', order: 'asc' })
  await service.listBookings({ ...page, q: 'jens', sort: 'nearest', order: 'desc' })
  assert.deepEqual(
    calls.list.map((filters) => filters.order),
    ['desc', 'asc', 'asc'],
  )
})

test('005 R4: an unknown sort never reaches SQL; it falls back to check-in with id as tiebreaker', () => {
  assert.equal(orderBy({ sort: 'b.id; DROP TABLE bookings', order: 'desc' }).sql, 'b.check_in DESC, b.id DESC')
  assert.equal(orderBy({ sort: '__proto__' }).sql, 'b.check_in ASC, b.id ASC')
})

test('005 FR-016: nearest sorts by distance from today, which is a parameter, not SQL text', () => {
  assert.deepEqual(orderBy({ sort: 'nearest', order: 'asc', today: '2026-03-01' }), {
    sql: 'ABS(DATEDIFF(b.check_in, ?)) ASC, b.id ASC',
    params: ['2026-03-01'],
  })
})

test('FR-006: rejects more guests than the room type holds', async () => {
  const { service } = fakeService()
  await assert.rejects(service.createBooking({ ...input, guestCount: 3 }, 'backoffice'), {
    code: 'CAPACITY_EXCEEDED',
    field: 'guestCount',
  })
})

test('FR-007: rejects booking when every room of the type is taken', async () => {
  const { service, calls } = fakeService({ overlappingRoomIds: [11, 12] })
  await assert.rejects(service.createBooking(input, 'backoffice'), { code: 'ROOM_TYPE_FULLY_BOOKED' })
  assert.equal(calls.insert.length, 0)
})

test('FR-007: assigns the lowest free room number', async () => {
  const { service, calls } = fakeService({ overlappingRoomIds: [11] })
  await service.createBooking(input, 'backoffice')
  assert.equal(calls.insert[0].roomId, 12)
  assert.equal(calls.insert[0].totalPriceOre, 100000) // 2 nights × 500
})

test('FR-003: rejects a departure before arrival', async () => {
  const { service } = fakeService()
  await assert.rejects(service.createBooking({ ...input, checkOut: '2026-03-09' }, 'backoffice'), {
    code: 'VALIDATION_ERROR',
    field: 'checkOut',
  })
})

test('004 FR-006: rejects a first name of only spaces', async () => {
  const { service } = fakeService()
  await assert.rejects(service.createBooking({ ...input, firstName: '   ' }, 'backoffice'), {
    code: 'VALIDATION_ERROR',
    field: 'firstName',
  })
})

test('004 FR-006: rejects a family name of only spaces', async () => {
  const { service } = fakeService()
  await assert.rejects(service.createBooking({ ...input, familyName: '   ' }, 'backoffice'), {
    code: 'VALIDATION_ERROR',
    field: 'familyName',
  })
})

test('004 FR-006: trims first and family name before saving', async () => {
  const { service, calls } = fakeService()
  await service.createBooking({ ...input, firstName: ' Jens ', familyName: '  Hansen ' }, 'backoffice')
  assert.equal(calls.insert[0].firstName, 'Jens')
  assert.equal(calls.insert[0].familyName, 'Hansen')
})

test('FR-007: quote on a sold-out type gives availableRooms 0 instead of failing', async () => {
  const { service } = fakeService({ overlappingRoomIds: [11, 12] })
  const quote = await service.quote({ roomTypeId: 1, ...stay })
  assert.equal(quote.availableRooms, 0)
  assert.equal(quote.total, 1000)
})

const existing = { id: 7, roomId: 12, ...stay }

test('FR-016: an edited booking keeps its room when it is still free', async () => {
  const { service, calls } = fakeService({ existing })
  await service.updateBooking(7, { ...input, checkOut: '2026-03-13' })
  assert.equal(calls.update[0].roomId, 12)
  assert.equal(calls.update[0].totalPriceOre, 150000) // 3 nights × 500
})

test('FR-016: an edited booking moves to another room when its own is taken', async () => {
  const { service, calls } = fakeService({ existing, overlappingRoomIds: [12] })
  await service.updateBooking(7, input)
  assert.equal(calls.update[0].roomId, 11)
})

test('FR-004: an edited booking does not overlap with itself', async () => {
  const { service, calls } = fakeService({ existing })
  await service.updateBooking(7, input)
  assert.equal(calls.overlap[0].excludeBookingId, 7)
})

test('FR-007: editing into a fully booked type is rejected and nothing is saved', async () => {
  const { service, calls } = fakeService({ existing, overlappingRoomIds: [11, 12] })
  await assert.rejects(service.updateBooking(7, input), { code: 'ROOM_TYPE_FULLY_BOOKED' })
  assert.equal(calls.update.length, 0)
})

// fakeService's today is 2026-03-01
const departingToday = { id: 8, checkIn: '2026-02-27', checkOut: '2026-03-01' }

test('FR-011 (003): rejects a score before the departure day', async () => {
  const { service, calls } = fakeService({ existing: { ...departingToday, checkOut: '2026-03-02' } })
  await assert.rejects(service.registerSatisfaction(8, 4), {
    code: 'BOOKING_NOT_DEPARTED',
    status: 422,
    field: 'score',
  })
  assert.equal(calls.satisfaction.length, 0)
})

test('FR-011 (003): accepts a score on the departure day', async () => {
  const { service, calls } = fakeService({ existing: departingToday })
  await service.registerSatisfaction(8, 4)
  assert.deepEqual(calls.satisfaction, [{ id: 8, score: 4 }])
})

test('FR-011 (003): NOT_FOUND when the booking was deleted in the meantime', async () => {
  const { service } = fakeService({ existing: departingToday, satisfactionRows: 0 })
  await assert.rejects(service.registerSatisfaction(8, 4), { code: 'NOT_FOUND' })
})

// fakeService's today is 2026-03-01
test('005 FR-003: check-in on the arrival day is saved', async () => {
  const { service, calls } = fakeService({ existing: { id: 9, checkIn: '2026-03-01', checkOut: '2026-03-03' } })
  await service.checkIn(9)
  assert.deepEqual(calls.checkIn, [9])
})

test('005 FR-003: a second check-in is rejected', async () => {
  const existing = { id: 9, checkIn: '2026-03-01', checkOut: '2026-03-03', checkedInAt: '2026-03-01T14:00:00' }
  const { service, calls } = fakeService({ existing })
  await assert.rejects(service.checkIn(9), { code: 'INVALID_STATUS', status: 422 })
  assert.equal(calls.checkIn.length, 0)
})

test('005 FR-003: check-in on another day than the arrival day is rejected', async () => {
  const { service, calls } = fakeService({ existing: { id: 9, checkIn: '2026-03-02', checkOut: '2026-03-04' } })
  await assert.rejects(service.checkIn(9), { code: 'INVALID_STATUS' })
  assert.equal(calls.checkIn.length, 0)
})

test('005 FR-003: check-out on the departure day is saved, a second one is rejected', async () => {
  const departing = { id: 9, checkIn: '2026-02-27', checkOut: '2026-03-01' }
  const first = fakeService({ existing: departing })
  await first.service.checkOut(9)
  assert.deepEqual(first.calls.checkOut, [9])
  const again = fakeService({ existing: { ...departing, checkedOutAt: '2026-03-01T10:00:00' } })
  await assert.rejects(again.service.checkOut(9), { code: 'INVALID_STATUS' })
})

test('005 FR-003: check-out before the departure day is rejected', async () => {
  const { service, calls } = fakeService({ existing: { id: 9, checkIn: '2026-02-27', checkOut: '2026-03-02' } })
  await assert.rejects(service.checkOut(9), { code: 'INVALID_STATUS' })
  assert.equal(calls.checkOut.length, 0)
})

test('005 R3: a score is accepted after check-out on the departure day', async () => {
  const { service, calls } = fakeService({
    existing: { ...departingToday, checkedInAt: '2026-02-27T15:00:00', checkedOutAt: '2026-03-01T10:00:00' },
  })
  await service.registerSatisfaction(8, 5)
  assert.deepEqual(calls.satisfaction, [{ id: 8, score: 5 }])
})

// 30 and 31 March in low season (500 today), 1 April in high season (800 today).
// The booking was made when prices were half: the frozen 900 is split 250 + 250 + 400.
const SEASON_CHANGE = [
  { seasonId: 1, seasonName: 'Lavsæson', startDate: '2026-01-01', endDate: '2026-03-31' },
  { seasonId: 2, seasonName: 'Højsæson', startDate: '2026-04-01', endDate: '2026-08-31' },
]
const folioBooking = { id: 5, roomTypeId: 1, checkIn: '2026-03-30', checkOut: '2026-04-02', totalPriceOre: 90000 }
const saleRow = {
  id: 1,
  drinkId: 2,
  drinkName: 'Espresso Martini',
  category: 'Cocktail',
  quantity: 2,
  unitPriceOre: 10500,
  soldAt: '2026-03-31T21:14:05',
  bookingId: 5,
  roomNumber: '305',
}
const folioService = () =>
  fakeService({
    existing: folioBooking,
    periods: SEASON_CHANGE,
    prices: new Map([
      [1, 50000],
      [2, 80000],
    ]),
    sales: { totalOre: 21000, rows: [saleRow] },
  }).service

test('005 FR-008: each night gets its share of the frozen price by its season, and the nights sum to it', async () => {
  const { nights: folioNights, booking } = await folioService().getFolio(5)
  assert.deepEqual(folioNights, [
    { date: '2026-03-30', season: 'Lavsæson', price: 250 },
    { date: '2026-03-31', season: 'Lavsæson', price: 250 },
    { date: '2026-04-01', season: 'Højsæson', price: 400 },
  ])
  assert.equal(booking.totalPrice, 900)
})

test('005 FR-009: the bill is the stay plus the bar sales on the booking', async () => {
  // 900 for the stay + 2 × 105 at the bar = 1110
  const { barSales, bill } = await folioService().getFolio(5)
  assert.equal(barSales.total, 210)
  assert.equal(barSales.items[0].amount, 210)
  assert.deepEqual(bill, { stay: 900, bar: 210, total: 1110 })
})
