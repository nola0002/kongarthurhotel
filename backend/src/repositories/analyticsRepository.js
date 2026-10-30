import { pool } from '../db.js'
import { toOre } from '../money.js'
import { getPeriods, getPrices } from './pricingRepository.js'

export { listCountries } from './referenceRepository.js'

export async function listBookings() {
  const [rows] = await pool.execute(
    `SELECT b.id, b.check_in AS checkIn, b.check_out AS checkOut, b.guest_count AS guestCount,
       b.total_price AS totalPrice, b.satisfaction_score AS satisfactionScore, rt.name AS roomType, b.country_code AS countryCode
     FROM bookings b
     JOIN rooms r ON r.id = b.room_id
     JOIN room_types rt ON rt.id = r.room_type_id
     ORDER BY b.check_in, b.id`,
  )
  return rows.map(({ totalPrice, ...row }) => ({ ...row, totalPriceOre: toOre(totalPrice) }))
}

// The dashboard loads every year, so the period query gets the widest possible DATE range
export const listPeriods = () => getPeriods(pool, '1000-01-01', '9999-12-31')

export async function listRoomTypes() {
  const [rows] = await pool.execute(
    `SELECT rt.id, rt.name, rt.capacity, COUNT(r.id) AS roomCount
     FROM room_types rt LEFT JOIN rooms r ON r.room_type_id = rt.id
     GROUP BY rt.id, rt.name, rt.capacity ORDER BY rt.id`,
  )
  return Promise.all(rows.map(async (row) => ({ ...row, prices: await getPrices(pool, row.id) })))
}

export async function listBarSales() {
  const [rows] = await pool.execute(
    `SELECT s.id, DATE(s.sold_at) AS date, d.name AS drink, dc.name AS category, s.quantity,
       s.unit_price AS unitPrice
     FROM bar_sales s
     JOIN drinks d ON d.id = s.drink_id
     JOIN drink_categories dc ON dc.id = d.drink_category_id
     ORDER BY s.sold_at, s.id`,
  )
  return rows.map(({ unitPrice, ...row }) => ({ ...row, unitPriceOre: toOre(unitPrice) }))
}

export async function listDrinkCategories() {
  const [rows] = await pool.execute('SELECT name FROM drink_categories ORDER BY name')
  return rows.map((row) => row.name)
}
