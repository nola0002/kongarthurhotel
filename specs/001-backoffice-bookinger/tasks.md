---
description: "Tasks for 001-backoffice-bookinger"
---

# Tasks: Back Office – bookinger og barsalg

**Input**: Design documents from `/specs/001-backoffice-bookinger/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml,
quickstart.md, analysis.md (beslutningerne B1–B18 er indarbejdet her)

**Tests**: Inkluderet. `docs/retningslinjer/tests.md` kræver en test for hver ny
forretningsregel og hvert nøgletal i samme commit. Tests skrives sammen med logikken og ses
fejle, før logikken er færdig. Der er kun backend-tests med `node:test`. **Testnavne starter
altid med krav-ID'et** (fx `test('FR-007: rejects booking when every room of the type is taken', …)`).

**Bindende for alle tasks**: `AGENTS.md`, `docs/retningslinjer/{kodekvalitet,database,tests}.md`
og `docs/design/`. Commit-beskeder refererer task-ID og krav-ID (fx `T036 FR-002: …`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Kan køres parallelt (andre filer, ingen afhængighed af ufærdige tasks).
- **[Story]**: US0–US6 svarer til User Story 0–6 i spec.md.

## Path Conventions

- Web-app: `backend/src/`, `backend/test/`, `frontend/src/` og `db/` i repo-roden.
- Fejlformat overalt: `{ error: { code, message, field? } }` med dansk `message`
  (`backend/openapi.yaml` `Error`).
- Penge: Repositories omregner DECIMAL-strenge til øre (heltal). Services regner i øre.
  Routes sender kroner.
- Tidspunkter: Repositories returnerer `DATETIME` som lokal tid `'YYYY-MM-DDTHH:mm:ss'`
  (`replace(' ', 'T')`).
- I dag: `today()` fra `backend/src/today.js` (Europe/Copenhagen). Services får den injiceret
  og kalder aldrig `new Date()` selv.
- Services oprettes med en factory og injicerede afhængigheder (fx
  `createBookingService({ bookingRepo, roomRepo, pricingRepo, referenceRepo, withTransaction, today })`).
  `backend/src/app.js` er det eneste sted, hvor de kobles til de rigtige repositories.
  Unit-tests giver falske repos og `withTransaction: (fn) => fn({})`.
- Path-params læses som `Number(req.params.id)`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Repo-struktur, containere og pakker.

- [ ] T001 Flyt `specs/001-backoffice-bookinger/contracts/openapi.yaml` til `backend/openapi.yaml` med `git mv`. Opret `specs/001-backoffice-bookinger/contracts/README.md` med én linje: "Kontrakten ligger i `backend/openapi.yaml` (single source of truth)." Tasken kører før T002, så bind-mountet i swagger-servicen ikke opretter en tom mappe.
- [ ] T002 Opret `docker-compose.yml`, `.env.example` og `.gitignore` i repo-roden efter tabellen "Docker Compose" i plan.md:
  - Services:
    - `db`: `mysql:8.4`, `env_file: .env`, `environment: TZ=Europe/Copenhagen`, volumes `db-data:/var/lib/mysql` og `./db:/docker-entrypoint-initdb.d:ro`. Healthcheck `mysqladmin ping -h 127.0.0.1 --protocol=TCP -u$$MYSQL_USER -p$$MYSQL_PASSWORD` med `interval: 3s`, `retries: 40`, `start_period: 60s` (TCP, så "klar" først meldes efter init, KB-T4).
    - `backend`: build `./backend`, port 3000, `depends_on: db: condition: service_healthy`, `env_file: .env`, `environment: TZ=Europe/Copenhagen`. Volumes `./backend:/app`, anonymt `/app/node_modules` og `./db:/db` (så seed-script og test-DB kan læse og skrive `db/`).
    - `frontend`: build `./frontend`, port 5173, `./frontend:/app` + anonymt `/app/node_modules`.
    - `swagger`: `swaggerapi/swagger-ui`, **ingen porte**, `./backend/openapi.yaml:/openapi.yaml:ro`, `SWAGGER_JSON=/openapi.yaml`, `BASE_URL=/docs`. Den åbnes via Vite-proxyen på `http://localhost:5173/docs`.
  - Navngivet volume `db-data`.
  - `.env.example` indeholder kun udviklings-placeholders og øverst kommentaren `# Development placeholders – change them`: `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE=kongarthur`, `MYSQL_USER`, `MYSQL_PASSWORD`, `DB_HOST=db`, `SESSION_SECRET`, `BOOKING_SYSTEM_API_KEY` (placeholder på mindst 32 tegn), `SEED_USERNAME=reception`, `SEED_PASSWORD=skift-mig`.
  - `.gitignore` indeholder: `node_modules/`, `.env`, `.DS_Store`.
- [ ] T003 [P] Opret `backend/package.json`, `backend/Dockerfile` og `backend/package-lock.json`:
  - `package.json`: `"type": "module"`, scripts `start` (`node src/server.js`), `dev` (`node --watch src/server.js`), `test` (`node --test`). Dependencies: `express@^5.3`, `mysql2@^3`, `express-openapi-validator@^5.6`, `cookie-session@^2.1`. Ingen devDependencies.
  - `Dockerfile`: `FROM node:24-alpine`, `WORKDIR /app`, `COPY package*.json ./`, `RUN npm ci`, `COPY . .`, `CMD ["npm","run","dev"]`.
  - Generér lockfilen én gang med `docker run --rm -v "$PWD/backend:/app" -w /app node:24-alpine npm install`, og commit den.
- [ ] T004 [P] Opret frontend-skelettet:
  - `frontend/package.json`: dependencies `react@^19`, `react-dom@^19`, `react-router@^8`, `@phosphor-icons/react@^2`, `@fontsource-variable/instrument-sans@^5`. devDependencies `vite@^8`, `@vitejs/plugin-react@^6`, `tailwindcss@^4.3`, `@tailwindcss/vite@^4.3`.
  - `frontend/vite.config.js`: plugins `react()` og `tailwindcss()`, `server: { host: true, port: 5173, proxy: { '/api': 'http://backend:3000', '/docs': 'http://swagger:8080' } }`. Samme origin gør, at Swagger "Try it out" rammer `/api` med session-cookien.
  - `frontend/index.html`: `lang="da"`, `<div id="root">` og `src/main.jsx`.
  - `frontend/Dockerfile`: `FROM node:24-alpine`, `WORKDIR /app`, `COPY package*.json ./`, `RUN npm ci`, `COPY . .`, `CMD ["npx","vite"]`.
  - Generér `frontend/package-lock.json` med `docker run --rm -v "$PWD/frontend:/app" -w /app node:24-alpine npm install`, og commit den.
- [ ] T005 [P] Opret `.prettierrc.json` i roden: `{ "semi": false, "singleQuote": true, "printWidth": 120 }`. Det matcher kodeeksemplerne i `docs/design/`. Formatér med `npx prettier@3 --write backend frontend`, så der ikke kommer en afhængighed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Skema, test-DB, prisberegning, testdata, backend-skelet (lag, fejl, validering, tid) og frontend-skelet (tokens, primitiver, API-klient).

**⚠️ CRITICAL**: Ingen user story kan startes, før denne fase er færdig.

- [ ] T006 Skriv `db/01_schema.sql` præcis efter data-model.md. Ingen `USE`/`CREATE DATABASE`, så filen også kan køres mod `kongarthur_test`. Tabeller i FK-rækkefølge:
  - `countries`: `code CHAR(2) PK`, `name VARCHAR(100) NOT NULL`.
  - `room_types`: `name VARCHAR(50) NOT NULL UNIQUE`, `capacity TINYINT UNSIGNED NOT NULL` med `CHECK (capacity > 0)`.
  - `rooms`: `room_number VARCHAR(10) NOT NULL UNIQUE`, `room_type_id` FK.
  - `seasons`: `name VARCHAR(50) NOT NULL UNIQUE`.
  - `season_periods`: `start_date DATE NOT NULL`, `end_date DATE NOT NULL` med `CHECK (end_date >= start_date)`, index `(start_date, end_date)`.
  - `room_prices`: sammensat PK `(room_type_id, season_id)`, `price_per_night DECIMAL(10,2) NOT NULL` med `CHECK (price_per_night >= 0)`.
  - `bookings`:
    - `guest_name VARCHAR(150) NOT NULL` med `CHECK (CHAR_LENGTH(TRIM(guest_name)) > 0)`.
    - `country_code CHAR(2) NOT NULL` FK → `countries.code`.
    - `room_id` FK.
    - `check_in DATE NOT NULL`, `check_out DATE NOT NULL` med `CHECK (check_out > check_in)`.
    - `guest_count TINYINT UNSIGNED NOT NULL` med `CHECK (guest_count > 0)`.
    - `total_price DECIMAL(10,2) NOT NULL` med `CHECK (total_price >= 0)`.
    - `source ENUM('backoffice','booking_system') NOT NULL DEFAULT 'backoffice'`.
    - `created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`.
    - Indexes `(room_id, check_in, check_out)`, `(check_in)` og `(guest_name)`.
    - **Ingen** `room_type_id`.
  - `drink_categories`: `name VARCHAR(50) NOT NULL UNIQUE`.
  - `drinks`: `name VARCHAR(100) NOT NULL UNIQUE`, `drink_category_id` FK, `price DECIMAL(10,2) NOT NULL` med `CHECK (price >= 0)`.
  - `bar_sales`: `drink_id` FK, `quantity SMALLINT UNSIGNED NOT NULL` med `CHECK (quantity >= 1)`, `unit_price DECIMAL(10,2) NOT NULL` med `CHECK (unit_price >= 0)`, `sold_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`, `booking_id INT NULL` FK `ON DELETE SET NULL`, index `(sold_at)`.
  - `users`: `username VARCHAR(50) NOT NULL UNIQUE`, `password_hash VARCHAR(255) NOT NULL`.
  - Kommentér de to bevidste undtagelser (`total_price`, `unit_price`) i SQL'en.
- [ ] T007 [P] Opret init-scriptet `db/00_test-db.sh` med én linje: `docker_process_sql --database=mysql <<<"CREATE DATABASE IF NOT EXISTS kongarthur_test; GRANT ALL ON kongarthur_test.* TO '$MYSQL_USER'@'%';"`. Filen må ikke være eksekverbar, så MySQL-entrypointet sourcer den (kun da findes `docker_process_sql`). Den kører kun på et tomt volume.
- [ ] T008 [P] Implementér `backend/src/money.js`: `toOre(decimalString)` → heltal uden float-aritmetik (split på `.`) og `toKr(ore)` → tal med op til 2 decimaler. Tilføj et kort `node:test` i `backend/test/money.test.js` for `'1800.50'` ↔ `180050` og `'0.10'` ↔ `10`.
- [ ] T009 [P] Implementér `backend/src/errors.js`:
  - `class AppError extends Error` med `(code, message, { field, status })`. Standard-status pr. code: `VALIDATION_ERROR` 400, `UNAUTHORIZED` 401, `NOT_FOUND` 404, `ROOM_TYPE_FULLY_BOOKED` 409, `CAPACITY_EXCEEDED`/`PRICE_NOT_CONFIGURED`/`BOOKING_NOT_IN_HOUSE` 422.
  - Fejl-middleware `errorHandler(err, req, res, next)`:
    - `AppError` sendes som `{error:{code,message,field}}`.
    - Alle andre 4xx (validator, Express og body-parser) mappes: 404 → `NOT_FOUND`, 401 → `UNAUTHORIZED`, alle øvrige (400, 405, 413, 415 og malformet JSON) → `VALIDATION_ERROR` med samme status.
    - `field` sættes kun, når `err.errors?.[0]?.path` starter med `/body/`, `/query/` eller `/params/` (sidste del af stien). Beskeden er "Ugyldig værdi i feltet <label>", hvor et lille map oversætter API-feltnavnet til en dansk label (fx `guestCount` → "Antal gæster", `checkOut` → "Afrejse").
    - Alt andet bliver 500 `INTERNAL_ERROR` "Der skete en fejl. Prøv igen." og `console.error(err)`.
- [ ] T010 [P] Opret `backend/src/today.js` med én linje: `export const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Copenhagen' }).format(new Date())`.
- [ ] T011 [P] Implementér `hashPassword(password)` og `verifyPassword(password, stored)` som rene funktioner i `backend/src/services/authService.js`:
  - Brug `crypto.scrypt` (promisified) med 16 bytes tilfældigt salt og 64 bytes key.
  - Formatet er `scrypt$<salt-hex>$<hash-hex>`.
  - Sammenlign med `crypto.timingSafeEqual`.
  - `verifyPassword` returnerer `false` (kaster ikke) ved forkert format.
- [ ] T012 [P] Skriv `backend/test/authService.test.js` (`FR-015: …`): hash → verify med korrekt adgangskode er `true`, forkert er `false`, og ugyldigt format er `false`.
- [ ] T013 Implementér den rene funktion `calculateStayPrice({ checkIn, checkOut, periods, prices })` i `backend/src/services/pricing.js` (bruger `AppError` fra T009):
  - Gennemgå hver nat `d ∈ [checkIn, checkOut)` med UTC-datoaritmetik på `YYYY-MM-DD`.
  - Find den periode, der indeholder `d`, og prisen for dens sæson.
  - Gruppér i linjer pr. sæson i rækkefølge.
  - Returnér `{ nights, lines: [{ season, nights, pricePerNightOre, subtotalOre }], totalOre }`.
  - Mangler periode eller pris, kastes `AppError('PRICE_NOT_CONFIGURED', 'Der mangler en pris for værelsestypen i perioden')`.
  - Kommentar: `// each night is priced by its own season, so a stay can span two seasons (FR-008)`.
- [ ] T014 [P] Skriv `backend/test/pricing.test.js`:
  - `FR-008`: Én sæson: 3 × 500 = 1500.
  - `FR-008` over sæsonskifte: 2 nætter i lavsæson (500) + 1 nat i højsæson (800) = 1800, med to linjer.
  - `FR-008`: Ophold over årsskifte (31/12 → 2/1).
  - `FR-008`: Manglende periode kaster `PRICE_NOT_CONFIGURED`.
  - `FR-008`: Manglende `room_prices`-række (sæsonen findes ikke i `prices`) kaster `PRICE_NOT_CONFIGURED`.
  - Kør testen og se den fejle, før T013 er færdig.
- [ ] T015 Skriv `backend/scripts/generate-seed.js`. Det skriver `db/02_seed.sql` (sti via `new URL('../../db/02_seed.sql', import.meta.url)`, så den virker både i container og på host) med første linje `-- GENERATED by backend/scripts/generate-seed.js – do not edit`. Fuldt deterministisk: fast seed i en lille PRNG (mulberry32) og faste datoer `SEED_START = '2025-01-01'` og `SEED_END = '2027-02-28'`. Ingen `today` og intet tilfældigt salt. Indhold (research R10):
  - Ca. 40 lande med danske navne fra `new Intl.DisplayNames('da', { type: 'region' })`.
  - Værelsestyper: Enkeltværelse (kapacitet 1), Dobbeltværelse (2), Familieværelse (4), Suite (3).
  - 60 værelser med numrene 101–115, 201–215, 301–315, 401–415, fordelt på typerne.
  - Sæsoner: Lavsæson (jan–mar, nov–dec), Mellemsæson (apr–maj, sep–okt) og Højsæson (jun–aug). Perioder for 2025, 2026 og 2027 uden huller eller overlap.
  - `room_prices` for alle 4×3 kombinationer.
  - `drink_categories` Cocktail og Kaffe, og ca. 8 cocktails og 6 kaffedrikke med priser.
  - Bookinger fra `SEED_START` til `SEED_END` med 60–80 % belægning og 1–7 nætter. Ingen overlap pr. værelse. `guest_name`, `country_code` (landene vægtes realistisk) og `guest_count` ≤ typens kapacitet står direkte på bookingen. `total_price` beregnes med `calculateStayPrice` importeret fra `../src/services/pricing.js` (én prisimplementering), og beløb skrives med `toKr` fra `../src/money.js`.
  - Barsalg hver dag fra `SEED_START` til `SEED_SALES_END = '2026-11-05'` (dagen før fremlæggelsen, så der ikke er salg i fremtiden). Ca. 1/3 er knyttet til en booking, hvor gæsten er i huset den dag. `unit_price` er drinkens pris.
  - **Ingen** `users`. Kontoen oprettes af `ensureSeedUser()` (T026).
  - Batch-`INSERT`s med 1.000 rækker pr. statement.
  - Kør scriptet med `docker compose run --rm backend node scripts/generate-seed.js` (eller `node backend/scripts/generate-seed.js` på host), og commit `db/02_seed.sql`.
- [ ] T016 [P] Implementér `backend/src/db.js`:
  - Én `mysql2/promise`-pool fra env (`DB_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`) med `dateStrings: true`.
  - Eksportér `pool` og `withTransaction(fn)`, der henter en connection, kører `SET TRANSACTION ISOLATION LEVEL READ COMMITTED` og derefter `beginTransaction`, `fn(conn)` og `commit`. Den kører `rollback` ved fejl og altid `release`. Kommentar: `// READ COMMITTED so the FOR UPDATE lock reads the latest committed bookings (FR-007)`.
- [ ] T017 Implementér `backend/src/app.js` og `backend/src/server.js`:
  - `app.js` eksporterer en Express-app uden `listen`:
    - `app.set('trust proxy', 1)` og `express.json()`.
    - `cookieSession({ name: 'session', secret: process.env.SESSION_SECRET, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 12*3600*1000 })`.
    - `OpenApiValidator.middleware({ apiSpec: './openapi.yaml', validateRequests: true, validateResponses: false, validateSecurity: false, ajvFormats: { mode: 'full' } })`, så fx `2026-02-30` afvises.
    - Composition root: services oprettes her med rigtige repositories, `withTransaction` og `today`, og gives til routerne. Routers monteres under `/api`. Auth sættes pr. route i routerne (T027), ikke som global `app.use`.
    - `errorHandler` sidst.
  - `server.js` kalder `app.listen(3000)` og logger `API listening on :3000`.
- [ ] T018 Opret `backend/test/testDb.js` til API-tests (afhænger af T006 og T011):
  - `setupTestDb()` sætter `process.env.MYSQL_DATABASE = 'kongarthur_test'` og forbinder som `MYSQL_USER` uden database og med `multipleStatements`.
  - Den kører **hver gang** `DROP DATABASE IF EXISTS kongarthur_test`, `CREATE DATABASE kongarthur_test` og `USE kongarthur_test`, derefter `db/01_schema.sql` (via `new URL('../../db/01_schema.sql', import.meta.url)`).
  - Den indsætter et lille, eksplicit fixture: 2 lande, 1 type "Dobbeltværelse" (kapacitet 2) med 2 værelser, 1 sæson med periode 2020–2030 og pris 500, 1 drink og brugeren `test`/`test` (via `hashPassword`).
  - Kør aldrig mod `kongarthur`.
- [ ] T019 [P] Opret `frontend/src/index.css` ved at kopiere kodeblokken fra `docs/design/tokens.md` uændret.
- [ ] T020 [P] Opret `frontend/src/format.js` efter `docs/design/komponenter.md` § Formatering:
  - Funktioner: `kr`, `num`, `toDate`, `date`, `longDate`, `relative`, `isoWeek` og `nightsLabel(n)` ("1 nat" eller "N nætter", formaterer kun et antal fra API'et).
  - `TODAY = new Date().toLocaleDateString('sv-SE')` (lokal dato). Den bruges kun til visning (relative datoer). Status kommer fra API'et.
- [ ] T021 [P] Opret `frontend/src/ui.jsx` efter `docs/design/komponenter.md`:
  - Komponenter: `cx`, `buttonClass` (inkl. `danger`), `Button`, `ButtonLink`, `Kbd`, `PageHeader`, `SectionHeading`, `Panel`, `Tile`, `Stat`, `EmptyState`, `Field`, `inputClass`, `labelClass`. Brug klasserne præcis som specificeret dér.
  - `StatusBadge({ status })` for `upcoming`/`arriving`/`in_house`/`departed` med markører og pills fra `docs/design/komponenter.md` § `StatusBadge`.
- [ ] T022 [P] Opret `frontend/src/api.js` præcis som kodeblokken i `docs/design/komponenter.md`. Brug `BASE = '/api'` (Vite-proxy), så der ikke er nogen env-variabel.
- [ ] T023 Opret `frontend/src/Shell.jsx` og `frontend/src/main.jsx`:
  - Shell som i `docs/design/komponenter.md` § Shell og `docs/design/skaerme.md` § Shell, kun desktop: sidebar 264px med ordmærket "Kong Arthur", nav "Bookinger" (`/bookinger`) og "Barsalg" (`/barsalg`) og et indholdskort.
  - Toast er en lille komponent i `Shell.jsx` med `role="status" aria-live="polite"` og én toast ad gangen. Eksportér `useToast()` (hook, der viser `{ title, description, tone }`).
  - `main.jsx` har `createBrowserRouter` med layout-route `<Shell>`, `/` der redirecter til `/bookinger`, og placeholders for `/bookinger`, `/bookinger/:id` og `/barsalg`. Den importerer `index.css`.
- [ ] T024 Erstat kodeblokkene i `docs/design/tokens.md` og `docs/design/komponenter.md` med henvisninger til `frontend/src/index.css`, `frontend/src/ui.jsx`, `frontend/src/format.js` og `frontend/src/api.js`, så koden kun findes ét sted (SSOT efter implementering). Afhænger af T019–T022.

**Checkpoint**: `cp .env.example .env && docker compose up --build` starter alle 4 containere. Databasen indeholder seed-data, og `kongarthur_test` findes. Backend svarer på `http://localhost:3000/api`, og fejl kommer i JSON-format. Frontend viser en tom Shell, og Swagger UI på `http://localhost:5173/docs` viser kontrakten. `docker compose exec backend npm test` er grøn (money, authService, pricing).

---

## Phase 3: User Story 0 - Logge ind (Priority: P1)

**Goal**: Kun personale med login kan se og ændre data (FR-015).

**Independent Test**: Uden login giver `/api`-kald 401, og frontend viser login-siden uden data. Med forkert adgangskode eller ukendt bruger vises samme generelle fejl. Med korrekt login gives der adgang. Efter log ud kræves nyt login.

- [ ] T025 [P] [US0] Implementér `findByUsername(username)` (returnerer `{ id, username, passwordHash }` eller `null`), `countUsers()` og `insertUser({ username, passwordHash })` i `backend/src/repositories/userRepository.js`.
- [ ] T026 [US0] Implementér `createAuthService({ userRepo })` i `backend/src/services/authService.js` med:
  - `login(username, password)`, der returnerer `{ id, username }` og kaster `AppError('UNAUTHORIZED', 'Forkert brugernavn eller adgangskode')` både ved ukendt bruger og forkert kode (samme besked, FR-015/edge case).
  - `ensureSeedUser()`: Er `users` tom, indsættes `SEED_USERNAME` med `hashPassword(SEED_PASSWORD)` fra env. Ellers sker der intet.
  - `app.js` eksporterer `authService`, og `backend/src/server.js` kalder `await authService.ensureSeedUser()` før `app.listen(3000)`.
- [ ] T027 [US0] Implementér `backend/src/auth.js` med to middlewares, der monteres pr. route:
  - `requireSession`: 401 `UNAUTHORIZED` "Du skal være logget ind", hvis `req.session.userId` mangler.
  - `allowBookingSystemKey` (kun til `POST /bookings`):
    - Er headeren `X-API-Key` sat, sammenlignes den med `process.env.BOOKING_SYSTEM_API_KEY` via `crypto.timingSafeEqual` efter længdetjek.
    - Fejler lukket: er `BOOKING_SYSTEM_API_KEY` ikke sat eller under 32 tegn, afvises alle nøgler med 401.
    - Match sætter `req.bookingSource = 'booking_system'`. Mismatch giver 401 `UNAUTHORIZED` "Ugyldig API-nøgle".
    - Uden header falder den tilbage til `requireSession` med `req.bookingSource = 'backoffice'`.
- [ ] T028 [US0] Implementér `backend/src/routes/auth.js` og montér den i `backend/src/app.js`:
  - `POST /auth/login` er offentlig. Den sætter `req.session = { userId, username }` og svarer 204.
  - `POST /auth/logout` (`requireSession`) sætter `req.session = null` og svarer 204. Kommentar: `// Simplification: cookie sessions cannot be revoked server-side; logout clears the cookie`.
  - `GET /auth/me` (`requireSession`) svarer `{ username }`.
- [ ] T029 [US0] Skriv `backend/test/api.test.js`:
  - Kald `setupTestDb()` og derefter `const { default: app } = await import('../src/app.js')` (dynamisk import, så poolen peger på testdatabasen). Assert, at poolens database er `kongarthur_test` (`SELECT DATABASE()`), før første test. Start appen med `app.listen(0)`.
  - Cookies sammensættes med `res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')`.
  - Hver test bruger egne data og datoer, så rækkefølgen er ligegyldig.
  - `FR-015`: `GET /api/auth/me` uden cookie giver 401 med `error.code === 'UNAUTHORIZED'`.
  - `FR-015`: Login med forkert kode giver 401.
  - `FR-015`: Login med ukendt bruger giver 401 med samme `message` som forkert kode.
  - `FR-015`: Login med korrekt kode giver 204, og `GET /api/auth/me` med cookien giver 200.
  - `FR-015`: Efter `POST /api/auth/logout` giver `GET /api/auth/me` med cookien fra logout-svaret 401.
- [ ] T030 [P] [US0] Implementér `frontend/src/pages/Login.jsx` efter `docs/design/skaerme.md` § Log ind (uden SSO og "glemt kode"):
  - Én kolonne med formularen. Ingen produktvisning og ingen data før login.
  - Ukontrollerede inputs, der læses via `FormData`.
  - Fejl vises med `role="alert"` og teksten fra `error.message`.
  - Spinner og "Logger ind…" under kaldet.
  - Ved succes navigeres til `?fra` eller `/bookinger`.
- [ ] T031 [US0] Udvid `frontend/src/main.jsx` og `frontend/src/Shell.jsx`:
  - `/login` er en top-level route **uden for** layout-routen.
  - Layout-routen får loaderen `requireSession`: `await api('/auth/me')`. Ved 401 kastes `redirect('/login?fra=' + path)`.
  - Tilføj "Log ud" nederst i sidebaren i `Shell.jsx` (`api('/auth/logout', {method:'POST'})` og derefter `navigate('/login')`).

**Checkpoint**: Quickstart-scenarie 1–2 virker.

---

## Phase 4: User Story 1 - Se og søge i bookinger (Priority: P1) 🎯 MVP

**Goal**: Receptionisten kan finde bookinger via liste, søgning på navn og datofilter (FR-001, FR-002).

**Independent Test**: Med seed-data viser `/bookinger` "Viser 100 af N". Søgning på "jens" og filter på en dato giver de forventede rækker under fanen "Alle". Klik på en række åbner detaljen.

- [ ] T032 [P] [US1] Implementér i `backend/src/repositories/bookingRepository.js`:
  - `list({ q, checkInAfter, checkInOnOrBefore, checkOutAfter, checkOutOnOrBefore, limit, order })` → `{ total, totalPriceOre, rows }` og `count({ q, checkInAfter, checkInOnOrBefore, checkOutAfter, checkOutOnOrBefore })` → antal.
  - Repositoriet anvender kun parametrene. Hver grænse er valgfri og giver én betingelse (`check_in > ?`, `check_in <= ?`, `check_out > ?`, `check_out <= ?`). Der er ingen viden om visninger eller status i SQL'en.
  - `q`: `b.guest_name LIKE CONCAT('%', ?, '%')` (standard-collation er case-insensitive).
  - Join `countries`, `rooms` og `room_types`.
  - Sortering `check_in` med `order` (`'asc'`/`'desc'`, whitelistet).
  - `total` og `totalPriceOre` kommer fra `COUNT(*)` og `COALESCE(SUM(total_price), 0)` med samme WHERE og gælder alle matchende rækker, ikke kun `limit`.
  - `findById(id)` → række eller `null`.
  - Beløb returneres i øre via `toOre`, og `created_at` som `'YYYY-MM-DDTHH:mm:ss'`.
- [ ] T033 [US1] Implementér `backend/src/services/bookingService.js` (afhænger af T032):
  - Rene eksporter: `nights(checkIn, checkOut)`, `isInHouseOn(booking, d)` (`check_in <= d < check_out`, den eneste definition af "bor på hotellet"), `viewToDateBounds(view, today)` og `deriveStatus(booking, today)`:
    - Status: `upcoming` når `today < check_in`, `arriving` når `today = check_in`, `in_house` når `check_in < today < check_out`, `departed` når `today >= check_out`.
    - Visninger: `upcoming` → `checkInAfter: today`. `in_house` → `checkInOnOrBefore: today, checkOutAfter: today` (inkluderer `arriving`). `departed` → `checkOutOnOrBefore: today`. `all` → ingen grænser. Visningerne er disjunkte, og `upcoming + in_house + departed = all`.
  - `createBookingService({ bookingRepo, roomRepo, pricingRepo, referenceRepo, withTransaction, today })` med:
    - `listBookings({ q, date, view, limit })`: Er `q` eller `date` sat, bruges `all` i stedet for `view`. `date` oversættes til `{ checkInOnOrBefore: date, checkOutAfter: date }` (samme regel som `isInHouseOn`) og kombineres med visningens grænser ved at tage den strammeste grænse pr. parameter. Sortering `desc` for `departed`, ellers `asc`. Returnerer `{ total, totalPrice, counts: { upcoming, in_house, departed, all }, items }`, hvor `counts` gælder de aktuelle `q`/`date`-filtre.
    - `getBooking(id)`, der kaster `NOT_FOUND` "Bookingen findes ikke længere".
    - `toApi(row)`, der mapper `rows` → `items` efter `Booking`-skemaet (`guestName`, `country`, `roomType`, `room`, `checkIn`, `checkOut`, `nights`, `guestCount`, `totalPrice` i kroner via `toKr`, `source`, `status`, `createdAt`).
- [ ] T034 [P] [US1] Skriv `backend/test/bookingService.test.js` med tests af de rene funktioner og `listBookings` med falsk repository:
  - `FR-001`: Ankomstdag giver `arriving`, afrejsedag giver `departed`, dagen før ankomst giver `upcoming`, og en dag midt i opholdet giver `in_house`.
  - `FR-001`: 10.–12. mar. giver 2 nætter.
  - `FR-002`: `isInHouseOn` inkluderer ankomstdagen og udelukker afrejsedagen.
  - `FR-002`: Er `q` eller `date` sat, ignoreres `view` (repositoriet får ingen visningsgrænser), og `date` giver `checkInOnOrBefore`/`checkOutAfter` = `date`.
- [ ] T035 [US1] Implementér `GET /bookings` (query `q`, `date`, `view` = upcoming, `limit` = 100) og `GET /bookings/:id` (`Number(req.params.id)`) i `backend/src/routes/bookings.js`, begge med `requireSession`. Montér routeren i `backend/src/app.js`.
- [ ] T036 [US1] Implementér `frontend/src/pages/Bookings.jsx` efter `docs/design/skaerme.md` § Bookingliste og opskriften "Tabel" og "Søgning og filtre i URL'en" i `docs/design/komponenter.md`:
  - URL-parametrene `?q=`, `?dato=` og `?visning=` (kommende/i-huset/afrejst/alle) oversættes til API'ets `q`, `date` og `view`. Fanen "Alle" er aktiv, når der søges eller filtreres.
  - Faner med antal fra API'ets `counts`.
  - Kolonner: Periode, Gæst, Værelse, Gæster, Status, Pris.
  - `tfoot` med API'ets `totalPrice`.
  - Teksten "Viser N af total" med API'ets `total`.
  - `EmptyState` med "Ryd søgning".
  - Hele rækken er klikbar og fører til `/bookinger/:id`.
  - Frontend summerer og tæller ingenting.
- [ ] T037 [US1] Implementér skrivebeskyttet `frontend/src/pages/BookingDetail.jsx` efter `docs/design/skaerme.md` § Bookingdetalje:
  - Brødkrumme og header med `StatusBadge`.
  - Tile "Ophold" med `Field`-rækker.
  - Tile "Pris" med `Stat` (gemt total og `booking.nights`).
  - `EmptyState` ved 404.
  - Handlingerne tilføjes i US3/US4/US5.

**Checkpoint**: Quickstart-scenarie 3–5 virker. Det er MVP'en og kan demonstreres.

---

## Phase 5: User Story 2 - Oprette booking med validering og pris (Priority: P1)

**Goal**: Opret booking på værelsestype med tildeling af værelse, kapacitetstjek og sæsonpris vist før gem (FR-003, FR-006, FR-007, FR-008, FR-009, FR-016).

**Independent Test**: Opret en booking over et sæsonskifte. Prisen matcher manuel beregning, og toasten nævner værelset. Overskreden kapacitet afvises med en forståelig besked, og en udsolgt type er deaktiveret i formularen.

- [ ] T038 [US2] Implementér `listCountries()` (sorteret på `name`) og `countryExists(code)` i `backend/src/repositories/referenceRepository.js`.
- [ ] T039 [P] [US2] Implementér i `backend/src/repositories/roomRepository.js`:
  - `getRoomType(id)` → `{ id, name, capacity }` eller `null`.
  - `listRoomTypes({ checkIn, checkOut, excludeBookingId })` med `fromPrice` (`MIN(price_per_night)` i øre) og, hvis der er en periode, `availableRooms`. Det er antal værelser af typen uden overlappende booking.
  - Overlap-prædikatet er en parametriseret forespørgsel: `b.check_in < ? AND b.check_out > ? AND (? IS NULL OR b.id <> ?)`. `excludeBookingId` sendes to gange og er `null` ved oprettelse.
  - `lockRoomsOfType(conn, roomTypeId)` = `SELECT id, room_number FROM rooms WHERE room_type_id = ? ORDER BY room_number FOR UPDATE`.
  - `findOverlappingRoomIds(conn, roomIds, checkIn, checkOut, excludeBookingId)` med samme prædikat.
- [ ] T040 [P] [US2] Implementér `getPeriods(conn, fromDate, toDate)` (join `seasons` og returnér `{ seasonId, seasonName, startDate, endDate }`) og `getPrices(conn, roomTypeId)` (`Map` seasonId → øre) i `backend/src/repositories/pricingRepository.js`.
- [ ] T041 [US2] Implementér `insertBooking(conn, { guestName, countryCode, roomId, checkIn, checkOut, guestCount, totalPriceOre, source })` i `backend/src/repositories/bookingRepository.js` (afhænger af T032). Beløb skrives som DECIMAL-streng via `toKr`.
- [ ] T042 [US2] Implementér `quote(input)` og `createBooking(input, source)` i `createBookingService` i `backend/src/services/bookingService.js` (afhænger af T038–T041 og T013). Validering i rækkefølge, alle med dansk besked og `field`:
  1. `guestName` trimmes. Tomt navn → `VALIDATION_ERROR` field `guestName` "Gæstens navn skal udfyldes" (kun `createBooking`).
  2. `checkOut <= checkIn` → `VALIDATION_ERROR` (400) field `checkOut` "Afrejse skal være efter ankomst".
  3. Ukendt land → `VALIDATION_ERROR` field `countryCode` "Ukendt land" (kun `createBooking`).
  4. Ukendt type → `VALIDATION_ERROR` field `roomTypeId` "Ukendt værelsestype".
  5. `guestCount > capacity` → `CAPACITY_EXCEEDED` (422) field `guestCount` "Antal gæster overstiger værelsestypens kapacitet (N)" (FR-006).

  Derefter i `withTransaction`:
  1. `lockRoomsOfType` som første statement.
  2. `findOverlappingRoomIds` med `excludeBookingId = null`.
  3. Vælg det første ledige værelse (laveste nummer). Kommentar: `// Simplification: assigns the lowest free room number`.
  4. Er der intet ledigt → `ROOM_TYPE_FULLY_BOOKED` (409) "Ingen ledige værelser af typen <navn> i perioden" (FR-007).
  5. `calculateStayPrice` med `getPeriods`/`getPrices`.
  6. `insertBooking` med det trimmede navn, `total_price` og `source`.

  Returnér `getBooking`.

  `quote()` validerer datorækkefølge (400), at typen findes, kapacitet kun hvis `guestCount` er givet (422) og pris (`PRICE_NOT_CONFIGURED` 422). Den tjekker **ikke** land, låser ikke, indsætter ikke og returnerer **aldrig** 409. Den returnerer `Quote` med `nights`, sæsonlinjer, total og `availableRooms` (udsolgt giver `availableRooms: 0`).
- [ ] T043 [P] [US2] Udvid `backend/test/bookingService.test.js` med falske repositories (almindelige objekter), `withTransaction: (fn) => fn({})` og `today: () => '2026-03-01'`:
  - `FR-006`: 3 gæster på kapacitet 2 afvises med `CAPACITY_EXCEEDED`.
  - `FR-007`: Alle værelser optaget giver `ROOM_TYPE_FULLY_BOOKED`.
  - `FR-007`: Det laveste ledige værelsesnummer vælges (en antagelse i spec'ens Assumptions, ikke FR-016).
  - `FR-003`: Afrejse før ankomst giver `VALIDATION_ERROR`.
  - `FR-014`: Et navn med kun mellemrum giver `VALIDATION_ERROR` med `field === 'guestName'`.
  - `FR-007`: `quote()` på en udsolgt type giver `availableRooms: 0` og kaster ikke (aldrig 409).
- [ ] T044 [US2] Implementér ruterne:
  - `POST /bookings` (201) i `backend/src/routes/bookings.js` med `allowBookingSystemKey` (T027). Den sender `req.bookingSource` videre til `createBooking(input, source)`.
  - `GET /bookings/quote` (`requireSession`), registreret **før** `/bookings/:id`.
  - `backend/src/routes/referenceData.js` med `GET /room-types` og `GET /countries` (`requireSession`), monteret i `app.js`.
- [ ] T045 [US2] Udvid `backend/test/api.test.js`:
  - `FR-003`: Opret booking giver 201, `room.number` er sat, og `totalPrice === 1000` (2 nætter à 500).
  - `FR-007`: Afrejsedag = ankomstdag for en anden booking på samme værelse er tilladt.
  - `FR-007`: Oprettelse uden exclude ser en eksisterende overlap: når typens 2 værelser er optaget, giver næste oprettelse 409 med `error.code === 'ROOM_TYPE_FULLY_BOOKED'`.
  - `FR-007` samtidighed: Med ét ledigt værelse giver to parallelle `POST /api/bookings` (`Promise.all`) én 201 og én 409.
  - `FR-003`: Afrejse = ankomst giver 400 `VALIDATION_ERROR` med `field === 'checkOut'`.
  - `FR-006`: Body med `guestCount: 0` giver 400 `VALIDATION_ERROR` med `field === 'guestCount'`.
- [ ] T046 [US2] Implementér `frontend/src/BookingForm.jsx` (opret-tilstand) efter `docs/design/komponenter.md` § "Opret/rediger-formular i skuffe" og § "Inline-validering" samt `docs/design/skaerme.md` § Ny / rediger booking:
  - Native `<dialog>` som højre-skuffe.
  - Sektionerne Gæst (navn plus land-`<select>` fra `/api/countries`), Ophold (`<input type="date">` uden min-dato, da bookinger bagud i tid er tilladt, og antal gæster) og Værelsestype (radio-kort fra `/api/room-types?checkIn&checkOut`, hvor udsolgte er deaktiveret).
  - Prisboks fra `/api/bookings/quote`. Der vises "–", indtil der er en pris. Hjælpelinjen "N nætter" bruger `quote.nights`.
  - Fejl med `field` vises under feltet med `aria-invalid`. Andre fejl vises som banner. Teksten er altid `error.message`.
  - Ved succes: toast "Booking oprettet" med beskrivelse "<navn>, <periode> · værelse <nr>". Luk og genindlæs listen.
- [ ] T047 [US2] Tilføj primærknappen "Ny booking" med `<Kbd>N</Kbd>` i `PageHeader` på `frontend/src/pages/Bookings.jsx`. Tilføj genvejen `N` i `frontend/src/Shell.jsx`, ikke når fokus er i input/textarea/select. Den åbner `BookingForm` via en lille context (`useShell().newBooking`).

**Checkpoint**: Quickstart-scenarie 6–9 virker. `npm test` er grøn.

---

## Phase 6: User Story 3 - Redigere booking (Priority: P2)

**Goal**: Ændre datoer, antal gæster eller type. Prisen genberegnes, og værelset beholdes, hvis det er muligt (FR-004, FR-016).

**Independent Test**: Ændr afrejsedato. Prisen ændres, og værelset beholdes. Ændr til en periode, hvor værelset er optaget: der tildeles et andet. Er hele typen optaget, afvises ændringen, og den oprindelige booking er uændret.

- [ ] T048 [US3] Tilføj først `updateBooking(conn, id, { guestName, countryCode, roomId, checkIn, checkOut, guestCount, totalPriceOre })` i `backend/src/repositories/bookingRepository.js`. Implementér derefter `updateBooking(id, input)` i `createBookingService` i `backend/src/services/bookingService.js`:
  - Samme validering som `createBooking` (inkl. trim af `guestName`).
  - `NOT_FOUND` "Bookingen findes ikke længere", hvis bookingen ikke findes.
  - I transaktionen er `lockRoomsOfType` første statement, og bookingen selv ekskluderes (`excludeBookingId = id`). Er dens nuværende værelse ledigt og af samme type, beholdes det. Ellers bruges det første ledige.
  - Genberegn prisen, og gem navn, land, værelse, datoer og antal gæster på bookingen.
- [ ] T049 [P] [US3] Udvid `backend/test/bookingService.test.js`:
  - `FR-016`: Beholder værelset, når det er ledigt.
  - `FR-016`: Tildeler et andet værelse, når det nuværende er optaget.
  - `FR-004`: Overlap med sig selv afvises ikke (`findOverlappingRoomIds` får `excludeBookingId = id`).
  - `FR-007`: Hele typen optaget giver `ROOM_TYPE_FULLY_BOOKED`, og `updateBooking` i repositoriet kaldes ikke.
- [ ] T050 [US3] Implementér `PUT /bookings/:id` (200, `requireSession`, `Number(req.params.id)`) i `backend/src/routes/bookings.js`. Send `excludeBookingId` videre i `GET /bookings/quote` og `GET /room-types`.
- [ ] T051 [US3] Udvid `frontend/src/BookingForm.jsx` med rediger-tilstand:
  - Prop `booking` udfylder `defaultValue`.
  - Titlen bliver "Rediger booking" og knappen "Gem ændringer".
  - Der sendes `PUT /api/bookings/:id`, og `excludeBookingId` bruges i quote og room-types.
  - Ved succes vises toasten "Booking opdateret".
  - Ved 404 lukkes skuffen, toasten viser "Bookingen findes ikke længere" (`error.message`), og der navigeres til `/bookinger`.
  - Tilføj den sekundære knap "Rediger" i headeren på `frontend/src/pages/BookingDetail.jsx`.

**Checkpoint**: Quickstart-scenarie 10 virker.

---

## Phase 7: User Story 4 - Slette booking med bekræftelse (Priority: P2)

**Goal**: Sletning kræver eksplicit bekræftelse (FR-005).

**Independent Test**: Annullér i dialogen, og bookingen findes stadig. Bekræft, og bookingen er væk fra listen, og værelset er ledigt.

- [ ] T052 [US4] Tilføj først `deleteById(id)` (returnerer antal berørte rækker) i `backend/src/repositories/bookingRepository.js`. Implementér derefter `deleteBooking(id)` i `backend/src/services/bookingService.js`, der kaster `NOT_FOUND` "Bookingen findes ikke længere", hvis 0 rækker berøres. Implementér `DELETE /bookings/:id` (204, `requireSession`, `Number(req.params.id)`) i `backend/src/routes/bookings.js`.
- [ ] T053 [US4] Udvid `backend/test/api.test.js`:
  - `FR-005`: `DELETE /api/bookings/:id` giver 204, og bookingen er væk.
  - `FR-005`: `DELETE` og `PUT` på en booking, der allerede er slettet, giver 404 `NOT_FOUND` med `message === 'Bookingen findes ikke længere'`.
- [ ] T054 [US4] Tilføj `danger`-knappen "Slet booking" i headeren i `frontend/src/pages/BookingDetail.jsx`. Den åbner en native `<dialog>` efter `docs/design/komponenter.md` § "Bekræft sletning":
  - Titel "Slet booking?".
  - Teksten "<navn> · <type> · <periode>. Tilknyttede barsalg bevares."
  - "Annullér" har fokus som standard. `danger`-knappen hedder "Slet booking" og viser spinner under kaldet.
  - Ved succes navigeres til `/bookinger`, og toasten "Booking slettet" vises.
  - Ved 404 vises toasten "Bookingen findes ikke længere" (`error.message`), og der navigeres til `/bookinger`.

**Checkpoint**: Quickstart-scenarie 11 virker.

---

## Phase 8: User Story 5 - Registrere barsalg (Priority: P2)

**Goal**: Registrér drink og antal, eventuelt lagt på en gæst i huset. Prisen fastfryses (FR-009, FR-010, FR-010a, FR-011).

**Independent Test**: "2 × Espresso Martini" registreres med tidspunkt og pris. Antal 0 afvises. Et salg på en gæst, der ikke er i huset, afvises. Når bookingen slettes, bevares salget.

- [ ] T055 [US5] Implementér `listDrinks()` og `getDrink(id)` i `backend/src/repositories/referenceRepository.js` (samme fil som T038). De joiner `drink_categories`.
- [ ] T056 [P] [US5] Implementér i `backend/src/repositories/barRepository.js`:
  - `insertSale({ drinkId, quantity, unitPriceOre, bookingId })`. `sold_at` sættes af databasens `DEFAULT CURRENT_TIMESTAMP` (`TZ=Europe/Copenhagen`).
  - `listSales({ date, bookingId })`, der joiner drink, kategori og `rooms.room_number` via booking og returnerer `{ totalOre, rows }` sorteret nyeste først. `totalOre` er `COALESCE(SUM(quantity * unit_price), 0)`, og `sold_at` returneres som `'YYYY-MM-DDTHH:mm:ss'`.
- [ ] T057 [US5] Implementér `createBarService({ barRepo, referenceRepo, bookingRepo, today })` med `registerSale({ drinkId, quantity, bookingId })` og `listSales(query)` i `backend/src/services/barService.js` (afhænger af T032 `findById` og T033 `isInHouseOn`):
  - Ukendt drink giver `VALIDATION_ERROR` field `drinkId` "Ukendt drink".
  - `unitPrice` = drinkens nuværende pris (FR-010).
  - Med `bookingId` skal bookingen findes, og `isInHouseOn(booking, today())` skal være sand (importeret fra `bookingService.js`, én definition). Ellers `BOOKING_NOT_IN_HOUSE` field `bookingId` "Gæsten bor ikke på hotellet i dag" (FR-010a).
  - `amount` = `quantity × unitPrice` i øre.
  - `listSales` returnerer `{ total, items }` med `total` i kroner, og `rows` mappes til `items`.
- [ ] T058 [P] [US5] Skriv `backend/test/barService.test.js` med falske repositories og fast `today`:
  - `FR-010`: `unitPrice` er drinkens pris på salgstidspunktet.
  - `FR-010a`: Gæst på ankomstdagen accepteres, og gæst på afrejsedagen afvises.
  - `FR-010`: Ukendt drink afvises.
- [ ] T059 [US5] Implementér `backend/src/routes/barSales.js` (`GET /bar-sales`, `POST /bar-sales` 201, begge `requireSession`) og tilføj `GET /drinks` (`requireSession`) i `backend/src/routes/referenceData.js` (afhænger af T044). Montér dem i `app.js`.
- [ ] T060 [US5] Udvid `backend/test/api.test.js` (afhænger af T044 og T052):
  - `FR-010a`: Registrér et salg på en booking i huset i dag, og slet derefter bookingen. `GET /api/bar-sales` viser salget med `bookingId === null` (`ON DELETE SET NULL`).
  - `FR-010`: `GET /api/bar-sales?date=` for en dag uden salg giver `total: 0` og tom `items`.
- [ ] T061 [US5] Implementér `frontend/src/pages/BarSales.jsx` efter `docs/design/skaerme.md` § Barsalg:
  - Drink-radio-kort grupperet under Cocktails og Kaffe.
  - Antal (`min=1`).
  - Valgfri native `<select>` "Læg på værelse" over `GET /api/bookings?view=in_house&limit=500`.
  - Toasten "Salg registreret" viser beløbet fra API-svaret (`amount`). Der er ingen live-sum i formularen.
  - Dagens salg i `Tile flush`-tabel med `tfoot`-sum fra API'ets `total`.
- [ ] T062 [US5] Tilføj Tile "Barsalg på værelset" i `frontend/src/pages/BookingDetail.jsx` (afhænger af T037):
  - Tabel fra `GET /api/bar-sales?bookingId=` med API'ets `total`.
  - Knappen "Registrér salg" vises, når `status` er `arriving` eller `in_house`, og linker til `/barsalg?booking=<id>`. `BarSales.jsx` forudfylder fra den parameter.

**Checkpoint**: Quickstart-scenarie 12–13 virker.

---

## Phase 9: User Story 6 - Bookinger fra hotellets eget bookingsystem (Priority: P3)

**Goal**: Det eksterne bookingsystem opretter bookinger via API-nøgle med samme regler som manuelle bookinger. Kilden markeres (FR-013, KB-T10). `allowBookingSystemKey` (T027) og `POST /bookings` med `source` (T044) findes allerede.

**Independent Test**: `curl` med korrekt nøgle giver 201 og `source: booking_system`, og bookingen vises i listen med kilde-badge. Forkert nøgle giver 401. Udsolgt giver 409.

- [ ] T063 [US6] Udvid `backend/test/api.test.js`. Testen sætter `process.env.BOOKING_SYSTEM_API_KEY` til en kendt værdi på mindst 32 tegn:
  - `FR-013`: Med korrekt nøgle og uden cookie: 201 og `source === 'booking_system'`.
  - `FR-013`: Med forkert nøgle: 401.
  - `FR-013`: Med nøgle på `GET /api/bookings`: 401, fordi nøglen kun gælder `POST /bookings`.
  - `FR-013` (US6-2): Udsolgt type via API-nøgle giver 409 med `error.code === 'ROOM_TYPE_FULLY_BOOKED'`.
- [ ] T064 [P] [US6] Vis kilde-badgen "Bookingsystem" (`bg-sunken text-ink-2`, kun ved `source === 'booking_system'`) som kolonnen Kilde i listen i `frontend/src/pages/Bookings.jsx` og som `Field` "Kilde" i `frontend/src/pages/BookingDetail.jsx`.

**Checkpoint**: Quickstart-scenarie 14 virker.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Dokumentation, aflevering og samlet validering.

- [ ] T065 [P] Skriv `README.md` i roden (KB-D6):
  - Formål og stack.
  - Arkitekturdiagram som Mermaid: containere, backendens tre lag, Tableau og det eksterne system, svarende til FigJam-siden "Arkitektur".
  - Start (`cp .env.example .env && docker compose up --build`), URL'er (`http://localhost:5173`, Swagger UI på `http://localhost:5173/docs`, API på `http://localhost:3000/api`) og login (`SEED_USERNAME`/`SEED_PASSWORD` fra `.env`, oprettet af `ensureSeedUser()` ved første start).
  - Nulstilling (`docker compose down -v`), ændrede afhængigheder (`docker compose up --build -V`), tests (`docker compose exec backend npm test`) og genskab seed (`docker compose run --rm backend node scripts/generate-seed.js`).
  - HTTPS-note (research R7).
  - Links til `AGENTS.md`, `docs/` og `specs/`.
- [ ] T066 [P] Skriv `CONTRIBUTE.md` (KB-D6, KB-D10–KB-D12):
  - Spec Kit-flowet.
  - Commit til `main` ved hver større ændring.
  - Commit-besked med task- og krav-ID.
  - `Co-authored-by:` ved parprogrammering.
  - Alle skal have commits.
  - Definition of Done (link til `AGENTS.md`).
  - Gennemgå retningslinjerne før review.
- [ ] T067 [P] Fjern Sync Impact Report-kommentaren øverst i `.specify/memory/constitution.md`.
- [ ] T068 Kør `npx prettier@3 --write backend frontend` og `docker compose exec backend npm test`. Ret fejl, til alt er grønt.
- [ ] T069 Gennemgå alle 16 scenarier i `specs/001-backoffice-bookinger/quickstart.md` fra en tom maskine (`docker compose down -v && cp .env.example .env && docker compose up --build`). Notér afvigelser som nye tasks.
- [ ] T070 Kør `/speckit-converge` og gem resultatet (implementeret vs. mangler) i `specs/001-backoffice-bookinger/converge.md` (KB-D4).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Ingen afhængigheder. T001 kører før T002.
- **Foundational (Phase 2)**: Afhænger af Setup og blokerer alle user stories.
  - T013 (pricing) afhænger af T009.
  - T015 (seed) afhænger af T006, T008 og T013.
  - T017 (app) afhænger af T009 og T016.
  - T018 (testDb) afhænger af T006 og T011.
  - T023 (Shell) afhænger af T019–T022, og T024 (design-docs) af T019–T022.
- **US0 Login (Phase 3)**: Afhænger af Foundational. **Alle øvrige stories afhænger af US0**, fordi alle endpoints kræver session eller API-nøgle (FR-015).
- **US1 (Phase 4)**: Afhænger af US0. Det er MVP.
- **US2 (Phase 5)**: Afhænger af US0 og af T032/T033 (bookingRepository og bookingService fra US1). Den bruger listen fra US1 til at vise resultatet.
- **US3 (Phase 6)**: Afhænger af US2 (genbruger validering, tildeling, pris og `BookingForm`).
- **US4 (Phase 7)**: Afhænger af US1 (detaljesiden). T053 bruger oprettelse fra US2 (T044).
- **US5 (Phase 8)**: Afhænger af US0. Backend afhænger af T032 (`findById`), T033 (`isInHouseOn`) og T038 (`referenceRepository.js`). T059 → T044 (`referenceData.js`). T060 bruger oprettelse fra US2 (T044) og sletning fra US4 (T052). Detail-tilen (T062) afhænger af US1 (T037).
- **US6 (Phase 9)**: Afhænger af US2 (T044 `POST /bookings`) og US1 (T036/T037 til badgen).
- **Polish (Phase 10)**: Afhænger af de ønskede stories.

### User Story Dependencies

```text
Setup → Foundational → US0 ─┬─ US1 ─┬─ US4
                            │       ├─ US2 ─┬─ US3
                            │       │       └─ US6
                            │       └─ (T062 i US5)
                            └─ US5 (backend; T057 bruger T032/T033, T059 bruger T044)
```

### Within Each User Story

- Repositories → services (+ tests) → routes → frontend.
- Tests af en forretningsregel skrives sammen med reglen og ses fejle først. Testnavnet starter med krav-ID'et.
- Commit efter hver task eller logisk gruppe med task- og krav-ID.

### Parallel Opportunities

- Setup: T001 først, så T002. T003, T004 og T005 kan køre parallelt.
- Foundational: T007, T008, T009, T010, T011, T012, T014, T016 og T019–T022 parallelt. T013 venter på T009. T015 venter på T006, T008 og T013. T017 venter på T009 og T016. T018 venter på T006 og T011.
- Efter US0 kan tre personer arbejde samtidig: én på US1 (T032–T037), én på US2-backend (T038–T040 straks, T041–T045 efter T032/T033) og én på US5-backend (T055–T060).
  - T038 og T055 rører begge `referenceRepository.js`, og T041, T048 og T052 bygger videre på `bookingRepository.js` fra T032. De er derfor ikke `[P]` og koordineres.

---

## Parallel Example: User Story 2

```bash
# Repositories samtidig (forskellige filer):
Task: "T039 roomRepository (listRoomTypes, lockRoomsOfType, findOverlappingRoomIds)"
Task: "T040 pricingRepository (getPeriods, getPrices)"

# Service-test sideløbende med servicen:
Task: "T043 backend/test/bookingService.test.js"
```

## Parallel Example: User Story 5

```bash
Task: "T056 backend/src/repositories/barRepository.js"
Task: "T058 backend/test/barService.test.js"
```

---

## Implementation Strategy

### MVP First (US0 + US1)

1. Phase 1 Setup → Phase 2 Foundational. Tjek checkpointet: alle containere kører, og der er seed-data.
2. Phase 3 US0 Login.
3. Phase 4 US1 Liste og søg.
4. **STOP og valider** quickstart-scenarie 1–5. Det kan allerede vises.

### Incremental Delivery

1. MVP (US0 + US1).
2. US2 Opret (kerneværdien: regler og pris).
3. US3 Rediger og US4 Slet.
4. US5 Barsalg (datagrundlag for BI i feature 002).
5. US6 Eksternt bookingsystem.
6. Polish: README, CONTRIBUTE, quickstart og converge **før 2026-11-06**.

### Parallel Team Strategy

1. Hele gruppen laver Setup og Foundational sammen, gerne med parprogrammering og `Co-authored-by`.
2. Én laver US0. Derefter fordeles arbejdet:
   - Udvikler A: US1, derefter US4.
   - Udvikler B: US2, derefter US3 og US6.
   - Udvikler C: US5 (backend først, så frontend).
3. Alle har commits (KB-D5/KB-D10).

---

## Notes

- [P] = andre filer og ingen afhængighed af ufærdige tasks.
- Hver story kan valideres med sit quickstart-scenarie.
- Afvigelser fra plan eller retningslinjer skal begrundes i plan.md eller i en `Simplification:`-kommentar i koden.
- Undgå: logik i routes eller frontend, SQL uden for repositories, hardcodede priser, sæsoner og drinks, og nye afhængigheder uden begrundelse.
