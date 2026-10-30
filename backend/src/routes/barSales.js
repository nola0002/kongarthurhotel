import { Router } from 'express'
import { requireSession } from '../auth.js'

export function barSalesRouter(barService) {
  return Router()
    .get('/bar-sales', requireSession, async (req, res) => res.json(await barService.listSales(req.query)))
    .post('/bar-sales', requireSession, async (req, res) =>
      res.status(201).json(await barService.registerSale(req.body)),
    )
}
