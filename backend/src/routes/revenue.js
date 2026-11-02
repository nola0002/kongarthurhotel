import { Router } from 'express'
import { requireSession } from '../auth.js'

export function revenueRouter(revenueService) {
  return Router().get('/revenue', requireSession, async (req, res) =>
    res.json(await revenueService.getRevenue(req.query)),
  )
}
