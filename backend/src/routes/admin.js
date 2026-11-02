import { Router } from 'express'
import { requireSession } from '../auth.js'

export function adminRouter(adminService) {
  return Router()
    .get('/admin/prices', requireSession, async (req, res) => res.json(await adminService.priceList()))
    .put('/admin/prices/:roomTypeId/:seasonId', requireSession, async (req, res) =>
      res.json(
        await adminService.setRoomPrice(Number(req.params.roomTypeId), Number(req.params.seasonId), req.body.price),
      ),
    )
    .put('/admin/drinks/:id', requireSession, async (req, res) =>
      res.json(await adminService.setDrinkPrice(Number(req.params.id), req.body.price)),
    )
}
