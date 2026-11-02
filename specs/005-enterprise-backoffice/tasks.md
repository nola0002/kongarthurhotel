# Tasks: Enterprise back office (005)

**Input**: `specs/005-enterprise-backoffice/` (spec, plan, research, data-model, contracts, quickstart)

**Tests**: Påkrævet af `docs/retningslinjer/tests.md`: hver ny forretningsregel og hvert nøgletal får en
service-test med falsk repository, og de vigtigste endpoints en API-test.

**Agenter**: Hver task har en agent i parentes (B1, B2, F1, F2, F3). En agent ændrer kun sine
egne filer (plan § Project Structure). Kontrakten er `backend/openapi.yaml`.

## Format: `[ID] [P?] [Story] (Agent) Description`

---

## Phase 1: Setup (fælles fundament, lavet før agenterne starter)

- [X] T001 Facadefotoet lagt i `frontend/public/kong-arthur-facade.webp`
- [X] T002 `checked_in_at DATETIME NULL` og `checked_out_at DATETIME NULL` på `bookings` i `db/01_schema.sql`
- [X] T003 Fejlkoderne `INVALID_STATUS` (422) og `WRONG_PASSWORD` (422) og nye feltnavne i `backend/src/errors.js`
- [X] T004 Kontrakten for alle nye endpoints, felter og statusser i `backend/openapi.yaml` (research R1)
- [X] T005 `npm test` kører serielt (`--test-concurrency=1`) i `backend/package.json`, fordi API-testene deler testdatabasen
- [X] T006 Udviklingsdatabasen nulstillet med det nye skema (`docker compose down -v && docker compose up -d --build`)

---

## Phase 2: Foundational (blokerer US1–US3)

- [X] T007 (B1) Udvid `deriveStatus(booking, today)` i `backend/src/services/bookingService.js` til de seks statusser i data-model.md. `toApi` og `SELECT_BOOKING` i `backend/src/repositories/bookingRepository.js` giver `checkedInAt`/`checkedOutAt` (ISO uden offset, `T` i stedet for mellemrum, eller `null`). `registerSatisfaction` kræver today ≥ checkOut (research R3)
- [X] T008 (B1) Tests i `backend/test/bookingService.test.js`: hver af de seks statusser, inkl. "ankom før i dag uden registrering = in_house" og "tilfredshed tilladt på afrejsedagen"
- [X] T009 (F1) Statustabellen `STATUS` i `frontend/src/ui.jsx` får `departing` ("Rejser i dag") og `checked_out` ("Tjekket ud"), med markør og pille efter `docs/design/komponenter.md`

---

## Phase 3: User Story 1 – Dagens drift på forsiden (P1)

**Goal**: Forsiden viser fire nøgletal, ankomster og afrejser med ind-/udtjek.
**Independent Test**: quickstart Q2–Q4.

- [X] T010 [US1] (B1) `checkIn(id)` og `checkOut(id)` i `bookingService.js`: kun ved status `arriving` hhv. `departing`, ellers `AppError('INVALID_STATUS', …)` med dansk besked. `markCheckedIn`/`markCheckedOut` (sæt `NOW()`) i `bookingRepository.js`. Routes `POST /bookings/:id/check-in` og `/check-out` med `requireSession` i `backend/src/routes/bookings.js`
- [X] T011 [US1] (B1) `kpis` i `receptionService.overview`: `occupancy {occupied,total,rate}`, `arrivals {remaining,total}`, `departures {remaining,total}`, `averageRate` (gennemsnit af totalPrice/nætter for nattens ophold, 0 hvis ingen), præcis som i `ReceptionOverview` i openapi.yaml, i `backend/src/services/receptionService.js`
- [X] T012 [P] [US1] (B1) Tests: ind-/udtjek (gyldig, to gange, forkert dag) i `backend/test/bookingService.test.js` og kpis (fx 180/214 = 0,8411, remaining) i `backend/test/receptionService.test.js`. API-test for check-in 200/422 og at bookingsystemets nøgle afvises, i `backend/test/api.test.js`
- [X] T013 [US1] (F2) Ny forside i `frontend/src/pages/Overview.jsx`: fire nøgletalsfliser fra `kpis` (belægning i nat, ankomster tilbage/i alt, afrejser tilbage/i alt, gns. pris pr. nat), ankomster og afrejser med statusmærke og knapperne "Tjek ind"/"Tjek ud" (kalder API'et og revaliderer), "Registrér tilfredshed" efter udtjek (genbrug `SatisfactionDialog.jsx`), "Ny booking"-knap (`useShell().newBooking`), ledige værelser pr. type og dagens barsalg. Datovælger som i dag

---

## Phase 4: User Story 2 – Bookinglisten (P1)

**Goal**: Paginering, sortering og filtre på serveren.
**Independent Test**: quickstart Q5.

- [X] T014 [US2] (B1) `listBookings` i `bookingService.js` og `list`/`count`/`where` i `bookingRepository.js`: `page` (klemmes til 1..pageCount), `pageSize` (standard 50), `sort` via whitelist (`checkIn`→`b.check_in`, `checkOut`→`b.check_out`, `guest`→`b.family_name, b.first_name`, `nights`→`DATEDIFF(b.check_out, b.check_in)`, `totalPrice`→`b.total_price`, `nearest`→`ABS(DATEDIFF(b.check_in, ?))` med today), `order` (standard `desc` for `departed`, ellers `asc`), id som tiebreaker, `LIMIT ? OFFSET ?` med `pool.query`, filtrene `roomTypeId`, `countryCode`, `from`/`to` (overlap: `check_in <= to AND check_out > from`), og et rent tal i `q` matcher også `b.id = ?` og `r.room_number = ?` (research R4, R5). Svar: `total, totalPrice, counts, page, pageSize, pageCount, items`. `counts` bruger alle filtre undtagen `view`. Opdater `receptionService` og andre kaldere, der brugte `limit`
- [X] T015 [P] [US2] (B1) Tests: side klemmes, pageCount ≥ 1, sorteringens whitelist (ukendt værdi kommer aldrig til SQL), tal i `q` i `backend/test/bookingService.test.js`. Ret de to API-tests, der brugte `limit`, og tilføj en API-test for `page`/`pageSize`/`sort` i `backend/test/api.test.js`
- [X] T016 [US2] (F2) `frontend/src/pages/Bookings.jsx`: URL-state `side`, `pr-side` (25/50/100), `sorter`, `orden`, `visning`, `q`, `type`, `land`, `fra`, `til`. Filterlinje (søgning, værelsestype og land fra `/room-types` og `/countries`, periode med to `<input type="date">`, "Ryd filtre"), faner med antal, sorterbare kolonner (`SortHeader`: knap i `<th>` med `aria-sort`) og `Pagination` (forrige/næste/første/sidste, "fra–til af total") under tabellen i `frontend/src/Pagination.jsx` (ny, F2), sum i bunden. Et filter nulstiller siden til 1

---

## Phase 5: User Story 3 – Bookingens folio (P1)

**Goal**: Detaljesiden viser nætter, barsalg, regning og handlinger.
**Independent Test**: quickstart Q6.

- [X] T017 [US3] (B1) `getFolio(id)` i `bookingService.js`: booking, nætter med dato, sæson og andel af prisen fordelt med `allocateRevenue` fra `backend/src/services/analyticsService.js` efter nattens sæsonpris (research R6), barsalg på bookingen (`barRepo.listSales({ bookingId })`, giv `barRepo` til `createBookingService` i `backend/src/app.js` – koordinér: B2 ejer app.js, så B1 beskriver ændringen i sin rapport, og B2 tilføjer den), regning `{stay, bar, total}`. Route `GET /bookings/:id/folio`
- [X] T018 [P] [US3] (B1) Tests: nætternes priser summerer til totalPrice ved et ophold over et sæsonskifte, regning = ophold + bar, i `backend/test/bookingService.test.js`
- [X] T019 [US3] (F2) `frontend/src/pages/BookingDetail.jsx` henter `/bookings/:id/folio`: hoved med gæst, status og handlinger (Ret, Slet med bekræftelse, Tjek ind, Tjek ud, Registrér tilfredshed, "Sælg på værelset" → `/barsalg?booking=:id`, kun når gyldige), kort for gæst, ophold (inkl. ind-/udtjekningstid), nætter (tabel dato/sæson/pris med sum), barsalg (tabel med sum) og regning (ophold, bar, total)

---

## Phase 6: User Story 4 – Barsalg som kasse (P2)

**Goal**: Kasse med kurv og samlet afslutning.
**Independent Test**: quickstart Q7.

- [X] T020 [US4] (B2) `registerOrder({ bookingId, items })` i `backend/src/services/barService.js`: alle drinks findes, gæsten bor i dag (som `registerSale`), alle linjer indsættes i `withTransaction` (`insertSale` tager en `conn`), svar `{ total, items }`. Route `POST /bar-sales/orders` i `backend/src/routes/barSales.js`. `withTransaction` gives til `createBarService` i `backend/src/app.js`
- [X] T021 [P] [US4] (B2) Tests i `backend/test/barService.test.js`: total = Σ linjer, ukendt drink i én linje → ingen indsættes, gæst ikke i huset → `BOOKING_NOT_IN_HOUSE`
- [X] T022 [US4] (F3) `frontend/src/pages/BarSales.jsx` som kasse: drinks som store knapper grupperet efter kategori (faner eller to kolonner), et klik lægger 1 i kurven, ordrepanel med linjer (+/− og fjern), total, "Betalt direkte" eller "Læg på værelse" (vælg blandt gæster i huset fra `GET /bookings?view=in_house&pageSize=250&sort=guest`, forvalgt fra `?booking=`), afslut med `POST /bar-sales/orders`, toast og tom kurv. Ingen historik, kun et link til Omsætning. Totalen i kurven er et visningsoverslag. Det autoritative beløb er API'ets svar

---

## Phase 7: User Story 5 – Omsætning (P2)

**Goal**: Baromsætning (primært) og værelsesomsætning for en periode.
**Independent Test**: quickstart Q8.

- [X] T023 [US5] (B2) `backend/src/repositories/revenueRepository.js` (ny): bar aggregeret pr. periode og kategori (`DATE_FORMAT(sold_at, '%Y-%m-%d' | '%Y-%m' | '%Y')`, `SUM(quantity * unit_price)`, `SUM(quantity)`), top-drinks og listen over kategorier. Bookinger, der overlapper perioden (check_in, check_out, total_price, room_type_id), og sæsonperioder/priser via `pricingRepository`
- [X] T024 [US5] (B2) `backend/src/services/revenueService.js` (ny): validering (`to` < `from` → 400 `VALIDATION_ERROR` field `to`; `groupBy=day` over 1096 dage → field `groupBy`), andele pr. kategori (alle kategorier, også 0), top 5, værelsesnætter i perioden fordelt med `allocateRevenue` og summeret pr. periode, `total = bar + rooms`, præcis formen `Revenue` i openapi.yaml. Route `GET /revenue` i `backend/src/routes/revenue.js` (ny) med `requireSession`. Wiring i `backend/src/app.js`
- [X] T025 [P] [US5] (B2) Tests i `backend/test/revenueService.test.js` (ny): andele summerer til 1, top 5 sorteret, en booking over periodens grænse tæller kun nætterne indenfor, validering af `to` og `groupBy`
- [X] T026 [US5] (F3) `frontend/src/pages/Revenue.jsx` (ny, `export default` + `export function loader`): periodevælger (fra/til, genveje: denne måned, i år, sidste år, 2000–i dag) og gruppering (dag/måned/år) i URL'en (`fra`, `til`, `pr`), nøgletalsfliser (bar i alt, solgte enheder, værelser i alt, samlet), søjler pr. periode for baren (stablet cocktail/kaffe, `<div>` med højde i procent) med tabel som alternativ, kategoriandele, top 5-drinks og værelsesomsætning pr. periode som sekundær sektion. Alle tal fra API'et

---

## Phase 8: User Story 6 – Navigation og Cmd+K (P2)

**Goal**: Grupperet navigation og kommandopalet.
**Independent Test**: quickstart Q9.

- [X] T027 [US6] (F1) `frontend/src/Shell.jsx`: navigation i grupperne Reception (Oversigt, Belægningsplan, Bookinger), Bar (Kasse → `/barsalg`), Økonomi (Omsætning → `/omsaetning`) og Konto (Profil → `/profil`) med gruppetitler, aktiv markering og en søgeknap "Søg … ⌘K" øverst. Brugernavnet nederst linker til profilen (log ud flyttes til profilen). `useShell()` får `openPalette`
- [X] T028 [US6] (F1) `frontend/src/CommandPalette.jsx` (ny): native `<dialog>`, åbner med Cmd+K/Ctrl+K (også i felter), søgefelt, resultater i grupper: bookinger (`GET /bookings?q=…&sort=nearest&pageSize=8&view=all`, debounce ca. 150 ms, navn, værelse, periode og status), sider og handlinger ("Ny booking" → `newBooking`, "Nyt barsalg" → `/barsalg`). Piletaster, Enter, Escape, `role="listbox"`/`aria-activedescendant`
- [X] T029 [US6] (F1) `frontend/src/main.jsx`: ruterne `/omsaetning` (`pages/Revenue.jsx`, loader) og `/profil` (`pages/Profile.jsx`, loader). `RouteError` linker til Oversigt

---

## Phase 9: User Story 7 – Login med facade (P3)

- [X] T030 [US7] (F1) `frontend/src/pages/Login.jsx`: to kolonner fra `lg:` (facadefotoet `/kong-arthur-facade.webp` som `<img>` med `object-cover` og en diskret gradient med "Hotel Kong Arthur · København" og en kort linje), formularen på den anden side, kun formularen på smalle skærme. Logik og fejlvisning uændret. Hint "Tryk ⌘K for at søge, når du er logget ind"

---

## Phase 10: User Story 8 – Profil og administration (P3)

- [X] T031 [US8] (B2) `changePassword(userId, current, next)` i `backend/src/services/authService.js` (forkert nuværende → `AppError('WRONG_PASSWORD', 'Den nuværende adgangskode er forkert', { field: 'currentPassword' })`, ny hash med `hashPassword`). `findById`/`updatePasswordHash` i `backend/src/repositories/userRepository.js`. Route `PUT /auth/password` med `requireSession` (bruger `req.session.userId`) i `backend/src/routes/auth.js`
- [X] T032 [US8] (B2) `backend/src/services/adminService.js` (ny): `priceList()`, `setRoomPrice(roomTypeId, seasonId, price)` (404 hvis type/sæson ikke findes, upsert), `setDrinkPrice(id, price)` (404 hvis drinken ikke findes, svarer med `Drink`). Repository-funktioner i `pricingRepository.js` og `referenceRepository.js`. Routes i `backend/src/routes/admin.js` (ny) med `requireSession`. Wiring i `backend/src/app.js`
- [X] T033 [P] [US8] (B2) Tests: `backend/test/authService.test.js` (rigtig/forkert nuværende), `backend/test/adminService.test.js` (ny: 404, upsert, beløb i øre). API-test i `backend/test/api.admin.test.js` (ny): pris ændret → nyt `GET /bookings/quote` bruger den, og en eksisterende bookings `totalPrice` er uændret. Adgangskode skiftet → login med den nye virker
- [X] T034 [US8] (F1) `frontend/src/pages/Profile.jsx` (ny, `export default` + `loader`): kort med brugernavn og "Log ud", formular til skift af adgangskode (nuværende, ny, gentag ny – gentagelsen tjekkes i formularen, resten i API'et), og "Administration" med prislisten som tabel (værelsestyper × sæsoner med talfelter, gem pr. celle eller pr. række) og drinkkortet (navn, kategori, pris med gem). Toast efter hver gemning

---

## Phase 11: Polish

- [X] T035 Kør `npx prettier@3 --write` på ændrede filer, `docker compose exec backend npm test` og `docker compose exec frontend npm run build`. Alt grønt
- [X] T036 Opdatér `docs/design/skaerme.md` (forside, liste, folio, kasse, omsætning, profil, palet, login) og `README.md` (sider og nye endpoints)
- [ ] T037 Kør quickstart.md Q1–Q12 og `/speckit-converge` for 005. Skriv resultatet i `specs/005-enterprise-backoffice/converge.md` (converge.md er skrevet. Klik-gennemgangen i en browser mangler)

---

## Dependencies & Execution Order

- Phase 1 er færdig. T007 (B1) og T009 (F1) er fundament og laves først af deres agent.
- Backend (B1, B2) og frontend (F1, F2, F3) kører parallelt mod kontrakten i openapi.yaml.
- B1: T007 → T008 → T010–T012 → T014–T015 → T017–T018.
- B2: T020–T021 → T023–T025 → T031–T033. B2 ejer `app.js` og tilføjer B1's `barRepo` til `createBookingService` (T017).
- F1: T009 → T027–T029 → T030 → T034. F2 og F3 bruger `STATUS` fra T009.
- F2: T013, T016, T019. F3: T022, T026. `main.jsx` (F1) importerer `pages/Revenue.jsx` (F3).
- Phase 11 når alle agenter er færdige.

## Parallel Example

```text
Agent B1: T007 → T008 → T010 → T011 → T012 → T014 → T015 → T017 → T018
Agent B2: T020 → T021 → T023 → T024 → T025 → T031 → T032 → T033
Agent F1: T009 → T027 → T028 → T029 → T030 → T034
Agent F2: T013 → T016 → T019
Agent F3: T022 → T026
```

## Implementation Strategy

MVP = US1 + US2 + US3 (receptionens daglige arbejde). US4–US8 kan leveres hver for sig.
Alle fem agenter starter samtidig. Integration og test sker i Phase 11.
