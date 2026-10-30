import { readFile } from 'node:fs/promises'
import mysql from 'mysql2/promise'
import { hashPassword } from '../src/services/authService.js'

// Rebuilt on every run so API tests never touch development data and never depend on an earlier run
export async function setupTestDb() {
  process.env.MYSQL_DATABASE = 'kongarthur_test'
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    multipleStatements: true,
  })
  try {
    await conn.query('DROP DATABASE IF EXISTS kongarthur_test; CREATE DATABASE kongarthur_test; USE kongarthur_test')
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
       INSERT INTO drinks (id, name, drink_category_id, price) VALUES (1, 'Espresso Martini', 1, 95.00);
       INSERT INTO users (username, password_hash) VALUES ('test', ?);`,
      [await hashPassword('test')],
    )
  } finally {
    await conn.end()
  }
}
