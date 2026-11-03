// Generates db/02_seed.sql from the assignment's source files in db/source (004 research R1).
// Fully deterministic (fixed PRNG seed, fixed dates, no "today"), so everyone gets identical data and the committed
// file only changes when this script or the source files do.
import { readFileSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { calculateStayPrice } from '../src/services/pricing.js'
import { toKr, toOre } from '../src/money.js'

// From 2000, so the dashboard shows 25 years of trends through real crises (004 FR-016)
const SEED_START = '2000-01-01'
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
const yearOf = (isoDate) => Number(isoDate.slice(0, 4))

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
  value === null ? 'NULL' : typeof value === 'number' ? String(value) : `'${value.replaceAll("'", "''")}'`

const statements = []
// 1,000 rows per INSERT keeps each statement a readable size
function insert(table, columns, rows) {
  for (let i = 0; i < rows.length; i += 1000) {
    const values = rows.slice(i, i + 1000).map((row) => `(${row.map(sql).join(', ')})`)
    statements.push(`INSERT INTO ${table} (${columns.join(', ')}) VALUES\n${values.join(',\n')};`)
  }
  // Fixed ids bypass the identity sequence; move it past them so the next INSERT from the API gets a free id
  if (columns[0] === 'id')
    statements.push(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT MAX(id) FROM ${table}));`)
}

// --- Countries: the 20 in the booking file plus the hotel's other markets (004 FR-005, research R8) ---
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
// Share of the generated guests in 2000 and in 2025; years in between are interpolated, later years use 2025.
// Rough shape of Copenhagen hotel nights: Danes and neighbours first, Asia growing. Events are in countryFactor.
// prettier-ignore
const countryWeights = {
  DK: [22, 18], DE: [11, 10], SE: [9, 7], NO: [9, 7], GB: [7, 7], US: [7, 8], NL: [3, 3], IT: [3, 3], FR: [3, 3],
  ES: [2.5, 3], CH: [2, 2], PL: [0.5, 2], FI: [2, 2], AT: [1.2, 1.2], BE: [1.2, 1.2], IE: [0.8, 1], IS: [0.8, 0.5],
  PT: [0.6, 0.8], GR: [0.5, 0.5], CZ: [0.4, 0.6], EE: [0.2, 0.4], LT: [0.2, 0.4], UA: [0.3, 0.5], RU: [1, 2],
  TR: [0.4, 0.6], IL: [0.5, 0.6], AE: [0.1, 0.5], CN: [0.2, 2.5], JP: [1.5, 1.2], KR: [0.3, 1], IN: [0.4, 1.2],
  SG: [0.3, 0.5], TH: [0.2, 0.4], VN: [0.05, 0.3], PK: [0.1, 0.2], AU: [0.8, 1], NZ: [0.2, 0.3], CA: [1, 1],
  MX: [0.2, 0.4], BR: [0.3, 0.6], AR: [0.2, 0.3], ZA: [0.3, 0.3], EG: [0.1, 0.2], NG: [0.1, 0.2],
}
// prettier-ignore
const EUROPE = new Set([
  'DK', 'DE', 'SE', 'NO', 'GB', 'NL', 'IT', 'FR', 'ES', 'CH', 'PL', 'FI', 'AT', 'BE', 'IE', 'IS', 'PT', 'GR', 'CZ', 'EE',
  'LT', 'UA', 'RU',
])
const regionNames = new Intl.DisplayNames('da', { type: 'region' })
const countries = Object.keys(countryWeights).map((code) => ({ code, name: regionNames.of(code) }))
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

// Low is winter (January–March, November–19 December), mid is April–May and September–October, high is summer and
// Christmas 20–31 December (004 FR-003, research R6). Mid is 122 days, not 183, so it no longer earns more than high.
const yearPeriods = (year) => [
  [1, `${year}-01-01`, `${year}-03-31`],
  [2, `${year}-04-01`, `${year}-05-31`],
  [3, `${year}-06-01`, `${year}-08-31`],
  [2, `${year}-09-01`, `${year}-10-31`],
  [1, `${year}-11-01`, `${year}-12-19`],
  [3, `${year}-12-20`, `${year}-12-31`],
]
const SEED_YEARS = Array.from({ length: 2027 - 2000 + 1 }, (_, i) => 2000 + i)
const periods = SEED_YEARS.flatMap(yearPeriods).map(([seasonId, startDate, endDate]) => ({
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
// A map, not periods.find: the generator looks up ~10,000 days millions of times
const periodByDay = new Map()
for (const p of periods) {
  for (let day = p.startDate; day <= p.endDate; day = addDays(day, 1)) periodByDay.set(day, p)
}
const periodOn = (isoDate) => periodByDay.get(isoDate)

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

// --- History 2000–2024: demand and prices follow real events, so the dashboard shows trends (004 FR-016) ---
// Occupancy in a normal year (2025) per season; high > mid > low, also in revenue (004 FR-009)
const SEASON_OCCUPANCY = { 1: 0.55, 2: 0.72, 3: 0.88 }
// Demand per year relative to 2025: the dot-com crash, the financial crisis, steady growth, the war in Ukraine
// (energy prices and closed airspace); Covid-19 is in DEMAND_EVENTS, because it hit by month
// prettier-ignore
const DEMAND_BY_YEAR = {
  2000: 0.9, 2001: 0.84, 2002: 0.79, 2003: 0.78, 2004: 0.82, 2005: 0.85, 2006: 0.89, 2007: 0.92, 2008: 0.91,
  2009: 0.78, 2010: 0.82, 2011: 0.85, 2012: 0.86, 2013: 0.89, 2014: 0.93, 2015: 0.95, 2016: 0.97, 2017: 0.98,
  2018: 1.0, 2019: 1.03, 2020: 1.0, 2021: 1.0, 2022: 0.9, 2023: 0.96, 2024: 0.99,
}
const DEMAND_EVENTS = [
  ['2001-09-11', '2002-03-31', 0.85], // 9/11: transatlantic and business travel stops
  ['2003-03-20', '2003-06-30', 0.88], // Iraq war and SARS
  ['2008-09-15', '2008-12-31', 0.9], // Lehman Brothers falls: the financial crisis begins
  ['2009-12-07', '2009-12-18', 1.4], // COP15 climate summit in Copenhagen
  ['2014-05-04', '2014-05-11', 1.3], // Eurovision in Copenhagen
  ['2020-03-11', '2020-06-14', 0.08], // Covid-19: Denmark closes, borders shut until 15 June
  ['2020-06-15', '2020-08-31', 0.45], // summer 2020: mostly Danish guests
  ['2020-09-01', '2021-05-31', 0.15], // second wave and the winter lockdown
  ['2021-06-01', '2021-12-31', 0.6], // reopening with the corona passport
  ['2022-01-01', '2022-02-28', 0.7], // omicron; restrictions lifted 1 February
]
// Price level per year relative to 2025, for rooms and drinks: inflation, price cuts in 2009 and 2020, and the
// inflation after the invasion of Ukraine. History gets frozen prices (FR-009, FR-010); 2025 on uses the price list.
// prettier-ignore
const PRICE_INDEX = {
  2000: 0.62, 2001: 0.63, 2002: 0.63, 2003: 0.63, 2004: 0.64, 2005: 0.66, 2006: 0.69, 2007: 0.72, 2008: 0.75,
  2009: 0.7, 2010: 0.71, 2011: 0.73, 2012: 0.74, 2013: 0.75, 2014: 0.77, 2015: 0.79, 2016: 0.81, 2017: 0.83,
  2018: 0.85, 2019: 0.87, 2020: 0.78, 2021: 0.8, 2022: 0.9, 2023: 0.96, 2024: 0.98,
}
const priceIndexOn = (isoDate) => PRICE_INDEX[yearOf(isoDate)] ?? 1

const occupancyByDay = new Map(
  [...periodByDay].map(([day, period]) => {
    const event = DEMAND_EVENTS.find(([from, to]) => from <= day && day <= to)
    const target = SEASON_OCCUPANCY[period.seasonId] * (DEMAND_BY_YEAR[yearOf(day)] ?? 1) * (event?.[2] ?? 1)
    return [day, Math.min(target, 0.97)]
  }),
)

// Countries follow their own events on top of the total demand
function countryFactor(code, day) {
  if (code === 'RU') return day >= '2022-02-24' ? 0.05 : day >= '2014-03-01' ? 0.5 : 1 // Crimea, then the war
  if (code === 'UA' && day >= '2022-02-24') return 0.3
  if (code === 'CN' && day >= '2020-01-23' && day <= '2022-12-31') return 0.03 // zero-Covid until January 2023
  if ((code === 'US' || code === 'CA') && day >= '2001-09-11' && day <= '2002-12-31') return 0.6
  // Covid: travel restrictions hit long-haul guests, and Danes holidayed at home
  if (day >= '2020-03-11' && day <= '2021-12-31') return code === 'DK' ? 3 : EUROPE.has(code) ? 1 : 0.2
  return 1
}
function pickCountry(day) {
  const progress = Math.min(Math.max((yearOf(day) - 2000) / 25, 0), 1)
  const weights = Object.entries(countryWeights).map(([code, [from, to]]) => [
    code,
    (from + (to - from) * progress) * countryFactor(code, day),
  ])
  let r = random() * weights.reduce((total, [, weight]) => total + weight, 0)
  return weights.find(([, weight]) => (r -= weight) < 0)?.[0] ?? weights.at(-1)[0]
}

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

// A free room starts a stay on a day with chance q. With stays of L nights on average and q per empty day, the
// room is occupied L / (L + (1 - q) / q) of the time; solving for the day's target occupancy p gives q below.
const AVERAGE_STAY = 5.5 // randomInt(1, 10)
const startChance = (p) => p / (p + AVERAGE_STAY * (1 - p))

const generatedStays = []
for (const room of rooms) {
  let checkIn = SEED_START
  while (checkIn < SEED_END) {
    if (random() >= startChance(occupancyByDay.get(checkIn))) {
      checkIn = addDays(checkIn, 1)
      continue
    }
    const checkOut = addDays(checkIn, randomInt(1, 10))
    if (checkOut > SEED_END) break
    const blocking = staysByRoom.get(room.id).filter((stay) => stay.checkIn < checkOut && checkIn < stay.checkOut)
    if (blocking.length === 0) generatedStays.push({ room, checkIn, checkOut })
    // checkout day may equal the next check-in (half-open intervals); jump past an imported booking in the way
    checkIn = blocking.length ? blocking.map((stay) => stay.checkOut).sort()[0] : checkOut
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
    countryCode: pickCountry(stay.checkIn),
    guestCount: randomInt(1, stay.room.type.capacity),
    // Whole kroner, as a price list in an earlier year would have been
    totalPrice: toKr(Math.round((totalOre * priceIndexOn(stay.checkIn)) / 100) * 100),
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

// The bar sells in proportion to the guests in the house, so Covid and the crises also show in bar sales.
// Cocktails sell best in summer and in the evening, coffee in winter and in the daytime (FT15).
const COCKTAIL = 1
const COFFEE = 2
const CATEGORY_SEASON = { [COCKTAIL]: { 1: 0.8, 2: 1.0, 3: 1.3 }, [COFFEE]: { 1: 1.2, 2: 1.0, 3: 0.85 } } // category → season
const saleWeight = (categoryId, day) =>
  (inHouseByDay.get(day)?.length ?? 0) * CATEGORY_SEASON[categoryId][periodOn(day).seasonId]
const daysFrom = (first, last) => Array.from({ length: daysBetween(first, last) + 1 }, (_, i) => addDays(first, i))
const DAYS_2025 = daysFrom('2025-01-01', '2025-12-31')
const weightIn2025 = (categoryId) => DAYS_2025.reduce((total, day) => total + saleWeight(categoryId, day), 0)
const weight2025ByCategory = new Map(categories.map((c) => [c.id, weightIn2025(c.id)]))

const sales = []
function sell(drink, units, days) {
  const maxWeight = Math.max(...days.map((day) => saleWeight(drink.categoryId, day)))
  for (let left = units; left > 0;) {
    const day = pick(days)
    // rejection sampling: a day is kept in proportion to its weight
    if (random() * maxWeight >= saleWeight(drink.categoryId, day)) continue
    const quantity = Math.min(randomInt(1, 4), left)
    left -= quantity
    const hour = String(drink.categoryId === COFFEE ? randomInt(7, 16) : randomInt(16, 23)).padStart(2, '0')
    const minute = String(randomInt(0, 59)).padStart(2, '0')
    // ~1/3 is charged to a guest who stays at the hotel that day
    const inHouse = inHouseByDay.get(day) ?? []
    const booking = random() < 1 / 3 && inHouse.length > 0 ? pick(inHouse) : null
    sales.push({ drink, quantity, unitPriceOre: drink.priceOre, soldAt: `${day} ${hour}:${minute}:00`, booking })
  }
}
const DAYS_2026 = daysFrom('2026-01-01', SEED_SALES_END)
for (const drink of drinks) {
  sell(drink, drink.unitsSold, DAYS_2025)
  // same units per guest and season as 2025
  const weight2026 = DAYS_2026.reduce((total, day) => total + saleWeight(drink.categoryId, day), 0)
  sell(drink, Math.round((drink.unitsSold * weight2026) / weight2025ByCategory.get(drink.categoryId)), DAYS_2026)
}

// Before 2025 the bar's history is one daily total per drink, not single sales, which would be ~2 million rows
// (004 FR-012). Same units per guest as 2025, at that year's price; no booking, as the old till did not record one.
for (const day of daysFrom(SEED_START, '2024-12-31')) {
  for (const drink of drinks) {
    const expected = (drink.unitsSold * saleWeight(drink.categoryId, day)) / weight2025ByCategory.get(drink.categoryId)
    const quantity = Math.round(expected * (0.8 + 0.4 * random()))
    if (quantity === 0) continue
    const time = drink.categoryId === COFFEE ? '12:00:00' : '20:00:00'
    const unitPriceOre = Math.round(drink.priceOre * priceIndexOn(day))
    sales.push({ drink, quantity, unitPriceOre, soldAt: `${day} ${time}`, booking: null })
  }
}
sales.sort((a, b) => a.soldAt.localeCompare(b.soldAt))
insert(
  'bar_sales',
  ['id', 'drink_id', 'quantity', 'unit_price', 'sold_at', 'booking_id'],
  sales.map((s, index) => [index + 1, s.drink.id, s.quantity, toKr(s.unitPriceOre), s.soldAt, s.booking?.id ?? null]),
)

// --- Self-check: stop before writing if the data differs from the assignment (research R15) ---
assert.equal(rooms.length, 214)
assert.equal(roomTypes.length, 8)
assert.equal(
  rooms.reduce((sum, r) => sum + r.type.capacity, 0),
  428,
)
assert.equal(seasons.length, 3)
for (const code of Object.values(countryCodeByCsvName)) assert.ok(countryWeights[code], `country ${code}`)
for (let day = '2000-01-01'; day <= '2027-12-31'; day = addDays(day, 1)) {
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

// Occupancy and room revenue per year and season, the revenue of a stay spread evenly over its nights (FR-009, FR-016)
const roomNightsByYear = new Map()
const revenueByYearSeason = new Map()
for (const b of bookings) {
  const nightCount = daysBetween(b.checkIn, b.checkOut)
  for (let night = b.checkIn; night < b.checkOut; night = addDays(night, 1)) {
    const key = `${yearOf(night)}|${periodOn(night).seasonId}`
    roomNightsByYear.set(yearOf(night), (roomNightsByYear.get(yearOf(night)) ?? 0) + 1)
    revenueByYearSeason.set(key, (revenueByYearSeason.get(key) ?? 0) + b.totalPrice / nightCount)
  }
}
const occupancyIn = (year) =>
  roomNightsByYear.get(year) / (rooms.length * daysBetween(`${year}-01-01`, `${year + 1}-01-01`))
const occupancy2025 = occupancyIn(2025)
assert.ok(occupancy2025 >= 0.65 && occupancy2025 <= 0.8, `occupancy 2025 is ${occupancy2025}`)
assert.ok(occupancyIn(2020) < occupancyIn(2019) / 2, 'Covid-19 halves occupancy in 2020')
assert.ok(occupancyIn(2009) < occupancyIn(2007), 'the financial crisis lowers occupancy')
for (const year of SEED_YEARS.filter((y) => y < 2027 && (y < 2020 || y > 2021))) {
  const [low, mid, high] = [1, 2, 3].map((seasonId) => revenueByYearSeason.get(`${year}|${seasonId}`))
  assert.ok(high > mid && mid > low, `room revenue ${year}: low ${low}, mid ${mid}, high ${high}`)
}
assert.ok(
  bookings.filter((b) => b.countryCode === 'RU' && b.checkIn.startsWith('2023')).length <
    bookings.filter((b) => b.countryCode === 'RU' && b.checkIn.startsWith('2013')).length / 5,
  'Russian guests nearly vanish after the invasion of Ukraine',
)

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
const sales2025 = sales.filter((s) => s.soldAt.startsWith('2025'))
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
  const day = s.soldAt.slice(0, 10)
  // single sales from 2025; before that daily totals
  assert.ok(day <= SEED_SALES_END && s.quantity >= 1 && (day < '2025-01-01' || s.quantity <= 4), `sale on ${day}`)
  if (s.booking) assert.ok(s.booking.checkIn <= day && day < s.booking.checkOut)
}

// Single write so a reader (PostgreSQL starting up) never sees a half-written file
writeFileSync(
  new URL('../../db/02_seed.sql', import.meta.url),
  `-- GENERATED by backend/scripts/generate-seed.js – do not edit\n\n${statements.join('\n\n')}\n\n` +
    // Autovacuum only analyzes a table after ~50 changed rows, so the small lookup tables would never get planner
    // statistics, and grouping bar sales by drink would sort on disk instead of hashing (006 FR-011)
    'ANALYZE;\n',
)
console.log(`${bookings.length} bookings, ${sales.length} bar sales`)
