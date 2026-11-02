# Research: Enterprise back office (005)

## R1. Kontrakten først, direkte i OpenAPI

- **Beslutning**: Alle nye endpoints og felter er skrevet i `backend/openapi.yaml`, før
  implementeringen starter. `contracts/README.md` beskriver kun adfærd og ejerskab.
- **Begrundelse**: OpenAPI-filen er single source of truth (kodekvalitet §2), og
  `express-openapi-validator` afviser kald til endpoints, der ikke står i filen. Fem agenter kan
  derfor bygge mod den samme kontrakt uden at røre den samme fil.
- **Alternativ**: En kontrakt i Markdown, som overføres bagefter. Fravalgt: to sandheder.

## R2. Parallel implementering med ejerskab pr. fil

- **Beslutning**: Fem agenter (B1, B2, F1, F2, F3) med faste filer (plan § Project Structure).
  Fælles filer ændres kun før start. Ingen agent committer. Commits laves bagefter efter
  gruppens konvention.
- **Begrundelse**: Brugeren bad om parallelle agenter. Faste filer forhindrer, at to agenter
  overskriver hinanden.

## R3. Ind- og udtjekning kun for i dag

- **Beslutning**: `checked_in_at`/`checked_out_at` (DATETIME NULL). Status udledes af datoer,
  dags dato og registreringerne (spec FR-004, OpenAPI `Booking.status`). Et ophold, der startede
  før i dag, regnes som tjekket ind, og et, der sluttede før i dag, som afrejst.
- **Begrundelse**: Startdata har ingen registreringer, og systemets dato flytter sig (fremlæggelsen
  er 6/11). Hvis alle ophold uden registrering blev "ikke ankommet", ville alt før i dag se
  forkert ud. Reglen giver en korrekt forside uden at ændre 233.644 bookinger.
- **Alternativ**: Udfyld registreringer i seed. Fravalgt: forkert, så snart datoen passerer seedens slutdato.
- **Konsekvens**: Tilfredshed kræver nu today ≥ checkOut (status `departing`, `checked_out` eller
  `departed`) i stedet for `departed`, fordi afrejsedagen nu har sin egen status.

## R4. Paginering med LIMIT/OFFSET

- **Beslutning**: `page`/`pageSize` med `LIMIT ? OFFSET ?`, sortering via en fast whitelist
  (`checkIn` → `b.check_in` osv.). En side efter den sidste giver den sidste side.
- **Begrundelse**: 233.644 rækker. OFFSET er hurtigt nok (< 100 ms i MySQL ved denne størrelse) og
  langt enklere end keyset-paginering. Sorteringskolonnen kommer fra en whitelist, så der aldrig
  bygges SQL af brugerinput (kodekvalitet §3).
- **Alternativ**: Keyset/cursor. Fravalgt: kan ikke hoppe til side N.

## R5. Paletten genbruger `GET /bookings`

- **Beslutning**: Et tal i `q` matcher også booking-id og værelsesnummer eksakt. `sort=nearest`
  sorterer efter afstand fra ankomst til i dag, så gæsten, der bor på værelset nu, kommer først.
  Paletten kalder `?q=…&sort=nearest&pageSize=8&view=all`.
- **Begrundelse**: Ét søge-endpoint. Ingen ny søgning i backend.

## R6. Folioens natpriser fordeles som i BI

- **Beslutning**: Nætterne får hver sin andel af den fastfrosne pris i forhold til nattens
  sæsonpris. `allocateRevenue` fra `analyticsService.js` genbruges (002 FR-015).
- **Begrundelse**: Én regel for fordeling. Summen er altid præcis bookingens pris (SC-005), også
  for importerede og historiske bookinger med en anden pris end prislisten.

## R7. Ordre i én transaktion

- **Beslutning**: `POST /bar-sales/orders` validerer alle linjer og indsætter dem i `withTransaction`.
  Kurven er React-state og gemmes ikke.
- **Begrundelse**: FR-012 (alle eller ingen). En ordre-tabel ville være en ubestilt feature.

## R8. Omsætning

- **Beslutning**: Bar: SQL-aggregering (`SUM`, `GROUP BY` periode og kategori) i et repository,
  andele og top 5 i servicen. Værelser: bookinger, der overlapper perioden, fordeles pr. nat med
  `allocateRevenue`. Kun nætter i perioden tæller. `groupBy=day` over 1096 dage afvises.
- **Begrundelse**: Aggregering i SQL er tilladt af hensyn til ydelse, formler i services (database.md §6).
  Samme natfordeling som BI og folio.

## R9. Administration

- **Beslutning**: `PUT /admin/prices/{roomTypeId}/{seasonId}` (upsert) og `PUT /admin/drinks/{id}`.
  `PUT /auth/password` kræver den nuværende adgangskode og hasher med `scrypt` som i dag.
- **Begrundelse**: Priserne bor i databasen (SSOT). Gamle priser er fastfrosne på bookinger og salg
  (FR-009, FR-010), så en ændring påvirker kun nye.

## R10. Frontend uden nye biblioteker

- **Beslutning**: Paletten er en native `<dialog>` med en liste og `aria-activedescendant`.
  Paginering, kurv og grafer er Tailwind og simple `<div>`-søjler. Ingen chart-bibliotek.
  Login bruger `frontend/public/kong-arthur-facade.webp` som `<img>` med `object-cover`.
- **Begrundelse**: Kodekvalitet §4. Søjler med bredde/højde i procent af API'ets tal er nok til
  omsætningssiden.
