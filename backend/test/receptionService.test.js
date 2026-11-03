import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createReceptionService } from '../src/services/receptionService.js'

// Two rooms of type A (Dobbeltværelse) and one of type B (Suite); today is 11 March
const ROOMS = [
  { id: 11, number: '101', roomTypeId: 1, roomType: 'Dobbeltværelse' },
  { id: 12, number: '102', roomTypeId: 1, roomType: 'Dobbeltværelse' },
  { id: 21, number: '201', roomTypeId: 2, roomType: 'Suite' },
]
const TODAY = '2026-03-11'

const stay = (bookingId, roomId, checkIn, checkOut, guestCount = 2, extra = {}) => ({
  bookingId,
  roomId,
  roomTypeId: ROOMS.find((room) => room.id === roomId).roomTypeId,
  firstName: 'Jens',
  familyName: 'Jensen',
  checkIn,
  checkOut,
  guestCount,
  totalPriceOre: 100000,
  ...extra,
})

// Mirror the repositories' SQL conditions, so the service gets what the database would return
const overlaps = (s, from, to) => s.checkIn < to && s.checkOut > from
const withinBounds = (s, { checkInAfter, checkInOnOrBefore, checkOutAfter, checkOutOnOrBefore }) =>
  (!checkInAfter || s.checkIn > checkInAfter) &&
  (!checkInOnOrBefore || s.checkIn <= checkInOnOrBefore) &&
  (!checkOutAfter || s.checkOut > checkOutAfter) &&
  (!checkOutOnOrBefore || s.checkOut <= checkOutOnOrBefore)
const toBookingRow = ({ bookingId, ...s }) => ({ id: bookingId, ...s })

function fakeService(stays = [], barTotalOre = 0) {
  const salesQueries = []
  const service = createReceptionService({
    roomRepo: {
      listRooms: async () => ROOMS,
      listStays: async (from, to) => stays.filter((s) => overlaps(s, from, to)),
    },
    bookingRepo: {
      list: async (filters) => stays.filter((s) => withinBounds(s, filters)).map(toBookingRow),
    },
    barRepo: { listSales: async (filters) => (salesQueries.push(filters), { totalOre: barTotalOre, rows: [] }) },
    today: () => TODAY,
  })
  return { service, salesQueries }
}

const freeOfType = (plan, roomTypeId) => plan.roomTypes.find((type) => type.id === roomTypeId).free

test('FR-007 (003): a departure day counts as free for a new arrival', async () => {
  // 10–13 March in room 101: the 12th is a night, the 13th is the departure day
  const { service } = fakeService([stay(1, 11, '2026-03-10', '2026-03-13')])
  const plan = await service.roomPlan({ from: '2026-03-12', days: 7 })
  assert.deepEqual(freeOfType(plan, 1).slice(0, 2), [1, 2])
})

test('FR-006 (003): a stay that starts before the window only counts on visible nights', async () => {
  // 5–12 March seen from 10 March: occupies the 10th and 11th, nothing after
  const { service } = fakeService([stay(1, 11, '2026-03-05', '2026-03-12')])
  const plan = await service.roomPlan({ from: '2026-03-10', days: 7 })
  assert.deepEqual(freeOfType(plan, 1), [1, 1, 2, 2, 2, 2, 2])
  assert.equal(plan.stays[0].checkIn, '2026-03-05')
})

test('FR-007 (003): a stay only makes its own room type less free', async () => {
  // A suite booked 10–12 March leaves both double rooms free
  const { service } = fakeService([stay(1, 21, '2026-03-10', '2026-03-12')])
  const plan = await service.roomPlan({ from: '2026-03-10', days: 7 })
  assert.deepEqual(freeOfType(plan, 1), [2, 2, 2, 2, 2, 2, 2])
  assert.deepEqual(freeOfType(plan, 2), [0, 0, 1, 1, 1, 1, 1])
})

// On 11 March: 1 arrives, 2 departs, 3 stays over, 4 has not arrived yet
const DAY_STAYS = [
  stay(1, 11, '2026-03-11', '2026-03-13', 2),
  stay(2, 21, '2026-03-09', '2026-03-11', 1),
  stay(3, 12, '2026-03-10', '2026-03-12', 3),
  stay(4, 21, '2026-03-12', '2026-03-14', 4),
]

test('FR-002 (003): arrivals are bookings checking in on the date and departures checking out on it', async () => {
  const overview = await fakeService(DAY_STAYS).service.overview('2026-03-11')
  assert.deepEqual(
    overview.arrivals.map((booking) => booking.id),
    [1],
  )
  assert.deepEqual(
    overview.departures.map((booking) => booking.id),
    [2],
  )
})

test('FR-002 (003): in house counts bookings and guests staying the night, not the departures', async () => {
  // Bookings 1 (2 guests) and 3 (3 guests); booking 2 departs and 4 is not here yet
  const overview = await fakeService(DAY_STAYS).service.overview('2026-03-11')
  assert.deepEqual(overview.inHouse, { bookings: 2, guests: 5 })
})

test('FR-002 (003): free plus occupied equals the rooms of each type', async () => {
  // Both doubles are taken (1 and 3); the suite is free because booking 2 departs today
  const overview = await fakeService(DAY_STAYS).service.overview('2026-03-11')
  assert.deepEqual(overview.rooms, [
    { roomTypeId: 1, roomType: 'Dobbeltværelse', total: 2, occupied: 2, free: 0 },
    { roomTypeId: 2, roomType: 'Suite', total: 1, occupied: 0, free: 1 },
  ])
})

test('FR-002 (003): bar sales total for the date is returned in DKK', async () => {
  const { service, salesQueries } = fakeService([], 124050)
  const overview = await service.overview('2026-03-11')
  assert.equal(overview.barSalesTotal, 1240.5)
  assert.deepEqual(salesQueries, [{ date: '2026-03-11' }])
})

test('FR-005 (003): the plan has "days" dates from "from" and an exclusive "to"', async () => {
  // 14 days from 20 December cross new year: 20/12 … 2/1, and "to" is 3/1
  const plan = await fakeService().service.roomPlan({ from: '2026-12-20', days: 14 })
  assert.equal(plan.to, '2027-01-03')
  assert.equal(plan.dates.length, 14)
  assert.deepEqual([plan.dates[0], plan.dates.at(-1)], ['2026-12-20', '2027-01-02'])
})

test('FR-006 (003): stays keep their own dates and get their status from today', async () => {
  const { service } = fakeService([stay(1, 11, '2026-03-05', '2026-03-12'), stay(2, 12, '2026-03-13', '2026-03-20')])
  const plan = await service.roomPlan({ from: '2026-03-10', days: 7 })
  assert.deepEqual(
    plan.stays.map((s) => [s.bookingId, s.checkIn, s.checkOut, s.status, 'roomTypeId' in s]),
    [
      [1, '2026-03-05', '2026-03-12', 'in_house', false],
      [2, '2026-03-13', '2026-03-20', 'upcoming', false],
    ],
  )
})

// On 11 March (today): 1 and 5 arrive, 5 is already checked in; 2 and 6 depart, 6 is already checked out.
// 1 (2 nights, 2000 kr), 3 (2 nights, 3000 kr) and 5 (1 night, 900 kr) stay the night in the three rooms.
const KPI_STAYS = [
  stay(1, 11, '2026-03-11', '2026-03-13', 2, { totalPriceOre: 200000 }),
  stay(2, 21, '2026-03-09', '2026-03-11'),
  stay(3, 12, '2026-03-10', '2026-03-12', 2, { totalPriceOre: 300000 }),
  stay(5, 21, '2026-03-11', '2026-03-12', 2, { totalPriceOre: 90000, checkedInAt: '2026-03-11T14:00:00' }),
  stay(6, 12, '2026-03-08', '2026-03-11', 2, { checkedOutAt: '2026-03-11T09:30:00' }),
]

test('005 FR-001: occupancy is the rooms occupied tonight out of all rooms', async () => {
  const { kpis } = await fakeService(KPI_STAYS).service.overview('2026-03-11')
  assert.deepEqual(kpis.occupancy, { occupied: 3, total: 3, rate: 1 })
})

test('005 FR-001: occupancy rate is occupied / total, e.g. 2 of 3 rooms', async () => {
  const { kpis } = await fakeService(KPI_STAYS.slice(0, 3)).service.overview('2026-03-11')
  assert.deepEqual(kpis.occupancy, { occupied: 2, total: 3, rate: 2 / 3 })
})

test('005 FR-001: arrivals and departures remaining exclude those already checked in or out', async () => {
  const { kpis } = await fakeService(KPI_STAYS).service.overview('2026-03-11')
  assert.deepEqual(kpis.arrivals, { remaining: 1, total: 2 })
  assert.deepEqual(kpis.departures, { remaining: 1, total: 2 })
})

test('005 FR-002: average rate is the mean price per night of tonight’s stays', async () => {
  // (2000 / 2 + 3000 / 2 + 900 / 1) / 3 = (1000 + 1500 + 900) / 3 = 1133.33
  const { kpis } = await fakeService(KPI_STAYS).service.overview('2026-03-11')
  assert.equal(kpis.averageRate, 1133.33)
})

test('005 FR-001, FR-002: an empty night gives 0, not NaN', async () => {
  const { kpis } = await fakeService([]).service.overview('2026-03-11')
  assert.equal(kpis.occupancy.rate, 0)
  assert.equal(kpis.averageRate, 0)
})

test('005 FR-004: the plan shows a checked-out guest as checked out on the departure day', async () => {
  const { service } = fakeService(KPI_STAYS)
  const plan = await service.roomPlan({ from: '2026-03-10', days: 7 })
  assert.equal(plan.stays.find((s) => s.bookingId === 6).status, 'checked_out')
  assert.equal(plan.stays.find((s) => s.bookingId === 2).status, 'departing')
})
