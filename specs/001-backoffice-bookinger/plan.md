# Implementation Plan: Back Office – bookinger og barsalg

**Branch**: `001-backoffice-bookinger` (der arbejdes på `main`, jf. KB-D12) | **Date**: 2026-10-27 | **Spec**: [spec.md](spec.md)

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
- React + Tailwind-frontend efter designsystemet i `docs/design/`.
- Swagger UI, der viser samme kontrakt.

Detaljerede beslutninger står i [research.md](research.md).

## Technical Context

**Language/Version**: JavaScript (ES modules) på Node.js 24 LTS. Frontend er React 19 (JSX).

**Primary Dependencies**:
- Backend: Express 5.3, mysql2 3.x, express-openapi-validator 5.6, cookie-session 2.1.
- Frontend: React 19, React Router 8, Vite 8, Tailwind CSS 4.3, Phosphor Icons. Ingen
  UI-komponentbibliotek: native `<dialog>` og `<select>` (B14).
- Begrundelser: research.md § Afhængigheder.

**Storage**: MySQL 8.4 LTS i Docker med named volume `db-data`. Skema og seed er SQL-filer i
`db/`, som køres via `docker-entrypoint-initdb.d`. `db/00_test-db.sh` opretter testdatabasen
`kongarthur_test`. Scriptet kalder `mysql` direkte som root i stedet for `docker_process_sql`,
fordi Docker Desktop (macOS/Windows) viser monterede filer som eksekverbare, så entrypointet
kører scriptet i stedet for at source det. Sådan virker det begge veje, og
`db/.gitattributes` tvinger LF, så Windows-checkouts ikke giver CRLF. Tegnsættet er MySQL
8.4's standard `utf8mb4_0900_ai_ci`, så søgning ignorerer store/små bogstaver og accenter
(FR-002). Receptionistkontoen er ikke i seed. Den oprettes af `ensureSeedUser()` ved start af
backend ud fra `SEED_USERNAME`/`SEED_PASSWORD` i `.env` (B8).

**Testing**: `node:test` + `node:assert/strict` (`npm test` i `backend/`). Kun backend.
Services får repositories, `withTransaction` og `today` injiceret, så unit-tests kører uden
database. API-tests kører mod `kongarthur_test`, som nulstilles ved hver kørsel. Testnavne
starter med krav-ID (B11).

**Target Platform**: Docker Compose på udviklermaskiner (macOS/Windows/Linux). Back office
vises i en desktop-browser i receptionen.

**Project Type**: Web-applikation (backend + frontend) plus database og API-dokumentation.

**Performance Goals**: Svar til mennesker føles øjeblikkelige: liste og søgning under 1 sekund
på ca. 10.400 bookinger. En booking fra bookingsystemet er synlig i bookinglisten, næste gang
listen indlæses (SC-006).

**Constraints**:
- Én `docker compose up` starter alt (KB-T3).
- Al data går gennem API'et (KB-A5, KB-T9).
- Ingen AI i UI'et (KB-T8).
- Kun desktop. Mobil er uden for scope (spec, Assumptions).
- Fremlæggelse 2026-11-06.

**Scale/Scope**:
- 1 brugerkonto og 60 værelser.
- Ca. 10.400 bookinger og ca. 20.000 barsalg i testdata (research R10).
- 4 skærme (login, liste, detalje, barsalg) plus én skuffe-formular.
- 10 API-stier.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princip | Krav | Plan | Status |
|---|---|---|---|
| I. Trelagsarkitektur | Præsentation → logik → data. Kun repositories kender SQL | `routes/` → `services/` → `repositories/`. Services er rene og testbare uden HTTP/SQL | ✅ |
| II. API-først + OpenAPI | Al data via REST/JSON. Kontrakten ligger i repo og vises i Swagger. Frontend og eksterne systemer bruger kun API'et | `backend/openapi.yaml` er SSOT. Validatoren håndhæver den, og Swagger UI-containeren viser den. Frontend kalder via `api.js`, og bookingsystemet via `X-API-Key` | ✅ |
| III. Logik og nøgletal i logiklaget | Kapacitet, overlap og pris i logiklaget. Frontend regner ikke | `bookingService`, `pricing`, `barService`. Prisvisning via `/bookings/quote`. Summer og antal kommer fra API'et (`total`, `totalPrice`, `counts`, `nights`, `amount`) | ✅ |
| IV. Container og reproducerbart miljø | Docker, én compose, MySQL, healthcheck, named volume, reproducerbart skema, priser og sæsoner som tabeller | 4 services. `depends_on: condition: service_healthy`. `db-data`-volume. `db/01_schema.sql` + genereret `02_seed.sql`. Tabellerne `seasons`, `season_periods` og `room_prices` | ✅ |
| V. Testbar forretningslogik | Tests af regler, én kommando | `node --test`. Unit-tests af pris og booking samt få API-tests (research R13) | ✅ |
| VI. Enkelhed og ejerskab | YAGNI, ingen AI i UI, gruppen kan forklare alt | Ingen ORM og ingen state-, form- eller datobiblioteker. Hver afhængighed er begrundet. Bevidste forenklinger markeres med kommentar | ✅ |
| Retningslinjer | `AGENTS.md`, `docs/retningslinjer/*`, `docs/design/` | 3NF med dokumenterede undtagelser (data-model.md). Penge i øre/DECIMAL. Fejlformat `{error:{code,message,field}}`. Frontend følger `docs/design/` | ✅ |

**Gate (før research)**: Bestået. Ingen overtrædelser.

**Gate (efter design)**: Bestået. Designet tilføjede to tabeller ud over specens entiteter:
`season_periods`, der splitter Sæson (3NF), og `drink_categories` (opslag). Begge styrker
princip IV og 3NF. Specens Gæst er kolonner på `bookings` (`guest_name`, `country_code`),
fordi der ikke er nogen gæsteidentitet i scope (B15). `bookings.room_type_id` er bevidst
udeladt for at undgå en transitiv afhængighed. Ingen overtrædelser. Complexity Tracking
noterer ét bevidst valg (overlap-prædikatet i SQL).

## Project Structure

### Documentation (this feature)

```text
specs/001-backoffice-bookinger/
├── spec.md              # Krav (/speckit-specify)
├── plan.md              # Denne fil
├── research.md          # Phase 0: beslutninger og begrundelser
├── data-model.md        # Phase 1: tabeller, constraints, afledte værdier
├── quickstart.md        # Phase 1: start og valideringsscenarier
├── analysis.md          # /speckit-analyze: fund og bindende beslutninger (B1–B18)
├── contracts/
│   └── README.md        # peger på backend/openapi.yaml (se note)
├── checklists/
│   └── requirements.md
├── tasks.md             # Phase 2 (/speckit-tasks)
└── converge.md          # /speckit-converge: implementeret vs. mangler (KB-D4, T070)
```

**Note om kontrakten**: Ved implementering (T001) er `contracts/openapi.yaml` flyttet til
`backend/openapi.yaml`, som nu er single source of truth. Den bruges af validatoren og
af Swagger UI. `contracts/` beholder kun en `README.md`, der peger derhen, så der aldrig
findes to versioner.

### Source Code (repository root)

```text
README.md                   # start, arkitektur, fejlfinding (KB-D6)
CONTRIBUTE.md               # arbejdsgang og commits (KB-D6)
docker-compose.yml          # db, backend, frontend, swagger
.env.example                # udviklings-placeholders: DB-login, SESSION_SECRET, BOOKING_SYSTEM_API_KEY, SEED_*
.gitignore                  # node_modules/, dist/, .env, .DS_Store, *.log
.prettierrc.json            # fælles formatering (npx prettier@3, ingen afhængighed)
db/
├── .gitattributes          # *.sh med LF, så bash kan køre scriptet på Windows
├── 00_test-db.sh           # opretter kongarthur_test og giver MYSQL_USER adgang
├── 01_schema.sql           # SSOT for skemaet (data-model.md)
└── 02_seed.sql             # GENERERET af backend/scripts/generate-seed.js (uden users)
backend/
├── Dockerfile              # COPY package*.json → npm ci → COPY . .
├── .dockerignore           # node_modules, .env, *.log
├── package.json            # "type": "module", scripts: start, dev (node --watch), test (node --test)
├── package-lock.json
├── openapi.yaml            # SSOT for API'et
├── src/
│   ├── server.js           # ensureSeedUser() + app.listen
│   ├── app.js              # Express-app: json, cookie-session, validator, services → routes, fejl-middleware
│   ├── db.js               # Én mysql2-pool (dateStrings) + withTransaction() (READ COMMITTED)
│   ├── errors.js           # AppError(code, message, field, status) + fejl-middleware
│   ├── auth.js             # requireSession, allowBookingSystemKey (pr. route)
│   ├── money.js            # toOre()/toKr()
│   ├── today.js            # today() i Europe/Copenhagen, injiceres i services
│   ├── routes/
│   │   ├── auth.js
│   │   ├── bookings.js     # inkl. /quote
│   │   ├── referenceData.js  # /room-types, /countries, /drinks
│   │   └── barSales.js
│   ├── services/
│   │   ├── pricing.js      # calculateStayPrice(): ren funktion
│   │   ├── bookingService.js  # ophold/status/visninger, validering, tildeling, quote
│   │   ├── barService.js
│   │   └── authService.js  # scrypt hash/verify, login, ensureSeedUser
│   └── repositories/
│       ├── bookingRepository.js
│       ├── roomRepository.js    # room types, rooms, ledighed (FOR UPDATE)
│       ├── pricingRepository.js # season_periods, room_prices
│       ├── barRepository.js
│       ├── referenceRepository.js # countries, drinks
│       └── userRepository.js
├── scripts/
│   └── generate-seed.js    # deterministisk, bruger calculateStayPrice
└── test/
    ├── money.test.js
    ├── authService.test.js
    ├── pricing.test.js
    ├── bookingService.test.js
    ├── barService.test.js
    ├── testDb.js            # setupTestDb(): drop/create kongarthur_test + skema + fixture
    └── api.test.js          # mod kongarthur_test
frontend/
├── Dockerfile              # som backend, CMD npx vite
├── .dockerignore
├── package.json
├── package-lock.json
├── vite.config.js          # react + tailwind, proxy /api → backend:3000 og /docs → swagger:8080
├── index.html
└── src/
    ├── main.jsx            # router: /login uden for layout-routen, login-loader på layout
    ├── index.css           # tokens (docs/design/tokens.md)
    ├── ui.jsx              # primitiver (docs/design/komponenter.md)
    ├── format.js           # al tal- og datoformatering (Intl)
    ├── api.js              # eneste vej til backend
    ├── Shell.jsx           # sidebar, toast (aria-live)
    ├── BookingForm.jsx     # <dialog>-skuffe: opret + rediger
    └── pages/
        ├── Login.jsx
        ├── Bookings.jsx
        ├── BookingDetail.jsx
        └── BarSales.jsx
```

**Structure Decision**: Web-applikation med `backend/` og `frontend/` i roden, `db/` til
SQL-filer og én `docker-compose.yml`.

- Backend-mapperne spejler direkte de tre lag (princip I).
- Frontend er flad (`docs/design/README.md` § Filstruktur).
- Der er ingen `shared/`-pakke. Kontrakten (`openapi.yaml`) er det, de to sider deler.

## Docker Compose (overblik)

| Service | Image/build | Porte | Noter |
|---|---|---|---|
| `db` | `mysql:8.4` | – (kun internt) | `env_file: .env`, `TZ=Europe/Copenhagen`. Volumes: `db-data:/var/lib/mysql` og `./db:/docker-entrypoint-initdb.d:ro`. Healthcheck: `mysqladmin ping -h 127.0.0.1 --protocol=TCP -u$$MYSQL_USER -p$$MYSQL_PASSWORD` med `interval: 3s`, `retries: 40`, `start_period: 60s` |
| `backend` | `./backend` (`node:24-alpine`) | 3000 | `depends_on: db: condition: service_healthy`. `env_file: .env`, `TZ=Europe/Copenhagen`. Volumes: `./backend:/app`, anonymt `/app/node_modules` og `./db:/db`. `node --watch` |
| `frontend` | `./frontend` (`node:24-alpine`) | 5173 | `npx vite` med `host: true` i `vite.config.js`. Volumes: `./frontend:/app` og anonymt `/app/node_modules`. Proxy `/api` → `http://backend:3000` og `/docs` → `http://swagger:8080` |
| `swagger` | `swaggerapi/swagger-ui` | – (via `http://localhost:5173/docs`) | `./backend/openapi.yaml:/spec/openapi.yaml:ro`, `SWAGGER_JSON=/spec/openapi.yaml` (i en undermappe: ligger filen i `/`, leder imagets nginx efter `//openapi.yaml` og giver 404), `BASE_URL=/docs`. Samme origin som frontend, så "Try it out" kalder `/api` med session-cookien |

- Dockerfiles: `FROM node:24-alpine`, `WORKDIR /app`, `COPY package*.json ./`, `RUN npm ci`,
  `COPY . .`. Lockfiles genereres én gang med
  `docker run --rm -v "$PWD/backend:/app" -w /app node:24-alpine npm install` (tilsvarende for
  frontend) og committes.
- Stier til `db/` resolves med `new URL('../../db/…', import.meta.url)`, så de virker både i
  container og på host.
- Opstart: `cp .env.example .env && docker compose up --build`. Efter ændrede afhængigheder:
  `docker compose up --build -V`.

## Fejlhåndtering (fælles)

| Kilde | Hvad sker der |
|---|---|
| Services | Kaster `new AppError(code, message, { field, status })` med dansk `message` |
| Validator og andre 4xx | 404 → `NOT_FOUND`, 401 → `UNAUTHORIZED`. Alle øvrige (400, 405, 413, 415, malformet JSON) → `VALIDATION_ERROR` med samme status. `field` sættes kun, når fejlens `path` starter med `/body/`, `/query/` eller `/params/`, og beskeden er "Ugyldig værdi i feltet <dansk label>" |
| Ukendte fejl | `500 INTERNAL_ERROR`, "Der skete en fejl. Prøv igen." Detaljer logges kun på serveren |
| Svarformat | Altid `{ error: { code, message, field? } }`, jf. `Error`-skemaet i kontrakten |

## Implementeringsrækkefølge (input til /speckit-tasks)

1. **Fundament**: flyt kontrakten, compose, `.env.example`, `00_test-db.sh`, `01_schema.sql`,
   `pricing.js` og derefter seed-generatoren, backend-skelet (app, db, errors, validator,
   today, testDb) og frontend-skelet (tokens, ui, Shell, api).
2. **US0 Login** (auth pr. route, `ensureSeedUser`, login-loader) → **US1 Liste og søg** →
   **US2 Opret med pris og tildeling**. Tests af tildeling skrives sammen med logikken.
3. **US3 Rediger** → **US4 Slet med bekræftelse** → **US5 Barsalg**.
4. **US6 Eksternt bookingsystem** (tests og kilde-badge. API-nøglen og `source` findes fra US0
   og US2).
5. **Afslutning**: README med arkitekturdiagram og nulstilling, CONTRIBUTE.md, gennemgang af
   quickstart-scenarier og `/speckit-converge`.

## Complexity Tracking

Ingen overtrædelser af constitution. Tabellen noterer ét bevidst valg, så det kan forklares
ved fremlæggelsen.

| Valg | Hvorfor | Simplere alternativ fravalgt, fordi |
|---|---|---|
| Overlap-prædikatet `b.check_in < ? AND b.check_out > ? AND (? IS NULL OR b.id <> ?)` ligger som parametriseret SQL i `roomRepository` (research R4) | Ledige værelser skal findes i samme transaktion som `FOR UPDATE`-låsen, så to samtidige bookinger ikke får samme værelse (FR-007). Prædikatet er en forespørgsel, ikke en forretningsregel. Reglerne (tildeling, status, "bor på hotellet") ligger i `bookingService` | At hente alle bookinger af typen og tjekke overlap i JavaScript ville flytte flere rækker og stadig kræve låsen i databasen |
