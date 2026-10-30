# Converge: 002-bi-dashboard

**Dato**: 2026-10-30 · **Task**: T052 (efter stjerneskemaet) · **Krav**: KB-D4

> Denne kørsel **erstatter** den foreløbige kørsel (T036) og dens note "Forældet 2026-10-30".
> Den gamle kørsel byggede på fem datakilder og 67 tests.

Koden og dokumentationen er sammenholdt med `spec.md`, `plan.md`, `tasks.md` og constitution
v1.2.1. Udgangspunktet var den nuværende kode, ikke afkrydsningerne i `tasks.md`. Grundlaget er
dette:

- `docker compose exec -T backend npm test` giver `ℹ tests 106 · ℹ pass 106 · ℹ fail 0`. Heraf
  er 18 tests i `analyticsService.test.js` og 10 FT16/FT17-tests i `api.test.js`.
- Alle ni URL'er under `/api/analytics` er kaldt med `curl` og
  `Authorization: Bearer <BI_API_KEY fra .env>` mod seed-data:

  | URL | Status | Rækker | Felter | Tid |
  |---|---|---|---|---|
  | `/api/analytics` | 200 | 8 | `table`, `path` (de fem fakta og de tre dimensioner) | 0,02 s |
  | `/room-nights` | 200 | 117.806 | `bookingId`, `date`, `roomType`, `countryCode`, `revenue` | 0,28 s |
  | `/occupancy` | 200 | 8.760 | `date`, `roomType`, `availableRoomNights`, `soldRoomNights`, `occupancyRate` | 0,19 s |
  | `/bookings` | 200 | 21.570 | `bookingId`, `checkIn`, `checkOut`, `roomType`, `countryCode`, `guestCount`, `nights`, `revenue`, `satisfactionScore` | 0,05 s |
  | `/bar-sales` | 200 | 132.698 | `saleId`, `date`, `drink`, `category`, `quantity`, `revenue` | 0,21 s |
  | `/kpis` | 200 | 33 (3 år × 11) | `year`, `kpi`, `label`, `dimension`, `value`, `unit`, `generatedAt` | 0,32 s |
  | `/calendar` | 200 | 1.095 | `date`, `year`, `month`, `season` | 0,12 s |
  | `/room-types` | 200 | 8 (214 værelser i alt) | `roomType`, `capacity`, `rooms` | 0,00 s |
  | `/countries` | 200 | 20 (sorteret efter navn) | `countryCode`, `country` | 0,00 s |

- Ingen faktatabel har `year`, `month`, `season` eller `country`.
- Kalenderen går fra 2025-01-01 til 2027-12-31. `/kpis` har præcis de samme år (2025, 2026 og
  2027), og de er hele kalenderår. Alle 117.806 nætter, 8.760 belægningsdage, 21.570 ankomster
  og 132.698 salgsdatoer findes i kalenderen. Alle `roomType` og `countryCode` i fakta findes i
  dimensionerne.
- Værelsesnætternes `revenue` summerer præcis til bookingernes `total_price`
  (193.196.934,00 kr.), og det samme gælder summen af `roomRevenue` over de tre år. Pr. år er
  SUM(`revenue`) for nætterne lig `roomRevenue`, og SUM(sold) ÷ SUM(available) er lig
  `occupancyRate` (2025: 70,47 %, 2026: 70,56 %).
- 2025 matcher SQL: 10.159 bookinger, 15.299 gæster, barsalg 13.448.640,34 kr. og
  kundetilfredshed 4,15 af 8.049 besvarelser. Cocktail 52,83 % + Kaffe 47,17 % = 1. 2027 har
  intet barsalg og viser 0, ikke `null`.
- Uden nøgle, med forkert Bearer-nøgle og med bookingsystemets `X-API-Key` giver alle ni URL'er
  `401`. BI-nøglen på `GET /api/bookings` giver `401`. `POST`, `PUT` og `DELETE` på `/kpis` giver
  `405`, og `?year=2025` giver `400` (ingen query-parametre).

**Tableau-workbooken er ikke bygget.** Mappen `tableau/` findes ikke. Alt, der kun kan ses i
Tableau, er derfor ⏳ og venter på de åbne, manuelle tasks T047–T051.

## Krav → implementering

| Krav | Status | Hvor |
|---|---|---|
| FR-001 Belægningsgrad (FT5) | ✅ API · ⏳ Tableau | `analyticsService.js` (`occupancyRows`, KPI `occupancyRate`), `/analytics/occupancy`. Arket mangler (T049) |
| FR-002 Bookinger og gæster pr. land (FT6) | ✅ API · ⏳ Tableau | `/analytics/bookings` → Lande og Kalender via `checkIn`. KPI `bookings`/`guests` i ankomståret. Arket mangler (T049) |
| FR-003 Indtjening pr. type × sæson (FT7) | ✅ API · ⏳ Tableau | `/analytics/room-nights` (`date` → Kalender.`season`, `roomType`). Arket mangler (T049) |
| FR-004/005 Indtjening og rangering pr. land og type (FT8, FT9) | ✅ API · ⏳ Tableau | `/analytics/room-nights` → Lande og Værelsestyper. Arkene mangler (T049) |
| FR-006 Årets indtjening (FT10) | ✅ API · ⏳ Tableau | KPI `roomRevenue` pr. nattens år. Flisen mangler (T049) |
| FR-007 Gns. pris pr. nat og opholdslængde (FT11) | ✅ API · ⏳ Tableau | KPI `avgPricePerNight`, `avgStayLength`. Fliserne mangler (T049) |
| FR-008–010 Barsalg, pr. drink, kategoriandele (FT13–FT15) | ✅ API · ⏳ Tableau | `/analytics/bar-sales`, KPI `barRevenue` og `barRevenueShare` (kategorier fra `drink_categories`). Arkene mangler (T049) |
| FR-011 Formler kun i backend (KB-A4) | ✅ | Alle formler, kalenderen og dimensionerne afledes i `analyticsService.js`. `docs/tableau-guide.md` § 0 tillader kun ét beregnet felt (belægning for et udsnit, constitution III v1.2.1) og forbyder `AVG(occupancyRate)`, egne gennemsnit og "Percent of Total" |
| FR-012 Interaktivitet via fælles dimensioner (FT16) | ✅ API · ⏳ Tableau | Fakta har kun nøgler til Kalender, Værelsestyper og Lande. Filtermatrixen står i `data-model.md` og guiden § 6.2–6.3. Dashboard, filtre og filterhandlinger mangler (T050) |
| FR-013 Data via API, én workbook med én datakilde (FT4, KB-A5) | ✅ API · ❌ workbook | `GET /api/analytics` lister otte tabeller til connectoren. `tableau/kong-arthur.twbx` findes ikke (T047, T048, T050) |
| FR-014 Skrivebeskyttet (FT17) | ✅ | `allowBiKey` i `backend/src/auth.js` (fejler lukket under 32 tegn), kun `GET`-routes i `routes/analytics.js`. 7 FT17-tests i `api.test.js`, inkl. dimensionerne. Curl: 401 og 405 som ovenfor |
| FR-015 Indtjening fordelt pr. nat | ✅ | `allocateRevenue` med `eachNight`/`periodOn` fra `pricing.js`. Nattens `date` giver sæson, måned og år via Kalender. Tests for sæsonskifte, årsskifte og ligelig deling. Totalen stemmer på øren |
| FR-016 Seneste opdatering | ✅ API · ⏳ Tableau | `generatedAt` (ens på alle rækker) på `/analytics/kpis`. Arket mangler (T049). Se afvigelse 5 om UTC |
| FR-017 Kalender, værelsestyper og lande uden nye tabeller | ✅ | `calendar()`, `roomTypes()` og `countries()` i `analyticsService.js`. Én fælles `calendarYears`. `listRoomTypes` (`LEFT JOIN`, 0 værelser) og `listCountries` genbrugt fra `referenceRepository.js`. Tests: hele år, `season` `null` uden periode, en type uden værelser og lande uden bookinger |
| FR-018 Nøgletal for hvert kalenderår | ✅ | `kpis()` bruger `calendarYears`. Test med et år uden data (0, aldrig `NaN`). Curl: samme tre år i `/calendar` og `/kpis` |
| US1–US5 (acceptkriterier) | ✅ API · ⏳ Tableau | Tallene er verificeret med tests, curl og SQL. Visningen venter på T049–T051 |
| US6 Aktuelle data og læseadgang | ✅ API · ⏳ Tableau | Data afledes ved hvert kald (research R6). SC-004 (Refresh All Extracts) og edge casen "API'et er nede" kræver workbooken (T051) |
| US7 Filtre, der betyder det samme overalt | ✅ API · ⏳ Tableau | Sc. 1 og 5 er klar i API'et (år i Kalender og Nøgletal, alle typer og lande i dimensionerne). Sc. 2–4 afhænger af filtre og handlinger i workbooken (T050, quickstart F1–F6 i T051) |
| SC-001 Tal matcher manuel beregning | ✅ API | 18 håndregnede tests i `analyticsService.test.js` og krydstjekket mod SQL ovenfor. Tableau-delen (T1–T10) mangler (T051) |
| SC-002–SC-007 | ⏳ | Måles i Tableau (T051). SC-005 er opfyldt i API'et (kun `GET`, nøglen virker ingen andre steder) |
| Edge cases | ✅ API | `data-model.md` § Edge cases. Tomme år giver 0, datoer uden periode har `season` `null`, og belægning og barsalg har intet land. "API'et er utilgængeligt" kræver workbooken (T051) |
| Constitution I–VI | ✅ | I: route → service → repository, SQL kun i `analyticsRepository.js`/`referenceRepository.js`. II: `openapi.yaml` ændret i samme commit som koden (`424a86d`). III: se FR-011. IV: ingen nye containere eller tabeller. V: `npm test` 106/106. VI: ingen nye pakker, ingen ny SQL til kalenderen |

### Erstattede tasks

Stjerneskemaet erstatter de åbne Tableau-tasks fra før 2026-10-30. De står uændret i
`tasks.md` som historik og udføres **ikke**, medmindre gruppen ikke kan få Tableau 2024.2.1+
(plan.md § Ændring 2026-10-30).

| Gammel task | Erstattet af |
|---|---|
| T003 (connector, Tableau 2023.3+) | T047 |
| T009 (fem datakilder) | T048 |
| T012, T013, T014, T017, T020, T023, T024, T027, T030 (arkene) | T049 |
| T032 (dashboard med "All Using Related Data Sources") | T050 |
| T031, T035 (opdateringstjek og quickstart) | T051 |
| T036 (converge) | T052 (denne kørsel) |
| **003** T042 (arket Kundetilfredshed) | **002** T049. 003's `tasks.md` er ikke ændret. Afkryds 003 T042, når 002 T049 er færdig |

## Afvigelser (bevidste og dokumenterede)

1. **Belægning for et udsnit beregnes i Tableau** som `SUM(soldRoomNights) / SUM(availableRoomNights)`.
   Constitution III v1.2.1 tillader det, og valget står i `plan.md` § Complexity Tracking.
2. **Testnavne bruger kravboardets FT-ID'er**, fordi spec 002's `FR-0xx` kolliderer med 001's.
3. **Kategoriandelene er almindelig division.** De summerer til 1 på seed-data (2025 og 2026)
   og i testen med tre lige store kategorier, men den sidste kategori tvinges ikke til
   `1 − resten`.
4. **Uverificerede Tableau-trin.** `docs/tableau-guide.md` markerer UI-detaljer med "(tjek i
   jeres Tableau-version)": JSONPath, tabelkonfigurationen i connectoren, placeringen af
   Performance Options, filtre på dashboardet, standardmål for "Use as Filter", visning af UTC,
   gem af extract, Bearer-token i `.twbx` og timeout. Research og quickstart markerer de samme
   som "verificeres i Tableau". De afklares i T051, som skal skrive svarene ind i guiden.
5. **`generatedAt` er UTC** (`…Z`), mens quickstart T9 skriver "lokal tid". Det er ikke en
   mangel: FR-016 kræver kun tidspunktet for seneste opdatering, og guiden § 5.9 skriver
   "(UTC)" på arket, hvis Tableau ikke selv omregner. T051 retter T9 til det, Tableau faktisk
   viser. Backend ændres ikke.
6. **Tests blev committet lige efter koden** (`1cfdd17` efter `424a86d`) og ikke i samme
   commit, som noten under Phase 10 foreslår. Kontrakten og koden ligger i samme commit, så
   constitution II er opfyldt.

## Mangler

Converge fandt ingen nye mangler, så der er **ikke** tilføjet en Convergence-fase til
`tasks.md`. Det resterende arbejde er de åbne, manuelle tasks for gruppen:

- **T047**: Installér REST API Connector i Tableau Desktop 2024.2.1+, og opret `tableau/`.
- **T048**: Én datakilde med otte tabeller, ti relationer og felttyperne.
- **T049**: Arkene, inkl. Kundetilfredshed (erstatter også 003 T042).
- **T050**: Dashboardet med filtre, Use as Filter og filterhandlinger efter filtermatrixen.
- **T051**: Gennemgå quickstart Del 1–3 fra en tom maskine, notér tal og byggetid (SC-007), og
  erstat hvert "verificeres i Tableau"/"(tjek i jeres Tableau-version)" med det, der virker.
- **T052**: Denne kørsel er lavet før T047–T051. Opdatér tabellen ovenfor (⏳ → ✅), når
  workbooken er bygget, og afkryds så T052.

## Analyze

`/speckit-analyze` (kun læsning) fandt ingen CRITICAL eller HIGH. Alle 18 FR og de 7 SC har
mindst én task, og alle tasks i Phase 10 kan spores til et krav, US7 eller en erstattet task.

| ID | Alvor | Fund | Anbefaling |
|---|---|---|---|
| A1 | LOW | `plan.md` Performance Goals (ca. 32.000 værelsesnætter, 4.400 belægningsdage, 20.000 barsalg) og research R3 (ca. 40.000 nætter, 10.400 bookinger) er under de faktiske 117.806, 8.760, 132.698 og 21.570. Målet holder stadig (alle endpoints under 0,35 s) | Ret tallene, næste gang plan og research ændres |
| A2 | LOW | Quickstart T9 forventer "lokal tid", guiden § 5.9 tillader UTC (afvigelse 5) | Afklares i T051 |
| A3 | LOW | Spec Key Entity "Nøgletal" nævner dimensionerne sæson, måned, type, land og drink. Efter 2026-10-30 er nøgletal kun pr. år (og kategori for andelene) | Ret ordlyden, næste gang spec ændres |
| A4 | LOW | `plan.md` siger "8 endpoints". Med forbindelsestesten `GET /analytics` er der ni `GET`-stier | Kun ordlyd |
| A5 | LOW | 003 `tasks.md` T042 står stadig åben, selv om 002 T049 erstatter den | Afkryds 003 T042 sammen med 002 T049 |

Disse beslutninger er stadig markeret *(foreslået af AI, afventer gruppen)*: hele kalenderår
(FR-017, R10), nøgletal for hvert kalenderår (FR-018), ét år ad gangen, felterne flyttet til
dimensionerne (R11) og standard-Performance Options på alle relationer (R8). Gruppen skal
bekræfte dem før fremlæggelsen (KB-D8).
