# Quickstart: validering af BI-dashboardet (002)

Formålet er at bevise, at featuren virker fra ende til anden: API'et leverer de rigtige tal,
og Tableau-dashboardet viser dem uden at kunne ændre data. Kontrakten står i
[`backend/openapi.yaml`](../../backend/openapi.yaml) (oversigt i
[`contracts/README.md`](contracts/README.md)), og de afledte entiteter, relationerne og
filtermatrixen står i [`data-model.md`](data-model.md).

**Byggetrinene til workbooken står kun i [`docs/tableau-guide.md`](../../docs/tableau-guide.md).**
Denne fil tjekker resultatet og gentager ikke trinene.

## Forudsætninger

- Systemet kører som beskrevet i [README § Kom i gang](../../README.md#kom-i-gang). Start fra
  en tom maskine:

  ```bash
  docker compose down -v && cp .env.example .env && docker compose up --build
  ```

- `.env` indeholder `BI_API_KEY` på mindst 32 tegn (placeholder i `.env.example`).
- Tableau Desktop **2024.2.1 eller nyere** (research R9, før 2026-10-30: 2023.3+).

Hjælpere i shellen (samme som i [004 quickstart](../004-opgavedata/quickstart.md)):

```bash
sql() { docker compose exec -T db sh -c 'mysql -N --default-character-set=utf8mb4 -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" 2>/dev/null'; }
BI_API_KEY=$(grep '^BI_API_KEY=' .env | cut -d= -f2)
API=http://localhost:3000/api
bi() { curl -s -H "Authorization: Bearer $BI_API_KEY" "$API/analytics$1"; }
# One KPI for one year, e.g. kpi 2025 roomRevenue
kpi() { bi /kpis | tr '{' '\n' | grep "\"year\":$1," | grep "\"kpi\":\"$2\""; }
```

## Del 1: API'et med curl

| # | Kald | Forventet resultat | Krav |
|---|---|---|---|
| 1 | `bi /kpis` | `200` og en JSON-array. Der er rækker for **hvert år i `/analytics/calendar`** (`occupancyRate`, `roomRevenue`, `avgPricePerNight`, `avgStayLength`, `bookings`, `guests`, `customerSatisfaction`, `satisfactionResponses`, `barRevenue` og én `barRevenueShare` pr. drinkkategori). Alle har samme `generatedAt` | FR-011, FR-016, FR-018 |
| 2 | `bi /room-nights`, `/occupancy`, `/bookings` og `/bar-sales` | `200` og en JSON-array af flade objekter med felterne fra kontrakten. Datoer er `YYYY-MM-DD` | FR-013 |
| 3 | `/kpis` igen: læg `barRevenueShare`-værdierne for ét år sammen | Summen er præcis 1 | FR-010 |
| 4 | Uden `Authorization`-header | `401` med `{ "error": { "code": "UNAUTHORIZED", … } }` | FR-014 |
| 5 | Med `Authorization: Bearer forkert-nøgle` | `401` | FR-014 |
| 6 | `GET /api/bookings` med BI-nøglen som Bearer | `401`. Nøglen gælder kun `/api/analytics` | FR-014, FT17 |
| 7 | `/api/analytics/kpis` med bookingsystemets `X-API-Key` | `401` | FR-014 |
| 8 | `curl -X POST` mod et `/api/analytics`-endpoint med BI-nøglen | En 4xx-fejl. Der findes ingen skrivende endpoints under `/analytics` | FR-014, SC-005 |
| 9 | Log ind i back office, åbn http://localhost:5173/docs og kør `GET /analytics/kpis` med "Try it out" | `200`. Session-cookien accepteres også | KB-A3 |
| 10 | `bi "" \| grep -o '"table"' \| wc -l` | `8`: de fem fakta og `calendar`, `room-types` og `countries`, hver med `table` og `path` | FR-013 |
| 11 | `bi /calendar \| grep -o '"date"' \| wc -l` og `bi /calendar \| grep -o '"year":[0-9]*' \| sort -u` | Én række pr. dato i hele år. Med seed: 2025, 2026 og 2027 og 1095 rækker. `season` er `Lavsæson`, `Mellemsæson`, `Højsæson` eller `null` | FR-017 |
| 12 | `bi /room-types` | 8 rækker med `roomType`, `capacity` og `rooms`. Summen af `rooms` er 214 | FR-017 |
| 13 | `bi /countries \| grep -o '"countryCode"' \| wc -l` | `20`, også lande uden bookinger | FR-017 |
| 14 | `for t in room-nights occupancy bookings bar-sales; do bi /$t \| grep -cE '"(year\|month\|season\|country)":'; done` | `0` fire gange. De fjernede felter findes kun i dimensionerne (`countryCode` er stadig der) | FR-012, research R11 |
| 15 | `bi /kpis \| grep -o '"year":[0-9]*' \| sort -u` | De samme år som i scenarie 11 | FR-018 |
| 16 | Scenarie 4 mod `/calendar`, `/room-types` og `/countries` | `401` | FR-014 |

Eksempel på scenarie 4 og 6:

```bash
curl -i $API/analytics/kpis
curl -i -H "Authorization: Bearer $BI_API_KEY" $API/bookings
```

### Krydstjek af fordelingen (FR-015)

Summen af alle værelsesnætters `revenue` skal være lig summen af alle bookingers
`total_price`. Fordelingen må ikke tabe eller opfinde en øre:

```bash
echo "SELECT SUM(total_price) FROM bookings" | sql
```

Sammenlign med summen af `roomRevenue` for alle år i `/kpis` eller med SUM(`revenue`) på
tabellen Værelsesnætter i Tableau uden filtre (Del 2). Opslaget direkte i databasen er kun et
udviklertjek. Dashboardet bruger aldrig databasen (FR-013).

## Del 2: Verifikation af workbooken

Byg `tableau/kong-arthur.twbx` efter [`docs/tableau-guide.md`](../../docs/tableau-guide.md),
kør **Data → Refresh All Extracts**, og tjek derefter dashboardet. Hvert tal skal være **ens**
med kilden i højre kolonne. En afvigelse betyder en forkert relation, felttype eller
filteropsætning, ikke en ny formel i Tableau (FR-011).

### Tal (år-filter 2025, ingen andre filtre)

| # | I workbooken | Skal være lig | Forventet med seed | Krav |
|---|---|---|---|---|
| T1 | Flisen Værelsesindtjening | `kpi 2025 roomRevenue` | – (notér) | FR-006, FT10 |
| T2 | SUM(`revenue`) på Værelsesnætter (fx totalen i "Indtjening pr. værelsestype × sæson") | T1 | Samme som T1 | FR-003, FR-015 |
| T3 | Flisen Belægningsgrad og "Belægning pr. måned" for hele året (`SUM(soldRoomNights) / SUM(availableRoomNights)`) | `kpi 2025 occupancyRate` | ca. 70,5 % | FR-001, FT5 |
| T4 | Fliserne Bookinger og Gæster og totalen i "Gæster og bookinger pr. land" | `kpi 2025 bookings`/`guests` og `echo "SELECT COUNT(*), SUM(guest_count) FROM bookings WHERE YEAR(check_in) = 2025" \| sql` | – (notér) | FR-002, FT6 |
| T5 | Flisen Kundetilfredshed og antal besvarelser | `kpi 2025 customerSatisfaction`/`satisfactionResponses` og `echo "SELECT ROUND(AVG(satisfaction_score), 2), COUNT(satisfaction_score) FROM bookings WHERE YEAR(check_out) = 2025" \| sql` | ca. 4,15 | 003 FR-014, FT12 |
| T6 | Flisen Barsalg og SUM(`revenue`) i "Baromsætning pr. drink" | `kpi 2025 barRevenue` og `echo "SELECT SUM(quantity * unit_price) FROM bar_sales WHERE YEAR(sold_at) = 2025" \| sql` | **13.448.640,34 kr.** | FR-008, FR-009, FT13, FT14 |
| T7 | "Cocktails vs. kaffe" | `kpi 2025 barRevenueShare` | Cocktail ca. 52,8 %, Kaffe ca. 47,2 %, i alt 100 % | FR-010, FT15 |
| T8 | Fliserne Gns. pris pr. nat og Gns. opholdslængde | `kpi 2025 avgPricePerNight`/`avgStayLength` | – (notér) | FR-007, FT11 |
| T9 | "Data opdateret" | `generatedAt` fra seneste `bi /kpis` (lokal tid) | – | FR-016 |
| T10 | Skift år-filteret til 2026 | T1, T3–T8 er lig `kpi 2026 …`. Vælg 2027: fliserne viser tal eller 0, aldrig tomme | Belægning 2026 ca. 70,6 % | FR-018, US7 sc. 1 |

### Filtre (filtermatrixen i [data-model.md](data-model.md#filtermatrix))

Udgangspunkt: år 2025 og ingen andre filtre. Notér tallene i fliserne, i belægningen og i
barsalget, og vælg derefter ét filter ad gangen.

| # | Vælg | Ændres | Må **ikke** ændres | Krav |
|---|---|---|---|---|
| F1 | Land = Tyskland (filter **og** klik i et landeark med "Use as Filter") | Indtjening pr. land/type × sæson, gæster og bookinger pr. land | Belægning, barsalg, cocktail/kaffe og alle nøgletalsfliser | FR-012, US3 sc. 2, US7 sc. 3, SC-006 |
| F2 | Værelsestype = Suite (filter og klik) | Indtjening, belægning og bookinger | Barsalg, cocktail/kaffe og alle nøgletalsfliser | FR-012, US7 sc. 4 |
| F3 | Sæson = Højsæson | Indtjening og belægning (kun højsæsonnætter), bookinger (ankomst i højsæson) og barsalg (salg i højsæson) | Nøgletalsfliserne | FR-012, US2 sc. 2, US7 sc. 2 |
| F4 | Måned = juli | Som F3, kun for juli | Nøgletalsfliserne | FR-012 |
| F5 | Ingen. Åbn listerne i filtrene for værelsestype og land | Alle 8 værelsestyper og alle 20 lande står i listerne | – | FR-017, US7 sc. 5 |
| F6 | Sæson = Højsæson | Baromsætningen i arket = `echo "SELECT SUM(s.quantity * s.unit_price) FROM bar_sales s JOIN season_periods p ON DATE(s.sold_at) BETWEEN p.start_date AND p.end_date JOIN seasons x ON x.id = p.season_id WHERE YEAR(s.sold_at) = 2025 AND x.name = 'Højsæson'" \| sql` | – | FR-012, SC-006 |

Teksten om, at nøgletalsfliserne og cocktail/kaffe-andelen kun følger år-filteret, står på
dashboardet (spec Edge Cases).

## Del 3: Successkriterier

| # | Tjek | Forventet resultat | Krav |
|---|---|---|---|
| SC-001 | Kør `docker compose exec backend npm test`, og sammenlign krydstjekket ovenfor | Alle tests er grønne, inkl. `analyticsService.test.js` med håndregnede eksempler (fordeling, belægning, gennemsnit, andele, kalender). Summen af `revenue` er lig summen af `total_price` | FT5–FT15 |
| SC-002 | Bed en person, der ikke har bygget dashboardet, svare på "hvilken værelsestype og hvilket land tjente mest i år?" | Svaret er fundet på under 30 sekunder via toplisterne | FT9 |
| SC-003 | Gennemgå dashboardet | FT5–FT11 og FT13–FT15 (og FT12 fra 003) er synlige på ét dashboard | FT16 |
| SC-004 | Opret en booking i back office (fx DE, Suite, i indeværende år) og registrér et barsalg. Kør **Data → Refresh All Extracts** | Bookingen indgår i indtjening, belægning og land, barsalget i barsalg, og "Data opdateret" viser det nye tidspunkt | FT4, FR-013, FR-016 |
| SC-005 | Del 1, scenarie 6–8, og gennemgå dashboardet | Ingen handling i dashboardet eller med BI-nøglen kan oprette, ændre eller slette data | FT17, FR-014 |
| SC-006 | Del 2, F1–F6 | Et land ændrer 0 tal i belægning, barsalg og fliser. År, måned og sæson giver samme tal som kilden | FR-012 |
| SC-007 | Tjek `tableau/`, og notér byggetiden efter guiden | Én fil `tableau/kong-arthur.twbx` med én datakilde (8 tabeller). Bygget på højst 2 timer | FR-013 |
| Edge | Stop backend (`docker compose stop backend`) og kør Refresh All Extracts | Opdateringen fejler. Dashboardet viser stadig de seneste data og det gamle "Data opdateret"-tidspunkt (**verificeres i Tableau**) | Edge case, FR-016 |

## Automatiske tests

```bash
docker compose exec backend npm test
```

Testene af `analyticsService` bruger et falsk repository og kræver ingen database
(`docs/retningslinjer/tests.md`).
