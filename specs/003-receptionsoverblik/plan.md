# Implementation Plan: Receptionsoverblik – dagsoverblik, belægningsplan og kundetilfredshed

**Branch**: `003-receptionsoverblik` (der arbejdes på `main`, jf. KB-D12) | **Date**: 2026-10-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-receptionsoverblik/spec.md`

## Summary

Back office får to nye skærme og en ny navigation: **Oversigt** (startside, én dag),
**Belægningsplan** (værelser × dage), **Bookinger** og **Barsalg**. Receptionisten kan
registrere **kundetilfredshed** (1–5) ved check-out, og ledelsesdashboardet får
kundetilfredshed og antal besvarelser som nøgletal (FT12).

Teknisk:

- To nye læse-endpoints, `GET /api/reception/overview` og `GET /api/reception/room-plan`.
  En ny `receptionService` regner antal, ledighed og status ud. React viser kun tallene.
- Ét nyt skrive-endpoint, `PUT /api/bookings/{id}/satisfaction`. Reglen "kun efter afrejse"
  ligger i `bookingService`.
- Én ny kolonne, `bookings.satisfaction_score`. Ingen nye tabeller og ingen nye afhængigheder.
- `analyticsService` får to nye nøgletalsrækker, og bookingrækkerne til Tableau får scoren.

Featuren bygger på 004 (opgavens data: 214 værelser i 8 typer, gæstens navn som `firstName` og
`familyName`). Opgaverne er delt i tre spor, så to agenter kan arbejde samtidig (se
§ Arbejdsdeling). Detaljerede beslutninger står i [research.md](research.md).

## Technical Context

**Language/Version**: JavaScript (ES modules) på Node.js 24 LTS. Frontend er React 19 (JSX),
som i 001.

**Primary Dependencies**: Uændret fra 001 og 002. Backend: Express 5.3, mysql2 3.x,
express-openapi-validator 5.6, cookie-session 2.1. Frontend: React 19, React Router 8,
Tailwind CSS 4.3, `@phosphor-icons/react` 2.1 (har `HouseIcon` og `CalendarDotsIcon`). Ingen nye
pakker: ingen kalender-, grid-, virtualiserings- eller datobiblioteker (research R5, R10).

**Storage**: MySQL 8.4. Én ny kolonne, `bookings.satisfaction_score TINYINT NULL` med `CHECK`
(data-model.md). Skemaet ændres i `db/01_schema.sql`, og databasen nulstilles med
`docker compose down -v` (`docs/retningslinjer/database.md` §5). Seed genereres af
`backend/scripts/generate-seed.js`.

**Testing**: `node:test` + `node:assert/strict`. `receptionService` og `analyticsService` testes
med falske repositories og håndregnede eksempler. Tilfredshedsreglen testes i
`bookingService.test.js`. API-tests i `api.test.js` dækker login-krav, 400 ved ugyldige
parametre og 422 ved score før afrejse. Testnavne starter med specens krav-ID, fx
`FR-007 (003): …`, eller FT-ID for nøgletal (`FT12: …`), fordi 003's `FR-0xx` kolliderer med 001's
og 002's.

**Target Platform**: Docker Compose (som 001). Desktop-browser i receptionen.

**Project Type**: Web-applikation (backend + frontend), som 001.

**Performance Goals**: Oversigt og belægningsplan svarer på under 1 sekund med seed-data. Planen
med 214 værelser × 31 dage (ca. 6.600 celler) vises på under 2 sekunder og scroller jævnt
(SC-001, SC-003).

**Constraints**:
- React tæller, summerer og udleder ikke status eller ledighed (constitution III, FR-017,
  `docs/design/README.md` princip 13).
- Alle endpoints kræver session. Bookingsystemets nøgle og BI-nøglen giver 401 (FR-018).
- Frontend følger `docs/design/` (tokens, komponenter). Ingen AI i UI (KB-T8).
- Fremlæggelse 2026-11-06.

**Scale/Scope**: 214 værelser, 8 typer, ca. 1.000 + genererede bookinger (004). 2 nye skærme,
1 dialog, 3 nye endpoints, 1 ny kolonne, 2 nye nøgletal.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princip | Krav | Plan | Status |
|---|---|---|---|
| I. Trelagsarkitektur | Præsentation → logik → data. Kun repositories kender SQL | `routes/reception.js` → `services/receptionService.js` → `roomRepository`, `bookingRepository`, `barRepository`. Tilfredshed: `routes/bookings.js` → `bookingService` → `bookingRepository`. Ingen SQL uden for repositories | ✅ |
| II. API-først + OpenAPI | Al data via REST. Kontrakten i samme commit | De tre nye endpoints, `Booking.satisfactionScore`, `AnalyticsBooking.satisfactionScore`, de nye `Kpi`-værdier og fejlkoden `BOOKING_NOT_DEPARTED` står i `backend/openapi.yaml` i samme commit som koden. Validatoren afviser ukendte stier, så kontrakt og route skal følges ad | ✅ |
| III. Logik og nøgletal i logiklaget | Frontend genberegner ikke regler eller nøgletal | Ankomster, afrejser, i huset (bookinger og gæster), ledige pr. type og dag, status og barsalgets total beregnes i `receptionService` og genbruger `isInHouseOn` og `deriveStatus` fra `bookingService`. Reglen "score kun efter afrejse" ligger i `bookingService`. Kundetilfredshed er en formel i `analyticsService`. React placerer kun bjælker i planen ved at sammenligne ISO-datoer med `dates` fra API'et (geometri, ikke en regel) og viser "Registrér tilfredshed", når API'ets `status` er `departed` | ✅ |
| IV. Container og reproducerbart miljø | Én `docker compose up`, reproducerbart skema | Kolonnen tilføjes i `db/01_schema.sql`, og scores genereres af `generate-seed.js`. Ingen nye containere eller miljøvariabler | ✅ |
| V. Testbar forretningslogik | Hver regel og hvert nøgletal har en test | `receptionService.test.js` (ledighed, afrejsedag, klipning, i huset), `bookingService.test.js` (score før/på afrejsedag, 404), `analyticsService.test.js` (FT12-gennemsnit, år uden scores, ophold over årsskifte), `api.test.js` (401, 400, 422) | ✅ |
| VI. Enkelhed og ejerskab | YAGNI, ingen nye afhængigheder | Ingen nye pakker eller tabeller. Planen er en almindelig `<table>` med `colSpan` og `position: sticky` uden virtualisering. Scoren er én kolonne, ikke en tabel. FR-010 (klik på ledig celle) er valgfri og bygges sidst | ✅ |
| Retningslinjer | `AGENTS.md`, `docs/retningslinjer/*`, `docs/design/` | 3NF: scoren afhænger kun af bookingen. `CHECK` i databasen og validering i service og kontrakt. Parametriseret SQL med den eksisterende overlap-konstant. Penge i øre i servicen og kroner ved kanten. Fejlformat `{error:{code,message,field}}` | ✅ |

**Gate (før research)**: Bestået. Alle afklaringer er truffet med brugeren
(spec.md § Clarifications).

**Gate (efter design)**: Bestået. Designet tilføjer én kolonne og ingen tabeller. De to afledte
entiteter (Dagsoverblik, Belægningsplan) beregnes ved hvert kald og gemmes ikke. Ingen
overtrædelser. Complexity Tracking noterer to bevidste valg.

## Project Structure

### Documentation (this feature)

```text
specs/003-receptionsoverblik/
├── spec.md              # Krav (/speckit-specify, /speckit-clarify)
├── plan.md              # Denne fil
├── research.md          # Phase 0: beslutninger (R1–R12)
├── data-model.md        # Phase 1: ny kolonne og afledte entiteter
├── quickstart.md        # Phase 1: curl- og browser-scenarier
├── contracts/
│   └── README.md        # peger på backend/openapi.yaml og lister de nye endpoints
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

Kun nye og ændrede filer. Resten er som i
[001 plan.md](../001-backoffice-bookinger/plan.md#project-structure). Mærket i parentes viser
sporet i § Arbejdsdeling: **F** = frontend, **B** = backend, **I** = integration (filen ændres
også af 004).

```text
db/
└── 01_schema.sql                  # ÆNDRET (I): bookings.satisfaction_score + CHECK
backend/
├── openapi.yaml                   # ÆNDRET (B: nye /reception-stier og skemaer, Kpi-enums; I: satisfaction, Booking, AnalyticsBooking, fejlkode)
├── scripts/
│   └── generate-seed.js           # ÆNDRET (I): genererede scores på afrejste bookinger
├── src/
│   ├── app.js                     # ÆNDRET (B): createReceptionService og receptionRouter
│   ├── errors.js                  # ÆNDRET (I): BOOKING_NOT_DEPARTED → 422, labels for score/from/days
│   ├── routes/
│   │   ├── reception.js           # NY (B): GET /reception/overview, GET /reception/room-plan
│   │   └── bookings.js            # ÆNDRET (I): PUT /bookings/:id/satisfaction
│   ├── services/
│   │   ├── pricing.js             # ÆNDRET (B): eksporterer addDays ved siden af eachNight
│   │   ├── receptionService.js    # NY (B): dagsoverblik, belægningsplan, ledighed
│   │   ├── bookingService.js      # ÆNDRET (B: `export` foran toApi; I: satisfactionScore, registerSatisfaction)
│   │   └── analyticsService.js    # ÆNDRET (B: customerSatisfaction, satisfactionResponses; I: satisfactionScore i bookingrækken)
│   └── repositories/
│       ├── roomRepository.js      # ÆNDRET (B): listRooms(), listStays(from, to)
│       ├── bookingRepository.js   # ÆNDRET (I): satisfaction_score i SELECT, updateSatisfaction()
│       └── analyticsRepository.js # ÆNDRET (I): satisfaction_score i listBookings
└── test/
    ├── receptionService.test.js   # NY (B)
    ├── analyticsService.test.js   # ÆNDRET (B): FT12-tests
    ├── bookingService.test.js     # ÆNDRET (I): tilfredshedsreglen
    └── api.test.js                # ÆNDRET (I): reception- og satisfaction-endpoints
frontend/src/
├── main.jsx                       # ÆNDRET (F): / → /oversigt, routes for oversigt og belaegningsplan
├── Shell.jsx                      # ÆNDRET (F): NAV med fire punkter (I, valgfri: newBooking(defaults))
├── ui.jsx                         # ÆNDRET (F): DateNav og StatusMarker (udtrukket af StatusBadge)
├── format.js                      # ÆNDRET (F): addDays(iso, n). 004 tilføjer guestName(booking) i samme fil
├── SatisfactionDialog.jsx         # NY (F): <dialog> med score 1–5
├── BookingForm.jsx                # ÆNDRET (I, valgfri FR-010): udfyld type og ankomst fra defaults
└── pages/
    ├── Login.jsx                  # ÆNDRET (F): efter login til `fra` eller `/`
    ├── Overview.jsx               # NY (F): Oversigt
    ├── RoomPlan.jsx               # NY (F): Belægningsplan
    ├── BookingDetail.jsx          # ÆNDRET (I): tilfredshed på afrejste bookinger
    └── BarSales.jsx               # ÆNDRET (I): "Helene Christine · lobbybaren"
docs/
├── design/skaerme.md              # ÆNDRET (I): Oversigt, Belægningsplan, kort over appen
├── design/komponenter.md          # ÆNDRET (I): Shell-navigation, DateNav, StatusMarker, SatisfactionDialog, plan-tabellen
└── krav/businessinteligence.md    # ÆNDRET: FT12 Must, spec 003
tableau/kong-arthur.twbx           # ÆNDRET: Kundetilfredshed-ark (manuelt)
```

**Structure Decision**: Samme web-applikation som 001. Backend-filerne følger de tre lag
(princip I). Frontend er flad (`docs/design/README.md` § Filstruktur): én fil pr. route under
`pages/`, delte primitiver i `ui.jsx` og dialogen i sin egen fil som `BookingForm.jsx`.

## Arbejdsdeling (tre spor)

| Spor | Hvem | Må røre | Afhængighed |
|---|---|---|---|
| **F – Frontend** | Agent 1 | Nye filer (`pages/Overview.jsx`, `pages/RoomPlan.jsx`, `SatisfactionDialog.jsx`) og de små ændringer i `main.jsx`, `Shell.jsx` (NAV), `ui.jsx`, `format.js` og `Login.jsx`. Kun `format.js` ændres også af 004 (ny `guestName`), og F tilføjer dér kun en ny funktion | Bygger mod kontrakten i [contracts/README.md](contracts/README.md). Kan skrives parallelt med 004 og B |
| **B – Backend** | Agent 2 | `receptionService.js`, `routes/reception.js`, `roomRepository.js`, `pricing.js`, `app.js`, `analyticsService.js`, deres tests, de **nye** stier og skemaer og `Kpi`-enums i `openapi.yaml` (ikke `Booking`). Eneste berøring af en 004-fil: ordet `export` foran `toApi` i `bookingService.js` | Kan skrives parallelt med 004. `listStays` læser `first_name`/`family_name`, så API'et kører først mod 004's skema |
| **I – Integration** | Agent 2 (eller 1) efter 004 | Filer, som 004 også ændrer: `01_schema.sql`, `bookingRepository.js`, `bookingService.js`, `routes/bookings.js`, `errors.js`, `generate-seed.js`, `Booking`-skemaet i `openapi.yaml`, `api.test.js`, `bookingService.test.js`, `BookingDetail.jsx`, `BarSales.jsx`, `BookingForm.jsx`, `docs/design/*` | **Starter først, når 004 er implementeret** |

## UI (følger `docs/design/`)

Tokens, primitiver og opskrifter i `docs/design/` er bindende. Ingen nye farver eller tokens.

**Genbruges uændret**: `PageHeader`, `Tile` (`count`, `action`, `flush`), `Stat`,
`EmptyState`, `Field`, `StatusBadge`, `Button`, `ButtonLink`, `Kbd`, `inputClass`,
`labelClass`, `radioCardClass`, `ErrorBanner`, `FieldError`, `invalidProps` (`ui.jsx`),
`date`, `longDate`, `period`, `nightsLabel`, `kr`, `num`, `today` og 004's `guestName(booking)` til "Fornavn Efternavn" (`format.js`), `api()`
(`api.js`), `useShell()`/`useToast()` (`Shell.jsx`), tabel-opskriften og
bekræftelsesdialogens `<dialog>`-opskrift (`komponenter.md`).

**Nyt**:

| Komponent | Fil | Indhold |
|---|---|---|
| `DateNav` | `ui.jsx` | Forrige · I dag · Næste som `ButtonLink` (`CaretLeft`/`CaretRight`, `aria-label`) og et native `<input type="date">` med `sr-only`-label. Får de færdige `to`-links og en `onChange`. Bruges på Oversigt (1 dag) og Belægningsplan (en periode) |
| `StatusMarker` | `ui.jsx` | Den lille firkant fra `StatusBadge`, udtrukket så status-tabellen stadig kun findes ét sted. `StatusBadge` og planens bjælker bruger den |
| `SatisfactionDialog` | `SatisfactionDialog.jsx` | Bekræftelsesdialog-opskriften (`w-[440px]`) med titlen "Kundetilfredshed", gæstens navn og periode, fem `radioCardClass`-kort i `grid grid-cols-5` med tallet og en label (1 Meget utilfreds … 5 Meget tilfreds) i et `<fieldset>` med `<legend>`, `ErrorBanner` med API'ets besked og knapperne "Annullér" og primær "Gem". Kalder `PUT /bookings/:id/satisfaction`, viser toasten "Tilfredshed registreret – Fornavn Efternavn · 4 af 5" og revaliderer |
| Oversigt | `pages/Overview.jsx` | `PageHeader` "Oversigt" med `longDate(date)` og `DateNav`. Række med fire `Stat` i `Tile` (`grid grid-cols-4 gap-5`): Ankomster, Afrejser, I huset (bookinger, kontekst "N gæster") og Barsalg (`kr(barSalesTotal)`). Derunder `Tile flush` "Ankomster" og "Afrejser" (tabel-opskriften med Gæst, Værelse, Nætter, Gæster, Status; afrejser har kolonnen Tilfredshed med "4 af 5" eller knappen "Registrér tilfredshed", når `status` er `departed`) og `Tile` "Ledige værelser" med én `Field` pr. type: "4 ledige af 30" og teksten "Udsolgt", når `free` er 0. Tomme lister: `EmptyState` på én linje |
| Belægningsplan | `pages/RoomPlan.jsx` | `PageHeader` "Belægningsplan" med `period(from, sidste dato)`, `DateNav` (Forrige = `fra − dage`, Næste = `to`) og en native `<select>` "Vis" med 7, 14 eller 31 dage. Forklaring under headeren med `StatusMarker` + label for hver status. `Tile flush` med en scroll-container (`overflow-auto`, `max-h-[calc(100dvh-16rem)]`) og en `<table className="border-separate border-spacing-0">`: sticky `thead` med ugedag og dato pr. kolonne (dags dato markeret med `bg-sunken` og teksten "I dag"), sticky første kolonne med værelsesnummer, en grupperække pr. type (`bg-sunken`, typens navn), en række pr. værelse og en "Ledige"-række pr. type med tallene fra `free` (`tnum`). En booking er én `<td colSpan>` med et `<Link>` til `/bookinger/:id`, `StatusMarker` og "Fornavn Efternavn" (`truncate`). `aria-label` og `title` gentager navn, periode og status. Ophold, der fortsætter uden for vinduet, har ingen afrundet kant på den side. Cellebredde ca. `w-11` |

Navigation (`Shell.jsx`, NAV): Oversigt (`HouseIcon`, `/oversigt`), Belægningsplan
(`CalendarDotsIcon`, `/belaegningsplan`), Bookinger (`BedIcon`), Barsalg (`MartiniIcon`).
`/` redirecter til `/oversigt`. Adressen er tilstanden: `/oversigt?dato=2026-03-10` og
`/belaegningsplan?fra=2026-03-10&dage=14`. Mangler parameteren, sender frontend den ikke, og
backend bruger dags dato og 14 dage.

## Implementeringsrækkefølge (input til /speckit-tasks)

1. **004 implementeres først** (beslutning). Spor F og B kan dog skrives samtidig med 004.
2. **Fundament (B)**: `addDays`, `listRooms`/`listStays`, `export toApi`, kontraktens nye
   reception-stier.
3. **US1 Dagsoverblik** og **US2 Belægningsplan** (P1): B bygger service, route og tests. F
   bygger navigation, `DateNav`, `StatusMarker` og de to sider.
4. **US4 nøgletal (B)**: formel og tests i `analyticsService` (falsk repository).
5. **Integration efter 004 (I)**: skema, repository, regel, endpoint, seed, kontrakt for
   satisfaction/Booking/Kpi, `BookingDetail`, `BarSales` (US5), API-tests.
6. **US3 UI (F)**: `SatisfactionDialog` og Oversigtens afrejser bruger endpointet fra trin 5.
7. **Afslutning**: designdokumenter, kravboard, Tableau-ark, valgfri FR-010, quickstart og
   `/speckit-converge`.

## Complexity Tracking

Ingen overtrædelser af constitution. Tabellen noterer to bevidste valg, så de kan forklares ved
fremlæggelsen.

| Valg | Hvorfor | Simplere alternativ fravalgt, fordi |
|---|---|---|
| To skærmspecifikke endpoints (`/reception/overview`, `/reception/room-plan`) i stedet for at genbruge `/bookings` og `/room-types` | Antal, ledighed pr. type og dag og "i huset" er regler (constitution III). Med ét kald pr. skærm regner servicen det hele ud, og React viser kun tallene | At hente bookinglister og tælle i React bryder III og designprincip 13 og kræver flere kald pr. skærm. `/room-types?checkIn=` giver kun ledighed for én periode ad gangen, så 31 dage ville kræve 31 kald |
| React placerer bookingbjælker ud fra `checkIn`/`checkOut` og `dates` (klipper ved vinduets kanter) | Det er ren geometri: hvilken kolonne en dato står i. Alle tal (ledige, status) kommer fra API'et | At lade API'et levere kolonneindeks ville binde kontrakten til én bestemt tegning og gøre den sværere at genbruge |
