import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateStayPrice } from '../src/services/pricing.js'

const periods = [
  { seasonId: 1, seasonName: 'Lavsæson', startDate: '2026-01-01', endDate: '2026-05-31' },
  { seasonId: 2, seasonName: 'Højsæson', startDate: '2026-06-01', endDate: '2026-12-31' },
  { seasonId: 1, seasonName: 'Lavsæson', startDate: '2027-01-01', endDate: '2027-05-31' },
]
const prices = new Map([
  [1, 50000],
  [2, 80000],
])

test('FR-008: prices every night in one season', () => {
  const result = calculateStayPrice({ checkIn: '2026-03-10', checkOut: '2026-03-13', periods, prices })
  assert.equal(result.nights, 3)
  assert.equal(result.totalOre, 150000) // 3 × 500
})

test('FR-008: prices each night by its own season', () => {
  // 2 nights in low season (500) + 1 night in high season (800) = 1800
  const result = calculateStayPrice({ checkIn: '2026-05-30', checkOut: '2026-06-02', periods, prices })
  assert.equal(result.totalOre, 180000)
  assert.deepEqual(result.lines, [
    { season: 'Lavsæson', nights: 2, pricePerNightOre: 50000, subtotalOre: 100000 },
    { season: 'Højsæson', nights: 1, pricePerNightOre: 80000, subtotalOre: 80000 },
  ])
})

test('FR-008: a stay across new year uses both years’ periods', () => {
  // 31/12 high season (800) + 1/1 low season (500) = 1300
  const result = calculateStayPrice({ checkIn: '2026-12-31', checkOut: '2027-01-02', periods, prices })
  assert.equal(result.nights, 2)
  assert.equal(result.totalOre, 130000)
})

test('FR-008: rejects a night without a season period', () => {
  assert.throws(() => calculateStayPrice({ checkIn: '2025-12-30', checkOut: '2026-01-02', periods, prices }), {
    code: 'PRICE_NOT_CONFIGURED',
  })
})

test('FR-008: rejects a season without a room price', () => {
  assert.throws(
    () => calculateStayPrice({ checkIn: '2026-03-10', checkOut: '2026-03-12', periods, prices: new Map([[2, 80000]]) }),
    { code: 'PRICE_NOT_CONFIGURED' },
  )
})
