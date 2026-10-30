---
description: "Tasks for 004-opgavedata"
---

# Tasks: Opgavedata – data og integration som i opgaven

**Input**: Design documents from `/specs/004-opgavedata/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R15), data-model.md, contracts/README.md
(kontrakten er `backend/openapi.yaml`), quickstart.md

**Tests**: Inkluderet. `docs/retningslinjer/tests.md` kræver en test for hver ny eller ændret
forretningsregel i samme commit: navnevalidering (FR-006), navnesøgning (FR-007) og
bookingsystemets nøgle på `PUT`/`DELETE` (FR-013). Seed-generatoren er et script og testes
med `node:assert`-selvtjek i scriptet (research R15) og optællingerne i quickstart.md.
**Testnavne starter med `004 FR-0xx:`**, fordi spec 004's FR-ID'er kolliderer med 001's.

**Bindende for alle tasks**: `AGENTS.md` og `docs/retningslinjer/{kodekvalitet,database,tests}.md`.
Commit-beskeder refererer task-ID og krav-ID (fx `T010 004 FR-007: …`).

**Status**: T001–T038 er implementeret 2026-10-30 (se converge.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Kan køres parallelt (andre filer, ingen afhængighed af ufærdige tasks).
- **[Story]**: US1–US5 svarer til User Story 1–5 i spec.md.

## Path Conventions

- Backend: `backend/src/`, `backend/test/`, `backend/scripts/`. Frontend: `frontend/src/`.
  Database: `db/`. Kildefiler: `db/source/`.
- Krav-ID'er: `FR-0xx` og `SC-0xx` er fra **spec 004**. Kravboardets `T`-, `A`- og `D`-ID'er
  skrives med præfikset `KB-` (fx `KB-T10`).
- Penge: Generatoren regner i øre med `toOre`/`toKr` (`backend/src/money.js`) og
  `calculateStayPrice` (`backend/src/services/pricing.js`) som i 001.
- Generatoren er deterministisk: fast PRNG-seed (`mulberry32(20261106)`), faste datoer
  (`SEED_START`, `SEED_END`, `SEED_SALES_END`) og ingen "today".
- Efter hver ændring af skema eller seed: `docker compose run --rm backend node
  scripts/generate-seed.js` og derefter `docker compose down -v && docker compose up --build`.

## Ejerskab af filer (004 vs. 003)

004 ejer disse filer, indtil 004 er færdig og committet. Feature 003 må først ændre dem
bagefter:

| Fil | 004 ændrer | 003 ændrer senere |
|---|---|---|
| `db/01_schema.sql` | `bookings.first_name`/`family_name` | `bookings.satisfaction_score` |
| `db/02_seed.sql`, `db/source/*`, `db/.gitattributes` | Alt (genereret/kopieret) | Genereres igen efter 003's generatorændring |
| `backend/scripts/generate-seed.js` | Alt indhold fra opgaven | Historiske tilfredshedsscorer |
| `backend/openapi.yaml` | Navnefelter, `security` på `PUT`/`DELETE` | `satisfactionScore`, `/reception/*`, `/bookings/{id}/satisfaction` |
| `backend/src/auth.js`, `backend/src/routes/bookings.js` | Nøglen på `PUT`/`DELETE` | Ny route for tilfredshed |
| `backend/src/repositories/bookingRepository.js`, `backend/src/services/bookingService.js`, `backend/src/errors.js` | Navnefelterne | Tilfredshed og overblik |
| `frontend/src/format.js`, `BookingForm.jsx`, `pages/Bookings.jsx`, `pages/BookingDetail.jsx`, `pages/BarSales.jsx` | Navnefelterne | Nye sider, Helene Christine på barsiden |
| `backend/test/api.test.js`, `backend/test/bookingService.test.js` | Navne og nøgle | Egne tests |
| `README.md`, `docs/design/skaerme.md`, `docs/krav/technical.md`, `specs/001-backoffice-bookinger/{spec,data-model,research}.md` | Noter om 004 | Egne noter |

004 rører **ikke**: receptionsendpoints, nye sider, navigation, `satisfaction_score` eller
`/analytics/*` (002).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Opgavens kildefiler i repoet.

- [X] T001 004 FR-014: Kopiér `international_names_with_rooms_1000.csv`, `international_names_with_rooms_1000.xlsx` og `drinks_menu_with_sales.xlsx` byte for byte fra https://github.com/ITAKEA/hoteldata (commit `e1f90f3`) til `db/source/` (research R1). Kontrollér med `shasum`, at filerne er identiske med kilden. Ret dem aldrig.
- [X] T002 [P] Tilføj `source/* -text` med en kommentar (kildefilerne skal forblive byte-identiske, og CSV-filen har CRLF) i `db/.gitattributes` (research R1).
- [X] T003 Eksportér `db/source/drinks_menu_with_sales.xlsx` én gang til `db/source/drinks_menu_with_sales.csv` (research R2):
  - UTF-8, komma-separeret, overskrifterne `Drink Name,Category,Price (DKK),Units Sold` og 30 rækker i xlsx-filens rækkefølge.
  - Priser med højst to decimaler, som regnearket viser dem (`91.4`, `69.1`), ikke rå float-værdier.
  - Komma som skilletegn og decimalpunktum, også hvis regnearket har danske regionale indstillinger (de giver `;` og `72,47`).
  - Kontrol: 20 `Cocktail`, 10 `Coffee`, `Units Sold` i alt 179958.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Skemaændringen og generatorens læsning af kildefilerne, som alle stories bygger på.

**⚠️ CRITICAL**: Ingen user story kan startes, før denne fase er færdig.

- [X] T004 004 FR-006: Erstat `guest_name` med `first_name VARCHAR(75) NOT NULL` og `family_name VARCHAR(75) NOT NULL` i `bookings` i `db/01_schema.sql` (data-model.md § Skemaændring, research R9):
  - Hver kolonne får `CHECK (CHAR_LENGTH(TRIM(...)) > 0)`.
  - Fjern `INDEX (guest_name)` uden erstatning. Kommentér hvorfor (en `LIKE '%…%'` kan ikke bruge et B-tree-index).
  - Kommentar ved kolonnerne: fornavn og efternavn er to oplysninger (1NF), som i opgavens data.
- [X] T005 Tilføj én hjælper `readSourceCsv(fileName, columnCount)` i `backend/scripts/generate-seed.js`, der læser `db/source/<fileName>` med `readFileSync(new URL('../../db/source/…', import.meta.url), 'utf8')`, splitter på `/\r?\n/` og `,`, springer overskriften og tomme linjer over og stopper med `assert` ved et forkert antal felter (research R2). Ingen nye afhængigheder.

**Checkpoint**: Skemaet har de to navnekolonner, og generatoren kan læse begge CSV-filer.

---

## Phase 3: User Story 3 - Fornavn og efternavn (Priority: P1)

**Goal**: Gæstens navn er to felter i database, API og UI. Søgning finder fornavn, efternavn og
"fornavn efternavn".

**Independent Test**: Opret "Ingrid Olsen", se "Ingrid Olsen" i listen og find bookingen med
"ingrid", "OLSEN" og "ingrid ols". Tomt efternavn afvises (quickstart Del 4).

US3 kommer før US1 og US2, fordi både seed og alle bookingvisninger bruger de nye felter. Alle
tre er P1.

### Tests for User Story 3

- [X] T006 [P] [US3] Opdatér `backend/test/bookingService.test.js`:
  - `input` bruger `firstName: 'Jens', familyName: 'Hansen'` i stedet for `guestName`.
  - Erstat testen af tomt `guestName` med `test('004 FR-006: rejects a first name of only spaces', …)` (forventer `VALIDATION_ERROR`, `field === 'firstName'`) og `test('004 FR-006: rejects a family name of only spaces', …)` (`field === 'familyName'`).
  - `test('004 FR-006: trims first and family name before saving', …)`: den falske repository modtager `'Jens'`/`'Hansen'` for input med mellemrum omkring.
- [X] T007 [P] [US3] Opdatér `backend/test/api.test.js`:
  - `stay()` sender `firstName: 'Test', familyName: 'Gæst'`.
  - `test('004 FR-007: search matches first name, family name and "first family"', …)`: opret en booking for "Ingrid Olsen" med egne datoer og kontroller, at `GET /bookings?q=ingrid`, `?q=OLSEN` og `?q=ingrid%20ols` alle indeholder bookingens id.
  - `test('004 FR-006: a booking response has firstName and familyName and no guestName', …)`.

### Implementation for User Story 3

- [X] T008 [US3] Opdatér `backend/openapi.yaml` efter contracts/README.md § Gæstens navn: `BookingInput`, `Booking` (properties, `required`, eksempler med Sverige og Standard dobbeltværelse), beskrivelsen af `q` og eksemplet i `ValidationError` (`field: firstName`, "Fornavn skal udfyldes").
- [X] T009 [P] [US3] Erstat `guestName: 'Gæstens navn'` med `firstName: 'Fornavn'` og `familyName: 'Efternavn'` i `FIELD_LABELS` i `backend/src/errors.js`.
- [X] T010 [US3] Opdatér `backend/src/repositories/bookingRepository.js` (research R9):
  - `SELECT_BOOKING`: `b.first_name AS firstName, b.family_name AS familyName` i stedet for `guestName`.
  - `where()`: `q` bliver til `CONCAT(b.first_name, ' ', b.family_name) LIKE CONCAT('%', ?, '%')`.
  - `insertBooking` og `updateBooking` skriver `first_name` og `family_name`.
- [X] T011 [US3] Opdatér `backend/src/services/bookingService.js` (afhænger af T009, T010):
  - `validate` trimmer `firstName` og `familyName`. Tomt fornavn → `AppError('VALIDATION_ERROR', 'Fornavn skal udfyldes', { field: 'firstName' })`, tomt efternavn → `'Efternavn skal udfyldes'` med `field: 'familyName'`. Ikke ved quote.
  - `toApi` returnerer `firstName` og `familyName` i stedet for `guestName`.
  - `createBooking` og `updateBooking` sender de trimmede navne videre.
  - Kør T006 og T007: de skal være grønne.
- [X] T012 [P] [US3] Tilføj `export const guestName = (booking) => \`${booking.firstName} ${booking.familyName}\`` i `frontend/src/format.js` med en kommentar om, at det er den eneste sammensætning af navnet til visning (research R9).
- [X] T013 [US3] Opdatér `frontend/src/BookingForm.jsx` (afhænger af T012):
  - `FIELDS` bruger `'firstName', 'familyName'` i stedet for `'guestName'`.
  - To felter med `<label>` "Fornavn" og "Efternavn", `required`, `maxLength={75}`, `defaultValue` fra bookingen og `FieldError` for hvert felt. Følg feltmønstret og afstandene i `docs/design/komponenter.md`.
  - Toastens beskrivelse bruger `guestName(saved)`.
- [X] T014 [P] [US3] Erstat `b.guestName`/`booking.guestName` med `guestName(…)` fra `format.js` i `frontend/src/pages/Bookings.jsx` (listen), `frontend/src/pages/BookingDetail.jsx` (overskrift, slet-dialog og toast) og `frontend/src/pages/BarSales.jsx` (valg af booking) (afhænger af T012).
- [X] T015 [US3] Lad `backend/scripts/generate-seed.js` skrive `first_name` og `family_name` i stedet for `guest_name` (de eksisterende navnelister bruges indtil US2). Generér seed, nulstil og kør quickstart Del 4 trin 2–8.

**Checkpoint**: Back office virker med fornavn og efternavn. `npm test` er grøn.

---

## Phase 4: User Story 1 - Opgavens hotel (Priority: P1)

**Goal**: 214 værelser, 8 værelsestyper, priser og sæsoner præcis som i opgaven.

**Independent Test**: quickstart Del 2: 8 typer i opgavens rækkefølge, 214 værelser, 428
pladser, 18 sæsonperioder uden huller og prisberegningerne 900/4.000/7.000/2.150/2.800 kr.

- [X] T016 [US1] 004 FR-001, FR-002: Erstat værelsestyper og værelser i `backend/scripts/generate-seed.js` med tabellen i research R4 (id 1–8, opgavens navne, kapacitet 1, 2, 2, 2, 3, 2, 4, 4, antal 46, 30, 50, 40, 14, 18, 10, 6 og CSV-navnet til importen) og etagerne i research R5 (36 værelser pr. etage i typeordenen, nummer = etage × 100 + løbenummer, 101–634).
- [X] T017 [US1] 004 FR-003: Erstat `yearSplit` med de seks perioder pr. år fra research R6 i `backend/scripts/generate-seed.js`. Sidste dag i februar beregnes som dagen før `-03-01` med den eksisterende `addDays`. Bevar årene 2025–2027.
- [X] T018 [US1] 004 FR-004: Erstat `pricesKr` med prislisten fra research R7 (lav = min, høj = max, mellem = midtpunkt afrundet til nærmeste 50) i `backend/scripts/generate-seed.js`. Kommentér, at CSV-filens priser pr. nat afviger fra opgavens intervaller, og at prislisten følger opgavens tekst.
- [X] T019 [US1] 004 FR-005: Erstat `countryWeights` med de 20 lande fra research R8 som en fast tabel `CSV-navn → ISO-kode` i `backend/scripts/generate-seed.js`. Danske navne kommer fortsat fra `Intl.DisplayNames('da', { type: 'region' })`. Indtil US2 vælges land jævnt blandt de 20 (`pick`).
- [X] T020 [US1] 004 FR-001–FR-005, SC-001: Tilføj selvtjek med `node:assert/strict` i `backend/scripts/generate-seed.js` (research R15): 214 værelser, 8 typer, Σ kapacitet = 428, 3 sæsoner, 20 lande og hver dag 2025-01-01–2027-12-31 i præcis én periode.
- [X] T021 [US1] Generér seed, nulstil (`docker compose down -v && docker compose up --build`) og kør quickstart Del 2.

**Checkpoint**: Hotellet svarer til opgaven. Bookinger og barsalg er stadig de genererede fra
001 (nu med 214 værelser).

---

## Phase 5: User Story 2 - Opgavens 1000 bookinger (Priority: P1)

**Goal**: De 1000 CSV-rækker findes uændret i 2025, og resten af perioden er fyldt op til ca.
70 % belægning med opgavens navne og lande.

**Independent Test**: quickstart Del 3: `diff` mod CSV-filen er tom, fordelingerne pr. land,
type og sæson passer, 0 overlap og belægning 65–80 %.

- [X] T022 [US2] 004 FR-008, FR-010: Importér CSV-rækkerne i `backend/scripts/generate-seed.js` med `readSourceCsv('international_names_with_rooms_1000.csv', 7)` (research R3, R10):
  - Erstat U+FFFD med "ü" med en kommentar, der henviser til xlsx-udgaven. Kræv præcis 54 erstatninger, alle i "Müller".
  - Oversæt værelsestype (R4), land (R8) og sæson (`low`/`mid`/`high` → sæson-id). Ukendte værdier stopper generatoren.
  - Placér hver række i filens rækkefølge: tilfældig ankomstdato i 2025, så alle `Days Rented` nætter ligger i én periode af rækkens sæson, og første ledige værelse af typen. Efter 200 forsøg uden ledigt værelse stopper generatoren med rækkens nummer.
  - Booking-id 1–1000 = rækkenummer. `total_price` = `Price`, `source` = `'booking_system'`, `guest_count` = 1..kapacitet, `created_at` = ankomst − 14 dage kl. 12:00 (som i 001).
- [X] T023 [US2] 004 FR-009, FR-010: Erstat bookinggeneratoren i `backend/scripts/generate-seed.js` med fyldningen fra research R11 (afhænger af T022):
  - Fyld hvert værelse fra `SEED_START` til `SEED_END` uden om de importerede bookinger. Overlap med en importeret booking → spring til dens afrejsedag.
  - 1–10 nætter jævnt fordelt. Fornavn, efternavn og land jævnt blandt CSV-filens værdier (afledt af de importerede rækker, ikke en ny liste). Slet de gamle navnelister fra 001.
  - Tomme dage: chance 1,0 / 0,85 / 0,45 (lav/mellem/høj på afrejsedagen) for 1–5 dage.
  - Pris med `calculateStayPrice`, `source` = `'backoffice'`, id fra 1001 sorteret efter ankomst og værelse.
- [X] T024 [US2] 004 FR-008, FR-010, SC-002, SC-004: Tilføj selvtjek i `backend/scripts/generate-seed.js` (research R15): 1000 importerede bookinger i 2025 med alle nætter i rækkens sæson, intet U+FFFD i navne, ingen overlap pr. værelse og `guest_count` ≤ kapacitet for alle bookinger.
- [X] T025 [US2] 004 FR-015, SC-005: Generér seed, nulstil og kør quickstart Del 1 og Del 3. Hvis Del 1 tager over 180 s, hæves `retries` i healthchecket i `docker-compose.yml` med en kommentar om seedens størrelse. Notér antal bookinger, belægning og opstartstid til README (T034).

**Checkpoint**: Opgavens bookinger er i systemet, og BI viser opgavens data for 2025.

---

## Phase 6: User Story 4 - Helene Christines drinkkort og årssalg (Priority: P2)

**Goal**: Opgavens 30 drinks og et barsalg, hvor 2025 giver præcis "Units Sold" pr. drink.

**Independent Test**: quickstart Del 5: `diff` mod drinkfilen er tom, 179.958 enheder og
13.448.640,34 kr. i 2025, intet salg efter 2026-11-05.

- [X] T026 [US4] 004 FR-011: Erstat drinklisten i `backend/scripts/generate-seed.js` med `readSourceCsv('drinks_menu_with_sales.csv', 4)` (research R12): id i filens rækkefølge, filens navne, pris med `toOre` og kategorierne 1 Cocktail og 2 Kaffe (`Coffee` → `Kaffe`). En ukendt kategori stopper generatoren.
- [X] T027 [US4] 004 FR-012: Erstat barsalgsgeneratoren i `backend/scripts/generate-seed.js` (research R12, afhænger af T023 og T026):
  - 2025: del hver drinks `Units Sold` i salg på 1–4 enheder (det sidste salg får resten), hvert med en tilfældig dag i 2025 og et tidspunkt 08:00–23:59.
  - 2026-01-01 til og med `SEED_SALES_END`: samme metode med `Math.round(unitsSold × dage / 365)` enheder pr. drink, hvor dage er antal dage i perioden (309).
  - Ca. en tredjedel lægges på en booking, hvor gæsten bor på hotellet på salgsdatoen (`check_in <= dato < check_out`).
  - Sortér efter tidspunkt, og giv id derefter. Kommentér, at alle salg er Helene Christines (eneste bartender, ingen medarbejderkolonne).
- [X] T028 [US4] 004 FR-011, FR-012, SC-003: Tilføj selvtjek i `backend/scripts/generate-seed.js` (research R15): 30 drinks (20 + 10), enheder pr. drink i 2025 = `Units Sold`, omsætning 2025 = 1.344.864.034 øre, intet salg efter `SEED_SALES_END`, `quantity` 1–4 og alle bookingkoblede salg inden for opholdet.
- [X] T029 [US4] Generér seed, nulstil og kør quickstart Del 5 (inkl. svartiden på `/analytics/bar-sales` og `/analytics/room-nights`). Notér tallene til README (T034).

**Checkpoint**: Barens tal i 2025 er opgavens tal.

---

## Phase 7: User Story 5 - Bookingsystemet kan ændre og slette (Priority: P2)

**Goal**: `X-API-Key` virker på `POST`, `PUT` og `DELETE` for bookinger og ingen andre steder.

**Independent Test**: quickstart Del 6: opret, ændr og slet med nøglen. Uden nøgle og ved
læsning afvises det med `401`.

### Tests for User Story 5

- [X] T030 [US5] Tilføj tests i `backend/test/api.test.js` (hver med egne datoer, afhænger af T007):
  - `test('004 FR-013: the booking system key can update a booking and the source is kept', …)`: opret med nøglen, `PUT` med nøglen giver 200, nye datoer og `source === 'booking_system'`.
  - `test('004 FR-013: the booking system key can update a back-office booking without changing its source', …)`.
  - `test('004 FR-013: the booking system key can delete a booking', …)`: `DELETE` giver 204, og `GET` med session giver 404.
  - `test('004 FR-013: a wrong key cannot update or delete', …)`: 401, og bookingen er uændret.
  - `test('004 FR-013: the booking system key cannot read bookings', …)`: `GET /bookings` og `GET /bookings/:id` med nøglen og uden cookie giver 401.

### Implementation for User Story 5

- [X] T031 [US5] Montér `allowBookingSystemKey` i stedet for `requireSession` på `.put('/bookings/:id', …)` og `.delete('/bookings/:id', …)` i `backend/src/routes/bookings.js`. Opdatér kommentaren over `allowBookingSystemKey` i `backend/src/auth.js` (gælder `POST`, `PUT` og `DELETE` på bookinger, KB-T10). `updateBooking` ændrer stadig ikke `source` (research R13). Kør T030.
- [X] T032 [US5] Opdatér `backend/openapi.yaml` efter contracts/README.md § Bookingsystemets nøgle: `security` på `PUT` og `DELETE /bookings/{id}`, beskrivelsen af `bookingSystemKey` og `info.description`.
- [X] T033 [US5] Kør quickstart Del 6 inkl. Swagger UI.

**Checkpoint**: Bookingsystemet kan oprette, ændre og slette.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T034 [P] Opdatér `README.md`:
  - § Testdata: kildefilerne i `db/source/`, 214 værelser i 8 typer, 3 sæsoner inkl. jul, 20 lande, 30 drinks, de 1000 bookinger fra opgaven (id 1–1000), antal bookinger og barsalg, belægning og opstartstid fra T025/T029.
  - § Eksternt bookingsystem: curl-eksemplet med `firstName`/`familyName`, plus eksempler på `PUT` og `DELETE`. Teksten om Swagger ("Nøglen virker kun på det endpoint") ændres til `POST`, `PUT` og `DELETE`.
- [X] T035 [P] Tilføj noter om ændringerne fra 004 i `specs/001-backoffice-bookinger/spec.md` (ved FR-001–FR-003: fornavn og efternavn, ved FR-012: opgavens data, ved FR-013: `PUT`/`DELETE`, og ved Assumptions: "Der er intet datasæt fra opgaven" gælder ikke længere), i `specs/001-backoffice-bookinger/data-model.md` (`bookings`-tabellen og valideringsreglen for navn) og i `specs/001-backoffice-bookinger/research.md` R10 (erstattet af 004 research R4–R12). Noterne henviser til `specs/004-opgavedata/` og ændrer ikke 001's øvrige tekst.
- [X] T036 [P] Opdatér `docs/design/skaerme.md` (listens gæstekolonne bruger fornavn og efternavn, formularen har felterne "Fornavn" og "Efternavn") og `docs/krav/technical.md` (KB-T7: opgavens værelsestyper, priser og sæsoner. KB-T10: `POST`, `PUT` og `DELETE /api/bookings` med `X-API-Key`).
- [X] T037 Kør `npx prettier@3 --write` på de ændrede filer og `docker compose exec backend npm test`. Alt skal være grønt.
- [X] T038 Kør hele quickstart.md fra en tom maskine (`docker compose down -v`), og kør derefter `/speckit-converge` for 004. Resultatet skrives i `specs/004-opgavedata/converge.md` (KB-D4).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Ingen afhængigheder.
- **Foundational (Phase 2)**: Efter Setup. Blokerer alle stories.
- **US3 (Phase 3)**: Efter Foundational. Skal være færdig før US1, US2 og US4, fordi seed og
  alle bookingvisninger bruger navnekolonnerne.
- **US1 (Phase 4)**: Efter US3.
- **US2 (Phase 5)**: Efter US1 (værelsestyper, sæsoner, lande og priser).
- **US4 (Phase 6)**: Efter US2 (salg lægges på bookinger). T026 kan laves efter US1.
- **US5 (Phase 7)**: Efter Foundational og T007 (samme testfil). Uafhængig af data, så den kan
  laves parallelt med US1, US2 og US4 af en anden person.
- **Polish (Phase 8)**: Efter alle stories.
- **Feature 003**: Starter først, når T038 er færdig og committet.

### User Story Dependencies

```text
Setup → Foundational → US3 → US1 → US2 → US4 → Polish
                         └──────→ US5 ──────────┘
```

### Within Each User Story

- Tests skrives først og skal fejle, før implementeringen laves (T006/T007 før T010/T011,
  T030 før T031).
- Kontrakt (`openapi.yaml`) og kode ændres i samme commit (constitution II).
- Alle generator-tasks rører `backend/scripts/generate-seed.js` og laves i rækkefølge.

### Parallel Opportunities

- T002 kan laves parallelt med T001 og T003.
- T006 og T007 (to testfiler).
- T009, T012 og T014 (forskellige filer) parallelt med T010/T011.
- US5 (T030–T033) parallelt med US1/US2/US4, når T007 er færdig.
- T034, T035 og T036 (forskellige filer).

---

## Parallel Example: User Story 3

```bash
# Tests samtidig (forskellige filer):
Task: "T006 backend/test/bookingService.test.js (004 FR-006)"
Task: "T007 backend/test/api.test.js (004 FR-006, FR-007)"

# Frontend og fejl-labels samtidig med repository/service:
Task: "T009 backend/src/errors.js FIELD_LABELS"
Task: "T012 frontend/src/format.js guestName()"
```

## Parallel Example: User Story 5

```bash
# Bookingsystemets nøgle (backend) samtidig med generatoren (US1/US2):
Task: "T030 backend/test/api.test.js (004 FR-013)"
Task: "T016 backend/scripts/generate-seed.js værelsestyper og værelser"
```

---

## Implementation Strategy

### MVP First

1. Phase 1 Setup → Phase 2 Foundational.
2. Phase 3 US3 (navn) → Phase 4 US1 (hotellet) → Phase 5 US2 (de 1000 bookinger).
3. **STOP og valider** quickstart Del 2–4. Systemet viser nu opgavens hotel og bookinger.

### Incremental Delivery

1. MVP (US3 + US1 + US2).
2. US4 Bar (BI's barnøgletal bliver opgavens tal).
3. US5 Bookingsystemet (kan komme når som helst efter T007).
4. Polish og converge **før feature 003 startes og før 2026-11-06**.

### Parallel Team Strategy

1. Setup og Foundational sammen, gerne med parprogrammering og `Co-authored-by`.
2. Derefter:
   - Udvikler A: US3 backend (T006–T011) og derefter generatoren (US1, US2, US4).
   - Udvikler B: US3 frontend (T012–T014) og derefter US5.
   - Udvikler C: dokumentation (T034–T036) og quickstart.
3. Alle har commits (KB-D5/KB-D10).

---

## Notes

- [P] = andre filer og ingen afhængighed af ufærdige tasks.
- `db/02_seed.sql` redigeres aldrig i hånden. Kildefilerne i `db/source/` ændres aldrig.
- Undgå: nye afhængigheder (xlsx-pakker), hardcodede lister i backend eller frontend
  (værelsestyper, lande og drinks kommer fra databasen), et samlet navnefelt nogen steder og
  ændringer i `/analytics/*`.
- Testenes egne fixtures (`backend/test/testDb.js`, `analyticsService.test.js` med land `DK`)
  er testdata og ændres ikke. Analytics-fixturen har intet navnefelt.
