import pg from 'pg'

// DATE and TIMESTAMP stay strings, so a time zone can never shift a check-in by a day (R3).
// COUNT and SUM of integers are BIGINT, which pg returns as a string; our counts fit easily in a Number.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value)
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (value) => value)
pg.types.setTypeParser(pg.types.builtins.INT8, Number)

export const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
})

// Repositories write ? placeholders, so dynamically built WHERE clauses need no numbering; pg wants $1, $2 …
const numbered = (sql) => {
  let index = 0
  return sql.replace(/\?/g, () => `$${++index}`)
}

// client is a transaction's connection from withTransaction; without one the pool picks a free connection
export const query = (sql, params, client = pool) => client.query(numbered(sql), params)

export async function withTransaction(fn) {
  const client = await pool.connect()
  try {
    // PostgreSQL's default READ COMMITTED lets the FOR UPDATE lock read the latest committed bookings (FR-007)
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
