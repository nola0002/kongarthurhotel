import { pool } from '../db.js'

export async function findByUsername(username) {
  const [rows] = await pool.execute(
    'SELECT id, username, password_hash AS passwordHash FROM users WHERE username = ?',
    [username],
  )
  return rows[0] ?? null
}

export async function countUsers() {
  const [[{ count }]] = await pool.execute('SELECT COUNT(*) AS count FROM users')
  return count
}

export async function insertUser({ username, passwordHash }) {
  await pool.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, passwordHash])
}
