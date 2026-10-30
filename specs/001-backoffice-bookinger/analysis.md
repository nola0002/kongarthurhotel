# Analyse: 001-backoffice-bookinger

**Dato**: 2026-10-27 | **Kommando**: `/speckit-analyze` med tre review-agenter:

- A: dækning og konsistens
- B: constitution og retningslinjer
- C: teknisk korrekthed. Agent C verificerede mod express 5.3, express-openapi-validator 5.6.2,
  cookie-session 2.1.1 og MySQL 8.4's entrypoint.

Fundene er slået sammen, så overlap mellem agenterne kun står én gang. Afsnittet
**Beslutninger** nedenfor er den bindende rettelse. Agenter, der retter artefakterne, følger
det ordret.

## Status

| Alvor | Antal | Status |
|---|---|---|
| CRITICAL | 8 | ✅ Rettet 2026-10-27 |
| HIGH | 9 | ✅ Rettet 2026-10-27 |
| MEDIUM | 15 | ✅ Rettet 2026-10-27 |
| LOW | 1 samlet række (13 punkter) | ✅ Rettet 2026-10-27 |

Dækning før rettelser: 33 krav (17 FR, 7 SC, 9 edge cases) og 68 tasks. 97 % af kravene har
mindst én task, og 82 % er fuldt dækket.

### Verifikation efter rettelser

- Kontrakten indlæses af express-openapi-validator 5.6.2 med `ajvFormats: { mode: 'full' }`.
  Testkald:

  | Kald | Resultat |
  |---|---|
  | `GET /api/countries` | 200 |
  | Quote med `guestCount` | 200 |
  | Gyldig `POST /api/bookings` | 201 |
  | Navn med kun mellemrum | 400 |
  | Det gamle felt `guests` | 400 |
  | `2026-02-30` | 400 |

- `tasks.md`: 70 opgaver (T001–T070) i korrekt format. Ingen dubletter og i fortløbende
  rækkefølge.
- Opholdsstatus, visninger og statuskode for datorækkefølge er ens i `data-model.md`,
  `research.md`, `tasks.md` og kontrakten.
- Ingen forældede navne tilbage i `specs/`, `docs/` og `AGENTS.md`. Søgt efter:
  - `guests`-feltet, `guest_id`, `insertGuest`
  - `updated_at`, `is_active`
  - Base UI-komponenter, `MobileList`
  - Roster
- Ekstra rettelser ud over B1–B18:
  - Barsalg i seed stopper ved `SEED_SALES_END = '2026-11-05'`, så der ikke er salg i
    fremtiden.
  - Spec-entiteten "Gæst" beskriver nu gæsten som registreret pr. booking (B15).
  - `docs/retningslinjer/database.md` bruger de nye navne i sine eksempler.

## Fund

| ID | Kategori | Alvor | Sted | Fund | Beslutning |
|---|---|---|---|---|---|
| X1 | Teknisk | CRITICAL | openapi.yaml:332, 386, 427, 428 | Komma i fire flow-`description`s bliver læst som ekstra nøgler. Kontrakten er ugyldig, så alle `/api`-kald giver 500 | B1 |
| X2 | Constitution I/III | CRITICAL | tasks T027/T028/T053/T058; data-model:149 | Opholdsstatus er defineret fire steder, og de er uenige. Reglen ligger delvist i repository-SQL | B2 |
| X3 | Docker | CRITICAL | tasks T002/T003 | `npm ci` uden `COPY package*.json` og uden lockfile, så build fejler | B10 |
| X4 | Docker | CRITICAL | tasks T001 | `db` får ingen env, så MySQL stopper ved init | B10 |
| X5 | Docker | CRITICAL | tasks T001/T014; quickstart:92 | Backend kan ikke se `db/`, så test-DB-opsætningen og seed-scriptet virker ikke | B10 |
| X6 | Tests | CRITICAL | tasks T014 | `MYSQL_USER` kan ikke oprette `kongarthur_test`. Test-DB'en nulstilles ikke | B11 |
| X7 | Docker | CRITICAL | tasks T001 | Healthcheck via socket melder "klar", mens init kører, så backend får ECONNREFUSED (T4) | B10 |
| X8 | Tests | CRITICAL | tasks T014 | Statiske ESM-imports gør, at poolen peger på `kongarthur`, så tests skriver i udviklingsdata | B11 |
| X9 | Konsistens/sikkerhed | HIGH | tasks T022/T059 | Den globale `requireSession` afviser API-nøgle-kald, så US6 virker ikke | B7 |
| X10 | Teknisk | HIGH | tasks T034/T045 | `b.id <> NULL` ved oprettelse: intet overlap opdages, så dobbeltbooking er mulig | B12 |
| X11 | Teknisk | HIGH | research R4; T038/T045 | REPEATABLE READ-snapshot før `FOR UPDATE` er forældet, så samtidige skrivninger kan få samme værelse | B12 |
| X12 | Konsistens | HIGH | tasks T030/T031; quickstart sc. 5 | Datofilter og søgning kombineres med standardvisningen "kommende", så en dato i fortiden giver 0 resultater | B3 |
| X13 | Kontrakt | HIGH | tasks T038; openapi:124–145 | `quote()` er underspecificeret: land, kapacitet og 409 vs. `availableRooms` | B5 |
| X14 | SSOT | HIGH | tasks T009 | Seed-scriptet regner priser før `calculateStayPrice` findes, så der bliver to prisimplementeringer | B9 |
| X15 | Sikkerhed/SSOT | HIGH | tasks T001/T009; quickstart:28 | Login-hash ligger i den committede seed. `SEED_*` i `.env` har ingen effekt | B8 |
| X16 | Lag/SSOT | HIGH | tasks T031/T057; design | Frontend regner selv: sum over 100 rækker, antal pr. fane, barbeløb og nætter | B4 |
| X17 | Tests | HIGH | tasks T028/T038/T040 | Services importerer `withTransaction`, så "DB-frie" unit-tests rammer en rigtig DB | B11 |
| X18 | Krav | MEDIUM | design skaerme.md:41 | Login-siden viser et udsnit af bookinglisten, hvilket strider mod FR-015 og US0-1 | B14 |
| X19 | Kontrakt | MEDIUM | openapi:13; quickstart sc. 16 | Swagger "Try it out" rammer `:8080/api` og ikke backend | B10 |
| X20 | Kontrakt | MEDIUM | openapi:452 vs T012 | Datorækkefølge giver 422 i kontrakten, men 400 i `errors.js` | B5 |
| X21 | Teknisk | MEDIUM | T016/T028/T053 | "I dag" er udefineret i backend, frontend bruger UTC, og containerne kører UTC | B13 |
| X22 | Teknisk | MEDIUM | T012 | Malformet JSON, 405, 413 og 415 bliver til 500 | B6 |
| X23 | Teknisk | MEDIUM | T013 | Validatoren accepterer `2026-02-30` | B6 |
| X24 | Teknisk | MEDIUM | openapi:300 | Et gæstenavn med kun mellemrum passerer kontrakten og giver 500 fra DB-CHECK | B6 |
| X25 | Teknisk | MEDIUM | T052 | `SUM` er NULL på en dag uden salg, så siden crasher | B12 |
| X26 | Sikkerhed | MEDIUM | T059/T013 | Tom API-nøgle matcher tom header. Cookien mangler `secure`. Ingen note om manglende revocation | B7 |
| X27 | 3NF | MEDIUM | data-model:43 | `guests` er reelt 1:1 med booking. Sletning efterlader persondata | B15 |
| X28 | YAGNI | MEDIUM | design; T031 | Der bygges mobilvisning, selvom spec siger "uden for scope" | B14 |
| X29 | YAGNI | MEDIUM | design; T043/T050 | Base UI bruges, hvor native `<dialog>`/`<select>` er nok | B14 |
| X30 | SSOT | MEDIUM | design-docs | Status-tabellen findes to gange, Shell-klasserne er uenige, `.tsx`-navne, og docs-kode duplikeres efter implementering | B14 |
| X31 | Dækning | MEDIUM | spec edge cases; SC-006 | Ingen tests af samtidighed, slettet booking, manglende `room_prices`, logout, ukendt bruger eller US6-2. SC-006 har ingen mekanisme | B16 |
| X32 | Rækkefølge | MEDIUM | T033/T051, T038/T039, T014, T055 | Forkerte `[P]`-markeringer og afhængigheder | B17 |
| X33 | Diverse | LOW | se B18 | Diverse mindre fund, se B18 | B18 |

## Beslutninger (bindende for rettelserne)

### B1 Kontrakt-syntaks
Alle `description`-værdier med komma i flow-mappings sættes i anførselstegn. Kontrakten skal
kunne indlæses af `express-openapi-validator` uden fejl.

### B2 Én definition af ophold
- **"Gæsten bor på hotellet på dato d"** ⇔ `check_in <= d < check_out`. Det er den eneste
  definition. Den ligger i `bookingService` (`isInHouseOn(booking, d)` og `viewToDateBounds`).
- **Status** (afledt i `bookingService.deriveStatus`):
  - `upcoming` når `today < check_in`
  - `arriving` når `today = check_in`
  - `in_house` når `check_in < today < check_out`
  - `departed` når `today >= check_out`
- **Visninger** (`view`) oversættes i servicen til neutrale datogrænser. Repositoriet anvender
  kun parametre (`checkInAfter`, `checkInOnOrBefore`, `checkOutAfter`, `checkOutOnOrBefore`):
  - `upcoming`: `check_in > today`
  - `in_house`: `check_in <= today AND check_out > today` (inkluderer `arriving`)
  - `departed`: `check_out <= today`
  - `all`: ingen grænser
- Visningerne er disjunkte, og `upcoming + in_house + departed = all`.
- Barsalg på booking er tilladt, når `isInHouseOn(booking, salgsdato)`. Det inkluderer
  ankomstdagen og udelukker afrejsedagen.
- Knappen "Registrér salg" vises, når `status` ∈ {`arriving`, `in_house`}.
- Overlap-prædikatet (`existing.check_in < :checkOut AND existing.check_out > :checkIn`) er
  en parametriseret forespørgsel i repositoriet, ikke en forretningsregel. Det noteres i
  plan.md Complexity Tracking som bevidst valg (R4).

### B3 Søgning og filter
Hvis `q` eller `date` er sat, ignorerer servicen `view` og bruger `all`. Reglen står i
kontraktens beskrivelse af `view`. Frontend markerer fanen "Alle" som aktiv, når der søges
eller filtreres.

### B4 Frontend regner ikke
- `GET /bookings` returnerer `{ total, totalPrice, counts: { upcoming, in_house, departed, all }, items }`:
  - `total` og `totalPrice` (kr.) gælder **alle** matchende rækker, ikke kun `limit`.
  - `counts` gælder de aktuelle `q`/`date`-filtre på tværs af visninger.
- Booking-objektet har `nights`. Hjælpelinjen "3 nætter" i formularen bruger `quote.nights`.
- Live-summen på barsalg ("2 × 95 kr. = 190 kr.") fjernes (YAGNI). Efter registrering viser
  toasten beløbet fra API-svaret (`amount`).
- `GET /bar-sales` returnerer `{ total, items }` med `total` beregnet i backend.
- Frontend summerer, tæller og beregner ingenting. Den viser, hvad API'et returnerer.

### B5 Quote og fejlkoder
- `GET /bookings/quote` validerer:
  - Datorækkefølge: `VALIDATION_ERROR` 400.
  - Værelsestype findes.
  - Kapacitet, kun hvis `guestCount` er givet: `CAPACITY_EXCEEDED` 422.
  - Pris: `PRICE_NOT_CONFIGURED` 422.
- Quote tjekker **ikke** land og returnerer **aldrig** 409. Udsolgt giver `availableRooms: 0`.
- Datorækkefølge er **400** `VALIDATION_ERROR` overalt. Kontraktens `BusinessRule` (422)
  nævner kun `CAPACITY_EXCEEDED`, `PRICE_NOT_CONFIGURED` og `BOOKING_NOT_IN_HOUSE`.

### B6 Validering og fejlhåndtering
- `OpenApiValidator.middleware({ apiSpec, validateRequests: true, validateResponses: false,
  validateSecurity: false, ajvFormats: { mode: 'full' } })`.
- `guestName` får `pattern: '\S'` i kontrakten. Servicen trimmer og afviser tomt navn
  (`VALIDATION_ERROR`, field `guestName`, "Gæstens navn skal udfyldes").
- `errors.js` mapper alle 4xx, der ikke er `AppError`:
  - 404 → `NOT_FOUND`
  - 401 → `UNAUTHORIZED`
  - Alle andre (400, 405, 413, 415, malformet JSON) → `VALIDATION_ERROR` med samme status.

  `field` sættes kun, når `err.errors?.[0]?.path` starter med `/body/`, `/query/` eller
  `/params/`. Beskeden bruger et lille map fra API-feltnavn til dansk label (fx `guestCount`
  → "Antal gæster"): "Ugyldig værdi i feltet <label>".
- Path-params læses som `Number(req.params.id)`.

### B7 Adgang
- Auth monteres pr. route, ikke som global `app.use`:
  - `POST /auth/login` er offentlig.
  - `POST /bookings` bruger `allowBookingSystemKey`. Er `X-API-Key` sat, tjekkes nøglen.
    Ellers kræves session.
  - Alt andet bruger `requireSession`.
- `allowBookingSystemKey` fejler lukket. Er `BOOKING_SYSTEM_API_KEY` ikke sat eller under 32
  tegn, afvises alle nøgler med 401. Sammenligning med `crypto.timingSafeEqual` efter
  længdetjek.
- Cookie: `secure: process.env.NODE_ENV === 'production'` og `app.set('trust proxy', 1)`.
- Kommentar ved `logout`:
  `// Simplification: cookie sessions cannot be revoked server-side; logout clears the cookie`.

### B8 Receptionistkonto
`users` er **ikke** i seed. `backend/src/server.js` kalder `ensureSeedUser()` ved start. Er
`users` tom, indsættes `SEED_USERNAME` med `hashPassword(SEED_PASSWORD)` fra `.env`.
`.env.example` indeholder kun udviklings-placeholders (`SEED_PASSWORD=skift-mig`) og en
kommentar om at ændre dem. `.env` er i `.gitignore`.

### B9 Seed
- `pricing.js` (`calculateStayPrice`) og dens test flyttes til Foundational før seed-scriptet.
- Seed-scriptet importerer `calculateStayPrice` (én prisimplementering).
- Seed er fuldt deterministisk: fast PRNG-seed og faste datoer `SEED_START = '2025-01-01'` og
  `SEED_END = '2027-02-28'` for bookinger og `SEED_SALES_END = '2026-11-05'` for barsalg, så der
  ikke er salg i fremtiden. Der er ingen `today` og ingen tilfældigt salt, fordi brugere ikke
  er i seed (B8).
- Køres med `docker compose run --rm backend node scripts/generate-seed.js` (med `./db`
  monteret, B10) eller med `node backend/scripts/generate-seed.js` på host.

### B10 Docker
- Dockerfiles: `FROM node:24-alpine`, `WORKDIR /app`, `COPY package*.json ./`, `RUN npm ci`,
  `COPY . .`.
- Lockfiles genereres én gang med
  `docker run --rm -v "$PWD/backend:/app" -w /app node:24-alpine npm install` (og tilsvarende
  for frontend) og committes.
- Efter ændrede afhængigheder: `docker compose up --build -V`.
- `db` får `env_file: .env`. Healthcheck:
  `mysqladmin ping -h 127.0.0.1 --protocol=TCP -u$$MYSQL_USER -p$$MYSQL_PASSWORD` med
  `interval: 3s`, `retries: 40`, `start_period: 60s`.
- `TZ=Europe/Copenhagen` sættes på `db` og `backend`.
- `backend` monterer `./backend:/app`, anonymt `/app/node_modules` og `./db:/db`. Stier
  resolves med `new URL('../../db/…', import.meta.url)`, så de virker både i container og på
  host.
- Swagger UI: env `BASE_URL=/docs`, og Vite-proxy `'/docs': 'http://swagger:8080'`. Åbnes på
  `http://localhost:5173/docs`, så samme origin giver relativ `/api` med cookie. Port 8080
  eksponeres ikke.
- Opstart dokumenteres overalt som `cp .env.example .env && docker compose up --build`.
- T004 (flyt `openapi.yaml`) kører før T001, så bind-mountet ikke opretter en mappe.

### B11 Tests
- `db/00_test-db.sh` (init-script):
  `docker_process_sql --database=mysql <<<"CREATE DATABASE IF NOT EXISTS kongarthur_test; GRANT ALL ON kongarthur_test.* TO '$MYSQL_USER'@'%';"`
  Implementeret som et direkte `mysql`-kald som root i stedet (se tasks.md T007, Afvigelse).
- `setupTestDb()` kører `DROP DATABASE IF EXISTS` + `CREATE` + skema + fixture **hver**
  kørsel.
- `api.test.js` kalder `setupTestDb()` og derefter `const { default: app } = await import('../src/app.js')`,
  og asserter at poolens database er `kongarthur_test`.
- Services får afhængigheder injiceret: `createBookingService({ bookingRepo, roomRepo, pricingRepo, referenceRepo, withTransaction, today })`.
  Unit-tests giver falske repos og `withTransaction: (fn) => fn({})`.
- Testnavne starter **altid** med krav-ID: `'FR-007: …'`.
- Testcookies sammensættes med `res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')`.

### B12 SQL
- Overlap med valgfri udelukkelse: `AND (? IS NULL OR b.id <> ?)`. Værdien sendes to gange som
  `null` ved oprettelse.
- `withTransaction` kører `SET TRANSACTION ISOLATION LEVEL READ COMMITTED` før
  `beginTransaction`. `lockRoomsOfType` er første statement i transaktionen.
- Alle summer bruger `COALESCE(SUM(…), 0)`.

### B13 Tid
- `backend/src/today.js`:
  `export const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Copenhagen' }).format(new Date())`.
- Services får `today` injiceret.
- DATETIME returneres som `'YYYY-MM-DDTHH:mm:ss'` (lokal tid, `replace(' ', 'T')`).
  Kontrakten bruger `type: string` med beskrivelsen "Lokal tid (Europe/Copenhagen), ISO uden
  offset" i stedet for `format: date-time`.
- Frontend: `today()` (tidligere konstanten `TODAY`, nu en funktion, så datoen skifter ved midnat) `= new Date().toLocaleDateString('sv-SE')` bruges kun til visning (relative
  datoer). Status kommer fra API'et.

### B14 Frontend og design
- **Ingen Base UI.** Native elementer bruges i stedet:
  - `<dialog>` som højre-skuffe (opret/rediger) og som bekræftelsesdialog.
  - `<select>` til land.
  - Handlingerne på detaljesiden er almindelige knapper: "Rediger" (sekundær) og
    "Slet booking" (`danger`). Ingen kebab-menu.
  - Toast er en lille komponent i `Shell.jsx` med `role="status" aria-live="polite"` og én
    toast ad gangen.
  - `@base-ui/react` fjernes fra afhængighederne.
- **Kun desktop** (spec: mobil er uden for scope). Ingen `MobileList`, ingen mobil-topbar og
  ingen mobil-navigation.
- **Login-siden** har én kolonne med formularen. Ingen produktvisning og ingen data før login.
- `/login` er en top-level route **uden for** layout-routen med login-loaderen.
- Status-tabellen og Shell-klasserne findes kun i `komponenter.md`. `skaerme.md` linker
  derhen. `.tsx` rettes til `.jsx`.
- Tokens: `--color-signal-hover: oklch(0.47 0.19 264)` og
  `--color-signal-active: oklch(0.43 0.18 264)`. `buttonClass` bruger
  `hover:bg-signal-hover active:bg-signal-active`.
- Efter T015/T018 erstatter en task kodeblokkene i `tokens.md` og `komponenter.md` med
  henvisninger til `frontend/src/index.css` og `frontend/src/api.js` (SSOT efter
  implementering).
- Fejltekster i frontend kommer fra `error.message` fra API'et. Frontend har kun egne tekster
  til tomme tilstande og knapper.

### B15 Datamodel: gæst på booking
- Tabellen `guests` fjernes. `bookings` får:
  - `guest_name VARCHAR(150) NOT NULL` med `CHECK (CHAR_LENGTH(TRIM(guest_name)) > 0)`
  - `country_code CHAR(2) NOT NULL` FK → `countries.code`
  - index på `guest_name`
- Det er stadig 3NF, fordi der ikke er nogen gæsteidentitet i scope. Sletning fjerner
  persondata.
- `bookings.guests` omdøbes til `guest_count` (`TINYINT UNSIGNED NOT NULL`,
  `CHECK (guest_count > 0)`).
- `updated_at` og `drinks.is_active` fjernes (YAGNI, ingen admin-UI).
- `room_prices` beholder den sammensatte PK. `docs/retningslinjer/database.md` får
  undtagelsen: "Rene relationstabeller (fx `room_prices`) har sammensat primærnøgle".
- **API-navne**:
  - `BookingInput { guestName, countryCode, roomTypeId, checkIn, checkOut, guestCount }`
  - `Booking { id, guestName, country { code, name }, roomType { id, name }, room { id, number }, checkIn, checkOut, nights, guestCount, totalPrice, source, status, createdAt }`
  - Quote-parameteren hedder `guestCount`.

### B16 Dækning
- SC-006 omformuleres til: "En booking sendt fra det eksterne bookingsystem er synlig i
  bookinglisten, næste gang listen indlæses (ingen manuel indtastning)."
- Nye testassertions:
  - FR-007 samtidighed: to parallelle `POST /bookings` på det sidste værelse giver én 201 og
    én 409.
  - Redigering og sletning af en booking, der allerede er slettet, giver 404 med "Bookingen
    findes ikke længere".
  - Manglende `room_prices`-række giver `PRICE_NOT_CONFIGURED`.
  - Logout, hvorefter `/auth/me` giver 401.
  - Ukendt bruger giver samme besked som forkert kode.
  - US6-2: udsolgt via API-nøgle giver 409.
  - Tom dag på `/bar-sales` giver `total: 0`.
  - Oprettelse uden exclude ser en eksisterende overlap.
  - Afrejse = ankomst giver 400.
- Frontend håndterer 404 i rediger-skuffen og slet-dialogen: toast "Bookingen findes ikke
  længere" og navigation til `/bookinger`.
- Bookinger bagud i tid er tilladt. Det står eksplicit i T043 ("ingen min-dato").

### B17 Rækkefølge og afhængigheder
- Repository-tasks står før de service-tasks, der kalder dem (T039 før T038).
- `[P]` fjernes fra tasks, der rører samme fil som en anden `[P]`-task i samme fase, eller som
  afhænger af en ufærdig task:
  - T033 og T051 rører begge `referenceRepository.js`.
  - T014 afhænger af T006.
- Afhængigheder noteres: T055 → T041 (`referenceData.js`), T053 → T027
  (`bookingRepository.findById`).
- `rows` → `items` mappes i servicens `toApi`.
- Den eksterne kilde-badge implementeres kun i T062. T031 og T032 nævner den ikke.

### B18 Diverse (LOW)
- Kravboard-ID'er i feature-dokumenterne får præfikset `KB-` (fx `KB-T10`, `KB-A4`,
  `KB-D6`), så de ikke forveksles med task-ID'er (`T010`).
- plan.md opdateres:
  - Fjern "tasks.md ikke lavet endnu".
  - Tilføj filerne `backend/test/{authService,money,barService}.test.js`, `testDb.js`,
    `src/today.js`, `db/00_test-db.sh`, `.prettierrc.json`, `.gitignore` og `converge.md` i
    strukturen.
- T040 kalder "laveste værelsesnummer" en antagelse fra spec, ikke FR-016.
- Quickstart scenarie 9: udsolgte typer er deaktiveret i UI'et (verificér det). Afvisningen
  verificeres via scenarie 14/`curl` eller samtidighedstesten.
