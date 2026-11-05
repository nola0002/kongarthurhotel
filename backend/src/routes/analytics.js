import { Router } from 'express'
import { promisify } from 'node:util'
import { gzip } from 'node:zlib'
import { allowBiKey } from '../auth.js'

const gzipAsync = promisify(gzip)

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

// 006 FR-012: the connector pages with offset/limit, so it never parses a whole 100+ MB table at once.
// Simplification: every page builds the whole table and slices it; page in SQL if a refresh gets too slow
const page = (rows, { offset = 0, limit }) =>
  rows.slice(Number(offset), limit === undefined ? undefined : Number(offset) + Number(limit))

// 006 FR-013: the JSON compresses ~20×, which matters when Tableau runs on another machine than the API
async function sendJson(req, res, rows) {
  const body = JSON.stringify(rows)
  res.type('json').vary('Accept-Encoding')
  if (!req.acceptsEncodings('gzip')) return res.send(body)
  res.set('Content-Encoding', 'gzip').send(await gzipAsync(body))
}

// GET only: the dashboard has read access and nothing else (FR-014/FT17)
export function analyticsRouter(analyticsService) {
  const router = Router()
  // Tableau's REST API connector tests the base URL before it reads a table, so the base must answer 200
  router.get('/analytics', allowBiKey, (req, res) =>
    res.json(Object.keys(TABLES).map((table) => ({ table, path: `/api/analytics/${table}` }))),
  )
  for (const [table, load] of Object.entries(TABLES)) {
    router.get(`/analytics/${table}`, allowBiKey, async (req, res) =>
      sendJson(req, res, page(await load(analyticsService), req.query)),
    )
  }
  return router
}
