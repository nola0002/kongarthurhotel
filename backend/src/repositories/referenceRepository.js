import { pool } from '../db.js'
import { toOre } from '../money.js'

export async function listCountries() {
  const [rows] = await pool.execute('SELECT code, name FROM countries ORDER BY name')
  return rows
}

export async function countryExists(code) {
  const [rows] = await pool.execute('SELECT 1 FROM countries WHERE code = ?', [code])
  return rows.length > 0
}

const SELECT_DRINK = `
  SELECT d.id, d.name, dc.name AS category, d.price
  FROM drinks d JOIN drink_categories dc ON dc.id = d.drink_category_id`

const toDrink = ({ price, ...drink }) => ({ ...drink, priceOre: toOre(price) })

export async function listDrinks() {
  const [rows] = await pool.execute(`${SELECT_DRINK} ORDER BY dc.name, d.name`)
  return rows.map(toDrink)
}

export async function getDrink(id) {
  const [rows] = await pool.execute(`${SELECT_DRINK} WHERE d.id = ?`, [id])
  return rows[0] ? toDrink(rows[0]) : null
}
