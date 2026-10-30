import { AppError } from '../errors.js'
import { toKr } from '../money.js'
import { isInHouseOn } from './bookingService.js'

const toApi = (row) => ({
  id: row.id,
  drink: { id: row.drinkId, name: row.drinkName, category: row.category },
  quantity: row.quantity,
  unitPrice: toKr(row.unitPriceOre),
  amount: toKr(row.quantity * row.unitPriceOre),
  soldAt: row.soldAt,
  bookingId: row.bookingId,
  roomNumber: row.roomNumber,
})

export function createBarService({ barRepo, referenceRepo, bookingRepo, today }) {
  return {
    async listDrinks() {
      const drinks = await referenceRepo.listDrinks()
      return drinks.map(({ priceOre, ...drink }) => ({ ...drink, price: toKr(priceOre) }))
    },

    async listSales({ date, bookingId }) {
      const { totalOre, rows } = await barRepo.listSales({ date, bookingId })
      return { total: toKr(totalOre), items: rows.map(toApi) }
    },

    async registerSale({ drinkId, quantity, bookingId = null }) {
      const drink = await referenceRepo.getDrink(drinkId)
      if (!drink) throw new AppError('VALIDATION_ERROR', 'Ukendt drink', { field: 'drinkId' })
      if (bookingId !== null) {
        const booking = await bookingRepo.findById(bookingId)
        if (!booking || !isInHouseOn(booking, today())) {
          throw new AppError('BOOKING_NOT_IN_HOUSE', 'Gæsten bor ikke på hotellet i dag', { field: 'bookingId' })
        }
      }
      // The current price is frozen on the sale, so later price changes do not rewrite history (FR-010)
      const id = await barRepo.insertSale({ drinkId, quantity, unitPriceOre: drink.priceOre, bookingId })
      const { rows } = await barRepo.listSales({ id })
      return toApi(rows[0])
    },
  }
}
