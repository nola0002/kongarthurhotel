import { pool } from '../db.js'
import { toOre } from '../money.js'

// Half-open stays: a departure day may equal another guest's arrival day (FR-007)
const OVERLAPS = 'b.check_in < ? AND b.check_out > ? AND (? IS NULL OR b.id <> ?)'
const overlapParams = (checkIn, checkOut, excludeBookingId = null) => [
  checkOut,
  checkIn,
  excludeBookingId,
  excludeBookingId,
]

export async function getRoomType(id) {
  const [rows] = await pool.execute('SELECT id, name, capacity FROM room_types WHERE id = ?', [id])
  return rows[0] ?? null
}

export async function listRoomTypes({ checkIn, checkOut, excludeBookingId }) {
  const withPeriod = Boolean(checkIn && checkOut)
  const available = `, (SELECT COUNT(*) FROM rooms r WHERE r.room_type_id = rt.id
      AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.room_id = r.id AND ${OVERLAPS})) AS availableRooms`
  const [rows] = await pool.execute(
    `SELECT rt.id, rt.name, rt.capacity,
       (SELECT MIN(rp.price_per_night) FROM room_prices rp WHERE rp.room_type_id = rt.id) AS fromPrice
       ${withPeriod ? available : ''}
     FROM room_types rt ORDER BY rt.id`,
    withPeriod ? overlapParams(checkIn, checkOut, excludeBookingId) : [],
  )
  return rows.map(({ fromPrice, ...row }) => ({ ...row, fromPriceOre: toOre(fromPrice) }))
}

// room_number is VARCHAR: ordering by length first keeps "lowest number" numeric, so 1001 comes after 999
export async function lockRoomsOfType(conn, roomTypeId) {
  const [rows] = await conn.execute(
    'SELECT id, room_number AS roomNumber FROM rooms WHERE room_type_id = ? ORDER BY CHAR_LENGTH(room_number), room_number FOR UPDATE',
    [roomTypeId],
  )
  return rows
}

export async function findOverlappingRoomIds(conn, roomIds, checkIn, checkOut, excludeBookingId) {
  if (roomIds.length === 0) return []
  // query, not execute: only the client-side formatter expands an array for IN (?)
  const [rows] = await conn.query(
    `SELECT DISTINCT b.room_id AS roomId FROM bookings b WHERE b.room_id IN (?) AND ${OVERLAPS}`,
    [roomIds, ...overlapParams(checkIn, checkOut, excludeBookingId)],
  )
  return rows.map((row) => row.roomId)
}

export async function listRooms() {
  const [rows] = await pool.execute(
    `SELECT r.id, r.room_number AS number, rt.id AS roomTypeId, rt.name AS roomType
     FROM rooms r JOIN room_types rt ON rt.id = r.room_type_id
     ORDER BY rt.id, CHAR_LENGTH(r.room_number), r.room_number`,
  )
  return rows
}

// Stays overlapping the window [from, to), with their own unclipped dates
export async function listStays(from, to) {
  const [rows] = await pool.execute(
    `SELECT b.id AS bookingId, b.room_id AS roomId, r.room_type_id AS roomTypeId,
       b.first_name AS firstName, b.family_name AS familyName,
       b.check_in AS checkIn, b.check_out AS checkOut, b.guest_count AS guestCount
     FROM bookings b JOIN rooms r ON r.id = b.room_id
     WHERE ${OVERLAPS}`,
    overlapParams(from, to),
  )
  return rows
}
