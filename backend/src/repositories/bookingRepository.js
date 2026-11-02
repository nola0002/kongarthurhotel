import { pool } from '../db.js'
import { toKr, toOre } from '../money.js'

const SELECT_BOOKING = `
  SELECT b.id, b.first_name AS firstName, b.family_name AS familyName, b.country_code AS countryCode, c.name AS countryName,
    rt.id AS roomTypeId, rt.name AS roomTypeName, r.id AS roomId, r.room_number AS roomNumber,
    b.check_in AS checkIn, b.check_out AS checkOut, b.guest_count AS guestCount,
    b.total_price AS totalPrice, b.source, b.satisfaction_score AS satisfactionScore,
    b.checked_in_at AS checkedInAt, b.checked_out_at AS checkedOutAt, b.created_at AS createdAt
  FROM bookings b
  JOIN countries c ON c.code = b.country_code
  JOIN rooms r ON r.id = b.room_id
  JOIN room_types rt ON rt.id = r.room_type_id`

const toIsoDateTime = (dateTime) => dateTime?.replace(' ', 'T') ?? null

const toRow = ({ totalPrice, createdAt, checkedInAt, checkedOutAt, ...row }) => ({
  ...row,
  totalPriceOre: toOre(totalPrice),
  checkedInAt: toIsoDateTime(checkedInAt),
  checkedOutAt: toIsoDateTime(checkedOutAt),
  createdAt: toIsoDateTime(createdAt),
})

// Each filter is optional and becomes one condition; which bounds a view means is decided in the service.
// Subqueries instead of a join to rooms, so COUNT(*) stays a scan of bookings alone.
function where({
  q,
  searchNumber,
  roomTypeId,
  countryCode,
  checkInAfter,
  checkInOnOrBefore,
  checkOutAfter,
  checkOutOnOrBefore,
}) {
  // One predicate finds first name, family name and "first family" (004 FR-007)
  const name = "CONCAT(b.first_name, ' ', b.family_name) LIKE CONCAT('%', ?, '%')"
  const conditions = [
    searchNumber
      ? [
          q,
          `(${name} OR b.id = ? OR b.room_id IN (SELECT id FROM rooms WHERE room_number = ?))`,
          [q, searchNumber, searchNumber],
        ]
      : [q, name],
    [roomTypeId, 'b.room_id IN (SELECT id FROM rooms WHERE room_type_id = ?)'],
    [countryCode, 'b.country_code = ?'],
    [checkInAfter, 'b.check_in > ?'],
    [checkInOnOrBefore, 'b.check_in <= ?'],
    [checkOutAfter, 'b.check_out > ?'],
    [checkOutOnOrBefore, 'b.check_out <= ?'],
  ].filter(([value]) => value)
  return {
    sql: conditions.length ? ` WHERE ${conditions.map(([, sql]) => sql).join(' AND ')}` : '',
    params: conditions.flatMap(([value, , params]) => params ?? [value]),
  }
}

// The whitelist is the only way a sort reaches SQL, so a request can never inject a column (005 R4)
const SORT_COLUMNS = new Map([
  ['checkIn', ['b.check_in']],
  ['checkOut', ['b.check_out']],
  ['guest', ['b.family_name', 'b.first_name']],
  ['nights', ['DATEDIFF(b.check_out, b.check_in)']],
  ['totalPrice', ['b.total_price']],
  ['nearest', ['ABS(DATEDIFF(b.check_in, ?))']],
])

export function orderBy({ sort, order, today }) {
  const direction = order === 'desc' ? 'DESC' : 'ASC'
  const columns = SORT_COLUMNS.get(sort) ?? SORT_COLUMNS.get('checkIn')
  return {
    // id breaks ties, so a booking never shows up on two pages
    sql: [...columns, 'b.id'].map((column) => `${column} ${direction}`).join(', '),
    params: sort === 'nearest' ? [today] : [],
  }
}

export async function count(filters) {
  const { sql, params } = where(filters)
  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM bookings b${sql}`, params)
  return total
}

export async function summary(filters) {
  const { sql, params } = where(filters)
  const [[row]] = await pool.execute(
    `SELECT COUNT(*) AS total, COALESCE(SUM(b.total_price), 0) AS totalPrice FROM bookings b${sql}`,
    params,
  )
  return { total: row.total, totalPriceOre: toOre(row.totalPrice) }
}

export async function list({ sort, order, today, limit, offset = 0, ...filters }) {
  const filter = where(filters)
  const sorting = orderBy({ sort, order, today })
  // query, not execute: prepared statements reject numeric LIMIT/OFFSET placeholders in MySQL 8
  const [rows] = await pool.query(`${SELECT_BOOKING}${filter.sql} ORDER BY ${sorting.sql} LIMIT ? OFFSET ?`, [
    ...filter.params,
    ...sorting.params,
    limit,
    offset,
  ])
  return rows.map(toRow)
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

// NOW() is local time: the database runs with TZ=Europe/Copenhagen, like sold_at on bar sales
export async function markCheckedIn(id) {
  const [result] = await pool.execute('UPDATE bookings SET checked_in_at = NOW() WHERE id = ?', [id])
  return result.affectedRows
}

export async function markCheckedOut(id) {
  const [result] = await pool.execute('UPDATE bookings SET checked_out_at = NOW() WHERE id = ?', [id])
  return result.affectedRows
}

export async function deleteById(id) {
  const [result] = await pool.execute('DELETE FROM bookings WHERE id = ?', [id])
  return result.affectedRows
}
