import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBarService } from '../src/services/barService.js'

// Today is 11 March; booking 1 arrives today, booking 2 departs today
function fakeService() {
  const inserted = []
  const service = createBarService({
    barRepo: {
      insertSale: async (sale) => inserted.push(sale),
      listSales: async () => ({
        totalOre: 0,
        rows: [
          {
            id: 1,
            drinkId: 1,
            quantity: inserted[0].quantity,
            unitPriceOre: inserted[0].unitPriceOre,
            soldAt: '2026-03-11T20:00:00',
          },
        ],
      }),
    },
    referenceRepo: {
      getDrink: async (id) =>
        id === 1 ? { id: 1, name: 'Espresso Martini', category: 'Cocktail', priceOre: 9500 } : null,
    },
    bookingRepo: {
      findById: async (id) =>
        ({
          1: { id: 1, checkIn: '2026-03-11', checkOut: '2026-03-13' },
          2: { id: 2, checkIn: '2026-03-09', checkOut: '2026-03-11' },
        })[id] ?? null,
    },
    today: () => '2026-03-11',
  })
  return { service, inserted }
}

test("FR-010: the sale freezes the drink's price at the time of sale", async () => {
  const { service, inserted } = fakeService()
  const sale = await service.registerSale({ drinkId: 1, quantity: 2 })
  assert.equal(inserted[0].unitPriceOre, 9500)
  assert.equal(sale.unitPrice, 95)
  assert.equal(sale.amount, 190) // 2 × 95
})

test('FR-010a: a sale can be put on a guest on the arrival day', async () => {
  const { service, inserted } = fakeService()
  await service.registerSale({ drinkId: 1, quantity: 1, bookingId: 1 })
  assert.equal(inserted[0].bookingId, 1)
})

test('FR-010a: a sale cannot be put on a guest on the departure day', async () => {
  const { service, inserted } = fakeService()
  await assert.rejects(service.registerSale({ drinkId: 1, quantity: 1, bookingId: 2 }), {
    code: 'BOOKING_NOT_IN_HOUSE',
    field: 'bookingId',
  })
  assert.equal(inserted.length, 0)
})

test('FR-010: an unknown drink is rejected', async () => {
  const { service } = fakeService()
  await assert.rejects(service.registerSale({ drinkId: 99, quantity: 1 }), {
    code: 'VALIDATION_ERROR',
    field: 'drinkId',
  })
})
