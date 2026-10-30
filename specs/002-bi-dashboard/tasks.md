---
description: "Tasks for 002-bi-dashboard"
---

# Tasks: Business Intelligence – ledelsesdashboard

**Input**: Design documents from `/specs/002-bi-dashboard/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R11), data-model.md, contracts/README.md
(kontrakten er `backend/openapi.yaml`), quickstart.md

**Tests**: Inkluderet. `docs/retningslinjer/tests.md` kræver en test for hvert nøgletal i
samme commit. Kun backend testes med `node:test`. `analyticsService` testes med et falsk
repository (et almindeligt objekt) og håndregnede tal. **Testnavne starter med kravboardets
FT-ID** (fx `test('FT7: a stay over a season change splits the frozen total …', …)`), fordi spec
002's `FR-0xx` kolliderer med 001's.
Tableau-delen valideres manuelt med quickstart.md.

**Bindende for alle tasks**: `AGENTS.md` og `docs/retningslinjer/{kodekvalitet,database,tests}.md`.
Commit-beskeder refererer task-ID og krav-ID (fx `T011 FR-015: …`).

**Status**: Backend-tasks (`[X]`) bliver implementeret sideløbende med disse dokumenter.
Tableau-workbooken, den manuelle gennemgang og converge er åbne (`[ ]`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Kan køres parallelt (andre filer, ingen afhængighed af ufærdige tasks).
- **[Story]**: US1–US7 svarer til User Story 1–7 i spec.md.

## Path Conventions

- Backend: `backend/src/`, `backend/test/`. Workbook: `tableau/kong-arthur.twbx`.
- Krav-ID'er: `FR-0xx` er fra **spec 002**. `FT*` er fra kravboardet. Kravboardets `A`-, `T`-
  og `D`-ID'er skrives med præfikset `KB-` (fx `KB-A4`).
- Penge: Repositoriet omregner DECIMAL-strenge til øre med `toOre`. Servicen regner i øre, og
  routen sender kroner med `toKr` (`backend/src/money.js`).
- Datoer: ISO `YYYY-MM-DD`. `year` og `month` er heltal (month 1–12).
- Svarformat: hvert endpoint returnerer en JSON-array af flade objekter uden query-parametre
  (research R3). Felterne står kun i `backend/openapi.yaml`.
- Servicen oprettes med en factory og injiceret repository (`createAnalyticsService({ analyticsRepo })`)
  i composition root `backend/src/app.js`, som i 001.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Spec Kit-peger, miljøvariabel og Tableau-connector.

- [X] T001 Peg `.specify/feature.json` på `specs/002-bi-dashboard`.
- [X] T002 [P] Tilføj `BI_API_KEY` med en udviklings-placeholder på mindst 32 tegn i `.env.example` under `BOOKING_SYSTEM_API_KEY` (FR-014). `docker-compose.yml` er uændret, fordi `env_file: .env` allerede sender den videre.
- [ ] T003 [P] Installér REST API Connector fra Tableau Exchange (https://exchange.tableau.com/products/1111) i Tableau Desktop 2023.3+ efter vejledningen på siden (JDBC-`.jar` i Tableaus `Drivers`-mappe), og opret mappen `tableau/` i repo-roden (research R1).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Adgang, kontrakt, repository, router og datakilder, som alle stories bygger på.

**⚠️ CRITICAL**: Ingen user story kan startes, før denne fase er færdig.

- [X] T004 Tilføj en middleware i `backend/src/auth.js`, der accepterer **enten** en session (som `requireSession`) **eller** `Authorization: Bearer <BI_API_KEY>` (FR-014, FT17, research R2):
  - Nøglen sammenlignes med `crypto.timingSafeEqual` efter længdetjek, ligesom `allowBookingSystemKey`.
  - Den fejler lukket: er `BI_API_KEY` ikke sat eller under 32 tegn, afvises alle Bearer-nøgler med 401 `UNAUTHORIZED`.
  - `X-API-Key` accepteres ikke. Middlewaren monteres kun på `/analytics`-routeren, så nøglen ikke virker andre steder.
- [X] T005 [P] Udtræk nat-gennemløbet (`d ∈ [checkIn, checkOut)` med UTC-datoaritmetik) fra `calculateStayPrice` til en eksporteret hjælper i `backend/src/services/pricing.js`, og lad `calculateStayPrice` bruge den. Så er der én definition af en nat (research R5). `backend/test/pricing.test.js` skal stadig være grøn.
- [X] T006 [P] Udvid `backend/openapi.yaml` (KB-A3, FR-013):
  - Et Bearer-skema (`type: http`, `scheme: bearer`) under `securitySchemes`.
  - Fem `GET`-stier: `/analytics/room-nights`, `/analytics/occupancy`, `/analytics/bookings`, `/analytics/bar-sales` og `/analytics/kpis`. Hver har `security` session **eller** Bearer, et `200`-svar, der er en array af flade objekter med felterne fra data-model.md, og `401` med `Error`.
  - Ingen query-parametre og ingen skrivende metoder.
- [X] T007 Implementér `backend/src/repositories/analyticsRepository.js` med parametriseret SQL, der kun returnerer rå rækker uden formler (`docs/retningslinjer/database.md` §6):
  - Bookinger med `check_in`, `check_out`, `guest_count`, `total_price` (øre), værelsestype (`rooms` → `room_types`) og land (`countries`).
  - Sæsonperioder med sæsonnavn, `room_prices` pr. (værelsestype, sæson) i øre og antal `rooms` pr. værelsestype.
  - Barsalg med datodelen af `sold_at`, drink, kategori (`drink_categories`), `quantity` og `unit_price` (øre).
- [X] T008 Implementér `backend/src/routes/analytics.js` med fem tynde `GET`-handlere, der kalder `analyticsService` og sender kroner med `toKr`. Montér routeren under `/api` med middlewaren fra T004, og kobl `createAnalyticsService({ analyticsRepo })` i `backend/src/app.js` (afhænger af T004, T006 og T007).
- [ ] T009 Opret `tableau/kong-arthur.twbx` med fem datakilder via REST API Connector (Nøgletal, Værelsesnætter, Belægning, Bookinger, Barsalg) efter quickstart.md § Forbind (afhænger af T003 og T008):
  - Autentificering med Bearer token = `BI_API_KEY`.
  - JSONPath til arrayen på øverste niveau (**verificeres i Tableau**).
  - `date`/`checkIn`/`checkOut` som Date, `year`/`month` som diskrete dimensioner, `countryCode` med rollen Country/Region og `generatedAt` som Date & Time.

**Checkpoint**: `curl` med Bearer-nøglen giver `200` på alle fem endpoints (quickstart Del 1,
scenarie 1–2), og datakilderne kan opdateres i Tableau.

---

## Phase 3: User Story 1 - Indtjening overblik (Priority: P1) 🎯 MVP

**Goal**: Årets samlede værelsesindtjening og indtjening pr. værelsestype × sæson og pr. land
med rangering. Hver nats indtjening ligger i sin egen sæson, måned og sit eget år (FR-003–FR-006, FR-015).

**Independent Test**: Med et kendt datasæt summerer `revenue` fra `/analytics/room-nights`
præcis til bookingernes `total_price`. Arkene viser indtjening pr. type × sæson og pr. land,
sorteret, og `roomRevenue` for året stemmer med SUM(`revenue`) for årets nætter.

### Tests for User Story 1

- [X] T010 [P] [US1] Skriv tests i `backend/test/analyticsService.test.js` med falsk repository:
  - `FT7`: Nætterne for en booking summerer præcis til `total_price`.
  - `FT7`: Hver nat vægtes med sæsonprisen. 2 nætter i lavsæson (500) + 1 nat i højsæson (800) med total 1800 giver 500, 500 og 800.
  - `FT7`: Resten af ørerne lægges på sidste nat. 100,00 kr. over 3 lige vægtede nætter giver 33,33, 33,33 og 33,34.
  - `FT10`: Et ophold 31/12 → 2/1 giver én nat i hvert år.
  - `FT7`: Er alle vægte 0, deles beløbet ligeligt.
  - `FT10`: `roomRevenue` for et år er summen af nætterne i året, ikke af bookinger med ankomst i året.

### Implementation for User Story 1

- [X] T011 [US1] Implementér værelsesnætterne i `backend/src/services/analyticsService.js` med nat-hjælperen fra T005. Én række pr. solgt nat med `bookingId`, `date`, `year`, `month`, `season`, `roomType`, `countryCode`, `country` og `revenue`, fordelt efter research R5. Tilføj nøgletallet `roomRevenue` pr. år (`unit` `DKK`).
- [ ] T012 [P] [US1] Byg arket "Indtjening pr. værelsestype × sæson" i `tableau/kong-arthur.twbx`: `roomType` × `season`, SUM(`revenue`) (FR-003, FT7).
- [ ] T013 [P] [US1] Byg arkene "Indtjening pr. land" og "Indtjening pr. værelsestype" i `tableau/kong-arthur.twbx`: sorteret faldende efter SUM(`revenue`) og Top 10 for lande (FR-004, FR-005, FT8, FT9).
- [ ] T014 [US1] Byg arket "Nøgletalsfliser" i `tableau/kong-arthur.twbx` med flisen `roomRevenue` fra datakilden Nøgletal, filtreret på `year` (FR-006, FT10). De øvrige fliser tilføjes i US2–US5.

**Checkpoint**: Quickstart krydstjek (FR-015) og SC-002 kan gennemføres.

---

## Phase 4: User Story 2 - Belægningsgrad (Priority: P1)

**Goal**: Belægningsgrad pr. måned, som kan filtreres på sæson og værelsestype (FR-001, FT5).

**Independent Test**: 10 værelser og 150 solgte værelsesnætter i en måned med 30 dage giver
50 %. Filtrering på sæson eller type ændrer tallet.

### Tests for User Story 2

- [X] T015 [P] [US2] Udvid `backend/test/analyticsService.test.js`:
  - `FT5`: 10 værelser af en type og 150 solgte værelsesnætter over 30 dage giver `occupancyRate` 0,5 for måneden og året.
  - `FT5`: En type uden værelser giver `occupancyRate` 0, "0, når nævneren er 0".
  - `FT5`: En booking hen over et månedsskifte tæller som solgt på hver af sine datoer og ikke på afrejsedagen.

### Implementation for User Story 2

- [X] T016 [US2] Implementér belægningsdage i `backend/src/services/analyticsService.js`. Én række pr. dato × værelsestype for hver dato i `season_periods` med `availableRoomNights` = antal værelser af typen og `soldRoomNights` = bookinger med `check_in <= date < check_out`. `occupancyRate` = sold ÷ available, og 0, når available er 0. Tilføj nøgletallet `occupancyRate` pr. år (`unit` `percent`, brøk 0–1).
- [ ] T017 [US2] Byg arket "Belægning pr. måned" i `tableau/kong-arthur.twbx` med det beregnede felt `SUM([soldRoomNights]) / SUM([availableRoomNights])` (plan.md Complexity Tracking). Brug **ikke** AVG(`occupancyRate`). Tilføj flisen `occupancyRate` på "Nøgletalsfliser" (FR-001, FT5).

**Checkpoint**: US2 scenarie 1–2 kan vises i Tableau.

---

## Phase 5: User Story 3 - Gæsternes oprindelseslande (Priority: P2)

**Goal**: Antal bookinger og gæster pr. land. Et klik på et land filtrerer de øvrige
visninger (FR-002, FT6, FT16).

**Independent Test**: Antal bookinger og gæster pr. land i Tableau matcher testdatasættet, og
et klik på et land filtrerer indtjeningsarkene.

### Tests for User Story 3

- [X] T018 [P] [US3] Udvid `backend/test/analyticsService.test.js`:
  - `FT6`: `bookings` og `guests` for et år tæller bookinger med ankomst i året.
  - `FT6`: En booking 30/12 → 2/1 tælles kun i ankomståret.
  - `FT6`: `nights` er `check_out − check_in` i dage.

### Implementation for User Story 3

- [X] T019 [US3] Implementér booking-rækkerne i `backend/src/services/analyticsService.js` (`year`/`month` fra `check_in`, `nights` afledt og ikke gemt, `revenue` = `total_price`) og nøgletallene `bookings` og `guests` pr. år (`unit` `count`).
- [ ] T020 [US3] Byg arket "Gæster og bookinger pr. land" i `tableau/kong-arthur.twbx` som kort eller søjler pr. `countryCode`/`country` med antal `bookingId` og SUM(`guestCount`), og slå **Use as Filter** til (FR-002, FT6, FR-012). Tilføj fliserne `bookings` og `guests`.

**Checkpoint**: US3 scenarie 1–2.

---

## Phase 6: User Story 4 - Barsalg (Priority: P2)

**Goal**: Årets barsalg, omsætning pr. drink og fordelingen mellem cocktails og kaffe
(FR-008–FR-010, FT13–FT15).

**Independent Test**: Med kendte barsalg matcher årets salg, omsætning pr. drink og andelene
manuel beregning, og andelene summerer til 100 %.

### Tests for User Story 4

- [X] T021 [P] [US4] Udvid `backend/test/analyticsService.test.js`:
  - `FT13`: `barRevenue` for et år er Σ `quantity × unit_price` for årets salg.
  - `FT15`: Andelene for et år "summerer til 1, når der er barsalg", også når de ikke går op (fx tre lige store kategorier).
  - `FT15`: Kategorierne kommer fra data. En tredje kategori i det falske repository giver sin egen række, så "Cocktail" og "Kaffe" ikke er hardcodet.
  - `FT15`: Et år uden barsalg giver ingen `NaN` eller `null`.

### Implementation for User Story 4

- [X] T022 [US4] Implementér barsalg-rækkerne i `backend/src/services/analyticsService.js` (`revenue` = `quantity × unit_price`) og nøgletallene `barRevenue` (`DKK`) og `barRevenueShare` (`percent`, én række pr. kategori med `dimension` = kategoriens navn).
- [ ] T023 [P] [US4] Byg arket "Baromsætning pr. drink" i `tableau/kong-arthur.twbx`: `drink` sorteret faldende efter SUM(`revenue`), farvet efter `category`, med SUM(`quantity`) i tooltip (FR-009, FT14).
- [ ] T024 [P] [US4] Byg arket "Cocktails vs. kaffe" i `tableau/kong-arthur.twbx` fra datakilden Nøgletal (`kpi = barRevenueShare`, `dimension` som farve) og tilføj flisen `barRevenue` (FR-008, FR-010, FT13, FT15).

**Checkpoint**: US4 scenarie 1–3.

---

## Phase 7: User Story 5 - Selvvalgte nøgletal (Priority: P2)

**Goal**: Gennemsnitlig pris pr. solgt værelsesnat og gennemsnitlig opholdslængde (FR-007, FT11).

**Independent Test**: Begge nøgletal matcher manuel beregning på et kendt datasæt.

### Tests for User Story 5

- [X] T025 [P] [US5] Udvid `backend/test/analyticsService.test.js`:
  - `FT11`: `avgPricePerNight` = `roomRevenue` ÷ solgte værelsesnætter i året (fx 1800 over 3 nætter = 600).
  - `FT11`: `avgStayLength` = gennemsnit af `nights` for bookinger med ankomst i året (fx 2 og 4 nætter = 3).
  - `FT11`: Et år uden bookinger giver 0 for begge.

### Implementation for User Story 5

- [X] T026 [US5] Tilføj nøgletallene `avgPricePerNight` (`DKK`) og `avgStayLength` (`nights`) pr. år i `backend/src/services/analyticsService.js`.
- [ ] T027 [US5] Tilføj fliserne "Gns. pris pr. nat" og "Gns. opholdslængde" på "Nøgletalsfliser" i `tableau/kong-arthur.twbx` (FR-007, FT11).

**Checkpoint**: US5 scenarie 1–2.

---

## Phase 8: User Story 6 - Aktuelle data og læseadgang (Priority: P3)

**Goal**: Dashboardet viser data fra API'et med tidspunkt for seneste opdatering og kan ikke
ændre noget (FR-013, FR-014, FR-016, FT4, FT17).

**Independent Test**: En ny booking indgår efter Refresh All Extracts, og "Data opdateret"
skifter. BI-nøglen giver 401 uden for `/api/analytics`.

- [X] T028 [US6] Sæt `generatedAt` (ISO-tidspunkt for svaret) på alle rækker fra `/analytics/kpis` i `backend/src/services/analyticsService.js` (FR-016, research R7).
- [X] T029 [US6] Udvid `backend/test/api.test.js` med adgangstests. Testen sætter `process.env.BI_API_KEY` til en kendt værdi på mindst 32 tegn:
  - `FT17`: `GET /api/analytics/kpis` uden auth giver 401.
  - `FT17`: Med korrekt Bearer-nøgle giver det 200 og en array.
  - `FT17`: Med forkert Bearer-nøgle giver det 401.
  - `FT17`: `GET /api/bookings` med BI-nøglen giver 401.
  - `FT17`: `/api/analytics/kpis` med `X-API-Key` giver 401.
  - Er testene allerede skrevet sammen med T004, så afkryds tasken.
- [ ] T030 [US6] Byg arket "Data opdateret" i `tableau/kong-arthur.twbx` med MAX(`generatedAt`) (FR-016).
- [ ] T031 [US6] Gennemfør SC-004 og edge casen "API'et er utilgængeligt" fra quickstart.md Del 3 i `tableau/kong-arthur.twbx`, og notér resultatet i `specs/002-bi-dashboard/quickstart.md`.

**Checkpoint**: Quickstart Del 1 scenarie 4–8 og SC-004/SC-005.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Samlet dashboard, dokumentation og aflevering.

- [ ] T032 Saml alle ark på ét dashboard i `tableau/kong-arthur.twbx` (SC-003, FR-012, FT16):
  - Filtre på `year` (standard: indeværende år), `season`, `roomType` og `country`, anvendt på alle ark med feltet ("All Using Related Data Sources").
  - Kobl de fælles feltnavne mellem datakilderne (**verificeres i Tableau**).
  - **Use as Filter** på indtjenings- og landearkene.
  - En kort tekst om, at nøgletalsfliserne og cocktail/kaffe-andelen er pr. kalenderår og kun følger år-filteret.
- [X] T033 [P] Opdatér dokumentationen: status, Tableau-pilen og `BI_API_KEY` i `README.md`, KB-A4 i `docs/krav/architecture.md`, status i `docs/krav/businessinteligence.md` og afklaringen 2026-10-30 i `specs/002-bi-dashboard/spec.md`.
- [X] T034 Kør `npx prettier@3 --write backend` og `docker compose exec backend npm test` (alle filer i `backend/`). Ret fejl, til alt er grønt.
- [ ] T035 Gennemgå `specs/002-bi-dashboard/quickstart.md` Del 1–3 fra en tom maskine. Erstat hvert "verificeres i Tableau" med den faktiske fremgangsmåde i `specs/002-bi-dashboard/quickstart.md` og `specs/002-bi-dashboard/research.md`, og notér afvigelser som nye tasks.
- [ ] T036 Kør `/speckit-converge` og gem resultatet (implementeret vs. mangler) i `specs/002-bi-dashboard/converge.md` (KB-D4).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Ingen afhængigheder.
- **Foundational (Phase 2)**: Afhænger af Setup og blokerer alle stories. T008 afhænger af T004, T006 og T007. T009 afhænger af T003 og T008.
- **US1 og US2 (P1)**: Afhænger af Foundational og er uafhængige af hinanden.
- **US3, US4 og US5 (P2)**: Afhænger af Foundational. US5 genbruger værelsesnætterne fra US1 (T011) og booking-rækkerne fra US3 (T019).
- **US6 (P3)**: T028 afhænger af nøgletallene i US1–US5. T029 afhænger af T004 og T008. T030 og T031 afhænger af T009.
- **Polish**: T032 afhænger af alle Tableau-ark (T012–T014, T017, T020, T023, T024, T027, T030). T035 og T036 kommer til sidst.

### User Story Dependencies

```text
Setup → Foundational ─┬─ US1 ─┐
                      ├─ US2  │
                      ├─ US3 ─┼─ US5
                      ├─ US4  │
                      └───────┴─ US6 → Polish
```

### Within Each User Story

- Test → service → Tableau-ark. Testen skrives sammen med formlen og ses fejle først.
- Alle backend-tests ligger i `backend/test/analyticsService.test.js`, og al logik i
  `backend/src/services/analyticsService.js`. Backend-tasks i forskellige stories rører derfor
  de samme to filer og koordineres. `[P]` gælder kun inden for en story (test-filen og
  servicen er forskellige filer).
- Tableau-arkene ligger i én workbook. Én person ad gangen redigerer `tableau/kong-arthur.twbx`.

### Parallel Opportunities

- Setup: T002 og T003 parallelt.
- Foundational: T005 og T006 parallelt med T004. T007 parallelt med T004–T006.
- Når datakilderne findes (T009), kan arkene designes i rækkefølge af én person, mens en anden
  gennemgår quickstart Del 1 med curl.

---

## Parallel Example: User Story 1

```bash
# Test og ark samtidig (forskellige filer):
Task: "T010 backend/test/analyticsService.test.js (FR-015, FR-006)"
Task: "T012 Indtjening pr. værelsestype × sæson i tableau/kong-arthur.twbx"
```

## Parallel Example: User Story 4

```bash
Task: "T021 backend/test/analyticsService.test.js (FR-008, FR-010)"
Task: "T023 Baromsætning pr. drink i tableau/kong-arthur.twbx"
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 Setup → Phase 2 Foundational. Tjek checkpointet: alle fem endpoints svarer med
   Bearer-nøglen, og datakilderne kan opdateres i Tableau.
2. Phase 3 US1 Indtjening.
3. **STOP og valider** krydstjekket (FR-015) og SC-002. Det kan allerede vises.

### Incremental Delivery

1. MVP (US1).
2. US2 Belægning (det andet P1-krav).
3. US3 Lande, US4 Barsalg og US5 Selvvalgte nøgletal.
4. US6 Aktuelle data og læseadgang.
5. Polish: samlet dashboard, quickstart og converge **før 2026-11-06**.

### Parallel Team Strategy

1. Backend (Phase 2 og alle `[X]`-tasks) laves samlet, gerne med parprogrammering og
   `Co-authored-by`.
2. Derefter:
   - Udvikler A: datakilder (T009) og arkene for US1 og US2.
   - Udvikler B: arkene for US3–US5.
   - Udvikler C: adgangstests (T029), quickstart Del 1 og dokumentation.
3. Samlingen af dashboardet (T032) og gennemgangen (T035) laves sammen. Alle har commits
   (KB-D5/KB-D10).

---

## Notes

- [P] = andre filer og ingen afhængighed af ufærdige tasks.
- Hver story kan valideres med sit quickstart-scenarie.
- Tableau må kun summere, tælle, filtrere og sortere. Den eneste division er belægning for et
  udsnit (plan.md Complexity Tracking).
- Undgå: formler i Tableau, SQL uden for repositories, hardcodede kategorier eller sæsoner,
  gemte afledte data og nye afhængigheder uden begrundelse.

---

## Phase 10: Stjerneskema (2026-10-30)

**Purpose**: Én workbook med én datakilde bygget som stjerneskema, så hvert filter kun rammer
de visninger, hvis data har dimensionen (spec.md § Clarifications "Ændring 2026-10-30", US7,
FR-012, FR-013, FR-017, FR-018, SC-006, SC-007). Grundlaget er research R8–R11,
[data-model.md § Stjerneskema](data-model.md#stjerneskema-ændring-2026-10-30) og
[contracts/README.md § Ændring 2026-10-30](contracts/README.md#ændring-2026-10-30-stjerneskema).

**Erstatter**: De åbne Tableau-tasks T003, T009, T012–T014, T017, T020, T023, T024, T027,
T030–T032, T035 og T036 bygger på fem datakilder og Tableau 2023.3. De udføres **ikke**. Hver
ny task nedenfor nævner, hvad den erstatter, og de gamle tasks står uændret som historik. Kan
gruppen ikke få Tableau Desktop 2024.2.1+, gælder de gamle tasks i stedet (plan.md § Ændring
2026-10-30) *(foreslået af AI, afventer gruppen)*.

**Independent Test**: quickstart.md Del 1 scenarie 10–16 (API) og Del 2 T1–T10 og F1–F6
(workbook).

### Backend og kontrakt (T039–T042 i samme commit, constitution II)

- [X] T037 [P] [US7] Skriv tests i `backend/test/analyticsService.test.js` med falsk repository, før T039 og T040, og se dem fejle:
  - `FT16`: Kalenderen har én række pr. dato i hele kalenderår fra det tidligste til det seneste år blandt sæsonperioder, `checkIn`, `checkOut` og barsalgsdatoer, uden huller. Fx en periode i 2025 og et barsalg 2026-03-01 giver 730 rækker fra 2025-01-01 til 2026-12-31.
  - `FT16`: `season` er navnet på sæsonen for perioden, der dækker datoen, og `null` for en dato uden periode.
  - `FT16`: `roomTypes()` giver alle værelsestyper sorteret efter id, også en type uden værelser (`rooms` 0). `countries()` giver alle lande, også dem uden bookinger.
  - `FT10`: `kpis()` har rækker for hvert år i kalenderen, også et år uden data, hvor værdierne er 0 og aldrig `NaN` eller `null` (FR-018).
  - `FT16`: Rækkerne fra `roomNights()`, `occupancy()`, `bookings()` og `barSales()` har ikke felterne `year`, `month`, `season` eller `country`.
  - Eksisterende tests, der læser de fjernede felter fra faktarækkerne, bruger i stedet `date`/`checkIn`. Formlerne og de forventede tal er uændrede.
- [X] T038 [P] [US7] I `backend/src/repositories/analyticsRepository.js`: `listRoomTypes` returnerer også `room_types.capacity`, og `listCountries` re-eksporteres fra `backend/src/repositories/referenceRepository.js`. Ingen ny SQL til kalenderen (plan.md § Ændring 2026-10-30).
- [X] T039 [US7] I `backend/src/services/analyticsService.js` (afhænger af T038):
  - Én hjælper for kalenderårene (research R10), som både `calendar()` og `kpis()` bruger, så de altid har de samme år (FR-017, FR-018).
  - `calendar()`: `{ date, year, month, season }` sorteret efter `date`. Sæsonen findes med de eksisterende hjælpere fra `backend/src/services/pricing.js`.
  - `roomTypes()`: `{ roomType, capacity, rooms }` sorteret efter `room_types.id`.
  - `countries()`: `{ countryCode, country }` sorteret efter `country`.
- [X] T040 [US7] I `backend/src/services/analyticsService.js`: fjern `year`, `month`, `season` og `country` fra rækkerne i `roomNights()`, `occupancy()`, `bookings()` og `barSales()` (contracts/README.md, tabellen "Ændrede faktafelter", research R11). Nøgletallene må stadig gruppere pr. år internt. Formlerne er uændrede (FR-011). `drink` og `category` bliver på barsalget.
- [X] T041 [US7] I `backend/src/routes/analytics.js`: tilføj `calendar`, `room-types` og `countries` til `TABLES`, så de får en `GET`-handler med `allowBiKey`, og `GET /analytics` lister otte tabeller (afhænger af T039).
- [X] T042 [US7] I `backend/openapi.yaml`, **samme commit som T039–T041**:
  - Tre `GET`-stier `/analytics/calendar`, `/analytics/room-types` og `/analytics/countries` med samme `security` (session **eller** Bearer), `200` med en array og `401` med `Error`.
  - Et skema pr. ny sti med felterne fra contracts/README.md (alle `required`, `date` som `format: date`, `month` 1–12, `season` `nullable: true`).
  - Fjern de felter, der står i contracts/README.md, fra `RoomNight`, `OccupancyDay`, `AnalyticsBooking` og `AnalyticsBarSale`.
  - Ny beskrivelse af årene i `/analytics/kpis` ("hvert år i `/analytics/calendar`") og af de otte tabeller i `GET /analytics`.
- [X] T043 [US7] Udvid `backend/test/api.test.js`, og kør derefter `npx prettier@3 --write backend` og `docker compose exec backend npm test`, til alt er grønt (afhænger af T037–T042):
  - `FT17`: `/api/analytics/calendar`, `/room-types` og `/countries` giver 401 uden auth og 200 med en array med Bearer-nøglen.
  - `FT16`: `GET /api/analytics` lister otte tabeller, inkl. `calendar`, `room-types` og `countries`.

### Dokumentation (parallelt med backend)

- [X] T044 [P] Skriv `docs/tableau-guide.md`. Den er det eneste sted, byggetrinene står (quickstart.md og README linker hertil). Den skal dække:
  - Tableau Desktop 2024.2.1+ (research R9) og installation af REST API Connector fra Tableau Exchange (JDBC-`.jar` i `Drivers`-mappen på macOS og Windows og genstart).
  - Én datakilde med alle otte tabeller: base-URL, Bearer-token = `BI_API_KEY`, tabellerne og stierne fra `GET /api/analytics`, fakta som basistabeller ("New Base Table") og de ti relationer præcis som i data-model.md § Relationer i Tableau. Ingen relation mellem to fakta.
  - Performance Options: standarden Many / Many og Some records match på alle ti relationer. Relation 10 (`Nøgletal.year` ↔ `Kalender.year`) **skal** være Many / Many.
  - Felttyper og roller: `date`, `checkIn` og `checkOut` som Date, `year` som Number (whole) på begge sider af relation 10, `year` og `month` som diskrete dimensioner, `countryCode` med rollen Country/Region og `generatedAt` som Date & Time.
  - Hvert ark med tabel, felter og aggregering: nøgletalsfliser, belægning pr. måned (`SUM([soldRoomNights]) / SUM([availableRoomNights])`, aldrig AVG), indtjening pr. værelsestype × sæson, indtjening pr. land og pr. værelsestype med topliste, gæster og bookinger pr. land, baromsætning pr. drink, cocktails vs. kaffe, **kundetilfredshed** (fra Nøgletal, 003 FT12) og "Data opdateret". Kun SUM, COUNT, filtrering og sortering (FR-011).
  - Dashboardet: layout, filtre på år (ét år ad gangen, standard indeværende år), måned, sæson, værelsestype og land, hver anvendt med "Apply to Worksheets → Selected Worksheets" efter filtermatrixen i data-model.md, og teksten om, at nøgletalsfliserne og cocktail/kaffe-andelen kun følger år.
  - **Use as Filter**: på lande- og værelsestypearkene, og målarkene for de genererede filterhandlinger rettes under Dashboard → Actions, så et klik følger filtermatrixen.
  - Opdatering med Data → Refresh All Extracts og ingen extract-filtre (research R9).
  - Gem som packaged workbook `tableau/kong-arthur.twbx`.
  - Fejlfinding: `HTTP error (404) … Unable to connect to the REST API server` på base-URL'en (`GET /api/analytics` skal svare 200 med otte tabeller), 401 (forkert eller manglende nøgle), "No such table" (Tableau før 2024.2.1), tal, der ganges op eller forsvinder (forkert relation, felttype eller Performance Options), og et land, der ændrer belægning eller barsalg (filter eller handling anvendt på forkerte ark).
  - Trin, der ikke er bekræftet i Tableaus dokumentation (research R8 "Verificeres i Tableau"), markeres **verificeres i Tableau**.
- [X] T045 [P] Tilføj et kort Tableau-afsnit i `README.md`: Tableau Desktop 2024.2.1+, REST API Connector, `BI_API_KEY`, én fil `tableau/kong-arthur.twbx` med én datakilde og links til `docs/tableau-guide.md` og `specs/002-bi-dashboard/quickstart.md` Del 2. Ingen byggetrin i README.
- [X] T046 [P] Opdatér `specs/002-bi-dashboard/quickstart.md`: Del 1 scenarie 10–16 (otte tabeller, de tre dimensioner, fjernede faktafelter, nøgletal for kalenderens år), Del 2 som verifikation af workbooken (tal mod `/analytics/kpis` og SQL, filtre efter filtermatrixen) med link til `docs/tableau-guide.md` og SC-006/SC-007 i Del 3.

### Workbook (manuelt af gruppen, efter T043 og T044)

- [ ] T047 Installér REST API Connector i Tableau Desktop 2024.2.1+ efter `docs/tableau-guide.md`, tjek versionen under Help → About Tableau, og opret mappen `tableau/` i repo-roden (**erstatter T003**).
- [ ] T048 [US7] Opret én datakilde med otte tabeller, ti relationer og felttyperne efter `docs/tableau-guide.md`, og gem den i `tableau/kong-arthur.twbx` (afhænger af T043, T044 og T047) (**erstatter T009**).
- [ ] T049 Byg arkene i `tableau/kong-arthur.twbx` efter `docs/tableau-guide.md` (afhænger af T048) (**erstatter T012, T013, T014, T017, T020, T023, T024, T027 og T030 samt 003 T042**):
  - Nøgletalsfliser (FR-006, FR-007, FT5, FT6, FT10, FT11, FT13) og Kundetilfredshed (003 FT12) fra Nøgletal.
  - Belægning pr. måned (FR-001, FT5), Indtjening pr. værelsestype × sæson (FR-003, FT7), Indtjening pr. land og pr. værelsestype (FR-004, FR-005, FT8, FT9) og Gæster og bookinger pr. land (FR-002, FT6).
  - Baromsætning pr. drink (FR-009, FT14), Cocktails vs. kaffe (FR-010, FT15) og Data opdateret (FR-016).
- [ ] T050 [US7] Saml arkene på ét dashboard i `tableau/kong-arthur.twbx` med filtrene, Use as Filter og filterhandlingerne efter filtermatrixen i `specs/002-bi-dashboard/data-model.md` og teksten om nøgletalsfliserne, og gem filen som packaged workbook (afhænger af T049) (**erstatter T032**).
- [ ] T051 Gennemgå `specs/002-bi-dashboard/quickstart.md` Del 1–3 fra en tom maskine (T1–T10, F1–F6, SC-001–SC-007 og edge casen). Notér de faktiske tal og byggetiden, erstat hvert "verificeres i Tableau" med den faktiske fremgangsmåde i `specs/002-bi-dashboard/quickstart.md`, `specs/002-bi-dashboard/research.md` og `docs/tableau-guide.md`, og notér afvigelser som nye tasks (afhænger af T050) (**erstatter T031 og T035**).

### Afslutning

- [ ] T052 Kør `/speckit-analyze` og `/speckit-converge` for 002, og gem resultatet i `specs/002-bi-dashboard/converge.md` med de erstattede tasks markeret som erstattet (KB-D4) (afhænger af T051) (**erstatter T036**).

### Phase 10: afhængigheder

```text
T037 (tests, ses fejle) ─┐
T038 → T039 ─────────────┼─ T040 → T041 → T042 → T043 ─┐
T044, T045 (parallelt med backend) ─────────────────────┼─ T048 → T049 → T050 → T051 → T052
T047 ───────────────────────────────────────────────────┘
```

- T039–T042 committes samlet med T037 og T043 (kontrakt og kode i samme commit, constitution II).
- T044 bygger på felterne i contracts/README.md og kan skrives, mens backend laves. Tal og
  skærmbilleder tjekkes i T051.
- Én person ad gangen redigerer `tableau/kong-arthur.twbx` (T048–T050).
