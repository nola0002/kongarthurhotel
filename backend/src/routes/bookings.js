import { Router } from 'express'
import { allowBookingSystemKey, requireSession } from '../auth.js'

export function bookingsRouter(bookingService) {
  return (
    Router()
      .get('/bookings', requireSession, async (req, res) => res.json(await bookingService.listBookings(req.query)))
      // Registered before /bookings/:id, so "quote" is not read as an id
      .get('/bookings/quote', requireSession, async (req, res) => res.json(await bookingService.quote(req.query)))
      .get('/bookings/:id', requireSession, async (req, res) =>
        res.json(await bookingService.getBooking(Number(req.params.id))),
      )
      .post('/bookings', allowBookingSystemKey, async (req, res) =>
        res.status(201).json(await bookingService.createBooking(req.body, req.bookingSource)),
      )
      .put('/bookings/:id', allowBookingSystemKey, async (req, res) =>
        res.json(await bookingService.updateBooking(Number(req.params.id), req.body)),
      )
      // Session only: the folio and the registrations are reception work, not the booking system's (005 FR-021)
      .get('/bookings/:id/folio', requireSession, async (req, res) =>
        res.json(await bookingService.getFolio(Number(req.params.id))),
      )
      .post('/bookings/:id/check-in', requireSession, async (req, res) =>
        res.json(await bookingService.checkIn(Number(req.params.id))),
      )
      .post('/bookings/:id/check-out', requireSession, async (req, res) =>
        res.json(await bookingService.checkOut(Number(req.params.id))),
      )
      // Session only: the booking system's key may not register satisfaction (FR-018 (003))
      .put('/bookings/:id/satisfaction', requireSession, async (req, res) =>
        res.json(await bookingService.registerSatisfaction(Number(req.params.id), req.body.score)),
      )
      .delete('/bookings/:id', allowBookingSystemKey, async (req, res) => {
        await bookingService.deleteBooking(Number(req.params.id))
        res.sendStatus(204)
      })
  )
}
