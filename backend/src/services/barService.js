import { AppError } from '../errors.js'
import { toKr } from '../money.js'
import { isInHouseOn } from './bookingService.js'

export const toApi = (row) => ({
  id: row.id,
  drink: { id: row.drinkId, name: row.drinkName, category: row.category },
  quantity: row.quantity,
  unitPrice: toKr(row.unitPriceOre),
  amount: toKr(row.quantity * row.unitPriceOre),
  soldAt: row.soldAt,
  bookingId: row.bookingId,
  roomNumber: row.roomNumber,
})

export function createBarService({ barRepo, referenceRepo, bookingRepo, withTransaction, today }) {
  async function listSales(filters) {
    const { totalOre, rows } = await barRepo.listSales(filters)
    return { total: toKr(totalOre), items: rows.map(toApi) }
  }

  // All lines or none: every line is validated first and inserted in one transaction (005 FR-012)
  async function registerOrder({ bookingId = null, items }) {
    const drinks = new Map((await referenceRepo.listDrinks()).map((drink) => [drink.id, drink]))
    if (items.some((item) => !drinks.has(item.drinkId))) {
      throw new AppError('VALIDATION_ERROR', 'Ukendt drink', { field: 'drinkId' })
    }
    if (bookingId !== null) {
      const booking = await bookingRepo.findById(bookingId)
      if (!booking || !isInHouseOn(booking, today())) {
        throw new AppError('BOOKING_NOT_IN_HOUSE', 'Gæsten bor ikke på hotellet i dag', { field: 'bookingId' })
      }
    }
    const ids = await withTransaction(async (conn) => {
      const ids = []
      for (const { drinkId, quantity } of items) {
        // The current price is frozen on the sale, so later price changes do not rewrite history (FR-010)
        ids.push(
          await barRepo.insertSale(conn, { drinkId, quantity, unitPriceOre: drinks.get(drinkId).priceOre, bookingId }),
        )
      }
      return ids
    })
    return listSales({ ids })
  }

  return {
    async listDrinks() {
      const drinks = await referenceRepo.listDrinks()
      return drinks.map(({ priceOre, ...drink }) => ({ ...drink, price: toKr(priceOre) }))
    },

    listSales: ({ date, bookingId }) => listSales({ date, bookingId }),

    registerOrder,

    // A single sale is an order with one line, so both follow the same rules
    async registerSale({ drinkId, quantity, bookingId = null }) {
      const { items } = await registerOrder({ bookingId, items: [{ drinkId, quantity }] })
      return items[0]
    },
  }
}
