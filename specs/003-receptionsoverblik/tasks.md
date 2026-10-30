---
description: "Tasks for 003-receptionsoverblik"
---

# Tasks: Receptionsoverblik – dagsoverblik, belægningsplan og kundetilfredshed

**Input**: Design documents from `/specs/003-receptionsoverblik/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R12), data-model.md, contracts/README.md
(kontrakten er `backend/openapi.yaml`), quickstart.md

**Tests**: Inkluderet. `docs/retningslinjer/tests.md` kræver en test for hver ny
forretningsregel og hvert nøgletal i samme commit. Kun backend testes (`node:test`). Services
testes med falske repositories (almindelige objekter). **Testnavne starter med specens krav-ID
og `(003)`**, fx `test('FR-007 (003): a departure day counts as free for a new arrival', …)`, og
nøgletal med FT-ID (`FT12: …`), fordi 003's `FR-0xx` kolliderer med 001's og 002's.

**Bindende for alle tasks**: `AGENTS.md`, `docs/retningslinjer/{kodekvalitet,database,tests}.md`
og `docs/design/` for frontend. Commit-beskeder refererer task-ID og krav-ID (fx
`T012 FR-007 (003): …`).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Kan køres parallelt (andre filer, ingen afhængighed af ufærdige tasks).
- **[Story]**: US1–US5 svarer til User Story 1–5 i spec.md.
- **Spor** (første ord i beskrivelsen, se plan.md § Arbejdsdeling):
  - **F** = frontend-agenten. Kun nye filer og `main.jsx`, `Shell.jsx` (NAV), `ui.jsx`,
    `format.js` og `Login.jsx`. Kun `format.js` ændres også af 004 (ny `guestName`), og F
    tilføjer dér kun en ny funktion. Navne vises med 004's `guestName(booking)`.
  - **B** = backend-agenten. Rører ikke 004's filer, bortset fra ordet `export` i T002.
  - **I** = integration. Rører filer, som 004 også ændrer. **Må først startes, når 004 er
    implementeret.**

## Path Conventions

- Backend: `backend/src/`, `backend/test/`. Frontend: `frontend/src/`. Skema og seed: `db/`.
- Gæstens navn er `firstName`/`familyName` (API) og `first_name`/`family_name` (SQL) fra 004.
- Datoer er ISO `YYYY-MM-DD`. "I dag" er `today()` (Europe/Copenhagen), som injiceres i
  services.
- Penge: repositories giver øre (`toOre`), og services sender kroner (`toKr`).
- Services oprettes med factory og injicerede repositories i composition root
  `backend/src/app.js`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Små hjælpere, som både overblik og plan bruger. Ingen nye afhængigheder.

- [X] T001 [P] B – Tilføj `export const addDays = (isoDate, n) => toIso(toUtc(isoDate) + n * DAY_MS)` ved siden af `eachNight` i `backend/src/services/pricing.js` (samme `toUtc`/`toIso`, så sommertid aldrig flytter datoen, research R10).
- [X] T002 [P] B – Skriv `export` foran `const toApi` i `backend/src/services/bookingService.js`, så `receptionService` kan genbruge mappingen af `Booking` (research R3). **Kun ordet `export`**. Funktionens krop ændres af 004 og i T025.
- [X] T003 [P] F – Tilføj `addDays(iso, n)` som ny funktion i `frontend/src/format.js` (rør ikke 004's `guestName`) ud fra `toDate` (kl. 12) og `toLocaleDateString('sv-SE')`. Kommentar: kun til links for forrige/næste dag eller periode (research R10).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Repository, ledighedsformel, kontrakt og UI-primitiver, som US1 og US2 begge
bygger på.

**⚠️ CRITICAL**: Ingen user story kan startes, før denne fase er færdig.

- [X] T004 B – Tilføj `listRooms()` og `listStays(from, to)` i `backend/src/repositories/roomRepository.js`. `listRooms`: `r.id, r.room_number AS number, rt.id AS roomTypeId, rt.name AS roomType`, sorteret `ORDER BY rt.id, CHAR_LENGTH(r.room_number), r.room_number` (som `lockRoomsOfType`). `listStays`: `b.id AS bookingId, b.room_id AS roomId, r.room_type_id AS roomTypeId, b.first_name AS firstName, b.family_name AS familyName, b.check_in AS checkIn, b.check_out AS checkOut, b.guest_count AS guestCount` med den eksisterende `OVERLAPS`/`overlapParams(from, to)`, så "overlapper `[from, to)`" kun er defineret ét sted. Kolonnenavnene kommer fra 004's skema.
- [X] T005 [P] B – Skriv testene for ledighedsformlen først i den nye `backend/test/receptionService.test.js` med falske repositories (2 værelser af type A, 1 af type B): `FR-007 (003): a departure day counts as free for a new arrival` (ophold 10.–13. marts giver ledig 13.), `FR-006 (003): a stay that starts before the window only counts on visible nights`, `FR-007 (003): a stay only makes its own room type less free`. Testene skal fejle, før T006 er lavet.
- [X] T006 B – Opret `backend/src/services/receptionService.js` med `createReceptionService({ roomRepo, bookingRepo, barRepo, today })` og én intern funktion, der grupperer `listRooms()` pr. type til `{ id, name, rooms: [{ id, number }], free: number[] }`, hvor `free[i] = antal værelser af typen − antal ophold af typen med isInHouseOn(stay, dates[i])` (genbrug `isInHouseOn` fra `bookingService.js`, research R4). Funktionen bruges af både `overview` og `roomPlan`.
- [X] T007 B – Tilføj i `backend/openapi.yaml` (**kun nye stier og skemaer**, `Booking` ændres af 004 og i T028): tag `Reception`; `GET /reception/overview` med valgfri query `date` (`format: date`); `GET /reception/room-plan` med valgfri `from` (`format: date`) og `days` (`integer`, `minimum: 7`, `maximum: 31`, `default: 14`); skemaerne `ReceptionOverview`, `RoomPlan` og `RoomPlanStay` præcis som i `specs/003-receptionsoverblik/contracts/README.md`; svar 200, 400 (`ValidationError`) og 401 (`Unauthorized`); `security: session`. Opdatér `info.description`, så den nævner feature 003.
- [X] T008 [P] F – I `frontend/src/ui.jsx`: udtræk markøren fra `StatusBadge` til en eksporteret `StatusMarker({ status })`, så `STATUS`-tabellen stadig kun findes ét sted, og lad `StatusBadge` bruge den. Tilføj `DateNav({ label, value, prevTo, todayTo, nextTo, onChange })`: `ButtonLink` "Forrige"/"Næste" som ikonknapper med `CaretLeftIcon`/`CaretRightIcon` og `aria-label`, `ButtonLink` "I dag" og et native `<input type="date" className={cx(inputClass, 'w-auto')}>` med `sr-only`-`<label>` (`docs/design/komponenter.md` § Søgning og filtre).

**Checkpoint**: Ledighedsformlen er testet, og kontrakten for de nye stier findes. US1 og US2
kan bygges parallelt.

---

## Phase 3: User Story 1 - Dagsoverblik (Priority: P1) 🎯 MVP

**Goal**: Oversigt er startsiden og viser ankomster, afrejser, i huset, ledige værelser pr.
type og dagens barsalg for en valgt dato.

**Independent Test**: Åbn `/oversigt?dato=2025-07-15`. Tallene stemmer med en manuel optælling
og med `GET /api/reception/overview?date=2025-07-15` (quickstart Del 1 #1–#2, Del 2 #1–#4).

### Tests for User Story 1

- [X] T009 [P] [US1] B – Tilføj i `backend/test/receptionService.test.js` (den falske `bookingRepo.list` filtrerer fixture-bookinger med samme grænser som SQL'en, som `withinBounds` i `bookingService.test.js`): `FR-002 (003): arrivals are bookings checking in on the date and departures checking out on it`, `FR-002 (003): in house counts bookings and guests staying the night, not the departures`, `FR-002 (003): free plus occupied equals the rooms of each type`, `FR-002 (003): bar sales total for the date is returned in DKK`.

### Implementation for User Story 1

- [X] T010 [US1] B – Implementér `overview(date = today())` i `backend/src/services/receptionService.js` efter data-model.md § Dagsoverblik: `Promise.all` af `roomRepo.listRooms()`, `roomRepo.listStays(d, addDays(d, 1))`, `bookingRepo.list({ checkInAfter: addDays(d, -1), checkInOnOrBefore: d, limit: 500 })`, `bookingRepo.list({ checkOutAfter: addDays(d, -1), checkOutOnOrBefore: d, limit: 500 })` og `barRepo.listSales({ date: d })`. Kommentér `limit: 500` (højst én ankomst og én afrejse pr. værelse pr. dag, 214 værelser). Map bookinger med `toApi` fra T002 og dags dato. Svar `{ date, arrivals, departures, inHouse: { bookings, guests }, rooms: [{ roomTypeId, roomType, total, occupied, free }], barSalesTotal: toKr(totalOre) }`.
- [X] T011 [US1] B – **Samme commit som T007** (constitution II, validatoren afviser stier uden kontrakt). Opret `backend/src/routes/reception.js` med `receptionRouter(receptionService)` og `GET /reception/overview` (`requireSession`, `res.json(await receptionService.overview(req.query.date))`). Opret servicen i `backend/src/app.js` med `createReceptionService({ roomRepo, bookingRepo, barRepo, today })`, og montér routeren under `/api`.
- [X] T012 [P] [US1] F – Opret `frontend/src/pages/Overview.jsx` med `loader` (`api('/reception/overview' + (dato ? '?date=' + dato : ''))` ud fra `?dato=`) og siden fra plan.md § UI: `PageHeader` "Oversigt" med `longDate(date)` og `DateNav` (forrige/næste dag med `addDays`, "I dag" = `/oversigt`); fire `Stat` (Ankomster, Afrejser, I huset med "N gæster", Barsalg med `kr(barSalesTotal)`); `Tile flush` "Ankomster" og "Afrejser" efter tabel-opskriften (Gæst som `<Link>` til `/bookinger/:id` med `guestName(b)`, Værelse, Nætter, Gæster, `StatusBadge`), hele rækken klikbar; `Tile` "Ledige værelser" med én `Field` pr. type ("N ledige af M", teksten "Udsolgt" når `free` er 0); `EmptyState` på én linje ved tomme lister. React tæller og summerer ikke (FR-017): antal i `Tile count` er listens længde fra API'et.
- [X] T013 [US1] F – I `frontend/src/main.jsx`: index-routen redirecter til `/oversigt`, og tilføj `{ path: 'oversigt', element: <Overview />, loader: requireSession(overviewLoader) }`. I `frontend/src/Shell.jsx`: NAV starter med `{ to: '/oversigt', label: 'Oversigt', Icon: HouseIcon }`. I `frontend/src/pages/Login.jsx`: efter login navigeres til `fra` eller `/` (FR-001).
- [X] T014 [US1] I (efter 004) – Tilføj i `backend/test/api.test.js`: `GET /reception/overview` giver 401 uden session og med bookingsystemets `X-API-Key`; med session giver den 200, og for fixturens type gælder `free + occupied = total` (FR-018).

**Checkpoint**: Oversigt virker for enhver dato og er startsiden.

---

## Phase 4: User Story 2 - Belægningsplan (Priority: P1)

**Goal**: Værelser × dage med bookingbjælker, "Ledige"-række pr. type og navigation i
perioder.

**Independent Test**: Åbn `/belaegningsplan?fra=2025-12-20&dage=31`. Bjælker og "Ledige"-tal
stemmer med en manuel optælling, og ophold over nytår er klippet ved kanterne (quickstart Del 1
#3–#4, Del 2 #7–#12).

### Tests for User Story 2

- [X] T015 [P] [US2] B – Tilføj i `backend/test/receptionService.test.js`: `FR-005 (003): the plan has "days" dates from "from" and an exclusive "to"` og `FR-006 (003): stays keep their own dates and get their status from today`.

### Implementation for User Story 2

- [X] T016 [US2] B – Implementér `roomPlan({ from = today(), days = 14 })` i `backend/src/services/receptionService.js` efter data-model.md § Belægningsplan: `to = addDays(from, days)`, `dates = [...eachNight(from, to)]`, `roomTypes` fra funktionen i T006 og `stays` fra `roomRepo.listStays(from, to)` med `status: deriveStatus(stay, today())` (uden `roomTypeId`, som kun bruges internt).
- [X] T017 [US2] B – Tilføj `GET /reception/room-plan` i `backend/src/routes/reception.js` (`requireSession`, `res.json(await receptionService.roomPlan(req.query))`). Validatoren har allerede omformet `days` til et heltal og afvist værdier uden for 7–31 (T007).
- [X] T018 [P] [US2] F – Opret `frontend/src/pages/RoomPlan.jsx` med `loader` (`?fra=` → `from`, `?dage=` → `days`, kun hvis de står i adressen) og siden fra plan.md § UI: `PageHeader` "Belægningsplan" med `period(from, dates.at(-1))`, `DateNav` (Forrige = `addDays(from, -days)`, Næste = `to`, "I dag" = `/belaegningsplan` med samme `dage`), native `<select>` "Vis" med 7, 14 og 31 dage, forklaring med `StatusMarker` + label for hver status; `Tile flush` med scroll-container og `<table>` med sticky `thead` (ugedag og dato, dags dato med `bg-sunken` og "I dag") og sticky første kolonne; grupperække pr. type, en række pr. værelse og en "Ledige"-række pr. type med `free` (`tnum`). En booking er én `<td colSpan>` fra `max(checkIn, from)` til `min(checkOut, to)` (geometri, ingen regel) med `<Link to={/bookinger/:id}>`, `StatusMarker` og `guestName(stay)` (`truncate`), `aria-label`/`title` med navn, periode og status. Ingen afrundet kant på en side, hvor opholdet fortsætter uden for vinduet. Kommentér, at 214 × 31 celler tegnes uden virtualisering (research R5).
- [X] T019 [US2] F – Tilføj `{ path: 'belaegningsplan', element: <RoomPlan />, loader: requireSession(roomPlanLoader) }` i `frontend/src/main.jsx` og `{ to: '/belaegningsplan', label: 'Belægningsplan', Icon: CalendarDotsIcon }` som andet NAV-punkt i `frontend/src/Shell.jsx`.
- [X] T020 [US2] I (efter 004) – Tilføj i `backend/test/api.test.js`: `GET /reception/room-plan?days=32` giver 400 `VALIDATION_ERROR` med `field: "days"`, og uden session 401.

**Checkpoint**: US1 og US2 virker hver for sig. Receptionen har nu fire nav-punkter.

---

## Phase 5: User Story 3 - Registrere kundetilfredshed ved check-out (Priority: P2)

**Goal**: Receptionisten registrerer en score 1–5 ved afrejse fra Oversigt og bookingdetaljen.

**Independent Test**: Registrér 4 på en afrejse i dag, og se "4 af 5". Forsøg på en booking
med afrejse i morgen giver 422 (quickstart Del 1 #6–#9, Del 2 #5–#6).

### Tests for User Story 3

- [X] T021 [P] [US3] I (efter 004) – Tilføj i `backend/test/bookingService.test.js` (falsk `bookingRepo` med `findById` og `updateSatisfaction`): `FR-011 (003): rejects a score before the departure day` (afrejse i morgen giver `BOOKING_NOT_DEPARTED`, status 422, `field: 'score'`, og `updateSatisfaction` kaldes ikke), `FR-011 (003): accepts a score on the departure day`, `FR-011 (003): NOT_FOUND when the booking was deleted in the meantime` (`updateSatisfaction` returnerer 0).
- [X] T022 [P] [US3] I (efter 004) – Tilføj i `backend/test/api.test.js`: `PUT /bookings/:id/satisfaction` giver 401 uden session og med `X-API-Key`, 400 ved `{"score":6}`, 422 på en kommende booking og 200 med `satisfactionScore: 4` på en booking med afrejse i dag (FR-011, FR-018).

### Implementation for User Story 3

- [X] T023 [US3] I (efter 004) – Tilføj i `db/01_schema.sql` efter `source`: `satisfaction_score TINYINT NULL` og `CHECK (satisfaction_score BETWEEN 1 AND 5)`, med kommentaren "NULL = not registered; set at check-out (003 FR-011)".
- [X] T024 [US3] I (efter 004) – I `backend/src/repositories/bookingRepository.js`: tilføj `b.satisfaction_score AS satisfactionScore` i `SELECT_BOOKING` og `updateSatisfaction(id, score)` (`UPDATE bookings SET satisfaction_score = ? WHERE id = ?`, returnerer `affectedRows`). `updateBooking` må ikke røre kolonnen (FR-013).
- [X] T025 [US3] I (efter 004) – I `backend/src/services/bookingService.js`: `toApi` får `satisfactionScore: row.satisfactionScore`, og tilføj `registerSatisfaction(id, score)` efter research R7 (`NOT_FOUND`; `deriveStatus(booking, today()) !== 'departed'` giver `AppError('BOOKING_NOT_DEPARTED', 'Tilfredshed kan først registreres på afrejsedagen', { field: 'score' })`; `updateSatisfaction` med 0 rækker giver `NOT_FOUND`; svar `getBooking(id)`). Kommentér reglen med FR-011 (003).
- [X] T026 [P] [US3] I (efter 004) – I `backend/src/errors.js`: `BOOKING_NOT_DEPARTED: 422` i `STATUS` og labels `score: 'Tilfredshed'`, `from: 'Fra'`, `days: 'Antal dage'` i `FIELD_LABELS`.
- [X] T027 [US3] I (efter 004) – Tilføj `PUT /bookings/:id/satisfaction` med `requireSession` (ikke `allowBookingSystemKey`, FR-018) i `backend/src/routes/bookings.js`.
- [X] T028 [US3] I (efter 004) – **Samme commit som T025–T027** (constitution II). I `backend/openapi.yaml`: stien `PUT /bookings/{id}/satisfaction` (svar 200 `Booking`, 400, 401, 404, 422), skemaet `SatisfactionInput` (`required: [score]`, `additionalProperties: false`, `score: { type: integer, minimum: 1, maximum: 5 }`), `Booking.satisfactionScore` (påkrævet, `type: integer, nullable: true, minimum: 1, maximum: 5`, også i eksemplet), `BOOKING_NOT_DEPARTED` i `Error.code`, fejltabellen i `info.description` og et eksempel i `BusinessRule`.
- [X] T029 [US3] I (efter 004) – I `backend/scripts/generate-seed.js`: giv bookinger med afrejse på eller før seedens skæringsdato en score med den eksisterende deterministiske tilfældighedsgenerator (80 % svarer; 5: 45 %, 4: 35 %, 3: 12 %, 2: 5 %, 1: 3 %) og en kommentar om, at scorerne er genererede, fordi opgavens data ingen har (FR-015, research R9). Generér `db/02_seed.sql` igen, og tjek at `docker compose down -v && docker compose up` stadig starter.
- [X] T030 [P] [US3] F – Opret `frontend/src/SatisfactionDialog.jsx` efter plan.md § UI: `<dialog>` (bekræftelsesdialog-opskriften, `aria-labelledby`), gæstens navn og periode, `<fieldset>` med `<legend>` og fem `radioCardClass`-kort (`grid grid-cols-5`, tallet og en label fra "Meget utilfreds" til "Meget tilfreds"), `ErrorBanner` med API'ets `error.message`, "Annullér" og primær "Gem" med spinner. `PUT /bookings/:id/satisfaction`, toasten "Tilfredshed registreret" / "Fornavn Efternavn · 4 af 5", `useRevalidator().revalidate()`. Ved 404 lukkes dialogen, og toasten viser `error.message`.
- [X] T031 [US3] F – I `frontend/src/pages/Overview.jsx`: kolonnen "Tilfredshed" i Afrejser viser "N af 5", når `satisfactionScore` er sat, og ellers knappen "Registrér tilfredshed" (`size="sm"`), når API'ets `status` er `departed`. Knappen åbner `SatisfactionDialog`. Afhænger af T028 for at kunne afprøves.
- [X] T032 [US3] I (efter 004) – I `frontend/src/pages/BookingDetail.jsx`: en `Field` "Tilfredshed" i flisen Ophold med "N af 5" eller "–", og en `Button` "Registrér tilfredshed" i headerens handlinger, når `status` er `departed`. Den åbner `SatisfactionDialog` (FR-012).

**Checkpoint**: Scoren kan registreres og rettes fra begge skærme, og reglen afviser før
afrejse.

---

## Phase 6: User Story 4 - Kundetilfredshed som nøgletal (Priority: P2)

**Goal**: `/analytics/kpis` har `customerSatisfaction` og `satisfactionResponses` pr. år, og
`/analytics/bookings` har `satisfactionScore`.

**Independent Test**: Med et kendt sæt scores matcher nøgletallene en manuel beregning
(quickstart Del 1 #10–#12).

### Tests for User Story 4

- [X] T033 [P] [US4] B – Tilføj i `backend/test/analyticsService.test.js` (falsk repository som de eksisterende tests): `FT12: customer satisfaction is the average of registered scores for check-outs in the year` (scores 5, 4, 3 og én uden giver 4 og 3 besvarelser), `FT12: a year without scores gives 0 and 0 responses`, `FT12: a stay over new year counts in the check-out year`.

### Implementation for User Story 4

- [X] T034 [US4] B – I `backend/src/services/analyticsService.js`: `kpis()` udvider årene med bookingernes afrejseår og tilføjer pr. år `row('customerSatisfaction', 'Kundetilfredshed', ratio(sum(scores), scores.length), 'score')` og `row('satisfactionResponses', 'Besvarelser', scores.length, 'count')`, hvor `scores` er registrerede scores for bookinger med `checkOut` i året (research R8). Kommentér FT12 og hvorfor afrejseåret. **Samme commit**: `customerSatisfaction` og `satisfactionResponses` i `Kpi.kpi`-enum, `score` i `Kpi.unit`-enum og to linjer i beskrivelsen af `/analytics/kpis` i `backend/openapi.yaml` (constitution II). Indtil T035 er værdien 0, fordi repositoriet endnu ikke læser scoren.
- [X] T035 [US4] I (efter 004) – Tilføj `b.satisfaction_score AS satisfactionScore` i `listBookings` i `backend/src/repositories/analyticsRepository.js` (kræver kolonnen fra T023), og lad `toBookingRow` i `backend/src/services/analyticsService.js` sende `satisfactionScore: booking.satisfactionScore`.
- [X] T036 [US4] I (efter 004) – **Samme commit som T035**: `AnalyticsBooking.satisfactionScore` (påkrævet, `type: integer, nullable: true`, også i eksemplet) i `backend/openapi.yaml`.

**Checkpoint**: Nøgletallet er færdigberegnet i API'et og klar til Tableau.

---

## Phase 7: User Story 5 - Barsalget er Helene Christines (Priority: P3)

**Goal**: Barsiden viser "Helene Christine · lobbybaren".

**Independent Test**: Åbn Barsalg og læs underteksten (quickstart Del 2 #13).

- [X] T037 [US5] I (efter 004) – I `frontend/src/pages/BarSales.jsx`: `PageHeader`-beskrivelsen bliver "Helene Christine · lobbybaren · I dag: X kr." (`kr(total)` som i dag) (FR-016).

**Checkpoint**: Alle user stories er funktionelle.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Dokumentation, dashboard, valgfri genvej og validering.

- [X] T038 [P] I (efter 004) – Opdatér `docs/design/skaerme.md`: kort over appen (`/` → `/oversigt`, `/oversigt?dato=`, `/belaegningsplan?fra=&dage=`), nye afsnit "Oversigt" og "Belægningsplan" (kilder `pages/Overview.jsx`, `pages/RoomPlan.jsx`, krav fra spec 003), tilfredshed på bookingdetaljen, barsidens undertekst, og fjern "Kalender eller belægningsgrid" fra "Bevidst udeladt".
- [X] T039 [P] I (efter 004) – Opdatér `docs/design/komponenter.md`: Shell-navigationen med fire punkter, `StatusMarker`, `DateNav`, `addDays` i formatering, `SatisfactionDialog` og en opskrift på plan-tabellen (sticky header og første kolonne, `colSpan`-bjælker, "Ledige"-række).
- [X] T040 [P] Opdatér kravdokumenterne: FT12 bliver Must og præciseres i spec 003 i `docs/krav/businessinteligence.md`; tilføj spec 003 i tabellen i `docs/krav/README.md`; tilføj en note under § Nøgletal i `specs/002-bi-dashboard/data-model.md`, der peger på de to nye rækker i `specs/003-receptionsoverblik/data-model.md`.
- [X] T041 [P] I (efter 004) – Tilføj i README.md's linje om testdata, at tilfredshedsscores er genererede (FR-015).
- [ ] T042 Tilføj arket "Kundetilfredshed" (gennemsnit og besvarelser pr. år fra `/analytics/kpis`, ingen egne formler) på dashboardet i `tableau/kong-arthur.twbx`, og opdatér extracts (manuelt, FR-014).
- [ ] T043 I (efter 004, **valgfri FR-010**, kun hvis tiden er der) – `newBooking(defaults)` i `frontend/src/Shell.jsx`, en `defaults`-prop (`roomTypeId`, `checkIn`) i `frontend/src/BookingForm.jsx` og en `<button>` med `aria-label` "Ny booking, <type>, <dato>" i ledige celler i `frontend/src/pages/RoomPlan.jsx`. Systemet tildeler stadig værelset.
- [X] T044 Kør `npx prettier@3 --write` på de ændrede filer og `docker compose exec backend npm test` (alt grønt).
- [ ] T045 Gennemgå `specs/003-receptionsoverblik/quickstart.md` Del 1–3 fra en tom maskine og notér afvigelser.
- [ ] T046 Kør `/speckit-converge` og gem resultatet i `specs/003-receptionsoverblik/converge.md` (KB-D4).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Ingen afhængigheder.
- **Foundational (Phase 2)**: Efter Setup. Blokerer US1 og US2.
- **US1 (Phase 3)** og **US2 (Phase 4)**: Efter Foundational. Uafhængige af hinanden.
- **US3 (Phase 5)**: Backend-delen (I) kræver 004. T031 kræver T012 og T030.
- **US4 (Phase 6)**: T033–T034 (B) kan laves når som helst. T035–T036 kræver T023.
- **US5 (Phase 7)**: Kræver kun 004.
- **Polish (Phase 8)**: Efter de stories, den dokumenterer.

### Spor og 004

| Spor | Tasks | Kan starte |
|---|---|---|
| F | T003, T008, T012, T013, T018, T019, T030, T031 | Med det samme (mod kontrakten) |
| B | T001, T002, T004–T007, T009–T011, T015–T017, T033, T034 | Med det samme. API'et kører mod 004's skema |
| I | T014, T020–T029, T032, T035–T039, T041, T043 | **Når 004 er implementeret** |
| Fælles | T040, T042, T044–T046 | Til sidst |

### Within Each User Story

- Tests skrives før implementeringen og skal fejle først.
- Repository → service → route → kontrakt. Kontrakt og route i samme commit (constitution II).
- En side kan bygges mod kontrakten, før endpointet findes, men afprøves først bagefter.

### Parallel Opportunities

- T001, T002 og T003 kan køres samtidig.
- T005 og T008 kan køres parallelt med T004 og T007.
- I US1 kan T009 (B) og T012 (F) køres samtidig. Det samme gælder T015 og T018 i US2.
- T021, T022 og T026 kan køres parallelt i integrationssporet.

## Parallel Example: User Story 1

```text
Agent F: T012 Opret frontend/src/pages/Overview.jsx
Agent B: T009 Tests i backend/test/receptionService.test.js → T010 overview() → T011 route og app.js
```

## Parallel Example: User Story 2

```text
Agent F: T018 Opret frontend/src/pages/RoomPlan.jsx → T019 route og NAV
Agent B: T015 Tests → T016 roomPlan() → T017 route
```

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 og 2.
2. Phase 3 (US1). Oversigt er startsiden. Stop og validér med quickstart Del 1 #1–#2 og Del 2
   #1–#4.

### Incremental Delivery

1. US1 → Oversigt.
2. US2 → Belægningsplan (kalenderoverblikket).
3. Efter 004: US3 → registrering af tilfredshed, US4 → nøgletallet, US5 → barsidens undertekst.
4. Polish: dokumentation, Tableau-ark, valgfri FR-010, quickstart, converge.

### Parallel Team Strategy

To agenter: agent F tager spor F, og agent B tager spor B. Når 004 er implementeret, tager
agent B spor I (backend og docs), og agent F tager T032 og T037, som er frontend-filer i spor I.

---

## Phase 9: Convergence

- [ ] T047 I – I `backend/scripts/generate-seed.js`: giv kun genererede scores til bookinger med afrejse på eller før en egen skæringsdato, der ikke ligger efter den første dag, seeden bruges (`SEED_SCORES_END = '2026-10-30'`, adskilt fra `SEED_SALES_END`), så ingen booking har en score før sin afrejsedag. I dag har 134 bookinger med afrejse 2026-10-31–2026-11-05 en score, så Oversigt og bookingdetaljen viser "N af 5" på gæster, der stadig er i huset, og 2026-nøgletallet tæller dem med. Ret selvtjekket (`departed` og `'score before departure'`) til den nye konstant, generér `db/02_seed.sql` igen, ret linjen om tilfredshed i `README.md` og research R9, og nulstil med `docker compose down -v` per FR-015, FR-011 (contradicts)
