import mysql from 'mysql2/promise'

// dateStrings keeps DATE as 'YYYY-MM-DD', so a time zone can never shift a check-in by a day (R3)
export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  dateStrings: true,
})

export async function withTransaction(fn) {
  const conn = await pool.getConnection()
  try {
    // READ COMMITTED so the FOR UPDATE lock reads the latest committed bookings (FR-007)
    await conn.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED')
    await conn.beginTransaction()
    const result = await fn(conn)
    await conn.commit()
    return result
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}
