import { pool } from '../db.js'
import { toKr, toOre } from '../money.js'

// sold_at comes from the database's DEFAULT CURRENT_TIMESTAMP (TZ=Europe/Copenhagen)
export async function insertSale({ drinkId, quantity, unitPriceOre, bookingId }) {
  const [result] = await pool.execute(
    'INSERT INTO bar_sales (drink_id, quantity, unit_price, booking_id) VALUES (?, ?, ?, ?)',
    [drinkId, quantity, toKr(unitPriceOre), bookingId],
  )
  return result.insertId
}

function where({ id, date, bookingId }) {
  const conditions = [
    [id, 's.id = ?'],
    // A range instead of DATE(sold_at) so the index on sold_at is used
    [date, 's.sold_at >= ? AND s.sold_at < DATE_ADD(?, INTERVAL 1 DAY)', [date, date]],
    [bookingId, 's.booking_id = ?'],
  ].filter(([value]) => value)
  return {
    sql: conditions.length ? ` WHERE ${conditions.map(([, sql]) => sql).join(' AND ')}` : '',
    params: conditions.flatMap(([value, , params]) => params ?? [value]),
  }
}

export async function listSales(filters) {
  const { sql, params } = where(filters)
  const [[[{ total }]], [rows]] = await Promise.all([
    pool.execute(`SELECT COALESCE(SUM(s.quantity * s.unit_price), 0) AS total FROM bar_sales s${sql}`, params),
    pool.execute(
      `SELECT s.id, d.id AS drinkId, d.name AS drinkName, dc.name AS category, s.quantity, s.unit_price AS unitPrice,
         s.sold_at AS soldAt, s.booking_id AS bookingId, r.room_number AS roomNumber
       FROM bar_sales s
       JOIN drinks d ON d.id = s.drink_id
       JOIN drink_categories dc ON dc.id = d.drink_category_id
       LEFT JOIN bookings b ON b.id = s.booking_id
       LEFT JOIN rooms r ON r.id = b.room_id
       ${sql}
       ORDER BY s.sold_at DESC, s.id DESC`,
      params,
    ),
  ])
  return {
    totalOre: toOre(total),
    rows: rows.map(({ unitPrice, soldAt, ...row }) => ({
      ...row,
      unitPriceOre: toOre(unitPrice),
      soldAt: soldAt.replace(' ', 'T'),
    })),
  }
}
