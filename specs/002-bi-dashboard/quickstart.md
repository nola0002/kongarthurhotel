# Quickstart: validering af BI-dashboardet (002)

Formålet er at bevise, at featuren virker fra ende til anden: API'et leverer de rigtige tal,
og Tableau-dashboardet viser dem uden at kunne ændre data. Kontrakten står i
[`backend/openapi.yaml`](../../backend/openapi.yaml) (oversigt i
[`contracts/README.md`](contracts/README.md)), og de afledte entiteter står i
[`data-model.md`](data-model.md).

## Forudsætninger

- Systemet kører som beskrevet i [README § Kom i gang](../../README.md#kom-i-gang). Start fra
  en tom maskine:

  ```bash
  docker compose down -v && cp .env.example .env && docker compose up --build
  ```

- `.env` indeholder `BI_API_KEY` på mindst 32 tegn (placeholder i `.env.example`).
- Tableau Desktop 2023.3 eller nyere (research R1).

Hent nøglen ind i shellen én gang:

```bash
BI_API_KEY=$(grep '^BI_API_KEY=' .env | cut -d= -f2)
```

## Del 1: API'et med curl

| # | Kald | Forventet resultat | Krav |
|---|---|---|---|
| 1 | `curl -s -H "Authorization: Bearer $BI_API_KEY" http://localhost:3000/api/analytics/kpis` | `200` og en JSON-array. Der er rækker for hvert år med data (`occupancyRate`, `roomRevenue`, `avgPricePerNight`, `avgStayLength`, `bookings`, `guests`, `barRevenue` og én `barRevenueShare` pr. drinkkategori). Alle har samme `generatedAt` | FR-011, FR-016 |
| 2 | Samme kald mod `/room-nights`, `/occupancy`, `/bookings` og `/bar-sales` | `200` og en JSON-array af flade objekter med felterne fra kontrakten. Datoer er `YYYY-MM-DD`, og `year`/`month` er heltal | FR-013 |
| 3 | `/kpis` igen: læg `barRevenueShare`-værdierne for ét år sammen | Summen er præcis 1 | FR-010 |
| 4 | Uden `Authorization`-header | `401` med `{ "error": { "code": "UNAUTHORIZED", … } }` | FR-014 |
| 5 | Med `Authorization: Bearer forkert-nøgle` | `401` | FR-014 |
| 6 | `GET /api/bookings` med BI-nøglen som Bearer | `401`. Nøglen gælder kun `/api/analytics` | FR-014, FT17 |
| 7 | `/api/analytics/kpis` med bookingsystemets `X-API-Key` | `401` | FR-014 |
| 8 | `curl -X POST` mod et `/api/analytics`-endpoint med BI-nøglen | En 4xx-fejl. Der findes ingen skrivende endpoints under `/analytics` | FR-014, SC-005 |
| 9 | Log ind i back office, åbn http://localhost:5173/docs og kør `GET /analytics/kpis` med "Try it out" | `200`. Session-cookien accepteres også | KB-A3 |

Eksempel på scenarie 4 og 6:

```bash
curl -i http://localhost:3000/api/analytics/kpis
curl -i -H "Authorization: Bearer $BI_API_KEY" http://localhost:3000/api/bookings
```

### Krydstjek af fordelingen (FR-015)

Summen af alle værelsesnætters `revenue` skal være lig summen af alle bookingers
`total_price`. Fordelingen må ikke tabe eller opfinde en øre:

```bash
docker compose exec db sh -c 'mysql -N -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" \
  -e "SELECT SUM(total_price) FROM bookings"'
```

Sammenlign med SUM(revenue) over hele datakilden "Værelsesnætter" i Tableau (del 2) eller med
summen af `roomRevenue` for alle år i `/kpis`. Opslaget direkte i databasen er kun et
udviklertjek. Dashboardet bruger aldrig databasen (FR-013).

## Del 2: Tableau

Skridtene, der er markeret **verificeres i Tableau**, er ikke bekræftet i Tableaus
dokumentation (research R1, R3). Notér den faktiske fremgangsmåde her, når den er afprøvet.

### Forbind

1. Installér **REST API Connector** fra
   [Tableau Exchange](https://exchange.tableau.com/products/1111) efter vejledningen på siden.
   Det er en JDBC-driver (`.jar`), der lægges i Tableaus `Drivers`-mappe, fx
   `~/Library/Tableau/Drivers` på macOS eller `C:\Program Files\Tableau\Drivers` på Windows.
   Genstart derefter Tableau Desktop.
2. Connect → To a Server → **REST API**. Opret én datakilde pr. endpoint:

   | Datakilde i Tableau | URL |
   |---|---|
   | Nøgletal | `http://localhost:3000/api/analytics/kpis` |
   | Værelsesnætter | `http://localhost:3000/api/analytics/room-nights` |
   | Belægning | `http://localhost:3000/api/analytics/occupancy` |
   | Bookinger | `http://localhost:3000/api/analytics/bookings` |
   | Barsalg | `http://localhost:3000/api/analytics/bar-sales` |

   - Server-URL'en kan være `http://localhost:3000/api/analytics/`. Connectoren tester den
     ved forbindelse, og backend svarer med listen over tabellerne ovenfor. Før `GET
     /api/analytics` fandtes, gav det `HTTP error (404) … Unable to connect to the REST API
     server` (verificeret 2026-10-30, connector 1.0.1).
   - Autentificering: **Bearer token** med værdien af `BI_API_KEY`.
   - JSONPath til posterne: arrayen på øverste niveau, fx `$[*]` (**verificeres i Tableau**).
3. Ret felttyperne på datakildesiden: `date`, `checkIn` og `checkOut` som Date, `year` og
   `month` som diskrete dimensioner, `countryCode` med den geografiske rolle Country/Region
   (**verificeres i Tableau**: at ISO-koder på to bogstaver genkendes) og `generatedAt` som
   Date & Time.
4. Connectoren er extract-only. Data hentes igen med **Data → Refresh All Extracts**.

### Byg arkene

Arkene må kun summere, tælle, filtrere og sortere (FR-011). Den eneste division er belægning
for et udsnit (ark 2, research R4).

| # | Ark | Datakilde | Opbygning | Krav |
|---|---|---|---|---|
| 1 | Nøgletalsfliser | Nøgletal | Én flise pr. `kpi` med `dimension` tom: `value` formateret efter `unit` og `label` som titel | FT5, FT6, FT10, FT11, FT13 |
| 2 | Belægning pr. måned | Belægning | `year` og `month` på kolonner. Beregnet felt `SUM([soldRoomNights]) / SUM([availableRoomNights])` som procent. **Ikke** AVG(`occupancyRate`) | FR-001, FT5 |
| 3 | Indtjening pr. værelsestype × sæson | Værelsesnætter | `roomType` på rækker, `season` på kolonner, SUM(`revenue`) som tekst eller heatmap | FR-003, FT7 |
| 4 | Indtjening pr. land og topliste | Værelsesnætter | `country` sorteret faldende efter SUM(`revenue`) med Top 10-filter. Et tilsvarende ark for `roomType` | FR-004, FR-005, FT8, FT9 |
| 5 | Gæster og bookinger pr. land | Bookinger | Kort eller søjler pr. `countryCode`/`country` med antal `bookingId` og SUM(`guestCount`) | FR-002, FT6 |
| 6 | Baromsætning pr. drink | Barsalg | `drink` sorteret faldende efter SUM(`revenue`), farvet efter `category`. Antal (SUM(`quantity`)) som tooltip | FR-009, FT14 |
| 7 | Cocktails vs. kaffe | Nøgletal | `kpi = barRevenueShare`, `dimension` som farve og `value` som procent | FR-010, FT15 |
| 8 | Data opdateret | Nøgletal | MAX(`generatedAt`) som tekst, fx "Data opdateret 30.10.2026 14:05" | FR-016 |

### Saml dashboardet

1. Læg arkene på ét dashboard (SC-003).
2. Tilføj filtre på `year` (standard: indeværende år), `season`, `roomType` og `country`, og
   anvend dem på alle ark, der har feltet. Brug "Apply to Worksheets → All Using Related Data
   Sources", så samme filter virker på tværs af datakilder. De fælles feltnavne skal kobles
   som relationer (**verificeres i Tableau**).
3. Slå **Use as Filter** til på ark 3, 4 og 5, så et klik på et land eller en værelsestype
   filtrerer de øvrige ark (FR-012, FT16, US3 scenarie 2).
4. Skriv i en lille tekst på dashboardet, at nøgletalsfliserne og cocktail/kaffe-andelen er
   pr. kalenderår og kun følger år-filteret. Barsalget har ingen sæson, værelsestype eller
   land.

## Del 3: Successkriterier

| # | Tjek | Forventet resultat | Krav |
|---|---|---|---|
| SC-001 | Kør `docker compose exec backend npm test`, og sammenlign krydstjekket ovenfor | Alle tests er grønne, inkl. `analyticsService.test.js` med håndregnede eksempler (fordeling, belægning, gennemsnit, andele). Summen af `revenue` er lig summen af `total_price` | FT5–FT15 |
| SC-002 | Bed en person, der ikke har bygget dashboardet, svare på "hvilken værelsestype og hvilket land tjente mest i år?" | Svaret er fundet på under 30 sekunder via ark 4 | FT9 |
| SC-003 | Gennemgå dashboardet | FT5–FT11 og FT13–FT15 er synlige på ét dashboard | FT16 |
| SC-004 | Opret en booking i back office (fx DE, Suite, i indeværende år) og registrér et barsalg. Kør **Data → Refresh All Extracts** | Bookingen indgår i indtjening, belægning og land, barsalget i barsalg, og "Data opdateret" viser det nye tidspunkt | FT4, FR-013, FR-016 |
| SC-005 | Del 1, scenarie 6–8, og gennemgå dashboardet | Ingen handling i dashboardet eller med BI-nøglen kan oprette, ændre eller slette data | FT17, FR-014 |
| Edge | Stop backend (`docker compose stop backend`) og kør Refresh All Extracts | Opdateringen fejler. Dashboardet viser stadig de seneste data og det gamle "Data opdateret"-tidspunkt (**verificeres i Tableau**) | Edge case, FR-016 |

## Automatiske tests

```bash
docker compose exec backend npm test
```

Testene af `analyticsService` bruger et falsk repository og kræver ingen database
(`docs/retningslinjer/tests.md`).
