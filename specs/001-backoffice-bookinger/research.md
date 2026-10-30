# Research: Back Office – bookinger og barsalg

**Feature**: `001-backoffice-bookinger` | **Dato**: 2026-10-27

Hver beslutning er truffet efter stigen i `docs/retningslinjer/kodekvalitet.md` §1: platform og
standardbibliotek før afhængigheder, og genbrug før nyt. Pakkeversioner er tjekket med
`npm view` den 2026-10-27.

## R1. Runtime og framework

- **Beslutning**: Node.js 24 LTS (`node:24-alpine`) og Express 5.3. JavaScript med ES modules.
- **Rationale**: Express 5 sender fejl fra `async` route-handlere videre til fejl-middleware
  af sig selv. Vi kan derfor have én fælles fejlhåndtering uden `try/catch` i hver route og
  uden `express-async-errors`. Node 24 har `node:test`, `fetch`, `crypto.scrypt` og
  `node --watch` indbygget.
- **Alternativer**: Express 4 kræver async-wrapper. Fastify/NestJS er mere at forklare, og
  ingen i gruppen har valgt dem.

## R2. Validering af requests: OpenAPI som single source of truth

- **Beslutning**: `express-openapi-validator` (5.6.x, peer `express: *`) validerer alle
  requests mod `backend/openapi.yaml`. Det dækker typer, påkrævede felter, datoformat og
  heltal ≥ 1. Forretningsregler (kapacitet, ledighed, pris, datorækkefølge) valideres i
  services.
- **Opsætning**: `OpenApiValidator.middleware({ apiSpec, validateRequests: true,
  validateResponses: false, validateSecurity: false, ajvFormats: { mode: 'full' } })`.
  `mode: 'full'` er nødvendig, ellers accepteres `2026-02-30` som dato.
- **Rationale**: Kontrakten bliver den eneste definition af API'et. Den dokumenterer (Swagger
  UI, KB-A3), og den håndhæver. Uden validatoren skulle samme regler skrives både i
  OpenAPI-filen og i JavaScript, og de to ville glide fra hinanden.
- **Fejlformat**: Den fælles fejl-middleware (`errors.js`) oversætter alle 4xx, der ikke er
  `AppError`, til `{ error: { code, field, message } }` med en dansk besked:
  - 404 → `NOT_FOUND` og 401 → `UNAUTHORIZED`.
  - Alle andre (400, 405, 413, 415, malformet JSON) → `VALIDATION_ERROR` med samme status.
  - `field` sættes kun, når fejlens `path` starter med `/body/`, `/query/` eller `/params/`.
    Beskeden er "Ugyldig værdi i feltet <label>" med et lille map fra API-felt til dansk
    label (fx `guestCount` → "Antal gæster").
  - Datorækkefølge giver altid 400 `VALIDATION_ERROR`.

  Ingen route ser rå validatorfejl. `guestName` har `pattern: '\S'` i kontrakten, og servicen
  trimmer og afviser tomt navn.
- **Alternativer**: zod eller håndskrevet validering ville duplikere kontrakten og bryde
  princip II (SSOT). express-validator har samme problem.

## R3. Database-adgang

- **Beslutning**: `mysql2/promise` med én fælles pool (`db.js`), rå parametriseret SQL i
  repositories og ingen ORM. Det blev besluttet i gruppen 2026-10-27.
- **Penge**: `DECIMAL(10,2)` i databasen. mysql2 returnerer DECIMAL som streng, og
  repositoriet omregner til **øre (heltal)**. Services regner i øre, og route-laget sender
  kroner som tal i JSON (`1800` eller `1800.5`).
- **Tekst og søgning**: Skemaet angiver ikke tegnsæt, så MySQL 8.4's standard
  `utf8mb4_0900_ai_ci` gælder. Danske tegn gemmes som UTF-8, og `LIKE` på gæstenavn skelner
  hverken mellem store og små bogstaver eller accenter (FR-002). Seed-filen starter med
  `SET NAMES utf8mb4`, fordi mysql-klienten i containeren ellers sender latin1.
- **Datoer**: `DATE` med poolens `dateStrings: true`, så datoer forbliver `'YYYY-MM-DD'`-strenge
  og aldrig bliver forskudt af tidszoner.
- **Tidspunkter**: `DATETIME` returneres som lokal tid `'YYYY-MM-DDTHH:mm:ss'` uden offset
  (`replace(' ', 'T')`). Kontrakten bruger `type: string` og ikke `format: date-time`.
  `db` og `backend` kører med `TZ=Europe/Copenhagen`.
- **I dag**: `backend/src/today.js` eksporterer
  `today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Copenhagen' }).format(new Date())`.
  Services får `today` injiceret. Frontend bruger kun sin egen dato til visning af relative
  datoer. Status kommer fra API'et.

## R4. Tildeling af værelse og samtidighed (FR-007, FR-016)

- **Beslutning**: Alt sker i én transaktion. `withTransaction` kører
  `SET TRANSACTION ISOLATION LEVEL READ COMMITTED` før `beginTransaction`:
  1. Første statement er `lockRoomsOfType`: `SELECT ... FROM rooms WHERE room_type_id = ?
     ORDER BY room_number FOR UPDATE`.
  2. Find det første værelse uden overlappende booking. To perioder overlapper, hvis
     `existing.check_in < :checkOut AND existing.check_out > :checkIn`. Udelukkelsen er
     valgfri: `AND (? IS NULL OR b.id <> ?)`, og værdien sendes to gange som `null` ved
     oprettelse.
  3. Indsæt bookingen og commit.
- Ved redigering ekskluderes bookingen selv. Er dens nuværende værelse stadig ledigt, beholder
  den det.
- Overlap-prædikatet er en parametriseret forespørgsel i repositoriet og ikke en
  forretningsregel (bevidst valg, se plan.md Complexity Tracking).
- **Rationale**: Låsen sikrer, at to receptionister ikke får samme sidste værelse (edge case i
  spec). Halvåbne intervaller betyder, at afrejsedag og ankomstdag må være den samme.
- **Hvorfor READ COMMITTED**: Under REPEATABLE READ tages snapshottet før låsen, så
  overlap-tjekket kan se forældede data. Med READ COMMITTED og låsen som første statement ser
  tjekket de bookinger, en samtidig transaktion har committet.
- **Alternativer**: Et unikt index kan ikke udtrykke datooverlap i MySQL. Optimistisk retry er
  mere kode.

## R5. Prisberegning (FR-008, FR-009)

- **Beslutning**: Sæsoner modelleres som `seasons` (navn) og `season_periods` (datointerval pr.
  år). Priser ligger i `room_prices` (værelsestype × sæson). Servicen gennemgår hver nat
  `d ∈ [check_in, check_out)`, slår sæsonen op og summerer i øre. Mangler der en periode eller
  pris, afvises bookingen med `PRICE_NOT_CONFIGURED`. Totalen gemmes på bookingen
  (`total_price`).
- **Rationale**: Én ren funktion (`calculateStayPrice({ checkIn, checkOut, periods, prices })`) uden I/O kan
  testes fuldt med `node:test`. Sæsonnavne gentages ikke pr. år (3NF), og BI (feature 002) kan
  gruppere på sæsonnavn på tværs af år.
- **Prisvisning før gem**: `GET /api/bookings/quote` kalder samme servicefunktion, så
  frontend aldrig regner selv (KB-A4).

## R6. Login og adgang (FR-015, FR-013)

- **Beslutning**:
  - Login med én fælles receptionistkonto i tabellen `users`.
  - Adgangskoden hashes med Node's indbyggede `crypto.scrypt` (salt + hash i én kolonne).
    `crypto.timingSafeEqual` bruges ved sammenligning.
  - Kontoen er ikke i seed. `server.js` kalder `ensureSeedUser()` ved start. Er `users` tom,
    indsættes `SEED_USERNAME` med `hashPassword(SEED_PASSWORD)` fra `.env`. `.env.example`
    har kun udviklings-placeholders, og `.env` er i `.gitignore`.
  - Sessionen gemmes i en signeret, httpOnly cookie via `cookie-session` (`sameSite: 'lax'`,
    `secure: process.env.NODE_ENV === 'production'` og `app.set('trust proxy', 1)`).
    Hemmeligheden ligger i `.env`.
  - Auth monteres pr. route og ikke som global `app.use`:
    - `POST /auth/login` er offentlig.
    - `POST /bookings` bruger `allowBookingSystemKey`. Er `X-API-Key` sat, tjekkes nøglen.
      Ellers kræves session.
    - Alt andet bruger `requireSession`.
  - Det eksterne bookingsystem (KB-T10) bruger headeren `X-API-Key`, som sammenlignes med
    `BOOKING_SYSTEM_API_KEY` i `.env` via `crypto.timingSafeEqual` efter længdetjek. Det
    fejler lukket: er nøglen ikke sat eller under 32 tegn, afvises alle nøgler med 401.
- **Rationale**: scrypt ligger i standardbiblioteket, så der er ingen bcrypt med native build.
  `cookie-session` er en lille pakke fra Express-projektet. Den kræver ingen session-store og
  overlever genstart af backend. Hjemmelavet cookie-signering ville være at genopfinde hjulet.
- **Alternativer**: `express-session` med MemoryStore mister sessioner ved genstart og advarer
  i produktion. JWT i localStorage er mere kode og har en dårligere sikkerhedsprofil.
- **Bevidst forenkling**: Ingen rate-limit på login og ingen brugeradministration (uden for
  scope). Cookie-sessioner kan ikke tilbagekaldes på serveren. Logout sletter cookien, og det
  står som kommentar ved `logout`.

## R7. HTTPS for det eksterne bookingsystem (KB-T10)

- **Beslutning**: Lokalt i Docker kører API'et over HTTP. I drift termineres HTTPS i en
  reverse proxy foran backend, så applikationen er den samme. Det beskrives i README og
  nævnes ved fremlæggelsen. Integrationen demonstreres med `curl` (se quickstart).
- **Rationale**: Selvsignerede certifikater lokalt giver en ekstra container og
  certifikatadvarsler. Det tilføjer ingen funktionalitet at forklare.
- **Åbent**: Kræver underviseren HTTPS demonstreret lokalt, kan en Caddy-container
  tilføjes senere uden kodeændringer.

## R8. Frontend og same-origin

- **Beslutning**: Frontend-containeren kører Vite's dev-server (`npx vite`, `host: true` i
  `vite.config.js`) med proxy
  `/api → http://backend:3000` og `/docs → http://swagger:8080`. Browseren ser derfor kun én
  origin (`localhost:5173`). Det betyder ingen CORS-opsætning og at cookies virker uden
  `sameSite: none`.
- **Rationale**: Det er mindst opsætning, giver hot reload under udvikling og kræver én
  Dockerfile. Tableau Desktop (002) kalder backend direkte på `localhost:3000`.
- **Alternativer**: Et nginx-build er mere "produktionsagtigt", men kræver et ekstra build-trin
  og en ekstra konfigurationsfil. Det tilføjer ingen funktionalitet til opgaven.

## R9. Swagger UI (KB-A3, KB-D7)

- **Beslutning**: Det officielle image `swaggerapi/swagger-ui` i egen container med
  `backend/openapi.yaml` mountet ind som `/spec/openapi.yaml` (`SWAGGER_JSON=/spec/openapi.yaml`)
  og `BASE_URL=/docs`. Filen skal ligge i en undermappe: i `/` leder imagets nginx efter
  `//openapi.yaml` og giver 404. Den åbnes via Vite-proxyen på `http://localhost:5173/docs`.
  Port 8080 eksponeres ikke.
- **Rationale**: Ingen kode, kun konfiguration. Samme fil, som validatoren bruger (SSOT).
  Kontraktens `servers: - url: /api` er relativ, så "Try it out" rammer `localhost:5173/api`
  på samme origin og sender session-cookien med.

## R10. Testdata ("gerne ret meget")

> **Erstattet af 004**: Indholdet (værelser, typer, sæsoner, priser, lande, bookinger og
> barsalg) følger nu opgavens datasæt. Se [004 research](../004-opgavedata/research.md)
> R4–R12. Generatoren er stadig deterministisk og skriver stadig `db/02_seed.sql`.

- **Beslutning**: Et deterministisk Node-script `backend/scripts/generate-seed.js` genererer
  `db/02_seed.sql`. Det er fuldt deterministisk: fast seed i en simpel PRNG og faste datoer
  `SEED_START = '2025-01-01'` og `SEED_END = '2027-02-28'`. Der er ingen `today` og intet
  tilfældigt salt. Priser beregnes med `calculateStayPrice` fra `pricing.js`, så der kun er én
  prisimplementering. Indhold:
  - 60 værelser fordelt på 4 typer.
  - Sæsonperioder for 2025–2027.
  - 40 lande med realistisk vægtning (DK, DE, SE, NO, GB, US …). Danske landenavne kommer
    fra `Intl.DisplayNames('da', { type: 'region' })`. Gæstenavne har danske bogstaver (fx
    Søren Jørgensen), så søgning med æ, ø og å bliver afprøvet.
  - Bookinger fra `SEED_START` til `SEED_END`. Belægningen varierer med sæsonen (ca. 62 % i
    lav-, 67 % i mellem- og 79 % i højsæson, ca. 68 % i alt), så belægning pr. sæson i BI giver
    mening. `created_at` er 14 dage før ankomst, men aldrig efter `SEED_SALES_END`, så ingen
    booking er oprettet i fremtiden.
  - Barsalg (cocktails og kaffe) dagligt fra `SEED_START` til `SEED_SALES_END = '2026-11-05'`
    (dagen før fremlæggelsen). Der er intet salg i fremtiden, så "årets salg" i BI er realistisk.
    Ca. en tredjedel er lagt på et værelse.
  - Ingen brugere. Receptionistkontoen oprettes ved start fra `.env` (R6).
- **Rationale**: Scriptet er sandheden, og SQL-filen er et genereret artefakt med headeren
  `-- GENERATED by backend/scripts/generate-seed.js – do not edit`. MySQL-containeren kan
  køre en `.sql`-fil direkte via `docker-entrypoint-initdb.d`, så Node ikke er nødvendig i
  DB-containeren. Scriptet køres med
  `docker compose run --rm backend node scripts/generate-seed.js` (`./db` er monteret) eller
  `node backend/scripts/generate-seed.js` på host.
- **Omfang**: Ca. 10.400 bookinger og ca. 20.000 barsalg, så sæson-, lande- og
  drinkfordelinger i BI giver mening.

## R11. Bookinglistens størrelse

- **Beslutning**: `GET /api/bookings` returnerer
  `{ total, totalPrice, counts: { upcoming, in_house, departed, all }, items }` med `limit`
  (standard 100, maks 500):
  - `total` og `totalPrice` (kr.) gælder alle matchende rækker, ikke kun `limit`.
  - `counts` gælder de aktuelle `q`/`date`-filtre på tværs af visninger.
  - Summer bruger `COALESCE(SUM(…), 0)`.

  Sortering er efter `check_in`. Standardvisningen er "kommende". UI'et viser
  "Viser 100 af 1.234 – søg eller filtrér for at indsnævre". Der er ingen paginering
  (designprincip 9). Søgning og datofilter er vejen til en bestemt booking (SC-002).
  Frontend summerer og tæller ikke selv.
- **Rationale**: 10.000 rækker i én tabel er langsomt og uoverskueligt. Paginering er mere UI
  end opgaven kræver.

## R12. Afledt opholdsstatus

- **Beslutning**: Én definition: gæsten bor på hotellet på dato d ⇔
  `check_in <= d < check_out` (`bookingService.isInHouseOn`).
  - Status (`bookingService.deriveStatus`): `upcoming` når `today < check_in`, `arriving` når
    `today = check_in`, `in_house` når `check_in < today < check_out` og `departed` når
    `today >= check_out`. Den gemmes ikke.
  - Visninger oversættes i servicen (`viewToDateBounds`) til neutrale datogrænser
    (`checkInAfter`, `checkInOnOrBefore`, `checkOutAfter`, `checkOutOnOrBefore`).
    Repositoriet anvender kun parametrene. `upcoming`: `check_in > today`. `in_house`:
    `check_in <= today AND check_out > today` (inkluderer `arriving`). `departed`:
    `check_out <= today`. `all`: ingen grænser. Visningerne er disjunkte.
  - Er `q` eller `date` sat, ignoreres `view`, og `all` bruges. Det står i kontrakten.
- **Rationale**: Gemt status ville være afledt data og ville blive forkert, så snart der går
  en dag (3NF, SSOT).

## R13. Tests

- **Beslutning**: `node --test` i `backend/`.
  - Unit-tests af `pricing.js` og services med falske repositories (almindelige objekter).
    Services får afhængigheder injiceret, fx `createBookingService({ bookingRepo, roomRepo,
    pricingRepo, referenceRepo, withTransaction, today })`. Tests giver
    `withTransaction: (fn) => fn({})`, så de ikke rammer databasen.
  - Få API-tests: login kræves, fejlformat, opret og afvis ved udsolgt. De kører mod
    databasen `kongarthur_test` i samme MySQL-container:
    - Init-scriptet `db/00_test-db.sh` opretter databasen og giver `MYSQL_USER` rettigheder
      til den.
    - `setupTestDb()` kører `DROP DATABASE IF EXISTS`, `CREATE`, skema og fixture ved hver
      kørsel.
    - `api.test.js` kalder `setupTestDb()` før `await import('../src/app.js')` (dynamisk
      import), så poolen peger på `kongarthur_test`. Testen asserter databasenavnet.
  - Testnavne starter med krav-ID, fx `'FR-007: …'`.
- **Rationale**: Det følger `docs/retningslinjer/tests.md`, og der er ingen
  testafhængigheder.

## Afhængigheder (begrundelse, jf. kodekvalitet.md §1)

| Pakke | Hvorfor den ikke kan undværes |
|---|---|
| `express` | Rammekrav (valgt stack) |
| `mysql2` | Driver til MySQL. Node har ingen indbygget |
| `express-openapi-validator` | Gør OpenAPI-filen til både dokumentation og validering (SSOT, R2) |
| `cookie-session` | Signeret session-cookie uden store. Alternativet er hjemmelavet krypto |
| `react`, `react-dom`, `react-router` | Rammekrav og routing med login-loader |
| `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite` | Rammekrav (React + Tailwind) |
| `@phosphor-icons/react`, `@fontsource-variable/instrument-sans` | Designsystemet i `docs/design/` |

Fravalgt: ORM, zod, bcrypt, express-session, CORS-pakke, dotenv (Compose sætter
miljøvariablerne fra `.env` via `env_file`),
nodemon (`node --watch`), Jest/supertest, clsx, dato- og formularbiblioteker og
`@base-ui/react` (native `<dialog>` og `<select>` er nok, og toast er en lille komponent).
