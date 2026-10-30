# Implementation Plan: Opgavedata – data og integration som i opgaven

**Branch**: `004-opgavedata` (der arbejdes på `main`, jf. KB-D12) | **Date**: 2026-10-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-opgavedata/spec.md`

## Summary

Systemets data og bookingintegration gøres identiske med opgaven og dens datasæt. Feature 004
er fundamentet, og feature 003 (receptionsoverblik) bygger ovenpå. 004 implementeres derfor
først.

- **Kildefiler**: Opgavens filer kopieres uændret til `db/source/`. Seed-generatoren læser dem
  og genererer `db/02_seed.sql`, som aldrig redigeres i hånden.
- **Hotellet**: 214 værelser i opgavens 8 værelsestyper med kapacitet 1–4 og i alt 428
  gæster. Lav-, mellem- og højsæson med julehøjsæson 20.–31. december. Priser fra opgavens
  intervaller.
- **Bookinger**: De 1000 CSV-rækker importeres uændret i 2025. Resten af perioden
  2025-01-01–2027-02-28 fyldes op til ca. 70 % belægning med samme navne og lande.
- **Gæstens navn**: `guest_name` erstattes af `first_name` og `family_name` (1NF). API'et får
  `firstName`/`familyName` i stedet for `guestName`, og frontend får to felter.
- **Bar**: Opgavens 30 drinks. Salget i 2025 giver præcis opgavens "Units Sold" pr. drink.
- **Bookingsystemet**: `X-API-Key` accepteres også på `PUT` og `DELETE /bookings/{id}`.

Der kommer ingen nye afhængigheder, tabeller, endpoints eller skærme. Ændringerne er data,
ét navnefelt, der bliver til to, og én middleware på to routes mere. Beslutningerne står i
[research.md](research.md) (R1–R15).

## Technical Context

**Language/Version**: JavaScript (ES modules) på Node.js 24 LTS, React 19 (JSX). Uændret fra
001.

**Primary Dependencies**: Ingen nye. Seed-generatoren bruger kun `node:fs`, `node:assert` og
`Intl.DisplayNames` (research R2). Drinkfilen (xlsx) eksporteres én gang til CSV i stedet for
at tilføje en xlsx-pakke.

**Storage**: MySQL 8.4 som i 001. Skemaændring kun i `bookings` (navnefelterne, data-model.md).
`db/source/` ligger i den mappe, MySQL-containeren monterer som `docker-entrypoint-initdb.d`.
Entrypointet kører kun `*.sh`/`*.sql*` i roden og ignorerer undermapper (research R1).

**Testing**: `node:test` som i 001. Nye og ændrede tests: navnevalidering i
`bookingService.test.js`, navnesøgning og bookingsystemets nøgle på `PUT`/`DELETE` i
`api.test.js`. Seed-generatoren tester sig selv med `node:assert` og stopper, hvis tallene
ikke svarer til opgaven (research R15). Optællingerne mod opgaven står i quickstart.md.

**Target Platform**: Docker Compose på udviklermaskiner (uændret).

**Project Type**: Web-applikation (backend + frontend) plus database og API-dokumentation.

**Performance Goals**:
- `docker compose up` fra tomt volume er klar på under 3 minutter (SC-005). Healthchecket
  tillader 60 s + 40 × 3 s = 180 s.
- Bookinglisten og søgning svarer stadig under 1 sekund med ca. 21.600 bookinger.

**Constraints**:
- Data skal svare 100 % til opgaven (brugerens krav).
- Én `docker compose up` (KB-T3). Ingen nye afhængigheder. Fremlæggelse 2026-11-06.
- Feature 003 må først starte, når 004 er færdig (fælles filer, se tasks.md § Ejerskab).

**Scale/Scope**:
- 214 værelser, 8 værelsestyper, 3 sæsoner, 20 lande og 30 drinks.
- Ca. 21.600 bookinger (1000 fra CSV) og ca. 133.000 barsalg. `02_seed.sql` vokser fra ca.
  2 MB til ca. 10 MB (research R14).
- 1 skemaændring, 2 ændrede API-skemaer, 2 routes med ny adgang og 5 frontendfiler.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princip | Krav | Plan | Status |
|---|---|---|---|
| I. Trelagsarkitektur | Kun repositories kender SQL. Services har reglerne | Navnesøgningen er ét SQL-prædikat i `bookingRepository`. Trim og "skal udfyldes" ligger i `bookingService`. Adgangen ligger i `auth.js` og monteres i routen | ✅ |
| II. API-først + OpenAPI | Kontrakten opdateres i samme commit | `BookingInput` og `Booking` får `firstName`/`familyName`. `PUT`/`DELETE /bookings/{id}` får `security: [session, bookingSystemKey]` (contracts/README.md) | ✅ |
| III. Logik i logiklaget | Frontend regner ikke | Frontend sætter kun navnet sammen til visning (`fornavn efternavn`) ét sted i `format.js`. Priser for genererede bookinger beregnes med `calculateStayPrice` | ✅ |
| IV. Container og reproducerbart | Én compose. Seed via init-script. Priser og sæsoner som tabeller (KB-T7) | Skema og seed er stadig `db/01_schema.sql` og genereret `db/02_seed.sql`. Data ligger i de eksisterende tabeller | ✅ |
| V. Testbar logik | Regler har tests | Navneregel, søgning og nøgle på `PUT`/`DELETE` får tests. Generatoren har selvtjek | ✅ |
| VI. Enkelhed og ejerskab | YAGNI, ingen nye afhængigheder | Ingen nye pakker, tabeller eller endpoints. xlsx eksporteres én gang i stedet for en parser | ✅ |
| Retningslinjer | 3NF, SSOT, `DECIMAL` | Navnet splittes (1NF). Kildefilerne er sandheden for data, og generatoren er eneste vej til seed. Drinkpriser er `DECIMAL(10,2)` med to decimaler | ✅ |

**Gate (før research)**: Bestået. Ingen overtrædelser.

**Gate (efter design)**: Bestået. Designet ændrer kun `bookings` (to navnekolonner i stedet
for én, research R9). Alt andet er indhold i eksisterende tabeller. Den eneste nye
konstruktion er en fast oversættelse fra CSV-filens engelske navne (værelsestyper, sæsoner,
lande, kategorier) til systemets data. Den ligger kun i seed-generatoren, fordi den kun
bruges ved import (research R4, R8). Ingen Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/004-opgavedata/
├── spec.md              # Krav (/speckit-specify + /speckit-clarify)
├── plan.md              # Denne fil
├── research.md          # Phase 0: beslutninger og begrundelser (R1–R15)
├── data-model.md        # Phase 1: skemaændring og dataindhold
├── quickstart.md        # Phase 1: optællinger mod opgaven og integrationstjek
├── contracts/
│   └── README.md        # ændringerne i backend/openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

Kun filer, som 004 ændrer eller opretter:

```text
db/
├── .gitattributes          # + source/* -text, så kildefilerne aldrig konverteres (CRLF)
├── 01_schema.sql           # bookings: first_name + family_name i stedet for guest_name
├── 02_seed.sql             # GENERERET igen
└── source/                 # NY: opgavens filer, uændrede (research R1)
    ├── international_names_with_rooms_1000.csv
    ├── international_names_with_rooms_1000.xlsx   # kun dokumentation ("Müller", R3)
    ├── drinks_menu_with_sales.xlsx
    └── drinks_menu_with_sales.csv                 # eksporteret én gang fra xlsx (R2)
backend/
├── openapi.yaml            # navnefelter, security på PUT/DELETE, beskrivelser
├── scripts/
│   └── generate-seed.js    # læser db/source, nye data, selvtjek
├── src/
│   ├── auth.js             # kommentar: nøglen gælder POST/PUT/DELETE
│   ├── errors.js           # FIELD_LABELS: firstName, familyName
│   ├── routes/bookings.js  # allowBookingSystemKey på PUT og DELETE
│   ├── services/bookingService.js     # validering og toApi med to navne
│   └── repositories/bookingRepository.js  # SELECT/INSERT/UPDATE og q-prædikat
└── test/
    ├── bookingService.test.js
    └── api.test.js
frontend/src/
├── format.js               # guestName(booking) = "fornavn efternavn"
├── BookingForm.jsx         # to felter: Fornavn, Efternavn
└── pages/
    ├── Bookings.jsx
    ├── BookingDetail.jsx
    └── BarSales.jsx
README.md                   # Testdata, curl-eksempel, bookingsystemets nøgle
docs/design/skaerme.md      # navnefelter
docs/krav/technical.md      # KB-T10: POST/PUT/DELETE
specs/001-backoffice-bookinger/{spec,data-model,research}.md  # noter om ændringerne fra 004
```

**Structure Decision**: Uændret web-applikation fra 001. Der kommer ingen nye moduler.
Kildefilerne ligger under `db/`, fordi de er sandheden for databasens startdata, og fordi
backend-containeren allerede monterer `./db` som `/db`. Så kan generatoren køre både i
containeren og på host.

## Afhængighed til feature 003

003 (receptionsoverblik) bygger på 004 og må først implementeres bagefter:

- 003 tilføjer `bookings.satisfaction_score`, `Booking.satisfactionScore`, nye endpoints og
  skærme. Det planlægges ikke her.
- 003 bruger `firstName`/`familyName` fra 004 i sine svar (fx `stays` i belægningsplanen).
- 003 og 004 rører de samme filer: `db/01_schema.sql`, `backend/scripts/generate-seed.js`,
  `backend/openapi.yaml` og `Booking`-visningerne i frontend. Når 004 er færdig og committet
  først, er der ingen konflikter.
- 003's belægningsplan skal kunne vise 214 værelser. Det er 004's antal.

## Risici

| Risiko | Konsekvens | Håndtering |
|---|---|---|
| Seed vokser til ca. 155.000 rækker | Langsommere første start | Måles i quickstart (Del 1). Healthchecket giver 180 s. Rækker indsættes stadig 1000 pr. `INSERT` |
| `/api/analytics/bar-sales` og `/room-nights` (002) returnerer alle rækker | Ca. 6,5 gange flere barsalg og ca. 4 gange flere værelsesnætter i Tableau-extracts | Svartid måles i quickstart (Del 5). Bliver det for langsomt, er det en opgave for 002, ikke 004 |
| CSV-filen har CRLF, og `core.autocrlf=input` ville konvertere den ved commit | Kildefilen ville ikke være uændret | `db/.gitattributes`: `source/* -text` (research R1) |
| Excel-eksporten af drinkpriser har float-støj (fx `69.09999999999999`) | `toOre` afkorter og ville give 69,09 kr. | Eksporten har to decimaler, og generatoren kontrollerer prisen mod en forventet sum (research R2, R15) |
| Ingen danske gæster og ingen andre lande end de 20 | Receptionisten kan ikke registrere fx en dansk gæst | Brugerens beslutning (100 % som opgaven). Noteret i spec Assumptions og som åbent punkt |

## Implementeringsrækkefølge (input til /speckit-tasks)

1. **Fundament**: kildefiler og `.gitattributes`, drink-CSV, skemaændring.
2. **US3 Navn** i backend (repository, service, fejl-labels, kontrakt, tests) og frontend.
   Det skal ske før seed, fordi seed skriver de nye kolonner.
3. **US1 Hotellet** og **US2 Bookinger** i generatoren, derefter **US4 Bar**. Seed genereres
   og indlæses fra tomt volume.
4. **US5 Bookingsystemet** (uafhængig af data).
5. **Afslutning**: dokumentation (README, 001-noter, design, kravtabel), quickstart og
   `/speckit-converge`.

## Complexity Tracking

Ingen overtrædelser af constitution.
