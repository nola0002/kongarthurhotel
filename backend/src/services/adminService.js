import { AppError } from '../errors.js'
import { toKr, toOre } from '../money.js'

const notFound = (message) => new AppError('NOT_FOUND', message)

// Prices live in the database (SSOT). Bookings and sales keep their frozen prices, so a change only affects new ones
// (005 FR-020, FR-009, FR-010)
export function createAdminService({ pricingRepo, referenceRepo, roomRepo }) {
  return {
    async priceList() {
      const [seasons, roomTypes, prices] = await Promise.all([
        pricingRepo.listSeasons(),
        roomRepo.listRoomTypes({}),
        pricingRepo.listPrices(),
      ])
      return {
        seasons,
        roomTypes: roomTypes.map(({ id, name }) => ({
          id,
          name,
          prices: prices
            .filter((price) => price.roomTypeId === id)
            .map(({ seasonId, priceOre }) => ({ seasonId, price: toKr(priceOre) })),
        })),
      }
    },

    async setRoomPrice(roomTypeId, seasonId, price) {
      const [roomType, seasonExists] = await Promise.all([
        roomRepo.getRoomType(roomTypeId),
        pricingRepo.seasonExists(seasonId),
      ])
      if (!roomType) throw notFound('Værelsestypen findes ikke')
      if (!seasonExists) throw notFound('Sæsonen findes ikke')
      const priceOre = toOre(price)
      await pricingRepo.upsertPrice(roomTypeId, seasonId, priceOre)
      return { roomTypeId, seasonId, price: toKr(priceOre) }
    },

    async setDrinkPrice(id, price) {
      const drink = await referenceRepo.getDrink(id)
      if (!drink) throw notFound('Drinken findes ikke')
      const { priceOre, ...rest } = drink
      const newPriceOre = toOre(price)
      await referenceRepo.updateDrinkPrice(id, newPriceOre)
      return { ...rest, price: toKr(newPriceOre) }
    },
  }
}
