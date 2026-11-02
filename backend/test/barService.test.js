import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBarService } from '../src/services/barService.js'

// Today is 11 March; booking 1 arrives today, booking 2 departs today
function fakeService() {
  const inserted = []
  const service = createBarService({
    barRepo: {
      insertSale: async (conn, sale) => inserted.push(sale),
      // Like the SQL: the inserted rows and SUM(quantity * unit_price)
      listSales: async () => ({
        totalOre: inserted.reduce((sum, sale) => sum + sale.quantity * sale.unitPriceOre, 0),
        rows: inserted.map((sale, i) => ({ id: i + 1, ...sale, soldAt: '2026-03-11T20:00:00' })),
      }),
    },
    referenceRepo: {
      listDrinks: async () => [
        { id: 1, name: 'Espresso Martini', category: 'Cocktail', priceOre: 9500 },
        { id: 2, name: 'Cappuccino', category: 'Kaffe', priceOre: 4250 },
      ],
    },
    bookingRepo: {
      findById: async (id) =>
        ({
          1: { id: 1, checkIn: '2026-03-11', checkOut: '2026-03-13' },
          2: { id: 2, checkIn: '2026-03-09', checkOut: '2026-03-11' },
        })[id] ?? null,
    },
    withTransaction: (fn) => fn('conn'),
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

test('005 FR-012: the order total is the sum of its lines at current prices', async () => {
  const { service } = fakeService()
  const order = await service.registerOrder({
    items: [
      { drinkId: 1, quantity: 2 },
      { drinkId: 2, quantity: 1 },
    ],
  })
  // 2 × 95 + 1 × 42.50 = 232.50
  assert.equal(order.total, 232.5)
  assert.deepEqual(
    order.items.map((item) => item.amount),
    [190, 42.5],
  )
})

test('005 FR-012: an unknown drink in one line inserts no lines', async () => {
  const { service, inserted } = fakeService()
  await assert.rejects(
    service.registerOrder({
      items: [
        { drinkId: 1, quantity: 1 },
        { drinkId: 99, quantity: 1 },
      ],
    }),
    { code: 'VALIDATION_ERROR' },
  )
  assert.equal(inserted.length, 0)
})

test('005 FR-011: an order cannot be put on a guest who does not stay today', async () => {
  const { service, inserted } = fakeService()
  await assert.rejects(service.registerOrder({ bookingId: 2, items: [{ drinkId: 1, quantity: 1 }] }), {
    code: 'BOOKING_NOT_IN_HOUSE',
  })
  assert.equal(inserted.length, 0)
})
