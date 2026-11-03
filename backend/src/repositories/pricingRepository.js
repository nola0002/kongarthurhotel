import { query } from '../db.js'
import { toKr, toOre } from '../money.js'

export async function getPeriods(conn, fromDate, toDate) {
  const { rows } = await query(
    `SELECT sp.season_id AS "seasonId", s.name AS "seasonName", sp.start_date AS "startDate", sp.end_date AS "endDate"
     FROM season_periods sp JOIN seasons s ON s.id = sp.season_id
     WHERE sp.start_date <= ? AND sp.end_date >= ?
     ORDER BY sp.start_date`,
    [toDate, fromDate],
    conn,
  )
  return rows
}

export async function getPrices(conn, roomTypeId) {
  const { rows } = await query(
    'SELECT season_id AS "seasonId", price_per_night AS price FROM room_prices WHERE room_type_id = ?',
    [roomTypeId],
    conn,
  )
  return new Map(rows.map((row) => [row.seasonId, toOre(row.price)]))
}

export async function listSeasons() {
  const { rows } = await query('SELECT id, name FROM seasons ORDER BY id')
  return rows
}

export async function seasonExists(id) {
  const { rows } = await query('SELECT 1 FROM seasons WHERE id = ?', [id])
  return rows.length > 0
}

export async function listPrices() {
  const { rows } = await query(
    'SELECT room_type_id AS "roomTypeId", season_id AS "seasonId", price_per_night AS price FROM room_prices',
  )
  return rows.map(({ price, ...row }) => ({ ...row, priceOre: toOre(price) }))
}

export async function upsertPrice(roomTypeId, seasonId, priceOre) {
  await query(
    `INSERT INTO room_prices (room_type_id, season_id, price_per_night) VALUES (?, ?, ?)
     ON CONFLICT (room_type_id, season_id) DO UPDATE SET price_per_night = EXCLUDED.price_per_night`,
    [roomTypeId, seasonId, toKr(priceOre)],
  )
}
