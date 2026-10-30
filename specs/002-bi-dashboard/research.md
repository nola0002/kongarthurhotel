# Research: Business Intelligence – ledelsesdashboard

**Feature**: `002-bi-dashboard` | **Dato**: 2026-10-30

Hver beslutning er truffet efter stigen i `docs/retningslinjer/kodekvalitet.md` §1: genbrug
før nyt, platform før egen kode og ingen nye afhængigheder. Feature 002 bygger videre på
backend, database og testdata fra `001-backoffice-bookinger` og indfører ingen nye tabeller.
Kontrakten for de nye endpoints står i [`backend/openapi.yaml`](../../backend/openapi.yaml)
(se [`contracts/README.md`](contracts/README.md)).

Påstande om Tableau er tjekket mod Tableaus egne kilder den 2026-10-30 (links i R1). Det, vi
ikke har kunnet bekræfte i en kilde, er markeret **verificeres i Tableau** og skal afprøves,
når workbooken bygges.

## R1. Sådan henter Tableau data fra API'et

- **Beslutning**: Tableau Desktop forbinder med **REST API Connector** fra Tableau Exchange.
  Hvert endpoint under `/api/analytics` bliver én datakilde. Connectoren henter JSON med
  HTTP GET og sender API-nøglen som Bearer-token.
- **Det er bekræftet** på [Exchange-siden for connectoren](https://exchange.tableau.com/products/1111)
  (version 1.0.1):
  - Den virker med Tableau 2023.3 og nyere.
  - Den bruger HTTP GET og forstår JSON og CSV.
  - Den understøtter basic auth, **Bearer-token** og OAuth.
  - Den er **extract-only**. Data trækkes ind i et Tableau-extract og opdateres med
    Data → Refresh All Extracts.
  - Den installeres som en JDBC-driver (`.jar`) i Tableaus `Drivers`-mappe og vælges under
    Connect → To a Server → REST API.
  - Posterne i svaret findes med en JSONPath-indstilling.
- **Verificeres i Tableau**: hvilken JSONPath der rammer en JSON-array på øverste niveau (fx
  `$[*]`), og hvordan felttyperne gættes (dato, heltal, decimal).
- **Rationale**: Det er Tableaus egen, anbefalede vej til et REST API, og den kræver ingen kode
  hos os. At connectoren er extract-only passer til afklaringen i spec'en: data hentes, når
  dashboardet opdateres manuelt (FR-013, FT4). Extractet gemmer de seneste data, så
  dashboardet stadig kan vises, hvis API'et er nede (edge case i spec'en, se R7).
- **Alternativer**:
  - **Web Data Connector 3.0**: fravalgt. Tableaus eget repo
    ([github.com/tableau/wdc3](https://github.com/tableau/wdc3)) skriver, at frameworket er
    udfaset, ikke får flere opdateringer og fjernes med Tableau 26.3. Repoet henviser selv til
    REST API Connector. Det ville også være en ekstra kodebase at vedligeholde og forklare.
  - **Direkte forbindelse til MySQL**: fravalgt. Det bryder KB-A5 og constitution II (al data
    via API'et), og nøgletallene ville blive regnet i Tableau i stedet for i logiklaget
    (KB-A4). MySQL-porten er heller ikke eksponeret.
  - **Statisk CSV-eksport**: fravalgt. FT4 og FR-013 kræver, at data hentes løbende fra API'et
    og ikke kun fra en CSV-fil.

## R2. Læseadgang med en separat Bearer-nøgle (FR-014, FT17)

- **Beslutning**: En ny miljøvariabel `BI_API_KEY` giver læseadgang. Alle endpoints under
  `/api/analytics` accepterer enten headeren `Authorization: Bearer <BI_API_KEY>` eller den
  almindelige session-cookie. Session-cookien er med, så Swagger UI's "Try it out" virker
  for en receptionist, der er logget ind.
  - Nøglen gælder **kun** `/api/analytics`. Fx giver `GET /api/bookings` med BI-nøglen 401.
  - Bookingsystemets `X-API-Key` gælder ikke på `/api/analytics` og giver 401.
  - Der findes kun GET-endpoints under `/analytics`, så dashboardet kan ikke ændre data, uanset
    hvad brugeren gør (SC-005).
  - Nøglen tjekkes på samme måde som `BOOKING_SYSTEM_API_KEY` (001 research R6): længdetjek og
    `crypto.timingSafeEqual`, og det fejler lukket. Er nøglen ikke sat eller under 32 tegn,
    afvises alle nøgler med 401.
- **Rationale**: Mindste rettighed. Bookingsystemets nøgle må oprette bookinger, og ledelsens
  nøgle må kun læse. To nøgler kan skiftes hver for sig. Bearer er en af de
  autentificeringsformer, connectoren understøtter (R1). Tableau kan derimod ikke logge ind med
  `POST /auth/login` og holde en cookie.
- **Alternativer**:
  - Genbruge `X-API-Key`: fravalgt, fordi den nøgle også kan skrive, og fordi det ville kræve
    en brugerdefineret header i Tableau. Om connectoren kan sende vilkårlige headers, er ikke
    bekræftet (**verificeres i Tableau**).
  - Ingen auth på analytics: fravalgt. Omsætning pr. land er forretningsdata.
  - OAuth: langt mere opsætning end opgaven kræver (constitution VI).
- **Bevidst forenkling**: Lokalt sendes nøglen over HTTP til `localhost:3000`. I drift
  termineres HTTPS i en reverse proxy foran backend, som for bookingsystemet (001 research R7).

## R3. Svarformat: flade arrays uden query-parametre (FR-012)

- **Beslutning**: Hvert endpoint returnerer en JSON-array på øverste niveau med flade objekter.
  Der er ingen indlejring, ingen wrapper og ingen query-parametre. Tableau henter alle år og
  filtrerer selv på år, sæson, værelsestype og land.
  - Felter, der bruges til filtrering, har samme navn i alle datakilder (`year`, `month`,
    `season`, `roomType`, `countryCode`, `country`), så Tableau kan koble dem på tværs.
  - `year` og `month` er heltal, så de kan bruges direkte som filtre. Datoer er ISO-strenge
    `YYYY-MM-DD`, og beløb er kroner som JSON-tal, ligesom i resten af API'et.
- **Rationale**: Det er det simpleste, en extract-baseret connector kan læse, og alle filtre i
  FR-012 bliver almindelige Tableau-filtre. Datamængden er lille. Den største datakilde er ca.
  40.000 værelsesnætter (skøn ud fra ca. 10.400 bookinger i seed), så det er unødvendigt at
  filtrere eller paginere i API'et.
- **Verificeres i Tableau**: at filtre og "Use as Filter" virker på tværs af datakilder via de
  fælles feltnavne. Ellers sættes koblingen op under Data → Edit Blend Relationships eller i
  filterhandlingens feltkobling.
- **Alternativer**:
  - `?year=`-parametre: Tableau skulle have en datakilde eller URL pr. år, og filteret ville
    ligge uden for dashboardet.
  - Indlejret JSON (fx `{ booking, nights: [...] }`): det er uklart, hvordan connectoren
    flader indlejrede arrays ud, og det giver ikke nogen gevinst.
  - Paginering: unødvendig ved denne datamængde (YAGNI). Connectoren understøtter
    offset/limit, hvis det bliver nødvendigt.

## R4. Hvor formlerne bor (KB-A4, FR-011, constitution III)

- **Beslutning**: Alle formler ligger i `backend/src/services/analyticsService.js`:
  fordeling af indtjening pr. nat, belægningsgrad, gennemsnit og andele. Tableau må kun
  summere, tælle, filtrere og sortere rækker, som API'et har leveret.
  - Datakilderne er lavet, så en **sum** er korrekt for ethvert udsnit. Indtjening ligger
    allerede fordelt pr. værelsesnat (R5), så SUM(revenue) pr. værelsestype, sæson, land,
    måned eller år er rigtig uden yderligere regning (FT7–FT10). Rangeringen (FT9) er en
    sortering af den sum.
  - De autoritative nøgletal pr. kalenderår kommer færdigberegnede fra `/analytics/kpis`:
    belægningsgrad, værelsesindtjening, gennemsnitlig pris pr. nat, gennemsnitlig
    opholdslængde, antal bookinger og gæster, barsalg og andel pr. drinkkategori.
  - Repositoriet må gerne bruge `SUM`/`COUNT` i SQL af hensyn til ydelsen, men formlen bor i
    servicen (`docs/retningslinjer/database.md` §6).
- **Ærlig note om belægning**: Når ledelsen filtrerer belægningen på sæson eller værelsestype
  (US2, scenarie 2), viser Tableau `SUM(soldRoomNights) / SUM(availableRoomNights)` over
  backendens rækker pr. dato og værelsestype. Det er den eneste division i workbooken. Den er
  med, fordi FR-001 kræver belægning for et vilkårligt udsnit, og fordi tæller og nævner
  begge er beregnet af backend. Tableau finder ikke selv på, hvad "solgt" og "tilgængelig"
  betyder. Gennemsnittet af rækkernes `occupancyRate` må **ikke** bruges, fordi typerne har
  forskelligt antal værelser. De autoritative årstal står i `/analytics/kpis`. Valget står i
  plan.md under Complexity Tracking.
- **Rationale**: Samme tal overalt, og formlerne kan testes med `node:test` uden Tableau
  (constitution V). Placeringen kan begrundes ved fremlæggelsen.
- **Alternativer**:
  - Beregnede felter i Tableau for alle nøgletal: bryder FR-011 og KB-A4 og kan ikke testes.
  - Et endpoint pr. kombination af filtre (fx belægning pr. sæson × type × måned): mange
    endpoints, og interaktiviteten (FR-012) ville stadig kræve, at Tableau kombinerer dem.

## R5. Fordeling af indtjening pr. nat (FR-015, 001 FR-009)

- **Beslutning**: Hver bookings **fastfrosne** `total_price` fordeles på bookingens nætter.
  Hver nat vægtes med den nuværende pris i `room_prices` for værelsestypen og den sæson,
  natten ligger i. Beløbene regnes i øre (heltal). Hver nat får den nedrundede andel, og
  resten af ørerne lægges på sidste nat. Nætterne summerer derfor altid præcis til
  `total_price`. Er alle vægte 0, deles beløbet ligeligt.
- **Eksempel**: En booking med 2 nætter i lavsæson og 1 i højsæson blev prissat til
  500 + 500 + 800 = 1.800 kr. Med uændrede priser bliver nætterne 500, 500 og 800 kr. Er
  priserne siden hævet til 600 og 900, er vægtene 600, 600 og 900 (i alt 2.100). Nætterne
  bliver 514,28 kr., 514,28 kr. og 771,44 kr. (resten), i alt stadig 1.800 kr.
- **Nætter** gennemløbes med den samme hjælper som `calculateStayPrice` i
  `backend/src/services/pricing.js`. Natten `d` tilhører `[check_in, check_out)`, så der er
  kun én definition af en nat. Natten ligger i den sæson, måned og det år, datoen ligger i, så
  ophold over sæson- og årsskifte fordeles rigtigt (US1, scenarie 5).
- **Rationale**: Bookingens pris er et historisk faktum (FR-009 i 001) og må ikke regnes om.
  Vægtene bestemmer kun fordelingen. En højsæsonnat tjener mere end en lavsæsonnat, og det
  skal kunne ses i indtjening pr. sæson (FT7). Priserne har ingen historik i databasen, så de
  nuværende priser er de bedste vægte. Det er kun et problem, hvis forholdet mellem sæsonerne
  ændres, og selv da stemmer totalen.
- **Alternativer**:
  - Lige fordeling pr. nat: undervurderer højsæsonen ved ophold over et sæsonskifte.
  - Hele beløbet på ankomstmåneden: bryder FR-015.
  - En ny tabel med pris pr. nat, gemt ved booking: præcis, men kræver skemaændring, ændring i
    bookingflowet og ny seed, og 001 har allerede totalen som det fastfrosne faktum (YAGNI).

## R6. Ingen nye tabeller

- **Beslutning**: Alle rækker og nøgletal afledes ved hvert kald fra tabellerne i 001
  (`bookings`, `rooms`, `room_types`, `countries`, `seasons`, `season_periods`,
  `room_prices`, `bar_sales`, `drinks`, `drink_categories`). Intet gemmes.
- **Rationale**: `docs/retningslinjer/database.md` siger "gem aldrig afledte data", og spec'en
  indfører ingen nye stamdata. En ny eller slettet booking indgår derfor straks, næste gang
  extractet opdateres (SC-004).
- **Alternativer**:
  - SQL-views: formlerne ville ligge i SQL i stedet for i servicen (KB-A4) og ville være
    sværere at teste.
  - Opsummeringstabeller eller cache: afledte data, der kan blive forældede, og datamængden
    kræver dem ikke.

## R7. Tidspunkt for seneste opdatering (FR-016)

- **Beslutning**: Hver række fra `/analytics/kpis` har `generatedAt`, dvs. tidspunktet, hvor
  API'et svarede. Dashboardet viser det som "Data opdateret …".
- **Rationale**: Tidspunktet kommer fra API'et og ikke fra Tableau. Fordi connectoren er
  extract-only (R1), viser dashboardet tidspunktet for den seneste **vellykkede** opdatering.
  Fejler en opdatering, beholder Tableau det gamle extract og det gamle tidspunkt (edge case i
  spec'en).
- **Alternativer**: Tableaus egen "sidst opdateret"-tekst fortæller, hvornår extractet blev
  hentet, men ikke, at data kom fra API'et. Et separat `/analytics/meta`-endpoint ville være
  en ekstra datakilde for ét felt.

## Afhængigheder

Ingen nye pakker. Backend genbruger Express, mysql2, `money.js` (`toOre`/`toKr`) og
nat-gennemløbet fra `pricing.js`. Nøglen tjekkes med Node's indbyggede `crypto.timingSafeEqual`.
Tableau-siden kræver kun Tableau Desktop 2023.3+ og REST API Connector fra Tableau Exchange.
