# Implementation Plan: Back Office – bookinger og barsalg

**Branch**: `001-backoffice-bookinger` (der arbejdes på `main`, jf. D12) | **Date**: 2026-10-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-backoffice-bookinger/spec.md`

## Summary

Et back office til receptionen på Hotel Kong Arthur, hvor receptionisten kan:

- Logge ind med én fælles konto.
- Se, søge i, oprette, redigere og slette bookinger.
- Registrere barsalg, eventuelt lagt på en gæsts booking.

Bookinger laves på en værelsestype. Systemet tildeler et ledigt værelse, kontrollerer
kapaciteten og prissætter hver nat efter dens sæson. Hotellets eget bookingsystem kan oprette
bookinger via samme API med en API-nøgle.

Teknisk: én Docker Compose-stak med fire containere:

- MySQL med named volume og healthcheck.
- Node/Express-backend i tre lag (routes → services → repositories). Alle requests
  valideres mod én OpenAPI-kontrakt.
- React + Tailwind-frontend, der genbruger designsystemet fra Roster (`docs/design/`).
- Swagger UI, der viser samme kontrakt.

Detaljerede beslutninger står i [research.md](research.md).

## Technical Context

**Language/Version**: JavaScript (ES modules) på Node.js 24 LTS. Frontend er React 19 (JSX).

**Primary Dependencies**:
- Backend: Express 5.3, mysql2 3.x, express-openapi-validator 5.6, cookie-session 2.1.
- Frontend: React 19, React Router 8, Vite 8, Tailwind CSS 4.3, Base UI 1.9, Phosphor Icons.
- Begrundelser: research.md § Afhængigheder.

**Storage**: MySQL 8.4 LTS i Docker med named volume `db-data`. Skema og seed er SQL-filer i
`db/`, som køres via `docker-entrypoint-initdb.d`.

**Testing**: `node:test` + `node:assert/strict` (`npm test` i `backend/`). Kun backend.

**Target Platform**: Docker Compose på udviklermaskiner (macOS/Windows/Linux). Back office
vises i en desktop-browser i receptionen.

**Project Type**: Web-applikation (backend + frontend) plus database og API-dokumentation.

**Performance Goals**: Svar til mennesker føles øjeblikkelige: liste og søgning under 1 sekund
på ca. 12.000 bookinger. En booking fra bookingsystemet er synlig inden for 5 sekunder
(SC-006).

**Constraints**:
- Én `docker compose up` starter alt (T3).
- Al data går gennem API'et (A5, T9).
- Ingen AI i UI'et (T8).
- Fremlæggelse 2026-11-06.

**Scale/Scope**:
- 1 brugerkonto og 60 værelser.
- Ca. 12.000 bookinger og ca. 20.000 barsalg i testdata.
- 4 skærme (login, liste, detalje, barsalg) plus én skuffe-formular.
- 10 API-stier.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princip | Krav | Plan | Status |
|---|---|---|---|
| I. Trelagsarkitektur | Præsentation → logik → data. Kun repositories kender SQL | `routes/` → `services/` → `repositories/`. Services er rene og testbare uden HTTP/SQL | ✅ |
| II. API-først + OpenAPI | Al data via REST/JSON. Kontrakten ligger i repo og vises i Swagger. Frontend og eksterne systemer bruger kun API'et | `backend/openapi.yaml` er SSOT. Validatoren håndhæver den, og Swagger UI-containeren viser den. Frontend kalder via `api.js`, og bookingsystemet via `X-API-Key` | ✅ |
| III. Logik og nøgletal i logiklaget | Kapacitet, overlap og pris i logiklaget. Frontend regner ikke | `bookingService`, `pricing`, `barService`. Prisvisning via `/bookings/quote` | ✅ |
| IV. Container og reproducerbart miljø | Docker, én compose, MySQL, healthcheck, named volume, reproducerbart skema, priser og sæsoner som tabeller | 4 services. `depends_on: condition: service_healthy`. `db-data`-volume. `db/01_schema.sql` + genereret `02_seed.sql`. Tabellerne `seasons`, `season_periods` og `room_prices` | ✅ |
| V. Testbar forretningslogik | Tests af regler, én kommando | `node --test`. Unit-tests af pris og booking samt få API-tests (research R13) | ✅ |
| VI. Enkelhed og ejerskab | YAGNI, ingen AI i UI, gruppen kan forklare alt | Ingen ORM og ingen state-, form- eller datobiblioteker. Hver afhængighed er begrundet. Bevidste forenklinger markeres med kommentar | ✅ |
| Retningslinjer | `AGENTS.md`, `docs/retningslinjer/*`, `docs/design/` | 3NF med dokumenterede undtagelser (data-model.md). Penge i øre/DECIMAL. Fejlformat `{error:{code,message,field}}`. Design genbruges fra Roster | ✅ |

**Gate (før research)**: Bestået. Ingen overtrædelser.

**Gate (efter design)**: Bestået. Designet tilføjede to tabeller ud over specens entiteter:
`season_periods`, der splitter Sæson (3NF), og `drink_categories` (opslag). Begge styrker
princip IV og 3NF. `bookings.room_type_id` er bevidst udeladt for at undgå en transitiv
afhængighed. Ingen punkter i Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-backoffice-bookinger/
├── spec.md              # Krav (/speckit-specify)
├── plan.md              # Denne fil
├── research.md          # Phase 0: beslutninger og begrundelser
├── data-model.md        # Phase 1: tabeller, constraints, afledte værdier
├── quickstart.md        # Phase 1: start og valideringsscenarier
├── contracts/
│   └── openapi.yaml     # Phase 1: API-kontrakt (flyttes til backend/openapi.yaml, se note)
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, ikke lavet endnu)
```

**Note om kontrakten**: Ved implementering flyttes `contracts/openapi.yaml` til
`backend/openapi.yaml`, som derefter er single source of truth. Den bruges af validatoren og
af Swagger UI. `contracts/` beholder kun en `README.md`, der peger derhen, så der aldrig
findes to versioner.

### Source Code (repository root)

```text
docker-compose.yml          # db, backend, frontend, swagger
.env.example                # porte, DB-login, SESSION_SECRET, BOOKING_SYSTEM_API_KEY, SEED_*
db/
├── 01_schema.sql           # SSOT for skemaet (data-model.md)
└── 02_seed.sql             # GENERERET af backend/scripts/generate-seed.js
backend/
├── Dockerfile
├── package.json            # "type": "module", scripts: start, dev (node --watch), test (node --test)
├── openapi.yaml            # SSOT for API'et
├── src/
│   ├── server.js           # app.listen
│   ├── app.js              # Express-app: json, cookie-session, validator, routes, fejl-middleware
│   ├── db.js               # Én mysql2-pool (dateStrings) + withTransaction()
│   ├── errors.js           # AppError(code, message, field, status) + fejl-middleware
│   ├── auth.js             # requireSession, allowBookingSystemKey
│   ├── money.js            # toOre()/toKr()
│   ├── routes/
│   │   ├── auth.js
│   │   ├── bookings.js     # inkl. /quote
│   │   ├── referenceData.js  # /room-types, /countries, /drinks
│   │   └── barSales.js
│   ├── services/
│   │   ├── pricing.js      # calculateStayPrice(): ren funktion
│   │   ├── bookingService.js  # validering, tildeling, status, quote
│   │   ├── barService.js
│   │   └── authService.js  # scrypt verify
│   └── repositories/
│       ├── bookingRepository.js
│       ├── roomRepository.js    # room types, rooms, ledighed (FOR UPDATE)
│       ├── pricingRepository.js # season_periods, room_prices
│       ├── barRepository.js
│       ├── referenceRepository.js # countries, drinks
│       └── userRepository.js
├── scripts/
│   └── generate-seed.js
└── test/
    ├── pricing.test.js
    ├── bookingService.test.js
    ├── barService.test.js
    └── api.test.js          # mod kongarthur_test
frontend/
├── Dockerfile
├── package.json
├── vite.config.js          # react + tailwind, proxy /api → backend:3000
├── index.html
└── src/
    ├── main.jsx            # router + login-loader
    ├── index.css           # tokens (docs/design/tokens.md)
    ├── ui.jsx              # primitiver (docs/design/komponenter.md)
    ├── format.js
    ├── api.js
    ├── Shell.jsx
    ├── BookingForm.jsx     # skuffe: opret + rediger
    └── pages/
        ├── Login.jsx
        ├── Bookings.jsx
        ├── BookingDetail.jsx
        └── BarSales.jsx
```

**Structure Decision**: Web-applikation med `backend/` og `frontend/` i roden, `db/` til
SQL-filer og én `docker-compose.yml`.

- Backend-mapperne spejler direkte de tre lag (princip I).
- Frontend er flad ligesom Roster.
- Der er ingen `shared/`-pakke. Kontrakten (`openapi.yaml`) er det, de to sider deler.

## Docker Compose (overblik)

| Service | Image/build | Porte | Noter |
|---|---|---|---|
| `db` | `mysql:8.4` | 3306 | Volumes: `db-data:/var/lib/mysql` og `./db:/docker-entrypoint-initdb.d:ro`. Healthcheck: `mysqladmin ping` |
| `backend` | `./backend` (`node:24-alpine`) | 3000 | `depends_on: db: condition: service_healthy`. `env_file: .env`. Kildekode mountet med `node --watch` |
| `frontend` | `./frontend` (`node:24-alpine`) | 5173 | `vite --host`. Proxy `/api` → `http://backend:3000` |
| `swagger` | `swaggerapi/swagger-ui` | 8080 | `./backend/openapi.yaml:/openapi.yaml:ro`, `SWAGGER_JSON=/openapi.yaml` |

## Fejlhåndtering (fælles)

| Kilde | Hvad sker der |
|---|---|
| Services | Kaster `new AppError(code, message, { field, status })` med dansk `message` |
| Validator | Fejl (`err.status === 400`) oversættes til `VALIDATION_ERROR` med `field` fra fejlens `path` og en dansk standardbesked |
| Ukendte fejl | `500 INTERNAL_ERROR`, "Der skete en fejl. Prøv igen." Detaljer logges kun på serveren |
| Svarformat | Altid `{ error: { code, message, field? } }`, jf. `Error`-skemaet i kontrakten |

## Implementeringsrækkefølge (input til /speckit-tasks)

1. **Fundament**: compose, `.env.example`, `01_schema.sql`, seed-generator, backend-skelet
   (app, db, errors, validator, auth) og frontend-skelet (tokens, ui, Shell, api,
   login-loader).
2. **US0 Login** → **US1 Liste og søg** → **US2 Opret med pris og tildeling**. Tests af
   `pricing` og tildeling skrives sammen med logikken.
3. **US3 Rediger** → **US4 Slet med bekræftelse** → **US5 Barsalg**.
4. **US6 Eksternt bookingsystem** (API-nøgle, `source`).
5. **Afslutning**: README med arkitekturdiagram og nulstilling, CONTRIBUTE.md, gennemgang af
   quickstart-scenarier og `/speckit-converge`.

## Complexity Tracking

Ingen overtrædelser af constitution. Tabellen er tom med vilje.
