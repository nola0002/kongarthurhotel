# Tableau-guide: byg ledelsesdashboardet

Trin-for-trin-vejledning til `tableau/kong-arthur.twbx` (feature
[002](../specs/002-bi-dashboard/spec.md)). Guiden fortæller, *hvordan* I bygger workbooken.
*Hvad* den skal vise, og *hvorfor*, står i spec, data-model og research. Guiden gentager ikke
deres indhold, men henviser til dem:

| Sandhed | Hvor |
|---|---|
| Krav (FR-001–FR-018, US7) | [`spec.md`](../specs/002-bi-dashboard/spec.md) |
| Tabeller, nøgler, relationer og filtermatrix | [`data-model.md` § Stjerneskema](../specs/002-bi-dashboard/data-model.md#stjerneskema-ændring-2026-10-30) |
| Endpoints og felter | [`contracts/README.md`](../specs/002-bi-dashboard/contracts/README.md) og [`backend/openapi.yaml`](../backend/openapi.yaml) |
| Connector, nøgle, version og begrundelser | [`research.md`](../specs/002-bi-dashboard/research.md) R1, R2, R7–R11 |
| Kundetilfredshed (FT12) | [003 `data-model.md` § Nøgletal](../specs/003-receptionsoverblik/data-model.md#afledt-nøgletal-udvidelse-af-002) |
| Tjek af tallene | [`quickstart.md`](../specs/002-bi-dashboard/quickstart.md) |

Menustier er tjekket mod Tableaus dokumentation den 2026-10-30 (links i teksten). Det, vi ikke
har kunnet bekræfte, er markeret **(tjek i jeres Tableau-version)**. Det svarer til
"verificeres i Tableau" i research og quickstart. Skriv det, I finder ud af, ind her, så næste
person ikke skal gætte.

## 0. Formål og hvad I ender med

Når I er færdige, har I:

- **Én fil**, `tableau/kong-arthur.twbx`, med extractet indbygget (SC-007).
- **Én datakilde** med 8 tabeller fra REST API'et: 3 dimensioner og 5 fakta i et stjerneskema
  (FR-013, research R8).
- **Ét dashboard** med alle Must-krav FT5–FT15 og kundetilfredshed (FT12), filtre på år, måned,
  sæson, værelsestype og land, og klik på et land eller en værelsestype, der filtrerer de andre
  visninger (FR-012, FT16).

Regn med 1–2 timer. Én person ad gangen redigerer workbooken, fordi en `.twbx` ikke kan flettes
i git.

### Hvad Tableau må regne (constitution III, FR-011)

Alle nøgletal beregnes i backend (`analyticsService.js`). Tableau må kun **summere, tælle,
filtrere, sortere** og **dividere to summer, som backend selv har beregnet**. I hele workbooken
er der derfor ét beregnet felt:

| Beregnet felt | Formel | Hvorfor det er tilladt |
|---|---|---|
| `Belægningsgrad` | `SUM([soldRoomNights]) / SUM([availableRoomNights])` | FR-001 kræver belægning for et vilkårligt udsnit (sæson, type, måned). Tæller og nævner er backendens tal pr. dato og værelsestype. Tableau dividerer kun summerne (research R4, plan Complexity Tracking) |

Ikke tilladt, fordi det er en formel i Tableau:

- `AVG([occupancyRate])`. Typerne har forskelligt antal værelser, så gennemsnittet er forkert.
- Egen gennemsnitspris, opholdslængde eller tilfredshed (fx `SUM(revenue)/COUNT(...)` eller
  `AVG([satisfactionScore])`). Brug nøgletallene `avgPricePerNight`, `avgStayLength` og
  `customerSatisfaction`.
- Quick Table Calculations som "Percent of Total" til cocktails vs. kaffe. Brug
  `barRevenueShare`.
- Formatering via beregnede felter. Brug Tableaus talformater.

Indbyggede aggregeringer (SUM, Count Distinct, MAX) og sortering er ikke formler og er tilladt.

## 1. Forudsætninger

1. **Tableau Desktop 2024.2.1 eller nyere.** Tjek under Help → About Tableau. Multi-fact-modellen
   findes først fra 2024.2, og extracts af den virker først fra 2024.2.1
   ([About multi-fact relationship data models](https://help.tableau.com/current/pro/desktop/en-us/datasource_mfr_multiple_base_tables.htm),
   research R9). Connectoren alene kræver 2023.3, men det er ikke nok her.
2. **Systemet kører** som i [README § Kom i gang](../README.md#kom-i-gang):

   ```bash
   cp .env.example .env        # kun første gang
   docker compose up --build
   ```

   Vent til backend logger `API listening on :3000`.
3. **Nøglen.** `BI_API_KEY` står i `.env` (placeholder i `.env.example`, mindst 32 tegn). Den
   giver kun læseadgang og virker kun på `/api/analytics` (research R2).
4. **Test API'et med curl**, før I åbner Tableau:

   ```bash
   BI_API_KEY=$(grep '^BI_API_KEY=' .env | cut -d= -f2)
   curl -i -H "Authorization: Bearer $BI_API_KEY" http://localhost:3000/api/analytics/
   ```

   Forventet: `200` og en JSON-array med **otte** tabeller (`table` og `path`): `room-nights`,
   `occupancy`, `bookings`, `bar-sales`, `kpis`, `calendar`, `room-types` og `countries`
   ([contracts](../specs/002-bi-dashboard/contracts/README.md)). Får I kun fem, kører I en
   backend fra før stjerneskemaet. Hent nyeste kode, og kør `docker compose up --build`.
   Det fulde API-tjek (felter og antal rækker pr. tabel) står i quickstart Del 1.

## 2. Installér connectoren

Kilde: [REST API Connector på Tableau Exchange](https://exchange.tableau.com/products/1111)
(version 1.0.1).

1. Hent JDBC-driveren (en `.jar`-fil) via "Driver Download" på Exchange-siden.
2. Læg filen i Tableaus driver-mappe:

   | OS | Mappe |
   |---|---|
   | macOS | `/Users/<bruger>/Library/Tableau/Drivers` |
   | Windows | `C:\Program Files\Tableau\Drivers` |

3. Genstart Tableau Desktop.
4. Tjek, at **REST API** står under Connect → To a Server.

Connectoren er **extract-only**. Data trækkes ind i et extract og opdateres med Data → Refresh
All Extracts (afsnit 7).

## 3. Opret datakilden

### 3.1 Forbind

1. Connect → To a Server → **REST API**.
2. Udfyld forbindelsen:

   | Felt | Værdi |
   |---|---|
   | Server-URL | `http://localhost:3000/api/analytics/` |
   | Autentificering | Bearer token (access token) med værdien af `BI_API_KEY` |
   | JSONPath to records | `$[*]`. Svaret er en JSON-array på øverste niveau **(tjek i jeres Tableau-version)**: virker `$[*]` ikke, så prøv `$` |

   Connectoren tester server-URL'en ved forbindelsen. Backend svarer med listen over de otte
   tabeller.
3. Tabellerne vises i venstre side af datakildesiden. Gør de ikke, så tilføj hvert endpoint
   under connectorens tabelkonfiguration ("Configure JDBC table names for API endpoints") med
   stierne fra listen ovenfor **(tjek i jeres Tableau-version)**: Exchange-siden viser ikke
   syntaksen.
4. Omdøb tabellerne på canvas til de danske navne, så de matcher data-model (fx `room-nights` →
   Værelsesnætter):

   | Endpoint | Tabelnavn i Tableau | Rolle |
   |---|---|---|
   | `/analytics/calendar` | Kalender | Dimension |
   | `/analytics/room-types` | Værelsestyper | Dimension |
   | `/analytics/countries` | Lande | Dimension |
   | `/analytics/room-nights` | Værelsesnætter | Fakta |
   | `/analytics/occupancy` | Belægning | Fakta |
   | `/analytics/bookings` | Bookinger | Fakta |
   | `/analytics/bar-sales` | Barsalg | Fakta |
   | `/analytics/kpis` | Nøgletal | Fakta |

### 3.2 Felttyper først

Ret felttyperne, **før** I opretter relationerne. Felterne på begge sider af en relation skal
have samme datatype
([Relate your data](https://help.tableau.com/current/pro/desktop/en-us/relate_tables.htm)):

- `date` (Kalender, Værelsesnætter, Belægning, Barsalg) og `checkIn` (Bookinger): **Date**.
- `year` (Kalender, Nøgletal): **Number (whole)**.
- `roomType` og `countryCode`: **String**.

Typen skiftes ved at klikke på type-ikonet over kolonnen i datagitteret. Den fulde liste over
felttyper og roller står i afsnit 4.

Tableau bruger kildens datatype, når den forespørger, så en ændring på datakildesiden ændrer
ikke kravet om ens typer. Det er ikke et problem her, fordi alle tabeller kommer fra samme API
med samme JSON-format: `date` og `checkIn` er begge `YYYY-MM-DD`, og begge `year` er heltal.

### 3.3 Relationer (stjerneskemaet)

Relationerne står i [data-model.md § Relationer i
Tableau](../specs/002-bi-dashboard/data-model.md#relationer-i-tableau), som er sandheden. Tabellen
herunder er samme ti relationer i den rækkefølge, I bygger dem.

Byg modellen sådan
([Build a multi-fact relationship data model](https://help.tableau.com/current/pro/desktop/en-us/datasource_mfr_build.htm)):

1. Træk **Værelsesnætter** til canvas. Den bliver den første basistabel.
2. Træk **Kalender**, **Værelsestyper** og **Lande** til canvas én ad gangen, og slip dem på
   Værelsesnætter. Vælg felterne i relationen (relation 1–3).
3. Træk **Belægning** til feltet **New Base Table**. Tableau advarer om flere basistabeller.
   Det er meningen.
4. Hold musen over Belægning. Træk dens **plus-ikon** hen på Kalender og derefter på
   Værelsestyper, og vælg felterne (relation 4–5).
5. Gentag trin 3–4 for **Bookinger** (6–8), **Barsalg** (9) og **Nøgletal** (10).

| # | Faktatabel.felt (venstre) | Dimension.felt (højre) | Type på begge sider |
|---|---|---|---|
| 1 | Værelsesnætter.`date` | Kalender.`date` | Date |
| 2 | Værelsesnætter.`roomType` | Værelsestyper.`roomType` | String |
| 3 | Værelsesnætter.`countryCode` | Lande.`countryCode` | String |
| 4 | Belægning.`date` | Kalender.`date` | Date |
| 5 | Belægning.`roomType` | Værelsestyper.`roomType` | String |
| 6 | Bookinger.`checkIn` | Kalender.`date` | Date |
| 7 | Bookinger.`roomType` | Værelsestyper.`roomType` | String |
| 8 | Bookinger.`countryCode` | Lande.`countryCode` | String |
| 9 | Barsalg.`date` | Kalender.`date` | Date |
| 10 | Nøgletal.`year` | Kalender.`year` | Number (whole) |

**Felterne i en relation:** Klik på relationslinjen. Felterne vises i panelet Table Details, hvor
I kan vælge et andet felt på hver side. Tableau gætter ofte på felter med samme navn, så tjek
især relation 6 (`checkIn` → `date`) og relation 10 (`year` → `year`, ikke `date`).

**Performance Options:** Lad alle ti stå på standarden, **Many / Many** og **Some records
match**. Det er korrekt for alle ti, og relation 10 er en mange-til-mange-relation, der **skal**
være Many / Many. Forkerte indstillinger kan tabe eller dublere data
([Cardinality and referential integrity](https://help.tableau.com/current/pro/desktop/en-us/cardinality_and_ri.htm)).
Hvor indstillingerne ligger i panelet, står ikke i Tableaus dokumentation **(tjek i jeres
Tableau-version)**. I skal ikke ændre dem, kun se, at de står på standarden.

**Hvorfor relateres fakta aldrig til hinanden?** Værelsesnætter har `bookingId` og kunne kobles
til Bookinger, men det ville give en cyklus (Værelsesnætter → Bookinger → Kalender ←
Værelsesnætter). Tableau tillader ikke cyklusser, og en relation mellem to basistabeller er ikke
tilladt i multi-fact-modellen (research R8). Fakta deler i stedet dimensionerne. Så betyder et
filter på `Kalender.year` det samme i alle tabeller.

## 4. Felttyper og roller

Gå datakildesiden igennem tabel for tabel. Under "Rolle" betyder Dimension, at feltet bruges til
at gruppere eller filtrere, og Measure, at feltet summeres.

| Tabel | Felt | Type | Rolle |
|---|---|---|---|
| Kalender | `date` | Date | Dimension |
| Kalender | `year`, `month` | Number (whole) | Dimension, **Discrete** |
| Kalender | `season` | String | Dimension |
| Værelsestyper | `roomType` | String | Dimension |
| Værelsestyper | `capacity`, `rooms` | Number (whole) | Bruges ikke i arkene |
| Lande | `countryCode` | String | Dimension, geografisk rolle **Country/Region** |
| Lande | `country` | String | Dimension |
| Værelsesnætter | `bookingId` | Number (whole) | Dimension (et id summeres ikke) |
| Værelsesnætter | `revenue` | Number (decimal) | Measure |
| Belægning | `availableRoomNights`, `soldRoomNights` | Number (whole) | Measure |
| Belægning | `occupancyRate` | Number (decimal) | Bruges **ikke** (afsnit 0) |
| Bookinger | `bookingId` | Number (whole) | Dimension |
| Bookinger | `checkIn`, `checkOut` | Date | Dimension |
| Bookinger | `guestCount`, `nights` | Number (whole) | Measure |
| Bookinger | `revenue`, `satisfactionScore` | Number (decimal) | Measure |
| Barsalg | `saleId` | Number (whole) | Dimension |
| Barsalg | `drink`, `category` | String | Dimension |
| Barsalg | `quantity` | Number (whole) | Measure |
| Barsalg | `revenue` | Number (decimal) | Measure |
| Nøgletal | `year` | Number (whole) | Dimension |
| Nøgletal | `kpi`, `label`, `dimension`, `unit` | String | Dimension |
| Nøgletal | `value` | Number (decimal) | Measure |
| Nøgletal | `generatedAt` | Date & Time | Dimension |

- **Discrete/Measure/Dimension:** Højreklik på feltet i Data-panelet, og vælg Convert to
  Discrete eller Convert to Dimension.
- **Geografisk rolle:** Klik på type-ikonet ved `countryCode`, og vælg Geographic Role →
  Country/Region. Tableau genkender ISO 3166-1 alpha-2-koder (`DK`, `DE`)
  ([Assign geographic roles](https://help.tableau.com/current/pro/desktop/en-us/maps_geographicroles.htm)).
- **Standardformat:** Sæt talformatet én gang pr. felt. Højreklik på feltet → Default Properties
  → Number Format. Så arver alle ark det:

  | Felt | Format |
  |---|---|
  | `revenue` (alle tabeller) | Number (Custom), 0 decimaler, tusindtalsseparator, suffiks ` kr.` |
  | `Belægningsgrad` | Percentage, 1 decimal |

## 5. Arkene

Hvert ark bruger **én** faktatabel plus de dimensioner, den er relateret til. Så skal Tableau
aldrig sy to fakta sammen (*stitching*, research R8). Navngiv arkene som overskrifterne
nedenfor, så de kan genkendes på dashboardet.

Feltnavne skrives `Tabel.felt`. "Kolonner" og "Rækker" er hylderne Columns og Rows, og
"Marks" er Marks-kortet.

### 5.1 Nøgletalsfliser (FT5, FT6, FT10–FT13)

Formål: årets autoritative tal fra backend. Hver flise er et lille ark med **ét** nøgletal fra
Nøgletal. Arknavnet er flisens titel og skal være præcis som i tabellen, fordi quickstart Del 2
tjekker fliserne ved navn. Navnene er de samme som `label` fra API'et.

| Ark (flise) | Filter `Nøgletal.kpi` = | Format på SUM(`value`) | Krav |
|---|---|---|---|
| Værelsesindtjening | `roomRevenue` | Number (Custom), 0 decimaler, suffiks ` kr.` | FR-006, FT10 |
| Belægningsgrad | `occupancyRate` | Percentage, 1 decimal | FR-001, FT5 |
| Bookinger | `bookings` | Number (Custom), 0 decimaler | FR-002, FT6 |
| Gæster | `guests` | Number (Custom), 0 decimaler | FR-002, FT6 |
| Gns. pris pr. nat | `avgPricePerNight` | Number (Custom), 0 decimaler, suffiks ` kr.` | FR-007, FT11 |
| Gns. opholdslængde | `avgStayLength` | Number (Custom), 1 decimal, suffiks ` nætter` | FR-007, FT11 |
| Kundetilfredshed | `customerSatisfaction` | Number (Custom), 1 decimal, suffiks ` / 5` | 003 FR-014, FT12 |
| Besvarelser | `satisfactionResponses` | Number (Custom), 0 decimaler | 003 FR-014, FT12 |
| Barsalg | `barRevenue` | Number (Custom), 0 decimaler, suffiks ` kr.` | FR-008, FT13 |

Byg den første flise, og duplikér den for de andre (højreklik på fanen → Duplicate, omdøb, og
skift filter og format):

1. Træk `Nøgletal.kpi` til Filters, og vælg ét nøgletal.
2. Marks: Text. Træk `Nøgletal.value` til Text. Den bliver SUM(`value`).
3. Formatér SUM(`value`) efter tabellen (højreklik → Format… → Numbers).
4. Lad titlen stå som arknavnet.

Fliserne følger kun år-filteret (afsnit 6). SUM(`value`) er præcis API'ets værdi, når ét år er
valgt. Relation 10 er mange-til-mange, men relationer dublerer ikke mål (research R8).

**Kundetilfredshed bygges fra Nøgletal, ikke fra Bookinger.** Nøgletallet er gennemsnittet af
scores 1–5 for bookinger med **afrejse** i året (003 FR-014). Bookinger hænger på kalenderen via
**ankomstdatoen**, så et gennemsnit af `Bookinger.satisfactionScore` ville tælle i et andet år
og være en formel i Tableau (data-model § Fakta og deres nøgler). Placér "Besvarelser" ved
siden af, så et gennemsnit af få svar kan ses. Et år uden scores viser 0 og 0. Scorerne i
testdata er genererede (README).

### 5.2 Belægning pr. måned (FR-001, FT5)

Formål: hvornår der er ledig kapacitet, også for en valgt sæson eller værelsestype.

1. Opret det beregnede felt: Analysis → Create Calculated Field, navn `Belægningsgrad`, formel
   `SUM([soldRoomNights]) / SUM([availableRoomNights])`. Det er det eneste beregnede felt
   (afsnit 0).
2. Kolonner: `Kalender.month` (diskret).
3. Rækker: `Belægningsgrad`.
4. Marks: Bar. Format: Percentage, 1 decimal.

Brug **ikke** `occupancyRate` fra Belægning. Flisen Belægningsgrad (5.1) er det autoritative årstal,
og arket her skal give det samme for hele året.

### 5.3 Indtjening pr. værelsestype × sæson (FR-003, FT7)

1. Rækker: `Værelsestyper.roomType`.
2. Kolonner: `Kalender.season`.
3. Marks: Square. Træk `Værelsesnætter.revenue` til Color og til Text (SUM).

Det er et heatmap, hvor de mørkeste felter tjener mest. Indtjeningen er allerede fordelt pr.
nat i backend, så et ophold over et sæsonskifte havner i de rigtige sæsoner (FR-015, research
R5). En kolonne "Null" ville være nætter uden for alle sæsonperioder (research R10). Med testdata
er der ingen.

### 5.4 Indtjening pr. værelsestype (FR-005, FT9)

1. Rækker: `Værelsestyper.roomType`.
2. Kolonner: `Værelsesnætter.revenue` (SUM).
3. Marks: Bar. Sortér faldende med Sort Descending i værktøjslinjen.

Den øverste bjælke er den type, der tjener mest i det valgte udsnit.

### 5.5 Indtjening pr. land (FR-004, FR-005, FT8, FT9)

1. Rækker: `Lande.country`.
2. Kolonner: `Værelsesnætter.revenue` (SUM).
3. Marks: Bar. Sortér faldende.

Vis alle 20 lande sorteret i stedet for et Top 10-filter. Et Top N-filter og almindelige
dimensionsfiltre anvendes samtidig, så "top 10" ville ikke følge år-filteret, medmindre filtrene
lægges i context
([Order of operations](https://help.tableau.com/current/pro/desktop/en-us/order_of_operations.htm)).
Det er en indstilling mere at forklare for den samme rangering.

### 5.6 Gæster og bookinger pr. land (FR-002, FT6)

Formål: hvor gæsterne kommer fra.

1. Dobbeltklik på `Lande.countryCode` (geografisk rolle Country/Region). Tableau laver et kort.
2. Marks: Map (udfyldt kort).
3. Color: `Bookinger.guestCount` (SUM).
4. Tooltip: `Lande.country`, SUM(`guestCount`) og antal bookinger. Træk `Bookinger.bookingId`
   til Tooltip, højreklik, og vælg Measure → Count (Distinct).

Bookinger hænger på kalenderen via ankomstdatoen, så år-filteret tæller bookinger med **ankomst**
i året, ligesom nøgletallene `bookings` og `guests` (FR-002).

### 5.7 Baromsætning pr. drink (FR-009, FT14)

Formål: Helene Christines lobbybar. Hvilke drinks tjener mest?

1. Rækker: `Barsalg.drink`.
2. Kolonner: `Barsalg.revenue` (SUM).
3. Marks: Bar. Color: `Barsalg.category`. Tooltip: `Barsalg.quantity` (SUM) som antal solgte.
4. Sortér faldende.

Årets samlede barsalg (FT13) er flisen Barsalg i 5.1.

### 5.8 Cocktails vs. kaffe (FR-010, FT15)

1. Filters: `Nøgletal.kpi` = `barRevenueShare`.
2. Marks: Bar (eller Pie). Color: `Nøgletal.dimension` (kategoriens navn).
3. Kolonner: `Nøgletal.value` (SUM). Label: SUM(`value`), format Percentage, 1 decimal.

Andelene er beregnet i backend og summerer til 100 %. Kategorierne kommer fra databasen og er
ikke skrevet i workbooken. Arket følger kun år, ligesom fliserne.

### 5.9 Data opdateret (FR-016)

1. Marks: Text. Træk `Nøgletal.generatedAt` til Text, og vælg aggregeringen Maximum.
2. Format: dato og tid, fx `dd.mm.yyyy hh:nn`.
3. Rediger teksten (klik på Text → …) til `Data opdateret <MAX(generatedAt)>`.

Tidspunktet kommer fra API'et, ikke fra Tableau, så det viser seneste **vellykkede** opdatering
(research R7). `generatedAt` er en UTC-tid (`…Z`). Om Tableau viser den som dansk tid
**(tjek i jeres Tableau-version)**. Gør den ikke, så skriv "(UTC)" i teksten.

## 6. Dashboardet

### 6.1 Layout

Dashboard → New Dashboard. Størrelse: Automatic eller 1366 × 768 (en bærbar til
fremlæggelsen). Forslag fra top til bund:

| Række | Indhold |
|---|---|
| 1 | Titel "Hotel Kong Arthur – ledelse", filtrene (år, måned, sæson, værelsestype, land) og "Data opdateret" |
| 2 | De ni fliser (5.1) i én vandret beholder og en tekst: "Fliserne og cocktails/kaffe er årstal og følger kun år-filteret." |
| 3 | Belægning pr. måned (5.2) og Indtjening pr. værelsestype × sæson (5.3) |
| 4 | Indtjening pr. værelsestype (5.4), Indtjening pr. land (5.5) og Gæster og bookinger pr. land (5.6) |
| 5 | Barområdet: Baromsætning pr. drink (5.7) og Cocktails vs. kaffe (5.8) |

### 6.2 Filtre

Filtrene er felter fra **dimensionerne**, aldrig fra en faktatabel. Hvilke ark hvert filter skal
ramme, står i [filtermatrixen i
data-model.md](../specs/002-bi-dashboard/data-model.md#filtermatrix). Kort fortalt: Land rammer
kun ark med Værelsesnætter eller Bookinger. Værelsestype rammer også Belægning. Måned og sæson
rammer alt undtagen Nøgletal. År rammer alt.

1. Læg `Kalender.year` på Filters i ét ark, og vis filteret (højreklik → Show Filter). Vælg
   filtertypen Single Value (dropdown), fordi fliserne er pr. år.
2. Højreklik på filteret → **Apply to Worksheets → Selected Worksheets**, og sæt flueben ved
   **alle** ark. År er det eneste filter, der rammer alt.
3. Vælg indeværende år (2026), før I gemmer. Det er standardvalget, når workbooken åbnes.
4. Tilføj `Kalender.month`, `Kalender.season`, `Værelsestyper.roomType` og `Lande.country` på
   samme måde (**Selected Worksheets**), men sæt kun flueben ved arkene i matrixen:

   | Filter | Ark |
   |---|---|
   | År | Alle |
   | Måned, Sæson | 5.2–5.7 (ikke fliserne, 5.8 og 5.9) |
   | Værelsestype | 5.2–5.6 |
   | Land | 5.3–5.6 |

5. Vis filtrene på dashboardet (vælg et ark på dashboardet → menuen på arket → Filters)
   **(tjek i jeres Tableau-version)**.

Menuerne er fra [Apply filters to multiple
worksheets](https://help.tableau.com/current/pro/desktop/en-us/filtering_global.htm). Brug
hverken "All Using This Data Source" eller "All on dashboard" til måned, sæson, værelsestype og
land. Alle ark deler én datakilde, så de ville også ramme belægning, barsalg og fliserne.

### 6.3 Klik på et land eller en værelsestype (Use as Filter)

1. Vælg arket "Gæster og bookinger pr. land" (5.6) på dashboardet, åbn arkets menu, og vælg
   **Use as Filter**
   ([Filter actions](https://help.tableau.com/current/pro/desktop/en-us/actions_filter.htm)).
   Gør det samme for "Indtjening pr. land" (5.5) og "Indtjening pr. værelsestype" (5.4).
2. **Ret målarkene. Det er det vigtigste trin i afsnit 6.** Use as Filter laver en
   filterhandling, der som standard rammer **alle** ark på dashboardet (data-model §
   Filtermatrix). Tableaus dokumentation siger ikke, hvilke mål standarden har **(tjek i jeres
   Tableau-version)**, så ret dem under alle omstændigheder. Uden rettelsen kan et klik på et
   land filtrere belægning og barsalg, og så viser dashboardet forkerte tal. For **hver** af de
   tre handlinger: **Dashboard → Actions**, vælg handlingen, Edit, og sæt kun flueben under
   Target Sheets ved arkene i filtermatrixen:

   | Handling fra | Målark |
   |---|---|
   | "Gæster og bookinger pr. land" (5.6) og "Indtjening pr. land" (5.5) | Kun 5.3–5.6. **Ikke** Belægning pr. måned, Baromsætning pr. drink, Cocktails vs. kaffe, fliserne eller Data opdateret |
   | "Indtjening pr. værelsestype" (5.4) | Kun 5.2–5.6. **Ikke** barsalgsarkene, fliserne eller Data opdateret |

3. Tjek: Klik på Tyskland. Belægning, barsalg, cocktails/kaffe og fliserne må ikke ændre sig
   (quickstart F1, US7 scenarie 3). Klik på Suite: barsalg, cocktails/kaffe og fliserne er uændrede
   (F2).

## 7. Opdatér data og gem

1. **Opdatér:** Data → Refresh All Extracts… (fra et ark). Connectoren henter alle otte
   endpoints igen. "Data opdateret" skal vise det nye tidspunkt.
   Én tabel ad gangen: Data → *datakilden* → Extract → Refresh
   ([Refresh extracts](https://help.tableau.com/current/pro/desktop/en-us/extracting_refresh.htm)).
2. **Første gang** beder Tableau om at gemme extractet (`.hyper`), når I går fra datakildesiden
   til et ark **(tjek i jeres Tableau-version)**. Gem det i `tableau/`. Det pakkes med ind i
   `.twbx` i næste trin.
3. **Gem som Packaged Workbook:** File → Save As, filtype **Tableau Packaged Workbook
   (\*.twbx)**, filnavn `tableau/kong-arthur.twbx` i repoet
   ([Packaged workbooks](https://help.tableau.com/current/pro/desktop/en-us/save_savework_packagedworkbooks.htm)).
   Filen indeholder ark, dashboard og extract, så ledelsen kan åbne den uden at have API'et
   kørende.
4. Opdatér altid extractet lige før I gemmer og før fremlæggelsen.

Om Bearer-tokenet gemmes i `.twbx`-filen **(tjek i jeres Tableau-version)**. Det er kun
udviklingsnøglen fra `.env.example`, men brug aldrig en rigtig drifts-nøgle i en workbook, der
committes.

## 8. Tjek tallene

Følg [`quickstart.md`](../specs/002-bi-dashboard/quickstart.md) Del 2 (tallene T1–T10 og
filtrene F1–F6) og Del 3 (successkriterierne). Tallene og de forventede værdier står kun der, så
de ikke kan blive forskellige to steder. Afviger et tal, er årsagen en relation, en felttype
eller et filter, aldrig en manglende formel i Tableau (afsnit 9).

## 9. Fejlfinding

| Symptom | Årsag og løsning |
|---|---|
| `HTTP error (404) … Unable to connect to the REST API server` | Server-URL'en svarer ikke `200`. Den skal være `http://localhost:3000/api/analytics/` (med `/api`). En gammel backend uden `GET /api/analytics` giver også 404. Kør `docker compose up --build`, og tjek med curl (afsnit 1) |
| `401` (eller "unauthorized"/login-fejl i connectoren) | Forkert eller manglende nøgle. Brug Bearer token med `BI_API_KEY` fra `.env`, ikke `BOOKING_SYSTEM_API_KEY`. Nøglen skal være mindst 32 tegn, ellers afviser backend alle nøgler |
| Forbindelsen virker, men tabellerne er tomme eller har én kolonne med hele JSON'en | Forkert JSONPath. Prøv `$[*]`, ellers `$`. Notér det, der virker, i afsnit 3.1 |
| Kun fem tabeller, eller faktatabellerne har stadig `year`, `season` eller `country` | Backend fra før stjerneskemaet. Hent nyeste kode, og kør `docker compose up --build` |
| Tableau vil ikke oprette en relation, eller den viser ingen matchende felter | Felterne har forskellig type. Tjek afsnit 3.2. `checkIn` skal relateres til `Kalender.date`, ikke til et felt med samme navn |
| Tallene er for store (fx nøgletal × 365) eller tomme | Forkert relation eller ændrede Performance Options. Tjek de ti relationer mod data-model, og sæt alle Performance Options tilbage til Many / Many og Some records match |
| Et land ændrer belægning eller barsalg | Filteret eller Use as Filter-handlingen rammer for mange ark. Ret dem efter afsnit 6.2 og 6.3 |
| Ingen New Base Table, Tableau vil ikke relatere to fakta til samme dimension, eller extractet fejler med "No such table" | Tableau er ældre end 2024.2.1. Multi-fact-modellen kom i 2024.2, og "No such table" ved extract er rettet i 2024.2.1. Tjek Help → About Tableau, og opgradér (research R9) |
| Landene står som "Unknown" på kortet | `countryCode` har ikke rollen Country/Region, eller den er sat på `country` (danske navne genkendes ikke altid). Sæt rollen på `countryCode` (afsnit 4) |
| Refresh All Extracts tager lang tid eller timer ud | Barsalg (132.698 rækker), værelsesnætter (117.806) og bookinger (21.570) hentes i sin helhed ved hver opdatering. Mål tiden med `curl -s -o /dev/null -w '%{time_total}\n' -H "Authorization: Bearer $BI_API_KEY" http://localhost:3000/api/analytics/bar-sales`. Hæv connectorens timeout i forbindelsesindstillingerne **(tjek i jeres Tableau-version)**. Brug ikke extract-filtre: de virker pr. tabel og ikke på tværs i multi-fact (research R9) |
| Opdateringen fejler, fordi API'et er nede | Forventet. Dashboardet beholder de seneste data og det gamle "Data opdateret" (research R7). Start backend, og opdatér igen |

## 10. Sådan forklarer I modellen ved fremlæggelsen

- **Stjerneskema i én datakilde.** Tre dimensioner (kalender, værelsestyper, lande) og fem fakta
  (værelsesnætter, belægning, bookinger, barsalg, nøgletal). Hver faktatabel har kun nøgler og
  tal. Beskrivende felter som år, sæson og landenavn bor kun i dimensionerne, så et filter
  betyder det samme overalt (FR-012, research R8, R11).
- **Ingen relationer mellem fakta.** Det ville give en cyklus, og Tableau tillader det ikke i
  multi-fact-modellen. Fakta deler dimensionerne i stedet, og hver tabel beholder sit eget
  detaljeniveau, så intet tælles dobbelt. Derfor ændrer et land ikke belægningen: belægning har
  intet land (US7).
- **Formlerne bor i backend (KB-A4, FR-011).** Fordeling af indtjening pr. nat, belægning,
  gennemsnit, andele og kundetilfredshed beregnes i `analyticsService.js` og er testet med
  `node:test`. Tableau summerer, tæller, filtrerer og sorterer. Den eneste division er
  belægning for et udsnit, og både tæller og nævner kommer fra backend (constitution III).
- **Kun læseadgang (FT17, FR-014).** Tableau bruger en separat nøgle, `BI_API_KEY`, som kun
  virker på `GET /api/analytics`. Den kan ikke oprette, ændre eller slette noget, og den virker
  ingen andre steder.
- **Data kommer fra API'et (FT4, FR-013).** Ingen direkte databaseforbindelse og ingen
  CSV-eksport. Refresh All Extracts henter de aktuelle data, og "Data opdateret" viser
  tidspunktet fra API'et.
- **Kalenderen dækker hele år (FR-017, FR-018).** Derfor forsvinder ingen række, når der
  filtreres, og hvert år i år-filteret har nøgletal (0 uden data).
