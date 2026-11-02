import { AppError } from '../errors.js'
import { toKr } from '../money.js'
import { allocateRevenue, ratio, sum } from './analyticsService.js'
import { nights } from './bookingService.js'
import { eachNight, periodOn } from './pricing.js'

// FR-015: three years including a leap day; longer day grouping gives more bars than the page can show
const MAX_DAYS_GROUPED_BY_DAY = 1096
// Same period keys as DATE_FORMAT in revenueRepository: YYYY-MM-DD, YYYY-MM, YYYY
const PERIOD_LENGTH = { day: 10, month: 7, year: 4 }

const totalOre = (rows) => sum(rows.map((row) => row.totalOre))
const inCategory = (rows, category) => rows.filter((row) => row.category === category)
const ascending = (entries) => [...entries].sort(([a], [b]) => a.localeCompare(b))

function barRevenue(rows, drinks, categories) {
  const barTotalOre = totalOre(rows)
  return {
    totalOre: barTotalOre,
    total: toKr(barTotalOre),
    quantity: sum(rows.map((row) => row.quantity)),
    // FT15: categories come from the database, so every category is listed, also with 0
    byCategory: categories.map((category) => {
      const rowsOfCategory = inCategory(rows, category)
      return {
        category,
        total: toKr(totalOre(rowsOfCategory)),
        quantity: sum(rowsOfCategory.map((row) => row.quantity)),
        share: ratio(totalOre(rowsOfCategory), barTotalOre),
      }
    }),
    byPeriod: ascending(Map.groupBy(rows, (row) => row.period)).map(([period, rowsOfPeriod]) => ({
      period,
      total: toKr(totalOre(rowsOfPeriod)),
      categories: categories.map((category) => ({
        category,
        total: toKr(totalOre(inCategory(rowsOfPeriod, category))),
      })),
    })),
    topDrinks: drinks
      .toSorted((a, b) => b.totalOre - a.totalOre)
      .slice(0, 5)
      .map(({ drink, category, quantity, totalOre }) => ({ drink, category, quantity, total: toKr(totalOre) })),
  }
}

// Each booking's frozen price is split over its nights as in BI (002 FR-015), so a stay over a period boundary
// counts in both periods and the revenue page agrees with Tableau. Only the nights inside [from, to] count.
function roomRevenue({ bookings, periods, prices, from, to, groupBy }) {
  const priceOf = new Map(prices.map((price) => [`${price.roomTypeId}|${price.seasonId}`, price.priceOre]))
  // Cached per date: 2000–today is over a million nights, and periodOn scans every season period
  const seasonIds = new Map()
  const seasonIdOn = (date) => {
    if (!seasonIds.has(date)) seasonIds.set(date, periodOn(periods, date)?.seasonId)
    return seasonIds.get(date)
  }
  const byPeriod = new Map()
  let nightCount = 0
  for (const booking of bookings) {
    const dates = [...eachNight(booking.checkIn, booking.checkOut)]
    const shares = allocateRevenue(
      booking.totalPriceOre,
      dates.map((date) => priceOf.get(`${booking.roomTypeId}|${seasonIdOn(date)}`) ?? 0),
    )
    dates.forEach((date, i) => {
      if (date < from || date > to) return
      const period = date.slice(0, PERIOD_LENGTH[groupBy])
      byPeriod.set(period, (byPeriod.get(period) ?? 0) + shares[i])
      nightCount++
    })
  }
  const roomTotalOre = sum([...byPeriod.values()])
  return {
    totalOre: roomTotalOre,
    total: toKr(roomTotalOre),
    nights: nightCount,
    byPeriod: ascending(byPeriod).map(([period, ore]) => ({ period, total: toKr(ore) })),
  }
}

export function createRevenueService({ revenueRepo }) {
  return {
    // 005 FR-014: `from` and `to` are both inclusive
    async getRevenue({ from, to, groupBy = 'month' }) {
      if (to < from) {
        throw new AppError('VALIDATION_ERROR', 'Til-datoen skal ligge efter fra-datoen', { field: 'to' })
      }
      if (groupBy === 'day' && nights(from, to) + 1 > MAX_DAYS_GROUPED_BY_DAY) {
        throw new AppError('VALIDATION_ERROR', 'Vælg måned eller år for perioder over 3 år', { field: 'groupBy' })
      }
      const [barRows, drinks, categories, bookings, periods, prices] = await Promise.all([
        revenueRepo.listBarByPeriodAndCategory(from, to, groupBy),
        revenueRepo.listBarByDrink(from, to),
        revenueRepo.listDrinkCategories(),
        revenueRepo.listBookings(from, to),
        revenueRepo.listPeriods(),
        revenueRepo.listPrices(),
      ])
      const { totalOre: barOre, ...bar } = barRevenue(barRows, drinks, categories)
      const { totalOre: roomsOre, ...rooms } = roomRevenue({ bookings, periods, prices, from, to, groupBy })
      return { from, to, groupBy, total: toKr(barOre + roomsOre), bar, rooms }
    },
  }
}
