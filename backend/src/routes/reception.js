import { Router } from 'express'
import { requireSession } from '../auth.js'

// Session only: the booking system's key gives no access to the reception screens (FR-018 (003))
export function receptionRouter(receptionService) {
  return Router()
    .get('/reception/overview', requireSession, async (req, res) =>
      res.json(await receptionService.overview(req.query.date)),
    )
    .get('/reception/room-plan', requireSession, async (req, res) =>
      res.json(await receptionService.roomPlan(req.query)),
    )
}
