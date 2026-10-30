import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { setupTestDb } from './testDb.js'
import { today } from '../src/today.js'
import { addDays } from '../src/services/pricing.js'

const API_KEY = 'test-booking-system-key-0123456789abcdef'
const BI_KEY = 'test-bi-dashboard-key-0123456789abcdef'
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
const create = (body, headers) => authed('/bookings', { method: 'POST', body, headers })
const stay = (checkIn, checkOut) => ({
  firstName: 'Test',
  familyName: 'Gæst',
  countryCode: 'DK',
  roomTypeId: 1,
  guestCount: 2,
  checkIn,
  checkOut,
})

// Every test uses its own dates against the fixture's 2 rooms, so the order does not matter
describe('API', { skip: !process.env.DB_HOST && 'needs MySQL: run with docker compose exec backend npm test' }, () => {
  before(async () => {
    await setupTestDb()
    process.env.BOOKING_SYSTEM_API_KEY = API_KEY
    process.env.BI_API_KEY = BI_KEY
    const { default: app } = await import('../src/app.js')
    ;({ pool } = await import('../src/db.js'))
    const [[{ database }]] = await pool.query('SELECT DATABASE() AS `database`')
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

  test('FR-015: /auth/me without a session cookie is 401', async () => {
    const res = await call('/auth/me')
    assert.equal(res.status, 401)
    assert.equal((await res.json()).error.code, 'UNAUTHORIZED')
  })

  test('FR-015: login with a wrong password is 401', async () => {
    assert.equal((await login('test', 'forkert')).status, 401)
  })

  test('FR-015: an unknown user gets the same message as a wrong password', async () => {
    const unknown = await login('ukendt', 'test')
    const wrong = await login('test', 'forkert')
    assert.equal(unknown.status, 401)
    assert.equal((await unknown.json()).error.message, (await wrong.json()).error.message)
  })

  test('FR-015: a correct login gives a session cookie that /auth/me accepts', async () => {
    const res = await login('test', 'test')
    assert.equal(res.status, 204)
    const me = await call('/auth/me', { headers: { cookie: cookieFrom(res) } })
    assert.equal(me.status, 200)
    assert.deepEqual(await me.json(), { username: 'test' })
  })

  test('FR-015: after logout the cookie no longer gives access', async () => {
    const session = cookieFrom(await login('test', 'test'))
    const logout = await call('/auth/logout', { method: 'POST', headers: { cookie: session } })
    assert.equal(logout.status, 204)
    assert.equal((await call('/auth/me', { headers: { cookie: cookieFrom(logout) } })).status, 401)
  })

  test('FR-003: creating a booking assigns a room and prices it', async () => {
    const res = await create(stay('2027-01-10', '2027-01-12'))
    assert.equal(res.status, 201)
    const booking = await res.json()
    assert.ok(booking.room.number)
    assert.equal(booking.totalPrice, 1000) // 2 nights × 500
  })

  test('FR-001: total and totalPrice count every match, not only the first `limit`', async () => {
    const guest = { ...stay('2027-09-10', '2027-09-12'), firstName: 'Limit', familyName: 'Testesen' }
    await create(guest)
    await create(guest)
    const res = await authed('/bookings?q=Limit%20Testesen&limit=1')
    const { total, totalPrice, counts, items } = await res.json()
    assert.equal(items.length, 1)
    assert.equal(total, 2)
    assert.equal(totalPrice, 2000) // 2 bookings × 2 nights × 500
    assert.equal(counts.all, 2)
  })

  test('004 FR-007: search matches first name, family name and "first family"', async () => {
    const { id } = await (
      await create({ ...stay('2028-01-10', '2028-01-12'), firstName: 'Ingrid', familyName: 'Olsen' })
    ).json()
    for (const q of ['ingrid', 'OLSEN', 'ingrid%20ols']) {
      const { items } = await (await authed(`/bookings?q=${q}`)).json()
      assert.ok(
        items.some((item) => item.id === id),
        `q=${q}`,
      )
    }
  })

  test('004 FR-006: a booking response has firstName and familyName and no guestName', async () => {
    const booking = await (await create(stay('2028-01-20', '2028-01-22'))).json()
    assert.equal(booking.firstName, 'Test')
    assert.equal(booking.familyName, 'Gæst')
    assert.equal('guestName' in booking, false)
  })

  test('FR-007: a departure day may be another booking’s arrival day in the same room', async () => {
    const first = await (await create(stay('2027-02-10', '2027-02-12'))).json()
    const res = await create(stay('2027-02-12', '2027-02-14'))
    assert.equal(res.status, 201)
    assert.equal((await res.json()).room.number, first.room.number)
  })

  test('FR-007: rejects booking when every room of the type is taken', async () => {
    assert.equal((await create(stay('2027-03-10', '2027-03-12'))).status, 201)
    assert.equal((await create(stay('2027-03-11', '2027-03-13'))).status, 201)
    const res = await create(stay('2027-03-11', '2027-03-12'))
    assert.equal(res.status, 409)
    assert.equal((await res.json()).error.code, 'ROOM_TYPE_FULLY_BOOKED')
  })

  // 5 rather than 2 parallel requests, so the test reliably fails if the room lock is removed
  test('FR-007: simultaneous bookings for the last room give one 201 and the rest 409', async () => {
    assert.equal((await create(stay('2027-04-10', '2027-04-12'))).status, 201)
    const responses = await Promise.all(Array.from({ length: 5 }, () => create(stay('2027-04-10', '2027-04-12'))))
    assert.deepEqual(responses.map((res) => res.status).sort(), [201, 409, 409, 409, 409])
  })

  test('FR-003: a departure on the arrival day is 400 on checkOut', async () => {
    const res = await create(stay('2027-05-10', '2027-05-10'))
    assert.equal(res.status, 400)
    const { error } = await res.json()
    assert.equal(error.code, 'VALIDATION_ERROR')
    assert.equal(error.field, 'checkOut')
  })

  test('FR-006: 0 guests is 400 on guestCount', async () => {
    const res = await create({ ...stay('2027-05-10', '2027-05-12'), guestCount: 0 })
    assert.equal(res.status, 400)
    const { error } = await res.json()
    assert.equal(error.code, 'VALIDATION_ERROR')
    assert.equal(error.field, 'guestCount')
  })

  test('FR-005: deleting a booking removes it', async () => {
    const { id } = await (await create(stay('2027-06-10', '2027-06-12'))).json()
    assert.equal((await authed(`/bookings/${id}`, { method: 'DELETE' })).status, 204)
    assert.equal((await authed(`/bookings/${id}`)).status, 404)
  })

  test('FR-005: DELETE and PUT on an already deleted booking are 404', async () => {
    const { id } = await (await create(stay('2027-06-20', '2027-06-22'))).json()
    await authed(`/bookings/${id}`, { method: 'DELETE' })
    for (const res of [
      await authed(`/bookings/${id}`, { method: 'DELETE' }),
      await authed(`/bookings/${id}`, { method: 'PUT', body: stay('2027-06-20', '2027-06-23') }),
    ]) {
      assert.equal(res.status, 404)
      const { error } = await res.json()
      assert.equal(error.code, 'NOT_FOUND')
      assert.equal(error.message, 'Bookingen findes ikke længere')
    }
  })

  test('FR-010a: a bar sale is kept when its booking is deleted', async () => {
    const day = today()
    const tomorrow = new Date(Date.parse(day) + 86_400_000).toISOString().slice(0, 10)
    const booking = await (await create(stay(day, tomorrow))).json()
    const saleRes = await authed('/bar-sales', {
      method: 'POST',
      body: { drinkId: 1, quantity: 2, bookingId: booking.id },
    })
    assert.equal(saleRes.status, 201)
    const sale = await saleRes.json()
    await authed(`/bookings/${booking.id}`, { method: 'DELETE' })
    const { items } = await (await authed(`/bar-sales?date=${day}`)).json()
    assert.equal(items.find((item) => item.id === sale.id).bookingId, null)
  })

  test('FR-010: quantity 0 is 400 on quantity', async () => {
    const res = await authed('/bar-sales', { method: 'POST', body: { drinkId: 1, quantity: 0 } })
    assert.equal(res.status, 400)
    const { error } = await res.json()
    assert.equal(error.code, 'VALIDATION_ERROR')
    assert.equal(error.field, 'quantity')
  })

  test('FR-010: a day without sales has total 0 and no items', async () => {
    const res = await authed('/bar-sales?date=2027-06-01')
    assert.deepEqual(await res.json(), { total: 0, items: [] })
  })

  test('FR-013: the booking system key creates a booking without a cookie', async () => {
    const res = await call('/bookings', {
      method: 'POST',
      body: stay('2027-07-10', '2027-07-12'),
      headers: { 'X-API-Key': API_KEY },
    })
    assert.equal(res.status, 201)
    assert.equal((await res.json()).source, 'booking_system')
  })

  test('FR-013: a wrong key is 401', async () => {
    const res = await call('/bookings', {
      method: 'POST',
      body: stay('2027-07-20', '2027-07-22'),
      headers: { 'X-API-Key': 'x'.repeat(40) },
    })
    assert.equal(res.status, 401)
  })

  test('FR-013: a sold-out type via the key is 409', async () => {
    await create(stay('2027-08-10', '2027-08-12'))
    await create(stay('2027-08-10', '2027-08-12'))
    const res = await call('/bookings', {
      method: 'POST',
      body: stay('2027-08-10', '2027-08-12'),
      headers: { 'X-API-Key': API_KEY },
    })
    assert.equal(res.status, 409)
    assert.equal((await res.json()).error.code, 'ROOM_TYPE_FULLY_BOOKED')
  })

  test('004 FR-013: the booking system key can update a booking and the source is kept', async () => {
    const key = { 'X-API-Key': API_KEY }
    const { id } = await (
      await call('/bookings', { method: 'POST', body: stay('2028-02-10', '2028-02-12'), headers: key })
    ).json()
    const res = await call(`/bookings/${id}`, { method: 'PUT', body: stay('2028-02-10', '2028-02-13'), headers: key })
    assert.equal(res.status, 200)
    const booking = await res.json()
    assert.equal(booking.checkOut, '2028-02-13')
    assert.equal(booking.source, 'booking_system')
  })

  test('004 FR-013: the booking system key can update a back-office booking without changing its source', async () => {
    const { id } = await (await create(stay('2028-02-20', '2028-02-22'))).json()
    const res = await call(`/bookings/${id}`, {
      method: 'PUT',
      body: stay('2028-02-20', '2028-02-23'),
      headers: { 'X-API-Key': API_KEY },
    })
    assert.equal(res.status, 200)
    assert.equal((await res.json()).source, 'backoffice')
  })

  test('004 FR-013: the booking system key can delete a booking', async () => {
    const { id } = await (await create(stay('2028-03-10', '2028-03-12'))).json()
    assert.equal((await call(`/bookings/${id}`, { method: 'DELETE', headers: { 'X-API-Key': API_KEY } })).status, 204)
    assert.equal((await authed(`/bookings/${id}`)).status, 404)
  })

  test('004 FR-013: a wrong key cannot update or delete', async () => {
    const before = await (await create(stay('2028-03-20', '2028-03-22'))).json()
    const wrong = { 'X-API-Key': 'x'.repeat(40) }
    const put = await call(`/bookings/${before.id}`, {
      method: 'PUT',
      body: stay('2028-03-20', '2028-03-25'),
      headers: wrong,
    })
    assert.equal(put.status, 401)
    assert.equal((await call(`/bookings/${before.id}`, { method: 'DELETE', headers: wrong })).status, 401)
    assert.deepEqual(await (await authed(`/bookings/${before.id}`)).json(), before)
  })

  test('004 FR-013: the booking system key cannot read bookings', async () => {
    const { id } = await (await create(stay('2028-04-10', '2028-04-12'))).json()
    assert.equal((await call('/bookings', { headers: { 'X-API-Key': API_KEY } })).status, 401)
    assert.equal((await call(`/bookings/${id}`, { headers: { 'X-API-Key': API_KEY } })).status, 401)
  })

  test('FR-018 (003): the reception overview needs a session; the booking system key is 401', async () => {
    assert.equal((await call('/reception/overview')).status, 401)
    assert.equal((await call('/reception/overview', { headers: { 'X-API-Key': API_KEY } })).status, 401)
  })

  test('FR-002 (003): the overview has free + occupied = total for the fixture’s room type', async () => {
    const res = await authed('/reception/overview?date=2027-01-10')
    assert.equal(res.status, 200)
    const [type] = (await res.json()).rooms
    assert.equal(type.total, 2)
    assert.equal(type.free + type.occupied, type.total)
  })

  test('FR-005 (003): a room plan of 32 days is 400 on days', async () => {
    const res = await authed('/reception/room-plan?days=32')
    assert.equal(res.status, 400)
    const { error } = await res.json()
    assert.equal(error.code, 'VALIDATION_ERROR')
    assert.equal(error.field, 'days')
  })

  test('FR-018 (003): the room plan without a session is 401', async () => {
    assert.equal((await call('/reception/room-plan')).status, 401)
  })

  const score = (id, body, headers) => authed(`/bookings/${id}/satisfaction`, { method: 'PUT', body, headers })

  test('FR-018 (003): satisfaction needs a session; no cookie and the booking system key are 401', async () => {
    const { id } = await (await create(stay('2028-05-10', '2028-05-12'))).json()
    const url = `/bookings/${id}/satisfaction`
    assert.equal((await call(url, { method: 'PUT', body: { score: 4 } })).status, 401)
    const withKey = await call(url, { method: 'PUT', body: { score: 4 }, headers: { 'X-API-Key': API_KEY } })
    assert.equal(withKey.status, 401)
  })

  test('FR-011 (003): a score of 6 is 400 on score', async () => {
    const { id } = await (await create(stay('2028-05-20', '2028-05-22'))).json()
    const res = await score(id, { score: 6 })
    assert.equal(res.status, 400)
    assert.equal((await res.json()).error.field, 'score')
  })

  test('FR-011 (003): a score on an upcoming booking is 422 BOOKING_NOT_DEPARTED', async () => {
    const { id } = await (await create(stay('2028-06-10', '2028-06-12'))).json()
    const res = await score(id, { score: 4 })
    assert.equal(res.status, 422)
    assert.equal((await res.json()).error.code, 'BOOKING_NOT_DEPARTED')
  })

  test('FR-011 (003): a score on a booking departing today is saved', async () => {
    const { id } = await (await create(stay(addDays(today(), -2), today()))).json()
    const res = await score(id, { score: 4 })
    assert.equal(res.status, 200)
    assert.equal((await res.json()).satisfactionScore, 4)
  })

  // Only status and shape are checked, so the tests do not depend on bookings made by other tests
  test('FT17: the BI key reads /analytics/kpis without a cookie', async () => {
    const res = await call('/analytics/kpis', { headers: { Authorization: `Bearer ${BI_KEY}` } })
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(await res.json()))
  })

  test('FT17: /analytics without a cookie or key is 401', async () => {
    const res = await call('/analytics/kpis')
    assert.equal(res.status, 401)
    assert.equal((await res.json()).error.code, 'UNAUTHORIZED')
  })

  test('FT17: a wrong BI key is 401', async () => {
    assert.equal(
      (await call('/analytics/kpis', { headers: { Authorization: `Bearer ${'x'.repeat(38)}` } })).status,
      401,
    )
  })

  test('FT17: the BI key does not open the back office', async () => {
    assert.equal((await call('/bookings', { headers: { Authorization: `Bearer ${BI_KEY}` } })).status, 401)
  })

  test('FT17: the booking system key does not open /analytics', async () => {
    assert.equal((await call('/analytics/kpis', { headers: { 'X-API-Key': API_KEY } })).status, 401)
  })

  test('FT17: a logged-in user can read /analytics', async () => {
    const res = await authed('/analytics/room-nights')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(await res.json()))
  })
})
