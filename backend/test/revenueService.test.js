import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRevenueService } from '../src/services/revenueService.js'

// One room type at 500 kr/night all year; bar rows are already aggregated as the SQL returns them
function fakeService({ barRows = [], drinks = [], bookings = [] } = {}) {
  return createRevenueService({
    revenueRepo: {
      listBarByPeriodAndCategory: async () => barRows,
      listBarByDrink: async () => drinks,
      listDrinkCategories: async () => ['Cocktail', 'Kaffe', 'Øl'],
      listBookings: async () => bookings,
      listPeriods: async () => [{ seasonId: 1, seasonName: 'Helår', startDate: '2020-01-01', endDate: '2030-12-31' }],
      listPrices: async () => [{ roomTypeId: 1, seasonId: 1, priceOre: 50000 }],
    },
  })
}

test('005 FR-014: category shares sum to 1 and a category without sales gets 0', async () => {
  const service = fakeService({
    barRows: [
      { period: '2025-01', category: 'Cocktail', totalOre: 30000, quantity: 3 },
      { period: '2025-02', category: 'Cocktail', totalOre: 30000, quantity: 3 },
      { period: '2025-02', category: 'Kaffe', totalOre: 20000, quantity: 5 },
    ],
  })
  const { bar } = await service.getRevenue({ from: '2025-01-01', to: '2025-12-31', groupBy: 'month' })
  // 600 + 200 = 800 kr: Cocktail 600/800 = 0.75, Kaffe 200/800 = 0.25, Øl 0
  assert.equal(bar.total, 800)
  assert.equal(bar.quantity, 11)
  assert.deepEqual(
    bar.byCategory.map(({ category, share }) => [category, share]),
    [
      ['Cocktail', 0.75],
      ['Kaffe', 0.25],
      ['Øl', 0],
    ],
  )
  assert.deepEqual(bar.byPeriod[1], {
    period: '2025-02',
    total: 500,
    categories: [
      { category: 'Cocktail', total: 300 },
      { category: 'Kaffe', total: 200 },
      { category: 'Øl', total: 0 },
    ],
  })
})

test('005 FR-014: top drinks are the 5 highest by revenue, highest first', async () => {
  const drinks = [100, 700, 300, 600, 200, 500].map((kr, i) => ({
    drink: `Drink ${i}`,
    category: 'Cocktail',
    quantity: 1,
    totalOre: kr * 100,
  }))
  const { bar } = await fakeService({ drinks }).getRevenue({ from: '2025-01-01', to: '2025-12-31' })
  assert.deepEqual(
    bar.topDrinks.map((drink) => drink.total),
    [700, 600, 500, 300, 200],
  )
})

test('005 FR-014: a booking over the period boundary only counts its nights inside the period', async () => {
  // 3 nights of 500 kr (29, 30, 31 Jan); the period starts 30 Jan, so 2 nights = 1000 kr count
  const service = fakeService({
    bookings: [{ checkIn: '2025-01-29', checkOut: '2025-02-01', totalPriceOre: 150000, roomTypeId: 1 }],
  })
  const revenue = await service.getRevenue({ from: '2025-01-30', to: '2025-02-28', groupBy: 'day' })
  assert.equal(revenue.rooms.total, 1000)
  assert.equal(revenue.rooms.nights, 2)
  assert.deepEqual(revenue.rooms.byPeriod, [
    { period: '2025-01-30', total: 500 },
    { period: '2025-01-31', total: 500 },
  ])
  assert.equal(revenue.total, 1000) // no bar sales
})

test('005 FR-014: a booking over a month boundary counts in both months', async () => {
  const service = fakeService({
    bookings: [{ checkIn: '2025-01-31', checkOut: '2025-02-02', totalPriceOre: 100000, roomTypeId: 1 }],
  })
  const { rooms } = await service.getRevenue({ from: '2025-01-01', to: '2025-12-31', groupBy: 'month' })
  assert.deepEqual(rooms.byPeriod, [
    { period: '2025-01', total: 500 },
    { period: '2025-02', total: 500 },
  ])
})

test('005 FR-014: `to` before `from` is rejected', async () => {
  await assert.rejects(fakeService().getRevenue({ from: '2025-02-01', to: '2025-01-31' }), {
    code: 'VALIDATION_ERROR',
    field: 'to',
  })
})

test('005 FR-015: grouping by day is allowed for 1096 days and rejected for 1097', async () => {
  // 2024-01-01 to 2026-12-31 = 366 + 365 + 365 = 1096 days
  await fakeService().getRevenue({ from: '2024-01-01', to: '2026-12-31', groupBy: 'day' })
  await assert.rejects(fakeService().getRevenue({ from: '2023-12-31', to: '2026-12-31', groupBy: 'day' }), {
    code: 'VALIDATION_ERROR',
    field: 'groupBy',
  })
})
