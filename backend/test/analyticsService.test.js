import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAnalyticsService } from '../src/services/analyticsService.js'

// Low season 500 kr/night until 31 May, high season 800 kr/night from 1 June, both years
const PERIODS = [
  {
    seasonId: 1,
    seasonName: 'Lavsæson',
    startDate: '2026-01-01',
    endDate: '2026-05-31',
  },
  {
    seasonId: 2,
    seasonName: 'Højsæson',
    startDate: '2026-06-01',
    endDate: '2026-12-31',
  },
  {
    seasonId: 1,
    seasonName: 'Lavsæson',
    startDate: '2027-01-01',
    endDate: '2027-05-31',
  },
]
const DOUBLE = {
  id: 1,
  name: 'Dobbeltværelse',
  roomCount: 10,
  prices: new Map([
    [1, 50000],
    [2, 80000],
  ]),
}

const booking = (id, checkIn, checkOut, totalPriceOre, guestCount = 2) => ({
  id,
  checkIn,
  checkOut,
  guestCount,
  totalPriceOre,
  roomType: 'Dobbeltværelse',
  countryCode: 'DK',
  country: 'Danmark',
})

function service({ bookings = [], periods = PERIODS, roomTypes = [DOUBLE], barSales = [] } = {}) {
  return createAnalyticsService({
    analyticsRepo: {
      listBookings: async () => bookings,
      listPeriods: async () => periods,
      listRoomTypes: async () => roomTypes,
      listBarSales: async () => barSales,
      listDrinkCategories: async () => ['Cocktail', 'Kaffe'],
    },
  })
}

const kpi = (rows, year, name, dimension = null) =>
  rows.find((row) => row.year === year && row.kpi === name && row.dimension === dimension).value

test('FT7: a stay over a season change splits the frozen total by season price, remainder on the last night', async () => {
  // Frozen total 1000 kr; weights 500 + 500 + 800 = 1800.
  // 100000 × 500/1800 = 27777.7 → 27777 øre per low night; last night gets 100000 − 2 × 27777 = 44446 øre
  const rows = await service({
    bookings: [booking(1, '2026-05-30', '2026-06-02', 100000)],
  }).roomNights()
  assert.deepEqual(
    rows.map((row) => [row.date, row.season, row.revenue]),
    [
      ['2026-05-30', 'Lavsæson', 277.77],
      ['2026-05-31', 'Lavsæson', 277.77],
      ['2026-06-01', 'Højsæson', 444.46],
    ],
  )
  assert.equal(Math.round(rows.reduce((total, row) => total + row.revenue * 100, 0)), 100000)
})

test('FT10: a stay over new year puts each night’s revenue in its own year', async () => {
  // 31/12 high season 800 + 1/1 low season 500 = the frozen 1300
  const analytics = service({
    bookings: [booking(1, '2026-12-31', '2027-01-02', 130000)],
  })
  const rows = await analytics.roomNights()
  assert.deepEqual(
    rows.map((row) => [row.year, row.month, row.revenue]),
    [
      [2026, 12, 800],
      [2027, 1, 500],
    ],
  )
  const kpis = await analytics.kpis()
  assert.equal(kpi(kpis, 2026, 'roomRevenue'), 800)
  assert.equal(kpi(kpis, 2027, 'roomRevenue'), 500)
})

test('FT7: without any season price the total is split evenly, remainder on the last night', async () => {
  // 100 kr over 3 nights: 33.33 + 33.33 + 33.34
  const roomTypes = [{ ...DOUBLE, prices: new Map() }]
  const rows = await service({
    bookings: [booking(1, '2026-03-10', '2026-03-13', 10000)],
    roomTypes,
  }).roomNights()
  assert.deepEqual(
    rows.map((row) => row.revenue),
    [33.33, 33.33, 33.34],
  )
})

test('FT5: 10 rooms and 150 sold room-nights in a 30-day month give 50 % occupancy', async () => {
  // 5 bookings × 30 nights = 150 sold; 10 rooms × 30 days = 300 available
  const periods = [
    {
      seasonId: 2,
      seasonName: 'Mellemsæson',
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    },
  ]
  const bookings = [1, 2, 3, 4, 5].map((id) => booking(id, '2026-04-01', '2026-05-01', 3000000))
  const analytics = service({ bookings, periods })
  const occupancy = await analytics.occupancy()
  assert.equal(occupancy.length, 30)
  assert.deepEqual(occupancy[29], {
    date: '2026-04-30',
    year: 2026,
    month: 4,
    season: 'Mellemsæson',
    roomType: 'Dobbeltværelse',
    availableRoomNights: 10,
    soldRoomNights: 5,
    occupancyRate: 0.5,
  })
  assert.equal(kpi(await analytics.kpis(), 2026, 'occupancyRate'), 0.5)
})

test('FT11: average price per night is room revenue ÷ sold room-nights', async () => {
  // (1000 + 800) kr ÷ 3 nights = 600 kr
  const bookings = [booking(1, '2026-03-10', '2026-03-12', 100000), booking(2, '2026-03-20', '2026-03-21', 80000)]
  assert.equal(kpi(await service({ bookings }).kpis(), 2026, 'avgPricePerNight'), 600)
})

test('FT11: average stay length is the average nights of bookings checking in that year', async () => {
  // (2 + 1) nights ÷ 2 bookings = 1.5
  const bookings = [booking(1, '2026-03-10', '2026-03-12', 100000), booking(2, '2026-03-20', '2026-03-21', 50000)]
  assert.equal(kpi(await service({ bookings }).kpis(), 2026, 'avgStayLength'), 1.5)
})

test('FT15: bar revenue shares per category sum to 1', async () => {
  // Cocktail 3 × 100 = 300 kr, Kaffe 2 × 50 = 100 kr → 0.75 + 0.25
  const barSales = [
    {
      id: 1,
      date: '2026-03-10',
      drink: 'Mojito',
      category: 'Cocktail',
      quantity: 3,
      unitPriceOre: 10000,
    },
    {
      id: 2,
      date: '2026-03-10',
      drink: 'Latte',
      category: 'Kaffe',
      quantity: 2,
      unitPriceOre: 5000,
    },
  ]
  const kpis = await service({ barSales }).kpis()
  assert.equal(kpi(kpis, 2026, 'barRevenue'), 400)
  assert.equal(kpi(kpis, 2026, 'barRevenueShare', 'Cocktail'), 0.75)
  assert.equal(kpi(kpis, 2026, 'barRevenueShare', 'Kaffe'), 0.25)
})

test('FT5: a year without bookings or bar sales gives 0, not NaN', async () => {
  // 2026 has only a booking and 2027 only a bar sale; 2027 has available room-nights but none sold
  const kpis = await service({
    bookings: [booking(1, '2026-03-10', '2026-03-12', 100000)],
    barSales: [
      {
        id: 1,
        date: '2027-07-01',
        drink: 'Latte',
        category: 'Kaffe',
        quantity: 1,
        unitPriceOre: 5000,
      },
    ],
  }).kpis()
  for (const name of ['occupancyRate', 'roomRevenue', 'avgPricePerNight', 'avgStayLength', 'bookings', 'guests']) {
    assert.equal(kpi(kpis, 2027, name), 0, name)
  }
  assert.equal(kpi(kpis, 2026, 'barRevenue'), 0)
  assert.equal(kpi(kpis, 2026, 'barRevenueShare', 'Cocktail'), 0)
  assert.equal(kpi(kpis, 2026, 'barRevenueShare', 'Kaffe'), 0)
})

test('FT6: bookings and guests count in the check-in year, even when the stay crosses new year', async () => {
  // 2 guests 10/3–12/3 + 3 guests 30/12–2/1 all count in 2026; 2027 only gets the nights
  const analytics = service({
    bookings: [booking(1, '2026-03-10', '2026-03-12', 100000), booking(2, '2026-12-30', '2027-01-02', 210000, 3)],
  })
  const kpis = await analytics.kpis()
  assert.equal(kpi(kpis, 2026, 'bookings'), 2)
  assert.equal(kpi(kpis, 2026, 'guests'), 5)
  assert.equal(kpi(kpis, 2027, 'bookings'), 0)
  assert.deepEqual(
    (await analytics.bookings()).map((row) => [row.year, row.nights]),
    [
      [2026, 2],
      [2026, 3],
    ],
  )
})

test('FT5: a stay over a month end is sold on each night but not on the departure day', async () => {
  // 30/3–2/4 occupies 30/3, 31/3 and 1/4; a type without rooms gives 0 instead of NaN
  const roomTypes = [DOUBLE, { id: 2, name: 'Suite', roomCount: 0, prices: new Map() }]
  const occupancy = await service({
    bookings: [booking(1, '2026-03-30', '2026-04-02', 150000)],
    roomTypes,
  }).occupancy()
  const sold = (date, roomType = 'Dobbeltværelse') =>
    occupancy.find((row) => row.date === date && row.roomType === roomType)
  assert.deepEqual(
    ['2026-03-30', '2026-03-31', '2026-04-01', '2026-04-02'].map((date) => sold(date).soldRoomNights),
    [1, 1, 1, 0],
  )
  assert.equal(sold('2026-03-30', 'Suite').occupancyRate, 0)
})

test('FT15: categories come from the data, so a third category gets its own share', async () => {
  // 100 kr in each of three categories → one third each
  const analytics = createAnalyticsService({
    analyticsRepo: {
      listBookings: async () => [],
      listPeriods: async () => PERIODS,
      listRoomTypes: async () => [DOUBLE],
      listBarSales: async () =>
        ['Cocktail', 'Kaffe', 'Øl'].map((category, i) => ({
          id: i,
          date: '2026-03-10',
          drink: category,
          category,
          quantity: 1,
          unitPriceOre: 10000,
        })),
      listDrinkCategories: async () => ['Cocktail', 'Kaffe', 'Øl'],
    },
  })
  const shares = (await analytics.kpis()).filter((row) => row.year === 2026 && row.kpi === 'barRevenueShare')
  assert.deepEqual(
    shares.map((row) => row.dimension),
    ['Cocktail', 'Kaffe', 'Øl'],
  )
  assert.equal(
    shares.reduce((total, row) => total + row.value, 0),
    1,
  )
})

const scored = (id, checkIn, checkOut, totalPriceOre, satisfactionScore) => ({
  ...booking(id, checkIn, checkOut, totalPriceOre),
  satisfactionScore,
})

test('FT12: customer satisfaction is the average of registered scores for check-outs in the year', async () => {
  // (5 + 4 + 3) ÷ 3 = 4; the booking without a score is not a response
  const kpis = await service({
    bookings: [
      scored(1, '2026-03-10', '2026-03-12', 100000, 5),
      scored(2, '2026-03-10', '2026-03-12', 100000, 4),
      scored(3, '2026-03-10', '2026-03-12', 100000, 3),
      scored(4, '2026-03-10', '2026-03-12', 100000, null),
    ],
  }).kpis()
  assert.equal(kpi(kpis, 2026, 'customerSatisfaction'), 4)
  assert.equal(kpi(kpis, 2026, 'satisfactionResponses'), 3)
})

test('FT12: a year without scores gives 0 and 0 responses', async () => {
  const kpis = await service({ bookings: [scored(1, '2026-03-10', '2026-03-12', 100000, null)] }).kpis()
  assert.equal(kpi(kpis, 2026, 'customerSatisfaction'), 0)
  assert.equal(kpi(kpis, 2026, 'satisfactionResponses'), 0)
})

test('FT12: a stay over new year counts in the check-out year', async () => {
  // 30/12–1/1 has both nights in 2026, but the guest answers at check-out in 2027
  const kpis = await service({ bookings: [scored(1, '2026-12-30', '2027-01-01', 160000, 5)] }).kpis()
  assert.equal(kpi(kpis, 2026, 'satisfactionResponses'), 0)
  assert.equal(kpi(kpis, 2027, 'customerSatisfaction'), 5)
  assert.equal(kpi(kpis, 2027, 'satisfactionResponses'), 1)
})
