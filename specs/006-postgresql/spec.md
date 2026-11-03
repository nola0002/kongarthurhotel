# Feature Specification: Kravændring – PostgreSQL i stedet for MySQL

**Feature Branch**: `006-postgresql`

**Created**: 2026-11-03

**Status**: Draft

**Input**: User description: "Kravændring fra kunden (2026-11-03): Databasen skal være PostgreSQL i
stedet for MySQL. Krav T1 ændres fra "Databasen er MySQL" til "Databasen er PostgreSQL". Al
eksisterende funktionalitet (bookinger, barsalg, priser, receptionsoverblik, BI-API til Tableau)
skal virke uændret mod PostgreSQL, API-kontrakten ændres ikke, og hele systemet skal stadig starte
med én `docker compose up` med healthcheck, named volume og init-scripts (T2–T7). Kravændringen
skal dokumenteres i kravoversigten, constitution og retningslinjerne." Tilføjet undervejs: "Optimer
evt. også eksisterende database, kald og indeksere så databasen bliver hurtigere."

## Kravændring

| | Før | Efter |
|---|---|---|
| **T1** | Databasen er MySQL | Databasen er PostgreSQL |
| Kilde | Opgaven (systemkrav) | Kunden, kravændring 2026-11-03 |
| Prioritet | Must | Must (uændret) |

Kunden har besluttet, at hotellets database skal være PostgreSQL. Ændringen rører kun datalaget.
Den er samtidig en prøve på arkitekturkravet om, at databasen kan udskiftes med begrænsede
ændringer (A5, tillægsspørgsmål 5, constitution I).

## Clarifications

### Session 2026-11-03

Brugeren bad om at køre kravændringen igennem uden afklaringsrunde. Valgene nedenfor er
*gruppens valg*.

- Q: Skal eksisterende data flyttes fra MySQL til PostgreSQL? → A: Nej. Der er ingen
  produktionsdata. Databasen oprettes forfra fra skema og startdata, så det samme datasæt findes
  i PostgreSQL efter skiftet.
- Q: Hvor langt går optimeringen? → A: Kun indekser og forespørgsler, der målbart er langsomme på
  startdatasættet (målt med forespørgselsplaner). Ingen caching, ingen gemte nøgletal (A4,
  `database.md` §1) og ingen ændring af API-kontrakten.
- Q: Skal MySQL fortsat understøttes som alternativ? → A: Nej. Der er én database. To
  understøttede databaser ville være en abstraktion uden et krav bag (constitution VI).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Receptionen arbejder uændret efter skiftet (Priority: P1)

Som receptionist vil jeg kunne oprette, rette, søge i og slette bookinger, registrere barsalg og
tjekke gæster ind og ud præcis som før, så skiftet af database ikke ændrer min arbejdsdag.

**Why this priority**: Back office er hotellets daglige drift. Fejler den, kan hotellet ikke
tage imod gæster.

**Independent Test**: Start systemet fra en tom maskine, log ind, opret en booking, søg den frem
på gæstens navn, tilknyt et barsalg og slet bookingen igen.

**Acceptance Scenarios**:

1. **Given** et nystartet system, **When** receptionisten opretter en booking for 2 gæster i en
   ledig Dobbeltværelse-periode, **Then** får bookingen et værelse og samme pris som før skiftet.
2. **Given** at alle værelser af en type er optaget i en periode, **When** en ny booking af typen
   oprettes i perioden, **Then** afvises den med samme fejlbesked som før (001 FR-007).
3. **Given** en gæst med navnet "Søren Østergaard", **When** receptionisten søger på "søren", **Then**
   findes bookingen (søgningen skelner ikke mellem store og små bogstaver, 001 FR-002).
4. **Given** et barsalg knyttet til en booking, **When** bookingen slettes, **Then** bevares
   barsalget uden booking (001 FR-010a).
5. **Given** to samtidige bookinger af det sidste ledige værelse, **When** begge sendes på samme
   tid, **Then** lykkes kun den ene (001 FR-007).

---

### User Story 2 - Ledelsen ser de samme nøgletal (Priority: P1)

Som hoteladministrator vil jeg se de samme tal i Tableau-dashboardet som før skiftet, så ledelsen
kan stole på, at belægning, indtjening og barsalg ikke har ændret sig af tekniske grunde.

**Why this priority**: Nøgletallene er grundlaget for ledelsens beslutninger (FT5–FT15).

**Independent Test**: Hent BI-endpoints før og efter skiftet på det samme startdatasæt og
sammenlign tallene.

**Acceptance Scenarios**:

1. **Given** startdatasættet, **When** dashboardet henter årets samlede indtjening, belægning og
   barsalg, **Then** er tallene identiske med tallene før skiftet.
2. **Given** omsætningssiden grupperet pr. dag, måned og år, **When** den vises, **Then** er
   perioderne og beløbene de samme som før (005 FR-014).

---

### User Story 3 - Systemet starter med én kommando (Priority: P1)

Som it-arkitekt og censor vil jeg starte hele systemet med én `docker compose up` på en tom
maskine, så jeg kan afprøve løsningen uden manuel opsætning af databasen.

**Why this priority**: Kravene T2–T6 og fremlæggelsen forudsætter det.

**Independent Test**: Klon repoet på en maskine uden tidligere volumes, kopiér `.env.example` til
`.env` og kør `docker compose up`. Back office, API og Swagger UI svarer, og startdata er
indlæst.

**Acceptance Scenarios**:

1. **Given** en tom maskine, **When** `docker compose up` køres, **Then** starter backend først,
   når databasen melder sig klar (T4).
2. **Given** et kørende system med en ny booking, **When** containerne genstartes, **Then** findes
   bookingen stadig (T5).
3. **Given** et kørende system, **When** `npm test` køres i backend-containeren, **Then** er alle
   tests grønne mod en separat testdatabase.

---

### User Story 4 - Hurtigere søgning og lister (Priority: P2)

Som receptionist vil jeg have, at søgning, bookinglisten, belægningsplanen og omsætningssiden
svarer hurtigt på et helt års data, så jeg ikke venter på systemet, mens gæsten står foran mig.

**Why this priority**: Systemet virker uden, men skiftet er den naturlige anledning til at
gennemgå forespørgsler og indekser.

**Independent Test**: Mål svartiden for de tungeste kald på startdatasættet før og efter.

**Acceptance Scenarios**:

1. **Given** startdatasættet, **When** receptionisten søger på en del af et gæstenavn, **Then**
   bruger databasen et indeks i stedet for at læse alle bookinger.
2. **Given** en booking med barsalg, **When** bookingen slettes, **Then** finder databasen
   barsalgene via et indeks.

---

### User Story 5 - Kravændringen kan spores (Priority: P2)

Som underviser og censor vil jeg kunne se, hvornår og hvorfor databasekravet blev ændret, så
beslutningen kan forklares ved fremlæggelsen (D8, D9).

**Why this priority**: Sporbarhed er et proceskrav, men systemet virker uden.

**Independent Test**: Kravoversigten, constitution og retningslinjerne nævner PostgreSQL og
henviser til denne spec. Ingen af dem kræver længere MySQL.

**Acceptance Scenarios**:

1. **Given** kravoversigten for tekniske krav, **When** T1 læses, **Then** står der PostgreSQL med
   dato og kilde for ændringen.
2. **Given** constitution, **When** princip IV og teknologiske rammer læses, **Then** står der
   PostgreSQL, og versionen er hævet med en Sync Impact Report.

---

### Edge Cases

- **Danske tegn**: Navne med æ, ø, å og accenter gemmes og vises korrekt, og navnesøgning
  skelner hverken mellem store og små bogstaver eller accenter, som før (001 FR-002).
- **Beløb**: Priser og summer har stadig to decimaler og afrundes ikke anderledes end før.
- **Datoer**: En ankomstdato flytter sig ikke en dag på grund af tidszoner.
- **Tidspunkter**: Barsalg og ind-/udtjekning får dansk lokaltid som før.
- **Gammelt volume**: En udvikler med et MySQL-volume fra før skiftet skal kunne starte forfra
  med én dokumenteret kommando.
- **Store lister**: Bookinglisten med sider og sortering virker på hele startdatasættet uden at
  blive langsommere end før.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Systemets database MUST være PostgreSQL (T1, kravændring 2026-11-03).
- **FR-002**: Al funktionalitet fra spec 001–005 MUST virke uændret efter skiftet.
- **FR-003**: API-kontrakten MUST være uændret: samme endpoints, felter, statuskoder og
  fejlformat (A3). Frontend og Tableau MUST ikke ændres.
- **FR-004**: Databasen MUST håndhæve de samme regler som før: primærnøgler, fremmednøgler,
  unikhed og check-regler (`docs/retningslinjer/database.md` §2), og skemaet MUST stadig være i 3NF.
- **FR-005**: Skema og startdata MUST oprettes automatisk ved første start på et tomt volume (T6),
  og startdatasættet MUST indeholde de samme rækker som før.
- **FR-006**: Backend MUST først forbinde, når databasen er klar (T4), og data MUST overleve
  genstart (T5).
- **FR-007**: To samtidige bookinger MUST aldrig få det samme værelse (001 FR-007).
- **FR-008**: Automatiske tests MUST køre mod en separat testdatabase, der nulstilles ved hver
  kørsel (`docs/retningslinjer/tests.md` §4).
- **FR-009**: Kravoversigten (`docs/krav/technical.md`), constitution og retningslinjerne MUST
  beskrive PostgreSQL og henvise til kravændringen. README MUST forklare, hvordan et gammelt
  MySQL-volume fjernes.
- **FR-010**: Fremmednøgler på de store tabeller (bookinger, barsalg) MUST have et indeks, og
  navnesøgning MUST kunne bruge et indeks (001 FR-002, 004 FR-007). Små tabeller (værelser,
  sæsoner, priser, drinks) får intet ekstra indeks.
- **FR-011**: Forespørgsler, der målbart er langsomme på startdatasættet, MUST forbedres uden at
  ændre resultatet. Nøgletal MUST stadig beregnes og ikke gemmes (A4).

### Key Entities

Ingen nye eller ændrede entiteter. Alle tabeller, kolonner og relationer fra
[`001 data-model`](../001-backoffice-bookinger/data-model.md) og senere specs bevares.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Hele systemet starter fra en tom maskine med én kommando, og back office kan bruges
  inden for 3 minutter.
- **SC-002**: 100 % af de eksisterende automatiske tests er grønne efter skiftet uden ændringer i
  testenes forventede værdier.
- **SC-003**: Alle nøgletal i dashboardet er identiske før og efter skiftet på samme
  startdatasæt.
- **SC-004**: Ingen ændringer i frontend eller API-kontrakt (0 ændrede linjer).
- **SC-005**: Navnesøgning og bookinglistens første side svarer på under 200 ms på
  startdatasættet.
- **SC-006**: Ingen bindende projektdokument (krav, constitution, retningslinjer, README) kræver
  længere den gamle database.

## Assumptions

- Der findes ingen produktionsdata. Startdata genereres af seed-scriptet, så skiftet kræver ingen
  datamigrering.
- Udviklere med et gammelt volume nulstiller med `docker compose down -v`, som allerede er
  praksis ved skemaændringer (`database.md` §5).
- Tableau henter kun data via API'et (A5), så Tableau-workbooken påvirkes ikke.
- Afslutningsdatoen (fremlæggelse 2026-11-06) gør, at skiftet skal holdes til datalaget og
  infrastrukturen. Andre forbedringer noteres og laves ikke.
