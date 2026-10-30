import { toKr } from '../money.js'
import { deriveStatus, isInHouseOn, toApi as toApiBooking } from './bookingService.js'
import { addDays, eachNight } from './pricing.js'

// R4: one formula for the overview and the plan, so the two screens can never disagree.
// isInHouseOn is half-open, so a departure day counts as free for a new arrival (FR-007 (003)).
function roomTypesWithFree(rooms, stays, dates) {
  return [...Map.groupBy(rooms, (room) => room.roomTypeId).values()].map((roomsOfType) => {
    const { roomTypeId, roomType } = roomsOfType[0]
    const staysOfType = stays.filter((stay) => stay.roomTypeId === roomTypeId)
    return {
      id: roomTypeId,
      name: roomType,
      rooms: roomsOfType.map(({ id, number }) => ({ id, number })),
      free: dates.map((date) => roomsOfType.length - staysOfType.filter((stay) => isInHouseOn(stay, date)).length),
    }
  })
}

export function createReceptionService({ roomRepo, bookingRepo, barRepo, today }) {
  return {
    // FR-002 (003): every count is computed here, so React only shows numbers (FR-017)
    async overview(date = today()) {
      const [rooms, stays, arrivals, departures, sales] = await Promise.all([
        roomRepo.listRooms(),
        roomRepo.listStays(date, addDays(date, 1)),
        // 500 is never reached: at most one arrival and one departure per room per day, and there are 214 rooms
        bookingRepo.list({ checkInAfter: addDays(date, -1), checkInOnOrBefore: date, limit: 500 }),
        bookingRepo.list({ checkOutAfter: addDays(date, -1), checkOutOnOrBefore: date, limit: 500 }),
        barRepo.listSales({ date }),
      ])
      const inHouse = stays.filter((stay) => isInHouseOn(stay, date))
      // Status stays relative to today, also when another date is shown (001)
      const day = today()
      return {
        date,
        arrivals: arrivals.rows.map((row) => toApiBooking(row, day)),
        departures: departures.rows.map((row) => toApiBooking(row, day)),
        inHouse: { bookings: inHouse.length, guests: inHouse.reduce((total, stay) => total + stay.guestCount, 0) },
        rooms: roomTypesWithFree(rooms, stays, [date]).map((type) => ({
          roomTypeId: type.id,
          roomType: type.name,
          total: type.rooms.length,
          occupied: type.rooms.length - type.free[0],
          free: type.free[0],
        })),
        barSalesTotal: toKr(sales.totalOre),
      }
    },

    // FR-005–FR-007 (003): "to" is exclusive, so it is both the day after the last date and the next period's "from"
    async roomPlan({ from = today(), days = 14 } = {}) {
      const to = addDays(from, days)
      const dates = [...eachNight(from, to)]
      const [rooms, stays] = await Promise.all([roomRepo.listRooms(), roomRepo.listStays(from, to)])
      const day = today()
      return {
        from,
        to,
        dates,
        roomTypes: roomTypesWithFree(rooms, stays, dates),
        stays: stays.map(({ roomTypeId, ...stay }) => ({ ...stay, status: deriveStatus(stay, day) })),
      }
    },
  }
}
