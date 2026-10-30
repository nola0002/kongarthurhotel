import { Router } from 'express'
import { allowBiKey } from '../auth.js'

const TABLES = {
  'room-nights': (service) => service.roomNights(),
  occupancy: (service) => service.occupancy(),
  bookings: (service) => service.bookings(),
  'bar-sales': (service) => service.barSales(),
  kpis: (service) => service.kpis(),
  calendar: (service) => service.calendar(),
  'room-types': (service) => service.roomTypes(),
  countries: (service) => service.countries(),
}

// GET only: the dashboard has read access and nothing else (FR-014/FT17)
export function analyticsRouter(analyticsService) {
  const router = Router()
  // Tableau's REST API connector tests the base URL before it reads a table, so the base must answer 200
  router.get('/analytics', allowBiKey, (req, res) =>
    res.json(Object.keys(TABLES).map((table) => ({ table, path: `/api/analytics/${table}` }))),
  )
  for (const [table, load] of Object.entries(TABLES)) {
    router.get(`/analytics/${table}`, allowBiKey, async (req, res) => res.json(await load(analyticsService)))
  }
  return router
}
