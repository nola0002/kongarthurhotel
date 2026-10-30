# Research: Receptionsoverblik

**Feature**: `003-receptionsoverblik` | **Dato**: 2026-10-30

Hver beslutning er truffet efter stigen i `docs/retningslinjer/kodekvalitet.md` §1: genbrug før
nyt, platform før egen kode og ingen nye afhængigheder. Featuren bygger på backend, database og
frontend fra 001, nøgletallene fra 002 og opgavens data fra 004. Kontrakten står i
[`backend/openapi.yaml`](../../backend/openapi.yaml) (se [`contracts/README.md`](contracts/README.md)).

## R1. Navigation og adresser

- **Beslutning**: Fire nav-punkter i `Shell.jsx`: Oversigt (`/oversigt`, `HouseIcon`),
  Belægningsplan (`/belaegningsplan`, `CalendarDotsIcon`), Bookinger og Barsalg. `/` redirecter
  til `/oversigt`, og `Login.jsx` sender til `fra` eller `/` efter login. Adresserne er
  `/oversigt?dato=YYYY-MM-DD` og `/belaegningsplan?fra=YYYY-MM-DD&dage=N`.
- **Rationale**: Danske URL'er og "URL'en er tilstanden" (designprincip 11 og 12). Ikonerne
  findes i den installerede `@phosphor-icons/react` 2.1.10.
- **Alternativer**: Faner på bookingsiden. Fravalgt, fordi brugeren netop vil have færre ting
  samlet ét sted.

## R2. Ét endpoint pr. skærm

- **Beslutning**: `GET /api/reception/overview?date=` og
  `GET /api/reception/room-plan?from=&days=` (felterne i [contracts/README.md](contracts/README.md)).
  Begge kræver session (`requireSession`).
- **Rationale**: Antal, "i huset" og ledighed er regler, som skal ligge i logiklaget
  (constitution III, FR-017). Ét kald pr. skærm giver én indlæsning, og React viser kun tal.
- **Alternativer**:
  - `/bookings?date=` og `/room-types?checkIn=&checkOut=`: fravalgt. React skulle tælle og
    filtrere, og planen ville kræve ét kald pr. dag.
  - Udvide `/analytics/occupancy`: fravalgt. Det er en flad tabel over alle år til Tableau med
    en anden adgangsmodel (BI-nøgle) og kender ikke de enkelte værelser.

## R3. Genbrug i backend

- **Beslutning**: En ny `receptionService` (`createReceptionService({ roomRepo, bookingRepo,
  barRepo, today })`) genbruger:
  - `isInHouseOn` og `deriveStatus` fra `bookingService.js`, som `barService` allerede gør.
  - `toApi` fra `bookingService.js` (eksporteres, importeres som `toApiBooking`), så
    ankomster og afrejser har præcis `Booking`-formen.
  - `bookingRepo.list()` med de eksisterende datogrænser:
    - Ankomster på `d`: `checkInAfter: d − 1, checkInOnOrBefore: d`.
    - Afrejser på `d`: `checkOutAfter: d − 1, checkOutOnOrBefore: d`.
    - `limit: 500`. Der kan højst være én ankomst og én afrejse pr. værelse pr. dag, og der er
      214 værelser.
  - `barRepo.listSales({ date })` for dagens `totalOre`.
  - `eachNight` og en ny `addDays` i `pricing.js`, som bruger de samme `toUtc`/`toIso`.
  - To nye læsefunktioner i `roomRepository.js`, der genbruger konstanten `OVERLAPS`:
    `listRooms()` (værelser med type, sorteret efter type og nummer som i `lockRoomsOfType`) og
    `listStays(from, to)` (bookinger, der overlapper `[from, to)`).
- **Rationale**: Der er kun én definition af "bor på hotellet", status og overlap. Ingen
  ændringer i `bookingRepository.js`, som 004 også ændrer.
- **Alternativer**: Et nyt `receptionRepository` med egen booking-SELECT. Fravalgt, fordi
  SELECT og mapping af `Booking` så ville findes to steder.

## R4. Ledighed pr. type og dag

- **Beslutning**: Én funktion i `receptionService` beregner for hver type og hver dato i
  vinduet: `free = antal værelser af typen − antal ophold af typen, hvor isInHouseOn(stay, dato)`.
  Oversigten kalder den med én dato (`[d]`), og planen med alle datoer i vinduet. Overblikket
  udleder `total = rooms.length`, `occupied = total − free[0]` og `free = free[0]`. "I huset" er
  ophold i `listStays(d, d + 1)`: `bookings` = antal og `guests` = summen af `guestCount`.
- **Rationale**: Samme formel begge steder, så Oversigt og Belægningsplan aldrig kan være
  uenige. Afrejsedagen tæller automatisk som ledig, fordi `isInHouseOn` er halvåben (001 R12).
  Et værelse har aldrig to overlappende ophold (001 FR-007), så `free` er aldrig negativ.
- **Ydelse**: Højst ca. 214 × 31 ophold-dato-tjek pr. type. Det er under 1 ms i Node.

## R5. Belægningsplanen tegnes som en almindelig tabel

- **Beslutning**: `<table>` med `border-separate border-spacing-0`, sticky `thead` og sticky
  første kolonne (`position: sticky`, Tailwind `sticky top-0`/`left-0`). En booking er én
  `<td colSpan={nætter i vinduet}>`, og ledige nætter er tomme `<td>`. Ingen virtualisering.
  React finder kolonnen ved at sammenligne ISO-strenge med `dates` og klipper til
  `[from, to)`. Rækkerne bygges én gang pr. svar.
- **Rationale**: 214 rækker × højst 31 celler er ca. 6.600 celler, hvilket en browser tegner
  uden problemer. En tabel er semantisk og tilgængelig, og `colSpan` udelukker overlap i
  tegningen, fordi et værelse aldrig har overlappende ophold.
- **Alternativer**:
  - CSS grid med `grid-column: start / span n`: lige så godt, men mindre semantisk.
  - Et kalender- eller virtualiseringsbibliotek: fravalgt (`docs/design/README.md`
    § Afhængigheder, YAGNI).
  - Halve celler for ankomst og afrejse (tape chart): fravalgt. Det er valgfrit i
    beslutningen og giver mere kode. Natbaserede kolonner viser allerede, at afrejsedagen er
    ledig.

## R6. Kundetilfredshed gemmes som en kolonne

- **Beslutning**: `bookings.satisfaction_score TINYINT NULL` med
  `CHECK (satisfaction_score BETWEEN 1 AND 5)`. `NULL` betyder "ikke registreret".
- **Rationale**: Én score pr. booking (spec, Assumptions). Den afhænger kun af bookingens nøgle,
  så kolonnen er i 3NF og ikke afledt. Den slettes sammen med bookingen.
- **Alternativer**: En tabel `satisfaction_responses` (booking_id, score, created_at).
  Fravalgt. Den ville være 1:1 med bookingen uden ekstra data, og historik over rettelser er
  ikke et krav.

## R7. Reglen og endpointet for tilfredshed

- **Beslutning**: `PUT /api/bookings/{id}/satisfaction` med `{ "score": 1–5 }` returnerer den
  opdaterede `Booking`. Det kræver session, og bookingsystemets nøgle giver 401.
  `bookingService.registerSatisfaction(id, score)`:
  1. `findById`, og hvis bookingen mangler, `NOT_FOUND` ("Bookingen findes ikke længere").
  2. Er `deriveStatus(booking, today()) !== 'departed'` (afrejse efter i dag), kastes
     `BOOKING_NOT_DEPARTED` (422, `field: 'score'`, "Tilfredshed kan først registreres på
     afrejsedagen").
  3. `bookingRepo.updateSatisfaction(id, score)`. Er 0 rækker berørt (slettet imens), kastes
     `NOT_FOUND`.
  4. Svarer med `getBooking(id)`.

  Et nyt kald erstatter scoren. `PUT /bookings/{id}` (redigering) rører ikke scoren.
- **Rationale**: Reglen bruger den eksisterende status, så "afrejst" kun er defineret ét sted.
  Et selvstændigt endpoint er nødvendigt, fordi `BookingInput` kræver alle felter og
  genberegner pris og værelse. Bookingsystemets nøgle (som 004 udvider til `PUT /bookings/{id}`)
  får ikke adgang til en receptionsopgave. Intervallet 1–5 håndhæves af kontrakten
  (`minimum`/`maximum`, 400 med feltet `score`) og af databasens `CHECK` som sidste værn
  (`docs/retningslinjer/database.md` §2).
- **Alternativer**: Et felt i `BookingInput`. Fravalgt af grundene ovenfor, og fordi
  bookingsystemet så kunne sætte scoren.

## R8. Kundetilfredshed som nøgletal (FT12)

- **Beslutning**: `analyticsService.kpis()` får to rækker pr. år:
  - `customerSatisfaction` (label "Kundetilfredshed", unit `score`): gennemsnittet af
    `satisfactionScore` for bookinger med `checkOut` i året, der har en score. 0, når der ingen
    er (samme `ratio`-hjælper som de øvrige nøgletal). Værdien afrundes ikke. Tableau
    formaterer den.
  - `satisfactionResponses` (label "Besvarelser", unit `count`): antallet af bookinger med
    `checkOut` i året, der har en score.

  Årene udvides med bookingernes afrejseår, så et ophold over nytår tæller i afrejseåret, også
  hvis det år ellers ikke har data. `/analytics/bookings` får `satisfactionScore` (heltal eller
  `null`). `Kpi.unit` får værdien `score`.
- **Rationale**: Scoren registreres ved afrejse, så afrejseåret er det naturlige år.
  Formlen ligger i logiklaget (KB-A4), og Tableau viser kun tallet.
- **Alternativer**: Ankomstår (som `bookings`/`guests`). Fravalgt, fordi en score fra januar på
  et ophold, der startede i december, så ville tælle i et år, hvor gæsten ikke kunne svare.

## R9. Genererede historiske scores

- **Beslutning**: `generate-seed.js` (efter 004) giver bookinger, hvis afrejse ligger på eller
  før seedens skæringsdato (samme dato som barsalgets "indtil i dag" i 004), en score med den
  eksisterende deterministiske tilfældighedsgenerator: 80 % svarer, fordelt med 5: 45 %, 4: 35 %,
  3: 12 %, 2: 5 % og 1: 3 % (gennemsnit ca. 4,1). Kommentaren i scriptet og README siger, at
  scorerne er genererede, fordi opgavens datasæt ikke har tilfredshedsdata.
- **Rationale**: Dashboardet og overblikket skal vise realistiske data fra start, og
  oprindelsen skal være tydelig (D8, ejerskab).
- **Alternativer**: Ingen historiske scores. Fravalgt, fordi nøgletallet så ville være 0 ved
  fremlæggelsen.

## R10. Datohjælpere

- **Beslutning**:
  - Backend: `addDays(iso, n)` i `pricing.js` ved siden af `eachNight` med de samme
    `toUtc`/`toIso` (UTC-midnat, så sommertid ikke flytter datoen).
  - Frontend: `addDays(iso, n)` i `format.js` ud fra `toDate` (kl. 12) og
    `toLocaleDateString('sv-SE')`. Bruges kun til links for forrige og næste dag eller periode.
    Planens "Næste" bruger `to` fra API'et.
- **Rationale**: Ingen datobibliotek (designdokumentet fravælger dem). Én hjælper pr. side af
  API'et, placeret hvor de andre datohjælpere bor.

## R11. Standardværdier og validering af parametre

- **Beslutning**: `date` og `from` er valgfrie (`format: date`). Mangler de, bruger servicen
  `today()` (Europe/Copenhagen). `days` er et heltal 7–31 med standard 14. Ugyldige værdier
  giver 400 `VALIDATION_ERROR` fra validatoren. `errors.js` får labels for `from` ("Fra"),
  `days` ("Antal dage") og `score` ("Tilfredshed").
- **Rationale**: Validatoren håndhæver allerede kontrakten. Frontend sender kun parametre, der
  står i adressen, så "i dag" altid er serverens dato.

## R12. Arbejdsdeling og 004

- **Beslutning**: Tasks deles i tre spor (plan.md § Arbejdsdeling). Spor F og B rører ikke
  filer, som 004 ændrer, bortset fra ordet `export` i `bookingService.js`. Spor I rører 004's
  filer og starter først, når 004 er implementeret.
- **Rationale**: To agenter kan arbejde samtidig uden at overskrive hinanden. Navnefelterne
  (`firstName`, `familyName`) og de 214 værelser kommer fra 004, så kontrakten bruger dem fra
  start.
