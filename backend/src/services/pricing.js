import { AppError } from '../errors.js'

const DAY_MS = 86_400_000
const toUtc = (isoDate) => Date.parse(`${isoDate}T00:00:00Z`)
const toIso = (ms) => new Date(ms).toISOString().slice(0, 10)

// Half-open like a stay: yields checkIn up to, not including, checkOut
export function* eachNight(checkIn, checkOut) {
  for (let ms = toUtc(checkIn); ms < toUtc(checkOut); ms += DAY_MS) yield toIso(ms)
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
