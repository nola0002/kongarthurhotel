import { query } from '../db.js'

export async function findByUsername(username) {
  const { rows } = await query('SELECT id, username, password_hash AS "passwordHash" FROM users WHERE username = ?', [
    username,
  ])
  return rows[0] ?? null
}

export async function countUsers() {
  const { rows } = await query('SELECT COUNT(*) AS count FROM users')
  return rows[0].count
}

export async function insertUser({ username, passwordHash }) {
  await query('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, passwordHash])
}

export async function findById(id) {
  const { rows } = await query('SELECT id, username, password_hash AS "passwordHash" FROM users WHERE id = ?', [id])
  return rows[0] ?? null
}

export async function updatePasswordHash(id, passwordHash) {
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id])
}
