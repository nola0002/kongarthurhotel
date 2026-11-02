import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAdminService } from '../src/services/adminService.js'

// Room type 1 and season 1 exist; drink 1 costs 95 kr
function fakeService() {
  const saved = []
  const service = createAdminService({
    pricingRepo: {
      listSeasons: async () => [{ id: 1, name: 'Lavsæson' }],
      listPrices: async () => [{ roomTypeId: 1, seasonId: 1, priceOre: 50000 }],
      seasonExists: async (id) => id === 1,
      upsertPrice: async (roomTypeId, seasonId, priceOre) => saved.push({ roomTypeId, seasonId, priceOre }),
    },
    roomRepo: {
      listRoomTypes: async () => [
        { id: 1, name: 'Dobbeltværelse' },
        { id: 2, name: 'Suite' },
      ],
      getRoomType: async (id) => (id === 1 ? { id: 1, name: 'Dobbeltværelse' } : null),
    },
    referenceRepo: {
      getDrink: async (id) => (id === 1 ? { id: 1, name: 'Mojito', category: 'Cocktail', priceOre: 9500 } : null),
      updateDrinkPrice: async (id, priceOre) => saved.push({ id, priceOre }),
    },
  })
  return { service, saved }
}

test('005 FR-020: the price list has every room type, also one without prices', async () => {
  const { service } = fakeService()
  assert.deepEqual((await service.priceList()).roomTypes, [
    { id: 1, name: 'Dobbeltværelse', prices: [{ seasonId: 1, price: 500 }] },
    { id: 2, name: 'Suite', prices: [] },
  ])
})

test('005 FR-020: a room price is saved in øre', async () => {
  const { service, saved } = fakeService()
  const result = await service.setRoomPrice(1, 1, 1234.56)
  assert.deepEqual(saved, [{ roomTypeId: 1, seasonId: 1, priceOre: 123456 }])
  assert.deepEqual(result, { roomTypeId: 1, seasonId: 1, price: 1234.56 })
})

test('005 FR-020: an unknown room type or season gives 404 and saves nothing', async () => {
  const { service, saved } = fakeService()
  await assert.rejects(service.setRoomPrice(9, 1, 500), { code: 'NOT_FOUND' })
  await assert.rejects(service.setRoomPrice(1, 9, 500), { code: 'NOT_FOUND' })
  assert.equal(saved.length, 0)
})

test("005 FR-020: a drink's new price is saved in øre and returned as a Drink", async () => {
  const { service, saved } = fakeService()
  const drink = await service.setDrinkPrice(1, 99.95)
  assert.deepEqual(saved, [{ id: 1, priceOre: 9995 }])
  assert.deepEqual(drink, { id: 1, name: 'Mojito', category: 'Cocktail', price: 99.95 })
})

test('005 FR-020: an unknown drink gives 404 and saves nothing', async () => {
  const { service, saved } = fakeService()
  await assert.rejects(service.setDrinkPrice(9, 50), { code: 'NOT_FOUND' })
  assert.equal(saved.length, 0)
})
