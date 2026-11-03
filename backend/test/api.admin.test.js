import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { setupTestDb } from './testDb.js'
import { today } from '../src/today.js'
import { addDays } from '../src/services/pricing.js'

const API_KEY = 'test-booking-system-key-0123456789abcdef'
let server, pool, base, cookie

const call = (path, { method = 'GET', body, headers } = {}) =>
  fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body && JSON.stringify(body),
  })
const cookieFrom = (res) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
const login = (username, password) => call('/auth/login', { method: 'POST', body: { username, password } })
const authed = (path, options = {}) => call(path, { ...options, headers: { cookie, ...options.headers } })

// Same fixture as api.test.js: 2 Dobbeltværelse rooms at 500 kr/night, Espresso Martini at 95 kr.
// Only `before` logs in, so changing the password cannot break another test.
describe(
  'API 005',
  { skip: !process.env.DB_HOST && 'needs PostgreSQL: run with docker compose exec backend npm test' },
  () => {
    before(async () => {
      await setupTestDb()
      process.env.BOOKING_SYSTEM_API_KEY = API_KEY
      const { default: app } = await import('../src/app.js')
      ;({ pool } = await import('../src/db.js'))
      const {
        rows: [{ database }],
      } = await pool.query('SELECT current_database() AS database')
      assert.equal(database, 'kongarthur_test')
      server = app.listen(0)
      await once(server, 'listening')
      base = `http://localhost:${server.address().port}/api`
      cookie = cookieFrom(await login('test', 'test'))
    })

    after(async () => {
      server?.close()
      await pool?.end()
    })

    test('005 FR-021: the new endpoints need a session; the booking system key is not enough', async () => {
      // Valid bodies, so the 401 comes from the session check and not from the contract validation
      for (const [method, path, body] of [
        ['GET', '/revenue?from=2025-01-01&to=2025-12-31'],
        ['GET', '/admin/prices'],
        ['PUT', '/admin/prices/1/1', { price: 1 }],
        ['PUT', '/admin/drinks/1', { price: 1 }],
        ['POST', '/bar-sales/orders', { items: [{ drinkId: 1, quantity: 1 }] }],
        ['PUT', '/auth/password', { currentPassword: 'test', newPassword: 'ny-kode-123' }],
      ]) {
        const res = await call(path, { method, body, headers: { 'X-API-Key': API_KEY } })
        assert.equal(res.status, 401, `${method} ${path}`)
      }
    })

    test('005 FR-020: a new room price is used by new quotes, an existing booking keeps its price', async () => {
      const [checkIn, checkOut] = [addDays(today(), 40), addDays(today(), 42)]
      const created = await authed('/bookings', {
        method: 'POST',
        body: {
          firstName: 'Pris',
          familyName: 'Test',
          countryCode: 'DK',
          roomTypeId: 1,
          guestCount: 2,
          checkIn,
          checkOut,
        },
      })
      const booking = await created.json()
      assert.equal(booking.totalPrice, 1000) // 2 × 500

      const put = await authed('/admin/prices/1/1', { method: 'PUT', body: { price: 650.5 } })
      assert.equal(put.status, 200)
      assert.deepEqual(await put.json(), { roomTypeId: 1, seasonId: 1, price: 650.5 })

      const quote = await (await authed(`/bookings/quote?roomTypeId=1&checkIn=${checkIn}&checkOut=${checkOut}`)).json()
      assert.equal(quote.total, 1301) // 2 × 650.50
      assert.equal((await (await authed(`/bookings/${booking.id}`)).json()).totalPrice, 1000)
      const list = await (await authed('/admin/prices')).json()
      assert.deepEqual(list.roomTypes[0].prices, [{ seasonId: 1, price: 650.5 }])
    })

    test('005 FR-020: an unknown season or drink is 404', async () => {
      assert.equal((await authed('/admin/prices/1/99', { method: 'PUT', body: { price: 100 } })).status, 404)
      assert.equal((await authed('/admin/drinks/99', { method: 'PUT', body: { price: 100 } })).status, 404)
    })

    test('005 FR-020: a new drink price is used by new sales, an old sale keeps its price', async () => {
      const old = await (await authed('/bar-sales', { method: 'POST', body: { drinkId: 1, quantity: 1 } })).json()
      const put = await authed('/admin/drinks/1', { method: 'PUT', body: { price: 99.95 } })
      assert.deepEqual(await put.json(), { id: 1, name: 'Espresso Martini', category: 'Cocktail', price: 99.95 })
      const order = await authed('/bar-sales/orders', {
        method: 'POST',
        body: { items: [{ drinkId: 1, quantity: 2 }] },
      })
      assert.equal(order.status, 201)
      assert.equal((await order.json()).total, 199.9) // 2 × 99.95
      const { items } = await (await authed(`/bar-sales?date=${today()}`)).json()
      assert.equal(items.find((item) => item.id === old.id).unitPrice, 95)
    })

    test('005 FR-012: an order with an unknown drink in one line registers no lines', async () => {
      const before = (await (await authed(`/bar-sales?date=${today()}`)).json()).items.length
      const res = await authed('/bar-sales/orders', {
        method: 'POST',
        body: {
          items: [
            { drinkId: 1, quantity: 1 },
            { drinkId: 99, quantity: 1 },
          ],
        },
      })
      assert.equal(res.status, 400)
      assert.equal((await res.json()).error.code, 'VALIDATION_ERROR')
      assert.equal((await (await authed(`/bar-sales?date=${today()}`)).json()).items.length, before)
    })

    test('005 FR-014: revenue gives 400 on `to` before `from` and the Revenue shape otherwise', async () => {
      const bad = await authed('/revenue?from=2025-02-01&to=2025-01-31')
      assert.equal(bad.status, 400)
      assert.equal((await bad.json()).error.field, 'to')
      const res = await authed(`/revenue?from=${today()}&to=${today()}&groupBy=day`)
      assert.equal(res.status, 200)
      const revenue = await res.json()
      assert.equal(revenue.total, revenue.bar.total + revenue.rooms.total)
      assert.deepEqual(
        revenue.bar.byCategory.map((category) => category.category),
        ['Cocktail'],
      )
    })

    test('005 FR-019: a wrong current password is 422, a correct one changes the password', async () => {
      const wrong = await authed('/auth/password', {
        method: 'PUT',
        body: { currentPassword: 'forkert', newPassword: 'ny-kode-123' },
      })
      assert.equal(wrong.status, 422)
      assert.equal((await wrong.json()).error.field, 'currentPassword')

      const changed = await authed('/auth/password', {
        method: 'PUT',
        body: { currentPassword: 'test', newPassword: 'ny-kode-123' },
      })
      assert.equal(changed.status, 204)
      assert.equal((await login('test', 'test')).status, 401)
      assert.equal((await login('test', 'ny-kode-123')).status, 204)
    })
  },
)
