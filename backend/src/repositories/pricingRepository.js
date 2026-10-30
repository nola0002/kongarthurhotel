import { toOre } from '../money.js'

export async function getPeriods(conn, fromDate, toDate) {
  const [rows] = await conn.execute(
    `SELECT sp.season_id AS seasonId, s.name AS seasonName, sp.start_date AS startDate, sp.end_date AS endDate
     FROM season_periods sp JOIN seasons s ON s.id = sp.season_id
     WHERE sp.start_date <= ? AND sp.end_date >= ?
     ORDER BY sp.start_date`,
    [toDate, fromDate],
  )
  return rows
}

export async function getPrices(conn, roomTypeId) {
  const [rows] = await conn.execute(
    'SELECT season_id AS seasonId, price_per_night AS price FROM room_prices WHERE room_type_id = ?',
    [roomTypeId],
  )
  return new Map(rows.map((row) => [row.seasonId, toOre(row.price)]))
}
