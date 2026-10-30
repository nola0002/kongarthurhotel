# Feature Specification: Business Intelligence – ledelsesdashboard

**Feature Branch**: `002-bi-dashboard`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "Interaktivt Tableau-dashboard til hoteladministrator og ledelse
på Hotel Kong Arthur med belægningsgrad, gæsternes oprindelseslande, indtjening pr.
værelsestype pr. sæson og pr. land, de mest indbringende værelsestyper og lande, årets
samlede indtjening, selvvalgte nøgletal og barsalg (samlet, pr. drink, cocktails vs. kaffe).
Data hentes løbende via systemets API, og ledelsen har kun læseadgang. (Kravboard: FT4–FT17,
A4, A5)"

## Clarifications

### Session 2026-10-27

- Q: Hvor "live" skal data i dashboardet være? → A: Data hentes fra API'et, hver gang
  dashboardet åbnes eller opdateres manuelt. Der er ingen planlagt automatisk opdatering.

### Session 2026-10-30

- Q: Hvordan forbinder Tableau til API'et, og hvordan sikres læseadgangen? → A: Tableau
  Desktop (2023.3+) bruger REST API Connector fra Tableau Exchange og henter JSON med HTTP GET
  til et extract, der opdateres manuelt. Web Data Connector 3.0 er udfaset og bruges ikke.
  Ledelsen autentificeres med en separat læse-nøgle (`BI_API_KEY`) som Bearer-token. Nøglen
  gælder kun endpoints under `/api/analytics`, og de er alle GET (FR-013, FR-014).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Indtjening overblik (Priority: P1)

Som hoteladministrator ønsker jeg at se årets samlede indtjening og indtjeningen fordelt på
værelsestype, sæson og land, så jeg kan se, hvad der tjener mest, og prioritere salg og
priser derefter.

**Why this priority**: Indtjening er ledelsens vigtigste spørgsmål (FT7–FT10) og udgør
størstedelen af BI-kravene.

**Independent Test**: Med et kendt testdatasæt viser dashboardet årets samlede indtjening,
indtjening pr. værelsestype pr. sæson og pr. land samt en rangering. Alle tal stemmer med en
manuel beregning.

**Acceptance Scenarios**:

1. **Given** bookinger for et år findes, **When** administratoren åbner dashboardet og vælger
   året, **Then** vises årets samlede værelsesindtjening (FT10).
2. **Given** bookinger på flere værelsestyper i flere sæsoner, **When** dashboardet vises,
   **Then** vises indtjening pr. værelsestype pr. sæson (FT7).
3. **Given** gæster fra flere lande, **When** dashboardet vises, **Then** vises indtjening pr.
   land (FT8).
4. **Given** indtjening pr. værelsestype og pr. land, **When** dashboardet vises, **Then**
   fremgår det tydeligt, hvilke værelsestyper og lande der tjener mest, fx som sorteret
   top-liste (FT9).
5. **Given** et ophold strækker sig over to sæsoner eller over et årsskifte, **When**
   indtjeningen opgøres, **Then** fordeles hver nats pris på den sæson og det år, natten
   ligger i.

---

### User Story 2 - Belægningsgrad (Priority: P1)

Som hoteladministrator ønsker jeg at se belægningsgraden over tid, så jeg kan se, hvornår
hotellet har ledig kapacitet.

**Why this priority**: Belægningsgrad er et Must-krav (FT5) og et standardnøgletal i
hotelbranchen.

**Independent Test**: Med et kendt datasæt vises belægningsgraden pr. måned, og den matcher
"bookede værelsesnætter / tilgængelige værelsesnætter".

**Acceptance Scenarios**:

1. **Given** hotellet har 10 værelser, og der er 150 bookede værelsesnætter i en måned med 30
   dage, **When** dashboardet viser måneden, **Then** er belægningsgraden 50 %.
2. **Given** administratoren vælger en sæson eller værelsestype, **When** filteret anvendes,
   **Then** genberegnes belægningsgraden for udvalget.

---

### User Story 3 - Gæsternes oprindelseslande (Priority: P2)

Som hoteladministrator ønsker jeg at se, hvilke lande gæsterne kommer fra, så markedsføringen
kan målrettes de vigtigste markeder.

**Why this priority**: Must-krav (FT6), men det giver mest værdi sammen med indtjening pr. land.

**Independent Test**: Dashboardet viser antal bookinger og gæster pr. land, og tallene matcher
testdatasættet.

**Acceptance Scenarios**:

1. **Given** bookinger fra gæster fra flere lande, **When** dashboardet vises, **Then** vises
   fordelingen af bookinger pr. land, fx som kort eller søjlediagram.
2. **Given** administratoren klikker på et land, **When** filteret anvendes, **Then** filtreres
   de øvrige visninger til det land (interaktivitet, FT16).

---

### User Story 4 - Barsalg (Priority: P2)

Som hoteladministrator ønsker jeg at se cocktailbarens salg for året, omsætningen pr. drink og
fordelingen mellem cocktails og kaffe, så jeg kan vurdere barens drift og drinkkort.

**Why this priority**: Must-krav (FT13–FT15). Det er et selvstændigt område, uafhængigt af
bookingdata.

**Independent Test**: Med et kendt sæt barsalg vises årets samlede salg, omsætning pr. drink
og procentfordelingen mellem cocktails og kaffe, og tallene matcher manuel beregning.

**Acceptance Scenarios**:

1. **Given** barsalg for et år, **When** dashboardet vises, **Then** vises barens samlede salg
   for året (FT13).
2. **Given** salg af flere drinks, **When** dashboardet vises, **Then** vises omsætning pr.
   drink sorteret efter omsætning (FT14).
3. **Given** salg af både cocktails og kaffe, **When** dashboardet vises, **Then** vises den
   procentvise fordeling af omsætningen mellem de to kategorier, og andelene summerer til
   100 % (FT15).

---

### User Story 5 - Selvvalgte nøgletal (Priority: P2)

Som hoteladministrator ønsker jeg at se gennemsnitlig pris pr. nat og gennemsnitlig
opholdslængde, så jeg kan følge prisniveau og gæsternes adfærd over tid.

**Why this priority**: FT11 kræver mindst ét selvvalgt nøgletal.

**Independent Test**: Med et kendt datasæt matcher begge nøgletal manuel beregning.

**Acceptance Scenarios**:

1. **Given** bookinger i en periode, **When** dashboardet vises, **Then** vises gennemsnitlig
   pris pr. solgt værelsesnat (samlet værelsesindtjening / antal solgte værelsesnætter).
2. **Given** bookinger i en periode, **When** dashboardet vises, **Then** vises gennemsnitlig
   opholdslængde i nætter.

---

### User Story 6 - Aktuelle data og læseadgang (Priority: P3)

Som hoteladministrator ønsker jeg, at dashboardet viser aktuelle data fra hotellets system og
ikke en gammel eksport, så beslutninger træffes på det rigtige grundlag.

**Why this priority**: FT4 og FT16 kræver, at data kommer løbende via API'et. Dashboardet giver
dog værdi selv med en manuelt opdateret datakilde.

**Independent Test**: En ny booking oprettes i back office, og den indgår i dashboardets tal
efter den aftalte opdateringsfrekvens. Ingen handling i dashboardet kan ændre data.

**Acceptance Scenarios**:

1. **Given** en ny booking oprettes i back office, **When** dashboardet derefter åbnes eller
   opdateres manuelt, **Then** indgår bookingen i nøgletallene.
2. **Given** en bruger fra ledelsen, **When** dashboardet bruges, **Then** findes der ingen
   mulighed for at oprette, ændre eller slette data (FT17).

---

### Edge Cases

- Et år eller en periode uden data viser 0 eller "ingen data" i stedet for fejl eller tomme
  diagrammer uden forklaring.
- Ophold over årsskifte eller sæsonskifte: Nætterne fordeles på den periode, de ligger i.
- Slettede bookinger indgår ikke i nogen nøgletal.
- Bookinger uden registreret land vises som "Ukendt" og udelades ikke.
- Hvis en drink ikke længere er på drinkkortet, indgår dens historiske salg stadig.
- Nøgletalskilden er utilgængelig: Dashboardet viser tidspunktet for seneste vellykkede
  opdatering.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (FT5): Systemet MUST beregne belægningsgrad som bookede værelsesnætter divideret
  med tilgængelige værelsesnætter for den valgte periode, sæson og/eller værelsestype.
- **FR-002** (FT6): Systemet MUST opgøre antal bookinger og gæster pr. oprindelsesland.
- **FR-003** (FT7): Systemet MUST opgøre værelsesindtjening pr. værelsestype pr. sæson.
- **FR-004** (FT8): Systemet MUST opgøre værelsesindtjening pr. land.
- **FR-005** (FT9): Systemet MUST rangere værelsestyper og lande efter indtjening.
- **FR-006** (FT10): Systemet MUST opgøre samlet værelsesindtjening for et valgt kalenderår.
- **FR-007** (FT11): Systemet MUST beregne gennemsnitlig pris pr. solgt værelsesnat og
  gennemsnitlig opholdslængde.
- **FR-008** (FT13): Systemet MUST opgøre barens samlede salg for et valgt kalenderår.
- **FR-009** (FT14): Systemet MUST opgøre omsætning pr. drink.
- **FR-010** (FT15): Systemet MUST opgøre den procentvise fordeling af baromsætningen mellem
  cocktails og kaffe.
- **FR-011** (A4): Alle nøgletal i FR-001–FR-010 MUST beregnes ét sted i systemets logik og
  leveres færdigberegnet til dashboardet. Dashboardet MUST NOT have sin egen
  beregningslogik for nøgletallene, ud over aggregering og filtrering til visning.
- **FR-012** (FT16): Dashboardet MUST være interaktivt med mindst filtrering på år, sæson,
  værelsestype og land, og valg i én visning MUST kunne filtrere de øvrige.
- **FR-013** (FT4, A5): Dashboardet MUST hente data fra systemets API og MUST NOT forbinde
  direkte til databasen eller kun bygge på en statisk CSV-eksport.
- **FR-014** (FT17): Dashboardet MUST være skrivebeskyttet. Det må ikke kunne oprette, ændre
  eller slette data.
- **FR-015**: Indtjening fra et ophold MUST fordeles pr. nat på den sæson, den måned og det år,
  natten ligger i.
- **FR-016**: Dashboardet MUST vise tidspunktet for, hvornår data sidst blev opdateret.

### Key Entities *(include if feature involves data)*

Dashboardet bygger på entiteterne fra `001-backoffice-bookinger` (Gæst, Værelsestype, Værelse,
Sæson, Pris, Booking, Drink, Barsalg) og indfører ingen nye stamdata.

- **Nøgletal**: Et beregnet tal med navn, værdi, enhed og de dimensioner, det er opgjort på
  (år, sæson, måned, værelsestype, land, drink, kategori).
- **Værelsesnat**: Én nat for ét værelse i én booking. Det er den mindste enhed for
  belægningsgrad og fordeling af indtjening.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Alle nøgletal (FT5–FT15) matcher en manuel beregning på et kendt testdatasæt med
  0 afvigelser.
- **SC-002**: En hoteladministrator kan besvare "hvilken værelsestype og hvilket land tjente
  mest i år?" på under 30 sekunder via dashboardet.
- **SC-003**: Alle Must-krav FT5–FT11 og FT13–FT15 er synlige i ét samlet, interaktivt
  dashboard.
- **SC-004**: En ny booking eller et nyt barsalg indgår i dashboardet, næste gang det åbnes
  eller opdateres manuelt, i 100 % af testene.
- **SC-005**: Ingen brugerhandling i dashboardet kan ændre data i systemet.

## Assumptions

- Indtjening betyder værelsesindtjening (summen af bookingernes gemte priser) og barsalg hver
  for sig. De vises separat og lægges ikke sammen, medmindre det er udtrykkeligt angivet.
- "Året" betyder kalenderår, som kan vælges. Standard er indeværende år.
- Tilgængelige værelsesnætter = antal værelser × antal dage i perioden. Værelser ude af drift
  modelleres ikke.
- Cocktails vs. kaffe opgøres på omsætning. Antal solgte enheder vises som supplement.
- Kundetilfredshed (FT12, Could) er uden for scope, da der ikke findes data. Det nævnes i
  præsentationen som en mulig udvidelse.
- Tableau Desktop er det valgte BI-værktøj (FT16). Det kan hente direkte fra API'et, der
  kører lokalt i Docker. Dashboardet deles med ledelsen som visning uden
  redigeringsrettigheder.
- Datagrundlaget er genereret testdata, der er stort nok til, at sæson-, lande- og
  drinkfordelinger giver mening.
- Datagrundlaget leveres af `001-backoffice-bookinger`, inkl. gæstens land på hver booking og
  kategori på hver drink.
