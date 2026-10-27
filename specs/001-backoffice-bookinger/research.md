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
  `--env-file` indbygget.
- **Alternativer**: Express 4 kræver async-wrapper. Fastify/NestJS er mere at forklare, og
  ingen i gruppen har valgt dem.

## R2. Validering af requests: OpenAPI som single source of truth

- **Beslutning**: `express-openapi-validator` (5.6.x, peer `express: *`) validerer alle
  requests mod `backend/openapi.yaml`. Det dækker typer, påkrævede felter, datoformat og
  heltal ≥ 1. Forretningsregler (kapacitet, ledighed, pris, datorækkefølge) valideres i
  services.
- **Rationale**: Kontrakten bliver den eneste definition af API'et. Den dokumenterer (Swagger
  UI, A3), og den håndhæver. Uden validatoren skulle samme regler skrives både i
  OpenAPI-filen og i JavaScript, og de to ville glide fra hinanden.
- **Fejlformat**: Den fælles fejl-middleware oversætter validatorens fejl til
  `{ error: { code: 'VALIDATION_ERROR', field, message } }` med en dansk besked. Ingen route
  ser rå validatorfejl.
- **Alternativer**: zod eller håndskrevet validering ville duplikere kontrakten og bryde
  princip II (SSOT). express-validator har samme problem.

## R3. Database-adgang

- **Beslutning**: `mysql2/promise` med én fælles pool (`db.js`), rå parametriseret SQL i
  repositories og ingen ORM. Det blev besluttet i gruppen 2026-10-27.
- **Penge**: `DECIMAL(10,2)` i databasen. mysql2 returnerer DECIMAL som streng, og
  repositoriet omregner til **øre (heltal)**. Services regner i øre, og route-laget sender
  kroner som tal i JSON (`1800` eller `1800.5`).
- **Datoer**: `DATE` med poolens `dateStrings: true`, så datoer forbliver `'YYYY-MM-DD'`-strenge
  og aldrig bliver forskudt af tidszoner.

## R4. Tildeling af værelse og samtidighed (FR-007, FR-016)

- **Beslutning**: Alt sker i én transaktion:
  1. Lås alle værelser af typen med `SELECT ... FROM rooms WHERE room_type_id = ? ORDER BY
     room_number FOR UPDATE`.
  2. Find det første værelse uden overlappende booking. To perioder overlapper, hvis
     `existing.check_in < :check_out AND existing.check_out > :check_in`.
  3. Indsæt bookingen og commit.
- Ved redigering ekskluderes bookingen selv. Er dens nuværende værelse stadig ledigt, beholder
  den det.
- **Rationale**: Låsen sikrer, at to receptionister ikke får samme sidste værelse (edge case i
  spec). Halvåbne intervaller betyder, at afrejsedag og ankomstdag må være den samme.
- **Alternativer**: Et unikt index kan ikke udtrykke datooverlap i MySQL. Optimistisk retry er
  mere kode.

## R5. Prisberegning (FR-008, FR-009)

- **Beslutning**: Sæsoner modelleres som `seasons` (navn) og `season_periods` (datointerval pr.
  år). Priser ligger i `room_prices` (værelsestype × sæson). Servicen gennemgår hver nat
  `d ∈ [check_in, check_out)`, slår sæsonen op og summerer i øre. Mangler der en periode eller
  pris, afvises bookingen med `PRICE_NOT_CONFIGURED`. Totalen gemmes på bookingen
  (`total_price`).
- **Rationale**: Én ren funktion (`calculateStayPrice(nights, periods, prices)`) uden I/O kan
  testes fuldt med `node:test`. Sæsonnavne gentages ikke pr. år (3NF), og BI (feature 002) kan
  gruppere på sæsonnavn på tværs af år.
- **Prisvisning før gem**: `GET /api/bookings/quote` kalder samme servicefunktion, så
  frontend aldrig regner selv (A4).

## R6. Login og adgang (FR-015, FR-013)

- **Beslutning**:
  - Login med én fælles receptionistkonto i tabellen `users`.
  - Adgangskoden hashes med Node's indbyggede `crypto.scrypt` (salt + hash i én kolonne).
    `crypto.timingSafeEqual` bruges ved sammenligning.
  - Sessionen gemmes i en signeret, httpOnly cookie via `cookie-session` (`sameSite: 'lax'`).
    Hemmeligheden ligger i `.env`.
  - Det eksterne bookingsystem (T10) bruger headeren `X-API-Key` og sammenlignes med
    `BOOKING_SYSTEM_API_KEY` i `.env`. Det giver kun adgang til `POST /api/bookings`.
- **Rationale**: scrypt ligger i standardbiblioteket, så der er ingen bcrypt med native build.
  `cookie-session` er en lille pakke fra Express-projektet. Den kræver ingen session-store og
  overlever genstart af backend. Hjemmelavet cookie-signering ville være at genopfinde hjulet.
- **Alternativer**: `express-session` med MemoryStore mister sessioner ved genstart og advarer
  i produktion. JWT i localStorage er mere kode og har en dårligere sikkerhedsprofil.
- **Bevidst forenkling**: Ingen rate-limit på login og ingen brugeradministration (uden for
  scope).

## R7. HTTPS for det eksterne bookingsystem (T10)

- **Beslutning**: Lokalt i Docker kører API'et over HTTP. I drift termineres HTTPS i en
  reverse proxy foran backend, så applikationen er den samme. Det beskrives i README og
  nævnes ved fremlæggelsen. Integrationen demonstreres med `curl` (se quickstart).
- **Rationale**: Selvsignerede certifikater lokalt giver en ekstra container og
  certifikatadvarsler. Det tilføjer ingen funktionalitet at forklare.
- **Åbent**: Kræver underviseren HTTPS demonstreret lokalt, kan en Caddy-container
  tilføjes senere uden kodeændringer.

## R8. Frontend og same-origin

- **Beslutning**: Frontend-containeren kører Vite's dev-server (`vite --host`) med proxy
  `/api → http://backend:3000`. Browseren ser derfor kun én origin (`localhost:5173`). Det
  betyder ingen CORS-opsætning og at cookies virker uden `sameSite: none`.
- **Rationale**: Det er mindst opsætning, giver hot reload under udvikling og kræver én
  Dockerfile. Tableau Desktop (002) kalder backend direkte på `localhost:3000`.
- **Alternativer**: Et nginx-build er mere "produktionsagtigt", men kræver et ekstra build-trin
  og en ekstra konfigurationsfil. Det tilføjer ingen funktionalitet til opgaven.

## R9. Swagger UI (A3, D7)

- **Beslutning**: Det officielle image `swaggerapi/swagger-ui` i egen container med
  `backend/openapi.yaml` mountet ind (`SWAGGER_JSON=/openapi.yaml`). Port 8080.
- **Rationale**: Ingen kode, kun konfiguration. Samme fil, som validatoren bruger (SSOT).

## R10. Testdata ("gerne ret meget")

- **Beslutning**: Et deterministisk Node-script `backend/scripts/generate-seed.js` genererer
  `db/02_seed.sql`. Det bruger en fast seed i en simpel PRNG, så alle får samme data. Indhold:
  - 60 værelser fordelt på 4 typer.
  - Sæsonperioder for 2025–2027.
  - Ca. 40 lande med realistisk vægtning (DK, DE, SE, NO, UK, US …). Danske landenavne kommer
    fra `Intl.DisplayNames('da', { type: 'region' })`.
  - Bookinger med 60–80 % belægning fra 2025-01-01 til ca. 3 måneder frem.
  - Barsalg (cocktails og kaffe) dagligt i samme periode. Ca. en tredjedel er lagt på et
    værelse.
  - Receptionistkontoen med scrypt-hash af `SEED_PASSWORD`.
- **Rationale**: Scriptet er sandheden, og SQL-filen er et genereret artefakt med headeren
  `-- GENERATED by backend/scripts/generate-seed.js – do not edit`. MySQL-containeren kan
  køre en `.sql`-fil direkte via `docker-entrypoint-initdb.d`, så Node ikke er nødvendig i
  DB-containeren.
- **Omfang**: Ca. 12.000 bookinger og ca. 20.000 barsalg, så sæson-, lande- og
  drinkfordelinger i BI giver mening.

## R11. Bookinglistens størrelse

- **Beslutning**: `GET /api/bookings` returnerer `{ total, items }` med `limit` (standard 100,
  maks 500). Sortering er efter `check_in`. Standardvisningen er "kommende". UI'et viser
  "Viser 100 af 1.234 – søg eller filtrér for at indsnævre". Der er ingen paginering
  (designprincip 9). Søgning og datofilter er vejen til en bestemt booking (SC-002).
- **Rationale**: 12.000 rækker i én tabel er langsomt og uoverskueligt. Paginering er mere UI
  end opgaven kræver.

## R12. Afledt opholdsstatus

- **Beslutning**: Status (`upcoming`, `arriving`, `in_house`, `departed`) beregnes i
  bookingservicen ud fra datoerne og dags dato. Den gemmes ikke. Visnings-filtret oversættes
  til SQL-betingelser i repositoriet.
- **Rationale**: Gemt status ville være afledt data og ville blive forkert, så snart der går
  en dag (3NF, SSOT).

## R13. Tests

- **Beslutning**: `node --test` i `backend/`.
  - Unit-tests af `pricing.js` og bookingservicen med falske repositories (almindelige
    objekter).
  - Få API-tests: login kræves, fejlformat, opret og afvis ved udsolgt. De kører mod
    databasen `kongarthur_test` i samme MySQL-container. Testopsætningen opretter
    databasen og kører `db/01_schema.sql`.
- **Rationale**: Det følger `docs/retningslinjer/tests.md`, og der er ingen
  testafhængigheder.

## Afhængigheder (begrundelse, jf. kodekvalitet.md §1)

| Pakke | Hvorfor den ikke kan undværes |
|---|---|
| `express` | Rammekrav (valgt stack) |
| `mysql2` | Driver til MySQL. Node har ingen indbygget |
| `express-openapi-validator` | Gør OpenAPI-filen til både dokumentation og validering (SSOT, R2) |
| `cookie-session` | Signeret session-cookie uden store. Alternativet er hjemmelavet krypto |
| `react`, `react-dom`, `react-router` | Rammekrav og routing med login-loader (som i Roster) |
| `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite` | Rammekrav (React + Tailwind) |
| `@base-ui/react` | Tilgængelig Drawer, AlertDialog, Combobox og Toast (genbrug fra Roster, `docs/design/`) |
| `@phosphor-icons/react`, `@fontsource-variable/instrument-sans` | Designsystemet fra Roster |

Fravalgt: ORM, zod, bcrypt, express-session, CORS-pakke, dotenv (`node --env-file`),
nodemon (`node --watch`), Jest/supertest, clsx, dato- og formularbiblioteker.
