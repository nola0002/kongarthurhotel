import { Router } from 'express'
import { requireSession } from '../auth.js'

export function authRouter(authService) {
  return Router()
    .post('/auth/login', async (req, res) => {
      const user = await authService.login(req.body.username, req.body.password)
      req.session = { userId: user.id, username: user.username }
      res.sendStatus(204)
    })
    .post('/auth/logout', requireSession, (req, res) => {
      // Simplification: cookie sessions cannot be revoked server-side; logout clears the cookie
      req.session = null
      res.sendStatus(204)
    })
    .get('/auth/me', requireSession, (req, res) => res.json({ username: req.session.username }))
}
