import { Router } from 'express'
import { requireSession } from '../auth.js'

export function referenceDataRouter({ bookingService, barService }) {
  return Router()
    .get('/room-types', requireSession, async (req, res) => res.json(await bookingService.listRoomTypes(req.query)))
    .get('/countries', requireSession, async (req, res) => res.json(await bookingService.listCountries()))
    .get('/drinks', requireSession, async (req, res) => res.json(await barService.listDrinks()))
}
