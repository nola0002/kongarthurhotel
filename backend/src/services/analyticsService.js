import { toKr } from '../money.js'
import { nights } from './bookingService.js'
import { eachNight, periodOn, stayCalendar } from './pricing.js'

const yearOf = (date) => Number(date.slice(0, 4))
export const sum = (values) => values.reduce((a, b) => a + b, 0)
// Empty periods give 0 instead of NaN, so Tableau shows a number rather than a gap
export const ratio = (numerator, denominator) => (denominator === 0 ? 0 : numerator / denominator)

// FR-015: the frozen total_price (FR-009) is split over the nights in proportion to each night's current season
// price. Rounding down per night and putting the remainder on the last night makes the nights sum to the total exactly.
export function allocateRevenue(totalOre, weights) {
  const weightSum = sum(weights)
  const shares = weights.map((weight) =>
    weightSum === 0 ? Math.floor(totalOre / weights.length) : Math.floor((totalOre * weight) / weightSum),
  )
  shares[shares.length - 1] += totalOre - sum(shares)
  return shares
}

// R10: whole calendar years from the earliest to the latest year in the data, so a fact row is never outside
// the calendar; the calendar and the KPIs both use this, so they always have the same years (FR-017, FR-018)
function calendarYears({ periods, bookings, barSales }) {
  const years = [
    ...periods.flatMap((period) => [period.startDate, period.endDate]),
    ...bookings.flatMap((booking) => [booking.checkIn, booking.checkOut]),
    ...barSales.map((sale) => sale.date),
  ].map(yearOf)
  if (years.length === 0) return []
  // reduce, not Math.min(...years): spreading 100k+ dates overflows the call stack
  const first = years.reduce((a, b) => Math.min(a, b))
  const last = years.reduce((a, b) => Math.max(a, b))
  return Array.from({ length: last - first + 1 }, (_, i) => first + i)
}

export function createAnalyticsService({ analyticsRepo }) {
  async function loadRoomNights() {
    const [bookings, periods, roomTypes] = await Promise.all([
      analyticsRepo.listBookings(),
      analyticsRepo.listPeriods(),
      analyticsRepo.listRoomTypes(),
    ])
    const pricesByType = new Map(roomTypes.map((type) => [type.name, type.prices]))
    // Each date is also matched to its season once, not once per night
    const calendar = stayCalendar(bookings)
    const seasonsOfCalendar = calendar.dates.map((date) => periodOn(periods, date))
    const roomNights = bookings.flatMap((booking) => {
      const [start, end] = calendar.span(booking)
      const dates = calendar.dates.slice(start, end)
      const seasons = seasonsOfCalendar.slice(start, end)
      const prices = pricesByType.get(booking.roomType)
      const revenues = allocateRevenue(
        booking.totalPriceOre,
        seasons.map((period) => prices?.get(period?.seasonId) ?? 0),
      )
      return dates.map((date, i) => ({
        date,
        roomType: booking.roomType,
        countryCode: booking.countryCode,
        revenueOre: revenues[i],
      }))
    })
    return { bookings, periods, roomTypes, roomNights }
  }

  // FT5: available = rooms of the type on every date a season period covers; rooms out of service are not modelled
  function occupancyRows({ periods, roomTypes, roomNights }) {
    // date → room type → count; nested instead of a joined "date|type" key, which built a new string per night
    const sold = new Map()
    for (const { date, roomType } of roomNights) {
      if (!sold.has(date)) sold.set(date, new Map())
      const byType = sold.get(date)
      byType.set(roomType, (byType.get(roomType) ?? 0) + 1)
    }
    return periods.flatMap((period) =>
      // eachNight is half-open, so the period's end date is added to include it
      [...eachNight(period.startDate, period.endDate), period.endDate].flatMap((date) =>
        roomTypes.map((type) => {
          const soldRoomNights = sold.get(date)?.get(type.name) ?? 0
          return {
            date,
            roomType: type.name,
            availableRoomNights: type.roomCount,
            soldRoomNights,
            occupancyRate: ratio(soldRoomNights, type.roomCount),
          }
        }),
      ),
    )
  }

  const toBookingRow = (booking) => ({
    bookingId: booking.id,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    roomType: booking.roomType,
    countryCode: booking.countryCode,
    guestCount: booking.guestCount,
    nights: nights(booking.checkIn, booking.checkOut),
    revenue: toKr(booking.totalPriceOre),
    satisfactionScore: booking.satisfactionScore,
  })

  const toBarSaleRow = (sale) => ({
    saleId: sale.id,
    date: sale.date,
    drink: sale.drink,
    category: sale.category,
    quantity: sale.quantity,
    revenue: toKr(sale.quantity * sale.unitPriceOre),
  })

  return {
    async calendar() {
      const [periods, bookings, barSales] = await Promise.all([
        analyticsRepo.listPeriods(),
        analyticsRepo.listBookings(),
        analyticsRepo.listBarSales(),
      ])
      const years = calendarYears({ periods, bookings, barSales })
      if (years.length === 0) return []
      return [...eachNight(`${years[0]}-01-01`, `${years.at(-1) + 1}-01-01`)].map((date) => ({
        date,
        year: yearOf(date),
        month: Number(date.slice(5, 7)),
        season: periodOn(periods, date)?.seasonName ?? null,
      }))
    },

    async roomTypes() {
      return (await analyticsRepo.listRoomTypes()).map((type) => ({
        roomType: type.name,
        capacity: type.capacity,
        rooms: type.roomCount,
      }))
    },

    async countries() {
      return (await analyticsRepo.listCountries()).map(({ code, name, iso3 }) => ({
        countryCode: code,
        iso3,
        country: name,
      }))
    },

    async roomNights() {
      const { roomNights } = await loadRoomNights()
      // Fields listed instead of rest/spread, which is several times slower over ~1.3M rows
      return roomNights.map(({ date, roomType, countryCode, revenueOre }) => ({
        date,
        roomType,
        countryCode,
        revenue: toKr(revenueOre),
      }))
    },

    async occupancy() {
      return occupancyRows(await loadRoomNights())
    },

    async bookings() {
      return (await analyticsRepo.listBookings()).map(toBookingRow)
    },

    async barSales() {
      return (await analyticsRepo.listBarSales()).map(toBarSaleRow)
    },

    // A4 / FR-011: the authoritative KPI formulas; Tableau only aggregates and filters the other endpoints
    async kpis() {
      const [loaded, barSales, categories] = await Promise.all([
        loadRoomNights(),
        analyticsRepo.listBarSales(),
        analyticsRepo.listDrinkCategories(),
      ])
      const occupancy = occupancyRows(loaded)
      const bookingRows = loaded.bookings.map(toBookingRow)
      const sales = barSales.map((sale) => ({ ...sale, revenueOre: sale.quantity * sale.unitPriceOre }))
      const years = calendarYears({ periods: loaded.periods, bookings: loaded.bookings, barSales })
      const generatedAt = new Date().toISOString()

      // Grouped once instead of filtering every row list again for each of the ~30 years
      const byYear = (rows, dateField = 'date') => Map.groupBy(rows, (row) => yearOf(row[dateField]))
      const nightsByYear = byYear(loaded.roomNights)
      const occupancyByYear = byYear(occupancy)
      // FT6: a booking counts in its check-in year
      const bookingsByYear = byYear(bookingRows, 'checkIn')
      const salesByYear = byYear(sales)
      // FT12: the score is given at check-out, so it counts in the check-out year, not the check-in year (R8)
      const checkOutsByYear = byYear(loaded.bookings, 'checkOut')

      return years.flatMap((year) => {
        const inYear = (groups) => groups.get(year) ?? []
        const nightsInYear = inYear(nightsByYear)
        const occupancyInYear = inYear(occupancyByYear)
        const bookingsInYear = inYear(bookingsByYear)
        const salesInYear = inYear(salesByYear)
        const roomRevenueOre = sum(nightsInYear.map((night) => night.revenueOre))
        const barRevenueOre = sum(salesInYear.map((sale) => sale.revenueOre))
        // null = not registered, so it is not a response
        const scores = inYear(checkOutsByYear)
          .map((booking) => booking.satisfactionScore)
          .filter((score) => score != null)
        const row = (kpi, label, value, unit, dimension = null) => ({
          year,
          kpi,
          label,
          dimension,
          value,
          unit,
          generatedAt,
        })

        return [
          row(
            'occupancyRate',
            'Belægningsgrad',
            ratio(
              sum(occupancyInYear.map((day) => day.soldRoomNights)),
              sum(occupancyInYear.map((day) => day.availableRoomNights)),
            ),
            'percent',
          ),
          row('roomRevenue', 'Værelsesindtjening', toKr(roomRevenueOre), 'DKK'),
          // Rounded to whole øre, so the average is a real DKK amount
          row(
            'avgPricePerNight',
            'Gns. pris pr. nat',
            toKr(Math.round(ratio(roomRevenueOre, nightsInYear.length))),
            'DKK',
          ),
          row(
            'avgStayLength',
            'Gns. opholdslængde',
            ratio(sum(bookingsInYear.map((booking) => booking.nights)), bookingsInYear.length),
            'nights',
          ),
          row('bookings', 'Bookinger', bookingsInYear.length, 'count'),
          row('guests', 'Gæster', sum(bookingsInYear.map((booking) => booking.guestCount)), 'count'),
          row('customerSatisfaction', 'Kundetilfredshed', ratio(sum(scores), scores.length), 'score'),
          row('satisfactionResponses', 'Besvarelser', scores.length, 'count'),
          row('barRevenue', 'Barsalg', toKr(barRevenueOre), 'DKK'),
          // FT15: categories come from the database, so a new category gets a row without code changes
          ...categories.map((category) =>
            row(
              'barRevenueShare',
              'Andel af barsalg',
              ratio(
                sum(salesInYear.filter((sale) => sale.category === category).map((sale) => sale.revenueOre)),
                barRevenueOre,
              ),
              'percent',
              category,
            ),
          ),
        ]
      })
    },
  }
}
