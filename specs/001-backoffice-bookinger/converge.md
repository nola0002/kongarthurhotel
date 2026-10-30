# Converge: 001-backoffice-bookinger

**Dato**: 2026-10-29 · **Task**: T070 · **Krav**: KB-D4

Koden er sammenholdt med `spec.md`, `plan.md`, `tasks.md` og constitution. Udgangspunktet var
den nuværende kode, ikke afkrydsningerne i `tasks.md`. Grundlaget: `docker compose exec backend
npm test` giver 50/50 grønne, og alle 16 quickstart-scenarier er verificeret på API-niveau med
`curl`. UI-flowene er **ikke** klikket igennem i en browser endnu. Det er T069.

## Krav → implementering

| Krav | Status | Hvor |
|---|---|---|
| FR-001 Liste med gæst, land, værelse, type, datoer, gæster, pris | ✅ | `backend/src/repositories/bookingRepository.js` (`list`), `backend/src/services/bookingService.js` (`listBookings`, `toApi`), `frontend/src/pages/Bookings.jsx` |
| FR-002 Søg på delvist navn (case-insensitive) og filtrér på dato | ✅ | `bookingRepository.js` (`LIKE`), `bookingService.js` (`isInHouseOn`, `tightest`), `Bookings.jsx` (`?q=`, `?dato=`) |
| FR-003 Opret booking | ✅ | `bookingService.js` (`createBooking`), `backend/src/routes/bookings.js` (`POST`), `frontend/src/BookingForm.jsx` |
| FR-004 Rediger alle felter | ✅ | `bookingService.js` (`updateBooking`), `PUT /bookings/:id`, `BookingForm.jsx` (rediger-tilstand) |
| FR-005 Slet med bekræftelse | ✅ | `bookingService.js` (`deleteBooking`), `DELETE /bookings/:id`, `frontend/src/pages/BookingDetail.jsx` (`<dialog>`) |
| FR-006 Kapacitet | ✅ | `bookingService.js` (`validate` → `CAPACITY_EXCEEDED`), `db/01_schema.sql` (`CHECK guest_count > 0`), OpenAPI `minimum: 1` |
| FR-007 Tildeling uden overlap, også ved samtidighed | ✅ | `bookingService.js` (`assignRoomAndPrice`), `backend/src/repositories/roomRepository.js` (`FOR UPDATE`, halvåbent overlap), `backend/src/db.js` (`READ COMMITTED`). Samtidighedstest i `backend/test/api.test.js` |
| FR-008 Pris pr. nat efter sæson, vist før gem | ✅ | `backend/src/services/pricing.js` (`calculateStayPrice`), `GET /bookings/quote`, prisboks i `BookingForm.jsx` |
| FR-009 Pris fastfryses på bookingen | ✅ | `bookings.total_price` (`db/01_schema.sql`). `BookingDetail.jsx` viser kun den gemte total |
| FR-010 Barsalg med drink, antal ≥ 1 og pris på salgstidspunktet | ✅ | `backend/src/services/barService.js` (`registerSale`), `backend/src/repositories/barRepository.js`, `frontend/src/pages/BarSales.jsx` |
| FR-010a Salg på booking i huset, bevares ved sletning | ✅ | `barService.js` (`isInHouseOn`), `bar_sales.booking_id ... ON DELETE SET NULL`, tile i `BookingDetail.jsx` |
| FR-011 Drinkkategorier | ✅ | `drink_categories` i `db/01_schema.sql`, gruppering i `BarSales.jsx` |
| FR-012 Stamdata som data | ✅ | Tabellerne `room_types`, `rooms`, `seasons`, `season_periods`, `room_prices`, `drinks`. `db/02_seed.sql` genereres af `backend/scripts/generate-seed.js` |
| FR-013 Bookingsystem via API-nøgle, samme regler, kilde | ✅ | `backend/src/auth.js` (`allowBookingSystemKey`), `bookings.source`, `SourceBadge` i `Bookings.jsx` og `BookingDetail.jsx` |
| FR-014 Forståelige danske fejl med felt eller regel | ✅ (se afvigelse 3) | `backend/src/errors.js`, `FieldError`/`ErrorBanner` i `frontend/src/ui.jsx` |
| FR-015 Login, scrypt-hash, ingen data uden login | ✅ | `backend/src/services/authService.js`, `backend/src/routes/auth.js`, `requireSession`, `frontend/src/main.jsx` (loader), `frontend/src/pages/Login.jsx` |
| FR-016 Tildelt værelse vises og beholdes ved redigering | ✅ | `assignRoomAndPrice` (`currentRoomId`), toast i `BookingForm.jsx` |
| US0–US6 (alle acceptkriterier) | ✅ API · ⏳ UI | Verificeret med `curl` og tests. Gennemklikning i browser venter på T069 |
| SC-003 Dobbeltbooking og kapacitet afvises | ✅ | Tests med `FR-006`/`FR-007` i `backend/test/bookingService.test.js` og `api.test.js` |
| SC-004 Pris matcher manuel beregning | ✅ | `backend/test/pricing.test.js` (sæsonskifte og årsskifte) |
| SC-005 Ingen sletning uden bekræftelse | ✅ | `<dialog>` i `BookingDetail.jsx`, hvor "Annullér" har fokus som standard |
| SC-006 Ekstern booking synlig ved næste indlæsning | ✅ | Samme tabel og samme `GET /bookings` |
| SC-001, SC-002, SC-007 (tidsmål) | ⏳ | Måles først ved gennemklikningen i T069 |
| Constitution I–VI | ✅ | Tre lag (SQL kun i `repositories/`), `backend/openapi.yaml` + validator + Swagger, regler i `services/`, én `docker compose up` med healthcheck og volume, `npm test` |

## Afvigelser (bevidste og dokumenterede)

1. Swagger-filen er mountet på `/spec/openapi.yaml` i stedet for `/openapi.yaml`, fordi
   imagets nginx ellers giver 404. Beskrevet i plan.md.
2. `db/00_test-db.sh` kalder `mysql` direkte i stedet for `docker_process_sql`, fordi Docker
   Desktop (macOS/Windows) viser filen som eksekverbar. Så virker scriptet, uanset om
   entrypointet kører eller sourcer det, og `db/.gitattributes` tvinger LF. Beskrevet i plan.md.
3. `frontend/src/api.js` forventer altid JSON i fejlsvar. Svarer Vite-proxyen med en HTML-fejl
   (fx 502, mens backend genstarter), vises en teknisk engelsk besked. Det rammer ikke
   FR-014, fordi backend altid svarer `{ error }`. Det er accepteret.
4. Kolonnerne i bookinglisten kan ikke sorteres (`aria-sort` i `docs/design/komponenter.md`).
   API'et sorterer kun på ankomst, og hverken spec, plan eller tasks kræver sortering.
5. `frontend/src/format.js` og `ui.jsx` har nogle få hjælpere ud over listen i T020/T021
   (`time`, `dateTime`, `period`, `SourceBadge`, `ErrorBanner`, `FieldError`). De bruges af
   skærmene, er ikke nye features og er dokumenteret i `docs/design/komponenter.md`.

## Mangler

- **T069** (eksisterende): Klik de 16 quickstart-scenarier igennem i browseren fra en tom
  maskine, og mål SC-001, SC-002 og SC-007.
- ~~**T071**~~ ✅ Løst: `FR-010: quantity 0 is 400 on quantity` i `backend/test/api.test.js`
  dækker US5/AC2 (barsalg med antal 0 afvises).
