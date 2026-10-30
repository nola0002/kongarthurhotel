import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createBookingService,
  deriveStatus,
  isInHouseOn,
  nights,
  viewToDateBounds,
} from '../src/services/bookingService.js'

const stay = { checkIn: '2026-03-10', checkOut: '2026-03-12' }

test('FR-001: status is derived from the dates and today', () => {
  assert.equal(deriveStatus(stay, '2026-03-09'), 'upcoming')
  assert.equal(deriveStatus(stay, '2026-03-10'), 'arriving')
  assert.equal(deriveStatus(stay, '2026-03-11'), 'in_house')
  assert.equal(deriveStatus(stay, '2026-03-12'), 'departed')
})

// Mirrors the repository's SQL conditions, so the views can be checked against deriveStatus
const withinBounds = (booking, { checkInAfter, checkInOnOrBefore, checkOutAfter, checkOutOnOrBefore }) =>
  (!checkInAfter || booking.checkIn > checkInAfter) &&
  (!checkInOnOrBefore || booking.checkIn <= checkInOnOrBefore) &&
  (!checkOutAfter || booking.checkOut > checkOutAfter) &&
  (!checkOutOnOrBefore || booking.checkOut <= checkOutOnOrBefore)

test('FR-001: a booking is in exactly one view, the one its status belongs to', () => {
  const viewOfStatus = { upcoming: 'upcoming', arriving: 'in_house', in_house: 'in_house', departed: 'departed' }
  for (const today of ['2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12']) {
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

// Two rooms of one type (capacity 2), one season at 500 kr; the fakes record what the service asks for
function fakeService({ overlappingRoomIds = [], existing, satisfactionRows = 1 } = {}) {
  const calls = { list: [], overlap: [], insert: [], update: [], satisfaction: [] }
  const service = createBookingService({
    bookingRepo: {
      list: async (filters) => (calls.list.push(filters), { total: 0, totalPriceOre: 0, rows: [] }),
      count: async () => 0,
      findById: async (id) => (id === existing?.id ? existing : { id, ...stay }),
      insertBooking: async (conn, booking) => (calls.insert.push(booking), 1),
      updateBooking: async (conn, id, booking) => calls.update.push(booking),
      updateSatisfaction: async (id, score) => (calls.satisfaction.push({ id, score }), satisfactionRows),
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
      getPeriods: async () => [{ seasonId: 1, seasonName: 'Lavsæson', startDate: '2026-01-01', endDate: '2026-12-31' }],
      getPrices: async () => new Map([[1, 50000]]),
    },
    referenceRepo: { countryExists: async (code) => code === 'DK' },
    withTransaction: (fn) => fn({}),
    today: () => '2026-03-01',
  })
  return { service, calls }
}

const input = { firstName: 'Jens', familyName: 'Hansen', countryCode: 'DK', roomTypeId: 1, guestCount: 2, ...stay }

test('FR-002: q or date ignores the view and date means in house on that date', async () => {
  const { service, calls } = fakeService()
  await service.listBookings({ date: '2026-03-11', view: 'upcoming', limit: 100 })
  await service.listBookings({ q: 'jens', view: 'departed', limit: 100 })
  assert.deepEqual(calls.list[0], {
    q: undefined,
    checkInAfter: undefined,
    checkInOnOrBefore: '2026-03-11',
    checkOutAfter: '2026-03-11',
    checkOutOnOrBefore: undefined,
    limit: 100,
    order: 'asc',
  })
  assert.deepEqual(calls.list[1], {
    q: 'jens',
    checkInAfter: undefined,
    checkInOnOrBefore: undefined,
    checkOutAfter: undefined,
    checkOutOnOrBefore: undefined,
    limit: 100,
    order: 'asc',
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
