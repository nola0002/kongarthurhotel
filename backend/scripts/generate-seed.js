// Generates db/02_seed.sql from the assignment's source files in db/source (004 research R1).
// Fully deterministic (fixed PRNG seed, fixed dates, no "today"), so everyone gets identical data and the committed
// file only changes when this script or the source files do.
import { readFileSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { calculateStayPrice } from '../src/services/pricing.js'
import { toKr, toOre } from '../src/money.js'

const SEED_START = '2025-01-01'
const SEED_END = '2027-02-28'
const SEED_SALES_END = '2026-11-05' // the day before the presentation: no sales and no booking created in the future
// Scores only up to the first day the seed is used, so no guest has a score before the departure day (003 FR-011, T047)
const SEED_SCORES_END = '2026-10-30'

// mulberry32: tiny seeded PRNG; Math.random cannot be seeded
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const random = mulberry32(20261106)
const randomInt = (min, max) => min + Math.floor(random() * (max - min + 1))
const pick = (list) => list[Math.floor(random() * list.length)]

const DAY_MS = 86_400_000
const toMs = (isoDate) => Date.parse(`${isoDate}T00:00:00Z`)
const addDays = (isoDate, days) => new Date(toMs(isoDate) + days * DAY_MS).toISOString().slice(0, 10)
const daysBetween = (from, to) => (toMs(to) - toMs(from)) / DAY_MS

// The source files have no quotes and no commas inside fields, so two splits are enough (004 research R2)
function readSourceCsv(fileName, columnCount) {
  const lines = readFileSync(new URL(`../../db/source/${fileName}`, import.meta.url), 'utf8').split(/\r?\n/)
  return lines
    .slice(1)
    .filter((line) => line !== '')
    .map((line, index) => {
      const fields = line.split(',')
      assert.equal(fields.length, columnCount, `${fileName} line ${index + 2}`)
      return fields
    })
}

const sql = (value) =>
  value === null
    ? 'NULL'
    : typeof value === 'number'
      ? String(value)
      : `'${value.replaceAll('\\', '\\\\').replaceAll("'", "''")}'`

const statements = []
// 1,000 rows per INSERT keeps statements small enough for MySQL's max_allowed_packet
function insert(table, columns, rows) {
  for (let i = 0; i < rows.length; i += 1000) {
    const values = rows.slice(i, i + 1000).map((row) => `(${row.map(sql).join(', ')})`)
    statements.push(`INSERT INTO ${table} (${columns.join(', ')}) VALUES\n${values.join(',\n')};`)
  }
}

// --- Countries: exactly the 20 in the booking file (004 FR-005, research R8) ---
// A fixed table: a reverse lookup via Intl.DisplayNames('en') gives outdated codes (France → FX, Russia → SU)
const countryCodeByCsvName = {
  Australia: 'AU',
  Brazil: 'BR',
  Canada: 'CA',
  China: 'CN',
  Egypt: 'EG',
  France: 'FR',
  Germany: 'DE',
  India: 'IN',
  Italy: 'IT',
  Japan: 'JP',
  Mexico: 'MX',
  Nigeria: 'NG',
  Pakistan: 'PK',
  Russia: 'RU',
  'South Korea': 'KR',
  Spain: 'ES',
  Sweden: 'SE',
  'United Kingdom': 'GB',
  'United States': 'US',
  Vietnam: 'VN',
}
const regionNames = new Intl.DisplayNames('da', { type: 'region' })
const countries = Object.values(countryCodeByCsvName).map((code) => ({ code, name: regionNames.of(code) }))
insert(
  'countries',
  ['code', 'name'],
  countries.map((c) => [c.code, c.name]),
)

// --- Room types and rooms: the assignment's 8 types, 214 rooms, 428 guests (004 FR-001, FR-002, research R4) ---
// csvName is only used to import the booking file, so it lives here and not in the database
const roomTypes = [
  { id: 1, name: 'Standard enkeltværelse', csvName: 'Standard Single', capacity: 1, rooms: 46 },
  { id: 2, name: 'Grand lit værelse', csvName: 'Grand Lit', capacity: 2, rooms: 30 },
  { id: 3, name: 'Standard dobbeltværelse', csvName: 'Standard Double', capacity: 2, rooms: 50 },
  { id: 4, name: 'Superior dobbeltværelse', csvName: 'Superior Double', capacity: 2, rooms: 40 },
  { id: 5, name: 'Junior suite', csvName: 'Junior Suite', capacity: 3, rooms: 14 },
  { id: 6, name: 'Spa executive', csvName: 'Spa Executive', capacity: 2, rooms: 18 },
  { id: 7, name: 'Suite', csvName: 'Suite', capacity: 4, rooms: 10 },
  { id: 8, name: 'LOFT suite', csvName: 'LOFT Suite', capacity: 4, rooms: 6 },
]
insert(
  'room_types',
  ['id', 'name', 'capacity'],
  roomTypes.map((t) => [t.id, t.name, t.capacity]),
)

// 36 rooms per floor in type order, numbered floor × 100 + position: 101–136 … 601–634 (research R5)
const ROOMS_PER_FLOOR = 36
const rooms = roomTypes
  .flatMap((type) => Array(type.rooms).fill(type))
  .map((type, index) => ({
    id: index + 1,
    number: String((Math.floor(index / ROOMS_PER_FLOOR) + 1) * 100 + (index % ROOMS_PER_FLOOR) + 1),
    type,
  }))
insert(
  'rooms',
  ['id', 'room_number', 'room_type_id'],
  rooms.map((r) => [r.id, r.number, r.type.id]),
)

// --- Seasons, periods, prices ---
const seasons = [
  { id: 1, name: 'Lavsæson', csvName: 'low' },
  { id: 2, name: 'Mellemsæson', csvName: 'mid' },
  { id: 3, name: 'Højsæson', csvName: 'high' },
]
insert(
  'seasons',
  ['id', 'name'],
  seasons.map((s) => [s.id, s.name]),
)

// Low is winter, mid is spring and autumn, high is summer and Christmas 20–31 December (004 FR-003, research R6).
// The last day of February is the day before 1 March, so leap years work too.
const yearPeriods = (year) => [
  [1, `${year}-01-01`, addDays(`${year}-03-01`, -1)],
  [2, `${year}-03-01`, `${year}-05-31`],
  [3, `${year}-06-01`, `${year}-08-31`],
  [2, `${year}-09-01`, `${year}-11-30`],
  [1, `${year}-12-01`, `${year}-12-19`],
  [3, `${year}-12-20`, `${year}-12-31`],
]
const periods = [2025, 2026, 2027].flatMap(yearPeriods).map(([seasonId, startDate, endDate]) => ({
  seasonId,
  seasonName: seasons[seasonId - 1].name,
  startDate,
  endDate,
}))
insert(
  'season_periods',
  ['season_id', 'start_date', 'end_date'],
  periods.map((p) => [p.seasonId, p.startDate, p.endDate]),
)
const periodOn = (isoDate) => periods.find((p) => p.startDate <= isoDate && isoDate <= p.endDate)

// Low = the assignment's lowest price, high = its highest, mid = the midpoint (004 FR-004, research R7).
// The booking file's prices per night vary per row and partly lie outside these ranges; the list follows the
// assignment's text, and the imported bookings keep their own frozen price.
const pricesKr = {
  1: [900, 1050, 1200],
  2: [1100, 1250, 1400],
  3: [1200, 1400, 1600],
  4: [1400, 1700, 2000],
  5: [1800, 2150, 2500],
  6: [2000, 2400, 2800],
  7: [2500, 3000, 3500],
  8: [3000, 3500, 4000],
} // by room type, then season
insert(
  'room_prices',
  ['room_type_id', 'season_id', 'price_per_night'],
  roomTypes.flatMap((t) => seasons.map((s) => [t.id, s.id, pricesKr[t.id][s.id - 1]])),
)
const pricesOreByRoomType = new Map(
  roomTypes.map((t) => [t.id, new Map(seasons.map((s) => [s.id, toOre(String(pricesKr[t.id][s.id - 1]))]))]),
)

// --- Bookings ---
const staysByRoom = new Map(rooms.map((room) => [room.id, []]))
const isFree = (room, checkIn, checkOut) =>
  staysByRoom.get(room.id).every((stay) => !(stay.checkIn < checkOut && checkIn < stay.checkOut))
const createdAt = (checkIn) =>
  // booked two weeks ahead, but never after SEED_SALES_END, so no booking shows a creation date in the future
  `${addDays(checkIn, -14) < SEED_SALES_END ? addDays(checkIn, -14) : SEED_SALES_END} 12:00:00`

// The assignment's 1000 bookings, row N = booking N, all nights in one 2025 period of the row's season
// (004 FR-008, research R3, R10)
let repairedNames = 0
const imported = readSourceCsv('international_names_with_rooms_1000.csv', 7).map(
  ([firstName, csvFamilyName, country, roomType, daysRented, season, price], index) => {
    const row = index + 1
    // The CSV export lost the "ü" in Müller (U+FFFD); the assignment's xlsx version of the same file has "Müller"
    const familyName = csvFamilyName.replaceAll('�', 'ü')
    if (familyName !== csvFamilyName) {
      assert.equal(familyName, 'Müller', `row ${row}`)
      repairedNames++
    }
    const type = roomTypes.find((t) => t.csvName === roomType)
    const seasonId = seasons.find((s) => s.csvName === season)?.id
    const countryCode = countryCodeByCsvName[country]
    assert.ok(type && seasonId && countryCode, `row ${row}: unknown room type, season or country`)
    const nights = Number(daysRented)
    const arrivals = periods
      .filter((p) => p.seasonId === seasonId && p.startDate.startsWith('2025'))
      .flatMap((p) =>
        Array.from({ length: daysBetween(p.startDate, p.endDate) + 2 - nights }, (_, i) => addDays(p.startDate, i)),
      )
    const typeRooms = rooms.filter((r) => r.type === type)
    for (let attempt = 0; attempt < 200; attempt++) {
      const checkIn = pick(arrivals)
      const checkOut = addDays(checkIn, nights)
      const room = typeRooms.find((r) => isFree(r, checkIn, checkOut))
      if (!room) continue
      const booking = {
        id: row,
        firstName,
        familyName,
        countryCode,
        room,
        checkIn,
        checkOut,
        guestCount: randomInt(1, type.capacity),
        totalPrice: Number(price),
        source: 'booking_system',
        seasonId,
      }
      staysByRoom.get(room.id).push(booking)
      return booking
    }
    throw new Error(`row ${row}: no free ${roomType} for ${nights} nights in ${season} season 2025`)
  },
)

// The rest is filled around the imported bookings with the booking file's own names and countries (research R11)
const unique = (values) => [...new Set(values)]
const firstNames = unique(imported.map((b) => b.firstName))
const familyNames = unique(imported.map((b) => b.familyName))
const countryCodes = unique(imported.map((b) => b.countryCode))

// Chance of 1–5 empty days after a stay; fewer gaps in high season, so occupancy differs by season in BI (FT5)
const gapChanceBySeason = { 1: 1.0, 2: 0.85, 3: 0.45 }

const generatedStays = []
for (const room of rooms) {
  let checkIn = addDays(SEED_START, randomInt(0, 3))
  while (true) {
    const checkOut = addDays(checkIn, randomInt(1, 10))
    if (checkOut > SEED_END) break
    const blocking = staysByRoom.get(room.id).filter((stay) => stay.checkIn < checkOut && checkIn < stay.checkOut)
    let next = checkOut
    if (blocking.length) {
      // jump past the imported booking that is in the way
      next = blocking.map((stay) => stay.checkOut).sort()[0]
    } else {
      generatedStays.push({ room, checkIn, checkOut })
    }
    // checkout day may equal the next check-in (half-open intervals)
    checkIn = addDays(next, random() < gapChanceBySeason[periodOn(next).seasonId] ? randomInt(1, 5) : 0)
  }
}
generatedStays.sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.room.id - b.room.id)

const generated = generatedStays.map((stay, index) => {
  const { totalOre } = calculateStayPrice({
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    periods,
    prices: pricesOreByRoomType.get(stay.room.type.id),
  })
  const booking = {
    id: 1001 + index,
    ...stay,
    firstName: pick(firstNames),
    familyName: pick(familyNames),
    countryCode: pick(countryCodes),
    guestCount: randomInt(1, stay.room.type.capacity),
    totalPrice: toKr(totalOre),
    source: 'backoffice',
  }
  staysByRoom.get(stay.room.id).push(booking)
  return booking
})
const bookings = [...imported, ...generated]

// Generated scores: the assignment's data has none, and the dashboard needs realistic data (003 FR-015, research R9).
// About 80 % of departed guests answer: 5: 45 %, 4: 35 %, 3: 12 %, 2: 5 %, 1: 3 % (average about 4.1).
// A PRNG stream of its own, so adding scores does not reshuffle the rest of the seed.
const scoreRandom = mulberry32(12)
const SCORE_SHARES = [
  [5, 0.45],
  [4, 0.35],
  [3, 0.12],
  [2, 0.05],
  [1, 0.03],
]
function satisfactionScore(checkOut) {
  if (checkOut > SEED_SCORES_END || scoreRandom() >= 0.8) return null
  let r = scoreRandom()
  // The shares sum to 1 up to float rounding, so a draw past the last share counts as the last score
  return SCORE_SHARES.find(([, share]) => (r -= share) < 0)?.[0] ?? 1
}
for (const b of bookings) b.satisfactionScore = satisfactionScore(b.checkOut)

insert(
  'bookings',
  [
    'id',
    'first_name',
    'family_name',
    'country_code',
    'room_id',
    'check_in',
    'check_out',
    'guest_count',
    'total_price',
    'source',
    'satisfaction_score',
    'created_at',
  ],
  bookings.map((b) => [
    b.id,
    b.firstName,
    b.familyName,
    b.countryCode,
    b.room.id,
    b.checkIn,
    b.checkOut,
    b.guestCount,
    b.totalPrice,
    b.source,
    b.satisfactionScore,
    createdAt(b.checkIn),
  ]),
)

// --- Drinks: Helene Christine's 20 cocktails and 10 coffees from the drinks file (004 FR-011, research R12) ---
const categories = [
  { id: 1, name: 'Cocktail', csvName: 'Cocktail' },
  { id: 2, name: 'Kaffe', csvName: 'Coffee' },
]
insert(
  'drink_categories',
  ['id', 'name'],
  categories.map((c) => [c.id, c.name]),
)
const drinks = readSourceCsv('drinks_menu_with_sales.csv', 4).map(([name, category, price, unitsSold], index) => {
  const categoryId = categories.find((c) => c.csvName === category)?.id
  assert.ok(categoryId, `drink ${name}: unknown category ${category}`)
  return { id: index + 1, name, categoryId, priceOre: toOre(price), unitsSold: Number(unitsSold) }
})
insert(
  'drinks',
  ['id', 'name', 'drink_category_id', 'price'],
  drinks.map((d) => [d.id, d.name, d.categoryId, toKr(d.priceOre)]),
)

// --- Bar sales: 2025 is exactly the file's "Units Sold" per drink; 2026 follows the same rate up to
// SEED_SALES_END (004 FR-012). All sales are Helene Christine's: she is the only bartender, so there is no
// employee column. ---
const inHouseByDay = new Map()
for (const b of bookings) {
  for (let day = b.checkIn; day < b.checkOut; day = addDays(day, 1)) {
    if (!inHouseByDay.has(day)) inHouseByDay.set(day, [])
    inHouseByDay.get(day).push(b)
  }
}

const sales = []
function sell(drink, units, firstDay, days) {
  for (let left = units; left > 0;) {
    const quantity = Math.min(randomInt(1, 4), left)
    left -= quantity
    const day = addDays(firstDay, randomInt(0, days - 1))
    const hour = String(randomInt(8, 23)).padStart(2, '0')
    const minute = String(randomInt(0, 59)).padStart(2, '0')
    // ~1/3 is charged to a guest who stays at the hotel that day
    const inHouse = inHouseByDay.get(day) ?? []
    const booking = random() < 1 / 3 && inHouse.length > 0 ? pick(inHouse) : null
    sales.push({ drink, quantity, soldAt: `${day} ${hour}:${minute}:00`, booking })
  }
}
const DAYS_2026 = daysBetween('2026-01-01', SEED_SALES_END) + 1
for (const drink of drinks) {
  sell(drink, drink.unitsSold, '2025-01-01', 365)
  sell(drink, Math.round((drink.unitsSold * DAYS_2026) / 365), '2026-01-01', DAYS_2026)
}
sales.sort((a, b) => a.soldAt.localeCompare(b.soldAt))
insert(
  'bar_sales',
  ['id', 'drink_id', 'quantity', 'unit_price', 'sold_at', 'booking_id'],
  sales.map((s, index) => [index + 1, s.drink.id, s.quantity, toKr(s.drink.priceOre), s.soldAt, s.booking?.id ?? null]),
)

// --- Self-check: stop before writing if the data differs from the assignment (research R15) ---
assert.equal(rooms.length, 214)
assert.equal(roomTypes.length, 8)
assert.equal(
  rooms.reduce((sum, r) => sum + r.type.capacity, 0),
  428,
)
assert.equal(seasons.length, 3)
assert.equal(countries.length, 20)
for (let day = '2025-01-01'; day <= '2027-12-31'; day = addDays(day, 1)) {
  assert.equal(periods.filter((p) => p.startDate <= day && day <= p.endDate).length, 1, `periods on ${day}`)
}

assert.equal(imported.length, 1000)
assert.equal(repairedNames, 54)
for (const b of imported) {
  assert.ok(b.checkIn.startsWith('2025'), `booking ${b.id} arrives in 2025`)
  for (let night = b.checkIn; night < b.checkOut; night = addDays(night, 1)) {
    assert.equal(periodOn(night).seasonId, b.seasonId, `booking ${b.id} night ${night}`)
  }
}
for (const b of bookings) {
  assert.ok(![b.firstName, b.familyName].some((name) => name.includes('�')), `booking ${b.id} name`)
  assert.ok(b.guestCount >= 1 && b.guestCount <= b.room.type.capacity, `booking ${b.id} guest count`)
}
for (const stays of staysByRoom.values()) {
  stays.sort((a, b) => a.checkIn.localeCompare(b.checkIn))
  stays.slice(1).forEach((stay, i) => assert.ok(stays[i].checkOut <= stay.checkIn, `booking ${stay.id} overlaps`))
}

const departed = bookings.filter((b) => b.checkOut <= SEED_SCORES_END)
const scores = departed.map((b) => b.satisfactionScore).filter((score) => score !== null)
assert.ok(
  bookings.every((b) => b.satisfactionScore === null || b.checkOut <= SEED_SCORES_END),
  'score before departure',
)
assert.ok(Math.abs(scores.length / departed.length - 0.8) < 0.02, 'satisfaction response rate')
assert.ok(Math.abs(scores.reduce((sum, s) => sum + s, 0) / scores.length - 4.14) < 0.05, 'average satisfaction')

assert.equal(drinks.length, 30)
assert.equal(drinks.filter((d) => d.categoryId === 1).length, 20)
const sales2025 = sales.filter((s) => s.soldAt < '2026-01-01')
for (const drink of drinks) {
  const units = sales2025.filter((s) => s.drink === drink).reduce((sum, s) => sum + s.quantity, 0)
  assert.equal(units, drink.unitsSold, `units of ${drink.name} in 2025`)
}
// Catches a drinks export with wrong prices (research R2)
assert.equal(
  sales2025.reduce((sum, s) => sum + s.quantity * s.drink.priceOre, 0),
  1_344_864_034,
)
for (const s of sales) {
  assert.ok(s.soldAt.slice(0, 10) <= SEED_SALES_END && s.quantity >= 1 && s.quantity <= 4)
  const day = s.soldAt.slice(0, 10)
  if (s.booking) assert.ok(s.booking.checkIn <= day && day < s.booking.checkOut)
}

// Single write so a reader (MySQL starting up) never sees a half-written file
writeFileSync(
  new URL('../../db/02_seed.sql', import.meta.url),
  `-- GENERATED by backend/scripts/generate-seed.js – do not edit\n\n-- The mysql client in the container defaults to latin1; Danish names must arrive as UTF-8\nSET NAMES utf8mb4;\n\n${statements.join('\n\n')}\n`,
)
console.log(`${bookings.length} bookings, ${sales.length} bar sales`)
