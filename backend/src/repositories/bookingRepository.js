import { pool } from '../db.js'
import { toKr, toOre } from '../money.js'

const SELECT_BOOKING = `
  SELECT b.id, b.first_name AS firstName, b.family_name AS familyName, b.country_code AS countryCode, c.name AS countryName,
    rt.id AS roomTypeId, rt.name AS roomTypeName, r.id AS roomId, r.room_number AS roomNumber,
    b.check_in AS checkIn, b.check_out AS checkOut, b.guest_count AS guestCount,
    b.total_price AS totalPrice, b.source, b.satisfaction_score AS satisfactionScore, b.created_at AS createdAt
  FROM bookings b
  JOIN countries c ON c.code = b.country_code
  JOIN rooms r ON r.id = b.room_id
  JOIN room_types rt ON rt.id = r.room_type_id`

const toRow = ({ totalPrice, createdAt, ...row }) => ({
  ...row,
  totalPriceOre: toOre(totalPrice),
  createdAt: createdAt.replace(' ', 'T'),
})

// Each bound is optional and becomes one condition; which bounds a view means is decided in the service
function where({ q, checkInAfter, checkInOnOrBefore, checkOutAfter, checkOutOnOrBefore }) {
  const conditions = [
    // One predicate finds first name, family name and "first family" (004 FR-007)
    [q, "CONCAT(b.first_name, ' ', b.family_name) LIKE CONCAT('%', ?, '%')"],
    [checkInAfter, 'b.check_in > ?'],
    [checkInOnOrBefore, 'b.check_in <= ?'],
    [checkOutAfter, 'b.check_out > ?'],
    [checkOutOnOrBefore, 'b.check_out <= ?'],
  ].filter(([value]) => value)
  return {
    sql: conditions.length ? ` WHERE ${conditions.map(([, sql]) => sql).join(' AND ')}` : '',
    params: conditions.map(([value]) => value),
  }
}

export async function count(filters) {
  const { sql, params } = where(filters)
  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM bookings b${sql}`, params)
  return total
}

export async function list({ limit, order, ...filters }) {
  const { sql, params } = where(filters)
  const direction = order === 'desc' ? 'DESC' : 'ASC'
  const [[[summary]], [rows]] = await Promise.all([
    pool.execute(
      `SELECT COUNT(*) AS total, COALESCE(SUM(b.total_price), 0) AS totalPrice FROM bookings b${sql}`,
      params,
    ),
    // query, not execute: prepared statements reject a numeric LIMIT placeholder in MySQL 8
    pool.query(`${SELECT_BOOKING}${sql} ORDER BY b.check_in ${direction}, b.id ${direction} LIMIT ?`, [
      ...params,
      limit,
    ]),
  ])
  return { total: summary.total, totalPriceOre: toOre(summary.totalPrice), rows: rows.map(toRow) }
}

export async function findById(id) {
  const [rows] = await pool.execute(`${SELECT_BOOKING} WHERE b.id = ?`, [id])
  return rows[0] ? toRow(rows[0]) : null
}

export async function insertBooking(
  conn,
  { firstName, familyName, countryCode, roomId, checkIn, checkOut, guestCount, totalPriceOre, source },
) {
  const [result] = await conn.execute(
    `INSERT INTO bookings (first_name, family_name, country_code, room_id, check_in, check_out, guest_count,
       total_price, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [firstName, familyName, countryCode, roomId, checkIn, checkOut, guestCount, toKr(totalPriceOre), source],
  )
  return result.insertId
}

export async function updateBooking(
  conn,
  id,
  { firstName, familyName, countryCode, roomId, checkIn, checkOut, guestCount, totalPriceOre },
) {
  await conn.execute(
    `UPDATE bookings SET first_name = ?, family_name = ?, country_code = ?, room_id = ?, check_in = ?, check_out = ?,
       guest_count = ?, total_price = ?
     WHERE id = ?`,
    [firstName, familyName, countryCode, roomId, checkIn, checkOut, guestCount, toKr(totalPriceOre), id],
  )
}

export async function updateSatisfaction(id, score) {
  const [result] = await pool.execute('UPDATE bookings SET satisfaction_score = ? WHERE id = ?', [score, id])
  return result.affectedRows
}

export async function deleteById(id) {
  const [result] = await pool.execute('DELETE FROM bookings WHERE id = ?', [id])
  return result.affectedRows
}
