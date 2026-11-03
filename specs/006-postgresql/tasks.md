# Tasks: Kravændring – PostgreSQL i stedet for MySQL (006)

**Input**: `specs/006-postgresql/` (spec, plan)

**Tests**: Eksisterende tests skal være grønne uden nye forventede værdier (SC-002). Den nye
hjælper `stayCalendar` får én test.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Baseline: svar og svartider for 33 læse-endpoints gemt fra MySQL-versionen, før skiftet (plan § Verifikation)
- [X] T002 `mysql2` erstattet af `pg` i `backend/package.json` og `package-lock.json` (plan R1)
- [X] T003 `docker-compose.yml`: `postgres:18`, healthcheck med `pg_isready` over TCP, volume `pg-data` (T4, T5, R8)
- [X] T004 `.env.example`: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`. `MYSQL_ROOT_PASSWORD` fjernet

## Phase 2: Foundational

- [X] T005 `backend/src/db.js`: pool, `query()` der nummererer `?` til `$n`, `withTransaction()`, type-parsere for `DATE`, `TIMESTAMP` og `BIGINT` (R2, R3)
- [X] T006 `db/01_schema.sql` på PostgreSQL: identity-nøgler, `NUMERIC`, `TIMESTAMP(0)`, `CHECK` i stedet for `ENUM`, `unaccent` + `pg_trgm` og `search_key()` (R4–R7)
- [X] T007 `backend/scripts/generate-seed.js`: PostgreSQL-strenge, `setval` efter faste id'er, `ANALYZE` til sidst. `db/02_seed.sql` genereret, samme rækker som før (R6, R11)
- [X] T008 `db/00_test-db.sh` slettet. `backend/test/testDb.js` opretter `kongarthur_test` selv (R9)

## Phase 3: User Story 1–3 – Uændret back office, nøgletal og opstart (P1)

**Independent Test**: `docker compose down -v && docker compose up -d --build`, `npm test`, snapshot-sammenligning.

- [X] T009 [US1] Alle otte repositories i `backend/src/repositories/` oversat til PostgreSQL-SQL og `query()` (plan § SQL-oversættelsen)
- [X] T010 [US1] API-testene tjekker `current_database()`. Testen af `orderBy` forventer `ABS(b.check_in - ?::date)` (plan § Complexity Tracking)
- [X] T011 [US2] Snapshot efter skiftet: alle 33 svar er identiske med MySQL, bortset fra `generatedAt` og rækkefølgen af `stays` i belægningsplanen, som ikke er sorteret
- [X] T012 [US3] Opstart fra tomt volume: 13 s, inkl. indlæsning af seed. 162 af 162 tests grønne

## Phase 4: User Story 4 – Hurtigere søgning og lister (P2)

- [X] T013 [US4] Indekser på fremmednøgler i `bookings` og `bar_sales`, GIN-trigramindeks til navnesøgning (FR-010, R10)
- [X] T014 [US4] Cifersøgning med `=` i stedet for `IN` i `bookingRepository.js` (R13)
- [X] T015 [US4] `stayCalendar()` i `services/pricing.js`, brugt af `analyticsService.js` og `revenueService.js`. Test i `test/pricing.test.js` (R12)
- [X] T016 [US4] `kpis` grupperer pr. år én gang med `Map.groupBy`, og `occupancyRows` tæller i et indlejret `Map` i `analyticsService.js`

Svartider på startdatasættet (ms, MySQL → PostgreSQL, efter én opvarmning):

| Endpoint | Før | Efter |
|---|---|---|
| `/bookings?q=søren` | 169 | 10 |
| `/bookings?q=101` | 212 | 35 |
| `/bookings?q=an` (to bogstaver, trigramindeks kan ikke bruges) | 184 | 113 |
| `/bookings/quote` | 193 | 6 |
| `/revenue` 2025 pr. måned | 532 | 57 |
| `/revenue` 2020–2026 pr. år | 811 | 163 |
| `/analytics/kpis` | 4462 | 1189 |
| `/analytics/occupancy` | 2495 | 625 |
| `/analytics/room-nights` (138 MB JSON) | 3580 | 1560 |

## Phase 5: User Story 5 – Sporbarhed (P2)

- [X] T017 [US5] `docs/krav/technical.md` (T1, T4, T5), `docs/krav/README.md` (Kravændringer), `docs/krav/architecture.md` (A5)
- [X] T018 [US5] Constitution 2.0.0: princip IV og teknologiske rammer siger PostgreSQL
- [X] T019 [US5] `AGENTS.md`, `docs/retningslinjer/{database,kodekvalitet,tests}.md`, `README.md` (opstart for dem med gammel `.env` og MySQL-volume), `docs/README.md`

## Bevidst ikke lavet

- **To-bogstavssøgning** (113 ms, under SC-005's 200 ms): et trigramindeks kræver mindst tre
  tegn. En gemt søgekolonne ville bryde reglen om ingen afledte data (`database.md` §1).
- **`/analytics/calendar`** henter alle bookinger og barsalg for at finde første og sidste år.
  En `MIN/MAX`-forespørgsel ville give ca. 50 ms, men kræver en ny repository-funktion og
  ændringer i testenes falske repository. Laves, hvis kalenderen bliver et problem.
- **`/analytics/room-nights`**: resten af tiden er at bygge 138 MB JSON. Størrelsen er
  kontrakten med Tableau.
