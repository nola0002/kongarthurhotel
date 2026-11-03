import { query } from '../db.js'
import { toKr, toOre } from '../money.js'

export async function listCountries() {
  const { rows } = await query('SELECT code, name FROM countries ORDER BY name')
  return rows
}

export async function countryExists(code) {
  const { rows } = await query('SELECT 1 FROM countries WHERE code = ?', [code])
  return rows.length > 0
}

const SELECT_DRINK = `
  SELECT d.id, d.name, dc.name AS category, d.price
  FROM drinks d JOIN drink_categories dc ON dc.id = d.drink_category_id`

const toDrink = ({ price, ...drink }) => ({ ...drink, priceOre: toOre(price) })

export async function listDrinks() {
  const { rows } = await query(`${SELECT_DRINK} ORDER BY dc.name, d.name`)
  return rows.map(toDrink)
}

export async function getDrink(id) {
  const { rows } = await query(`${SELECT_DRINK} WHERE d.id = ?`, [id])
  return rows[0] ? toDrink(rows[0]) : null
}

export async function updateDrinkPrice(id, priceOre) {
  await query('UPDATE drinks SET price = ? WHERE id = ?', [toKr(priceOre), id])
}
