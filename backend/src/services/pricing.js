import { AppError } from '../errors.js'

const DAY_MS = 86_400_000
const toUtc = (isoDate) => Date.parse(`${isoDate}T00:00:00Z`)
const toIso = (ms) => new Date(ms).toISOString().slice(0, 10)

// Half-open like a stay: yields checkIn up to, not including, checkOut
export function* eachNight(checkIn, checkOut) {
  for (let ms = toUtc(checkIn); ms < toUtc(checkOut); ms += DAY_MS) yield toIso(ms)
}

// One calendar covering all stays, so a stay's nights are a slice of it. Over many years ~1.3M room-nights fall on a
// few thousand dates, and formatting each night's date anew was most of the BI and revenue response time (006 FR-011)
export function stayCalendar(stays) {
  const first = stays.reduce((min, stay) => (stay.checkIn < min ? stay.checkIn : min), '9999-12-31')
  const last = stays.reduce((max, stay) => (stay.checkOut > max ? stay.checkOut : max), first)
  const indexOf = (date) => (toUtc(date) - toUtc(first)) / DAY_MS
  return { dates: [...eachNight(first, last)], span: (stay) => [indexOf(stay.checkIn), indexOf(stay.checkOut)] }
}

export const addDays = (isoDate, n) => toIso(toUtc(isoDate) + n * DAY_MS)

export const periodOn = (periods, date) => periods.find((p) => p.startDate <= date && date <= p.endDate)

/**
 * @param {{ checkIn: string, checkOut: string,
 *   periods: { seasonId: number, seasonName: string, startDate: string, endDate: string }[],
 *   prices: Map<number, number> }} input  prices: seasonId → øre per night
 */
export function calculateStayPrice({ checkIn, checkOut, periods, prices }) {
  const lines = []
  let totalOre = 0
  let nights = 0
  // each night is priced by its own season, so a stay can span two seasons (FR-008)
  for (const night of eachNight(checkIn, checkOut)) {
    const period = periodOn(periods, night)
    const pricePerNightOre = period && prices.get(period.seasonId)
    if (pricePerNightOre === undefined) {
      throw new AppError('PRICE_NOT_CONFIGURED', 'Der mangler en pris for værelsestypen i perioden')
    }
    const last = lines.at(-1)
    if (last?.season === period.seasonName) {
      last.nights++
      last.subtotalOre += pricePerNightOre
    } else {
      lines.push({ season: period.seasonName, nights: 1, pricePerNightOre, subtotalOre: pricePerNightOre })
    }
    totalOre += pricePerNightOre
    nights++
  }
  return { nights, lines, totalOre }
}
