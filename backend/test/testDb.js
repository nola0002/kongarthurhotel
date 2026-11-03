import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { hashPassword } from '../src/services/authService.js'

const connect = async (database) => {
  const client = new pg.Client({
    host: process.env.DB_HOST,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database,
  })
  await client.connect()
  return client
}

// Rebuilt on every run so API tests never touch development data and never depend on an earlier run
export async function setupTestDb() {
  process.env.POSTGRES_DB = 'kongarthur_test'
  // A database cannot be dropped from a connection to itself; POSTGRES_USER owns the server, so it may create it
  const admin = await connect('postgres')
  try {
    // FORCE closes connections a previous test file may have left open
    await admin.query('DROP DATABASE IF EXISTS kongarthur_test WITH (FORCE)')
    await admin.query('CREATE DATABASE kongarthur_test')
  } finally {
    await admin.end()
  }

  const conn = await connect('kongarthur_test')
  try {
    await conn.query(await readFile(new URL('../../db/01_schema.sql', import.meta.url), 'utf8'))
    // Two Dobbeltværelse rooms at 500 kr/night all year round, so expected prices are easy to compute.
    // The Suite has no rooms, so the analytics room-type dimension must still list it with 0 (FR-017)
    await conn.query(
      `INSERT INTO countries (code, name) VALUES ('DK', 'Danmark'), ('SE', 'Sverige');
       INSERT INTO room_types (id, name, capacity) VALUES (1, 'Dobbeltværelse', 2), (2, 'Suite', 4);
       INSERT INTO rooms (room_number, room_type_id) VALUES ('101', 1), ('102', 1);
       INSERT INTO seasons (id, name) VALUES (1, 'Helår');
       INSERT INTO season_periods (season_id, start_date, end_date) VALUES (1, '2020-01-01', '2030-12-31');
       INSERT INTO room_prices (room_type_id, season_id, price_per_night) VALUES (1, 1, 500.00);
       INSERT INTO drink_categories (id, name) VALUES (1, 'Cocktail');
       INSERT INTO drinks (id, name, drink_category_id, price) VALUES (1, 'Espresso Martini', 1, 95.00);`,
    )
    // A separate statement: pg only accepts parameters in a single-statement query
    await conn.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [
      'test',
      await hashPassword('test'),
    ])
  } finally {
    await conn.end()
  }
}
