import { query } from '../db.js'
import { toOre } from '../money.js'

export { listDrinkCategories, listPeriods } from './analyticsRepository.js'
export { listPrices } from './pricingRepository.js'

const PERIOD_FORMAT = { day: 'YYYY-MM-DD', month: 'YYYY-MM', year: 'YYYY' }

// A range instead of DATE(sold_at) so the index on sold_at is used; `to` is inclusive
const SALES_IN_PERIOD = `
  FROM bar_sales s
  JOIN drinks d ON d.id = s.drink_id
  JOIN drink_categories dc ON dc.id = d.drink_category_id
  WHERE s.sold_at >= ?::date AND s.sold_at < ?::date + 1`

const toTotals = ({ total, quantity, ...row }) => ({ ...row, totalOre: toOre(total), quantity: Number(quantity) })

// Aggregated in SQL for speed (database.md §6): a year has ~180,000 sales
export async function listBarByPeriodAndCategory(from, to, groupBy) {
  const { rows } = await query(
    `SELECT to_char(s.sold_at, ?) AS period, dc.name AS category,
       SUM(s.quantity * s.unit_price) AS total, SUM(s.quantity) AS quantity
     ${SALES_IN_PERIOD}
     GROUP BY period, dc.name
     ORDER BY period`,
    [PERIOD_FORMAT[groupBy], from, to],
  )
  return rows.map(toTotals)
}

export async function listBarByDrink(from, to) {
  const { rows } = await query(
    `SELECT d.name AS drink, dc.name AS category, SUM(s.quantity * s.unit_price) AS total, SUM(s.quantity) AS quantity
     ${SALES_IN_PERIOD}
     GROUP BY d.id, d.name, dc.name`,
    [from, to],
  )
  return rows.map(toTotals)
}

// Bookings with at least one night in [from, to]; their nights outside the period are dropped by the service
export async function listBookings(from, to) {
  const { rows } = await query(
    `SELECT b.check_in AS "checkIn", b.check_out AS "checkOut", b.total_price AS "totalPrice",
       r.room_type_id AS "roomTypeId"
     FROM bookings b JOIN rooms r ON r.id = b.room_id
     WHERE b.check_in <= ? AND b.check_out > ?`,
    [to, from],
  )
  return rows.map(({ totalPrice, ...row }) => ({ ...row, totalPriceOre: toOre(totalPrice) }))
}
