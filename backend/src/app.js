import express from 'express'
import cookieSession from 'cookie-session'
import * as OpenApiValidator from 'express-openapi-validator'
import { fileURLToPath } from 'node:url'
import { withTransaction } from './db.js'
import { errorHandler } from './errors.js'
import { today } from './today.js'
import * as analyticsRepo from './repositories/analyticsRepository.js'
import * as barRepo from './repositories/barRepository.js'
import * as bookingRepo from './repositories/bookingRepository.js'
import * as pricingRepo from './repositories/pricingRepository.js'
import * as referenceRepo from './repositories/referenceRepository.js'
import * as roomRepo from './repositories/roomRepository.js'
import * as userRepo from './repositories/userRepository.js'
import { createAnalyticsService } from './services/analyticsService.js'
import { createAuthService } from './services/authService.js'
import { createBarService } from './services/barService.js'
import { createBookingService } from './services/bookingService.js'
import { createReceptionService } from './services/receptionService.js'
import { analyticsRouter } from './routes/analytics.js'
import { authRouter } from './routes/auth.js'
import { barSalesRouter } from './routes/barSales.js'
import { bookingsRouter } from './routes/bookings.js'
import { receptionRouter } from './routes/reception.js'
import { referenceDataRouter } from './routes/referenceData.js'

// Composition root: the only place services are wired to the real repositories
export const authService = createAuthService({ userRepo })
const bookingService = createBookingService({
  bookingRepo,
  roomRepo,
  pricingRepo,
  referenceRepo,
  withTransaction,
  today,
})
const barService = createBarService({ barRepo, referenceRepo, bookingRepo, today })
const analyticsService = createAnalyticsService({ analyticsRepo })
const receptionService = createReceptionService({ roomRepo, bookingRepo, barRepo, today })

const app = express()
app.set('trust proxy', 1)
app.use(express.json())
app.use(
  cookieSession({
    name: 'session',
    secret: process.env.SESSION_SECRET,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 12 * 3600 * 1000,
  }),
)
app.use(
  OpenApiValidator.middleware({
    apiSpec: fileURLToPath(new URL('../openapi.yaml', import.meta.url)),
    validateRequests: true,
    validateResponses: false,
    // Auth is per route in auth.js; the validator would only check that a cookie or header exists
    validateSecurity: false,
    // 'full' so impossible dates such as 2026-02-30 are rejected
    ajvFormats: { mode: 'full' },
  }),
)
app.use(
  '/api',
  authRouter(authService),
  bookingsRouter(bookingService),
  referenceDataRouter({ bookingService, barService }),
  barSalesRouter(barService),
  analyticsRouter(analyticsService),
  receptionRouter(receptionService),
)
app.use(errorHandler)

export default app
