# Converge: 003-receptionsoverblik

**Dato**: 2026-10-30 · **Task**: T046 · **Krav**: KB-D4

Koden er sammenholdt med `spec.md`, `plan.md`, `tasks.md` og constitution v1.2.1. Udgangspunktet
var den nuværende kode, ikke afkrydsningerne i `tasks.md`. Grundlaget er dette:

- `docker compose exec -T backend npm test` giver **98/98 grønne** (0 fejl, 0 sprunget over).
  23 af dem er 003's: 9 i `receptionService.test.js`, 3 i `bookingService.test.js`, 8 i
  `api.test.js` og 3 FT12-tests i `analyticsService.test.js`.
- `docker compose exec -T frontend npx vite build` bygger uden fejl og advarsler (vite 8.3.5,
  4.645 moduler, `index-*.js` 399,38 kB / 120,20 kB gzip).
- Quickstart Del 1 er stikprøvet med `curl` mod seed-data: `/reception/overview` svarer `200`
  på 0,02 s med 8 typer, i alt 214 værelser og `free + occupied = total` for alle typer.
  `/reception/room-plan?from=2025-12-20&days=31` svarer på 0,01 s med `to = 2026-01-20` og 31
  tal i hver `free`. `days=32` og `date=2026-02-30` giver `400` med feltet, og
  bookingsystemets nøgle giver `401`. `customerSatisfaction` og `satisfactionResponses` fra
  `/analytics/kpis` matcher en genberegning ud fra `/analytics/bookings` for 2025, 2026 og
  2027 med 0 afvigelser (SC-006).

**UI'et er ikke klikket igennem i en browser endnu, og Tableau-arket er ikke bygget.** Det er
T045 og T042. Tidsmålene SC-001, SC-002, SC-003 (visning) og SC-007 måles først i T045.

## Krav → implementering

| Krav | Status | Hvor |
|---|---|---|
| FR-001 Navigation og Oversigt som startside | ✅ | `frontend/src/Shell.jsx` (`NAV`: Oversigt, Belægningsplan, Bookinger, Barsalg), `frontend/src/main.jsx` (index → `/oversigt`), `frontend/src/pages/Login.jsx` (`fra` eller `/`) |
| FR-002 Ankomster, afrejser, i huset, ledige pr. type, dagens barsalg | ✅ | `backend/src/services/receptionService.js` (`overview`, `roomTypesWithFree`, `isInHouseOn`), `backend/src/repositories/roomRepository.js` (`listRooms`, `listStays`), `GET /reception/overview` i `backend/src/routes/reception.js`, `frontend/src/pages/Overview.jsx`. 4 tests i `receptionService.test.js` |
| FR-003 Gæst, værelse, type, gæster, nætter, status, link til detalje | ✅ | `BookingTable` i `Overview.jsx` (`guestName`, `StatusBadge`, `<Link>` og klikbar række) |
| FR-004 Forrige, næste, I dag, datovælger, dato i adressen | ✅ | `DateNav` i `frontend/src/ui.jsx`, `?dato=` i `Overview.jsx`, `addDays` i `frontend/src/format.js` |
| FR-005 Værelser × dage, 7/14/31, accepterer 7–31 | ✅ | `roomPlan` i `receptionService.js`, `days` med `minimum: 7, maximum: 31, default: 14` i `backend/openapi.yaml`, `<select>` i `frontend/src/pages/RoomPlan.jsx`. Test `FR-005 (003)` og 400-test i `api.test.js` |
| FR-006 Én bjælke pr. ophold, klippet ved kanten | ✅ | `roomCells` i `RoomPlan.jsx` (`colSpan`, `rounded-l-none`/`rounded-r-none`). `listStays` giver uklippede datoer. Test `FR-006 (003)` (2 stk.) |
| FR-007 "Ledige"-række pr. type og dag | ✅ | `free[]` fra `roomTypesWithFree`, vist som "Ledige"-række i `planRows`. Tests `FR-007 (003)` (afrejsedag er ledig, kun egen type) |
| FR-008 Bladre, I dag, startdato og antal dage i adressen | ✅ | `DateNav` + `?fra=&dage=` i `RoomPlan.jsx` |
| FR-009 Klik åbner booking, status med form og tekst | ✅ | `<Link>` til `/bookinger/:id`, `StatusMarker`, `aria-label`/`title` med navn, periode og status, forklaring over planen |
| FR-010 (MAY) Klik på ledig celle åbner "Ny booking" | ⏳ valgfri | Ikke bygget (T043). Se afvigelse 1 |
| FR-011 Score 1–5, først på afrejsedagen, kan erstattes | ✅ API · ❌ seed | `registerSatisfaction` i `backend/src/services/bookingService.js`, `PUT /bookings/:id/satisfaction` i `backend/src/routes/bookings.js`, `SatisfactionInput` i `openapi.yaml`, `CHECK (satisfaction_score BETWEEN 1 AND 5)` i `db/01_schema.sql`. 3 tests i `bookingService.test.js`, 3 i `api.test.js`. Seed-data bryder reglen, se Mangler (T047) |
| FR-012 Handling og score i Oversigt og på detaljesiden | ✅ | Kolonnen Tilfredshed i `Overview.jsx`, `Field` og knap i `frontend/src/pages/BookingDetail.jsx`, `frontend/src/SatisfactionDialog.jsx`. Se afvigelse 3 |
| FR-013 Scoren på bookingen, bevares ved redigering, slettes med den | ✅ | `bookings.satisfaction_score`, `updateSatisfaction` i `backend/src/repositories/bookingRepository.js`. `updateBooking` sætter ikke kolonnen. Se afvigelse 4 |
| FR-014 Kundetilfredshed og besvarelser pr. år, score i bookingrækker | ✅ API · ⏳ Tableau | `kpis()` og `toBookingRow` i `backend/src/services/analyticsService.js`, `listBookings` i `backend/src/repositories/analyticsRepository.js`, `Kpi`-enum og `AnalyticsBooking.satisfactionScore` i `openapi.yaml`. 3 FT12-tests. Arket mangler (T042) |
| FR-015 Genererede historiske scores, dokumenteret | ❌ delvist | `satisfactionScore` i `backend/scripts/generate-seed.js` (80 %, gennemsnit 4,15) og `README.md` § testdata. Men 134 scores ligger på bookinger, der ikke er rejst endnu. Se Mangler (T047) |
| FR-016 "Helene Christine · lobbybaren" | ✅ | `PageHeader` i `frontend/src/pages/BarSales.jsx` |
| FR-017 Alle tal og status fra logiklaget | ✅ | `receptionService.js` regner antal, ledighed og status. React viser kun API'ets tal. `arrivals.length` er en optælling af API'ets liste (tilladt efter constitution III) |
| FR-018 Kun session, ikke bookingsystemets nøgle | ✅ | `requireSession` i `routes/reception.js` og på `PUT /bookings/:id/satisfaction`. 3 FR-018-tests i `api.test.js` (uden cookie og med `X-API-Key`) |
| FR-019 Dansk tekst, labels, status og ledighed som tekst | ✅ | `sr-only`-labels i `DateNav` og på `<select>`, `<fieldset>`/`<legend>` i `SatisfactionDialog.jsx`, "Udsolgt" og "N ledige af M" som tekst |
| SC-001 Oversigt efter login under 2 s | ✅ API · ⏳ UI | API'et svarer på 0,02 s. Visningen måles i T045 |
| SC-002 Ledigt værelse fundet under 30 s | ⏳ | Måles i T045 |
| SC-003 Plan 214 × 31 under 2 s, sticky under scroll | ✅ API · ⏳ UI | API'et svarer på 0,01 s. Sticky `thead` og første kolonne i `RoomPlan.jsx`. Visningen måles i T045 |
| SC-004 Tal matcher manuel optælling, ledige + optagede = værelser | ✅ | 4 FR-002-tests i `receptionService.test.js`, 1 i `api.test.js` og stikprøve med `curl` |
| SC-005 Score før afrejse eller uden for 1–5 afvises | ✅ | `BOOKING_NOT_DEPARTED` (422) og validatorens 400. Tests i `bookingService.test.js` og `api.test.js` |
| SC-006 Kundetilfredshed matcher manuel beregning | ✅ | FT12-tests i `analyticsService.test.js` og genberegning mod `/analytics/bookings` for tre år |
| SC-007 Score registreret under 10 s | ⏳ | Måles i T045 |
| Edge cases | ✅ | Afrejsedag ledig (test), klipning ved kanten (test), ugyldig dato og `days` uden for 7–31 giver 400 med feltets danske navn, slettet booking giver "Bookingen findes ikke længere" (test), tom dato giver `EmptyState` og 0 kr. |
| Constitution I–VI | ✅ | Tre lag (SQL kun i `repositories/`), kontrakten i `backend/openapi.yaml` med validator, regler og nøgletal i `services/`, én ny kolonne i `db/01_schema.sql` og ingen nye containere, tabeller eller pakker, `npm test` |

## Afvigelser (bevidste og dokumenterede)

1. **FR-010 er ikke bygget (T043).** Kravet er MAY, og plan.md § Constitution Check (VI)
   siger, at det bygges sidst og kun, hvis tiden er der. Receptionisten kan stadig oprette en
   booking med "Ny booking". Planen er et overblik, og systemet tildeler alligevel selv
   værelset (001 FR-007), så genvejen sparer kun to felter. T043 står åben som valgfri.
2. **"I dag"-kolonnen i planen bruger browserens dato.** Spec'en siger, at "I dag" er dags dato
   i Europe/Copenhagen. Status, standarddatoer og reglen om afrejse kommer fra backend
   (`backend/src/today.js`, Europe/Copenhagen). Kun markeringen af kolonnen bruger `today()` i
   `frontend/src/format.js`, som er browserens lokale dato. Back office bruges i receptionen i
   Danmark (spec § Assumptions), så de to datoer er ens. Det er accepteret.
3. **Rettelse af en score sker på detaljesiden.** I Oversigt viser kolonnen Tilfredshed "N af
   5", når scoren er registreret, og ellers knappen (plan.md § UI). En fejlindtastning
   (US3/AC3) rettes med "Registrér tilfredshed" på bookingens detaljeside, der vises for alle
   afrejste bookinger. Rækken i Oversigt fører direkte dertil.
4. **FR-013 har ingen egen test.** Reglen er, at `updateBooking` i `bookingRepository.js` ikke
   nævner `satisfaction_score`. Der er ingen logik i servicen at teste, og
   `docs/retningslinjer/tests.md` fraråder tests af kode uden logik. Det er verificeret ved
   gennemlæsning.
5. **Barsalg efter i dag i seed-data.** Seeden fra 004 har salg til og med 2026-11-05 (004
   spec, brugerens beslutning), så Oversigt viser barsalg for de kommende dage frem til
   fremlæggelsen. Det hører under 004 og er ikke en mangel i 003.
6. **Testnavne bruger `(003)` efter krav-ID'et**, fordi 003's `FR-0xx` kolliderer med 001's og
   002's (plan.md § Technical Context).

## Mangler

Converge fandt én ny mangel. Den er tilføjet som **Phase 9: Convergence** i `tasks.md`:

- **T047** (ny, FR-015, FR-011, contradicts): Seedens scores går til og med `SEED_SALES_END =
  2026-11-05` (fremlæggelsens aften, research R9). I dag, 2026-10-30, har 134 bookinger med
  afrejse fra 2026-10-31 til 2026-11-05 derfor en score, selv om gæsten ikke er rejst. Oversigt
  for fx 2026-10-31 viser 23 afrejser med "N af 5" og status "I huset", detaljesiden viser
  scoren på en gæst i huset, og 2026-nøgletallet tæller dem med. Det strider mod FR-015
  ("historiske scores for afrejste bookinger") og reglen om, at en score tidligst findes på
  afrejsedagen. Rettelsen er en egen skæringsdato for scores, der ikke ligger efter den første
  dag, seeden bruges (2026-10-30).

Det resterende arbejde er de åbne tasks, der allerede findes:

- **T042**: Arket "Kundetilfredshed" i Tableau. `tableau/kong-arthur.twbx` findes ikke endnu,
  fordi 002's workbook ikke er bygget, så T042 venter på 002's Tableau-tasks.
- **T045**: Klik quickstart Del 1–3 igennem fra en tom maskine og mål SC-001, SC-002, SC-003
  og SC-007.
- **T043** (valgfri): Se afvigelse 1.
- **T046**: Kør converge igen efter T047 og T045, og opdatér denne fil.

## Analyze

`/speckit-analyze` blev kørt på spec, plan og tasks før converge. Den fandt **8 fund: 0
CRITICAL, 0 HIGH, 2 MEDIUM og 6 LOW**, og ingen konflikter med constitution. Alle 19 FR og 7
SC har mindst én task. FR-019 er kun dækket indirekte af de bindende designdokumenter.

| ID | Alvor | Fund |
|---|---|---|
| I1 | MEDIUM | Research R9 og T029 lægger seedens score-skæringsdato på 2026-11-05, men FR-011 og FR-015 tillader kun scores fra afrejsedagen. Det blev til T047 |
| U1 | MEDIUM | plan.md og T042 kalder `tableau/kong-arthur.twbx` for ændret, men filen findes ikke. Afhængigheden af 002's Tableau-tasks står ikke i tasks.md |
| C1 | LOW | FR-013 (scoren bevares ved redigering) har en implementeringstask, men ingen test (afvigelse 4) |
| C2 | LOW | Tidsmålene SC-001, SC-002, SC-003 og SC-007 verificeres kun manuelt i T045 |
| C3 | LOW | FR-019 har ingen egen task og dækkes af `docs/design/` og labels i T008 og T030 |
| A1 | LOW | FR-012 siger ikke, om en registreret score kan rettes fra Oversigt. Plan.md § UI viser kun scoren der (afvigelse 3) |
| I2 | LOW | Spec'ens "I dag" (Europe/Copenhagen) mod planens markering af dags dato med frontendens `today()` (afvigelse 2) |
| T1 | LOW | `spec.md` står stadig som **Status: Draft**, selv om featuren er implementeret |
