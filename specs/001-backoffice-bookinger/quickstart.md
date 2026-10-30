# Quickstart: validering af Back Office (001)

Formålet er at bevise, at featuren virker fra ende til anden. Kontrakten står i
[`backend/openapi.yaml`](../../backend/openapi.yaml), og datamodellen i
[`data-model.md`](data-model.md).

## Start

Start, login, Swagger UI, nulstilling og fejlfinding står ét sted:
[README § Kom i gang](../../README.md#kom-i-gang). Valideringen starter fra en tom maskine:

```bash
docker compose down -v && cp .env.example .env && docker compose up --build
```

Systemet er klar, når backend logger `API listening on :3000`.

## Valideringsscenarier

Hvert scenarie svarer til acceptkriterier i [`spec.md`](spec.md).

| # | Scenarie | Forventet resultat | Krav |
|---|---|---|---|
| 1 | Åbn http://localhost:5173 uden at være logget ind | Login-siden vises, og ingen data er synlige | US0, FR-015 |
| 2 | Log ind med forkert adgangskode | En generel fejlbesked vises | US0 |
| 3 | Log ind korrekt | Bookinglisten vises med "Viser 100 af N" | FR-001 |
| 4 | Søg på en del af et gæstenavn med små bogstaver | Kun matchende bookinger vises | FR-002 |
| 5 | Filtrér på en dato (også en dato i fortiden) | Kun gæster, der bor på hotellet den dato, vises. Fanen "Alle" er aktiv | FR-002 |
| 6 | "Ny booking": vælg type og datoer over et sæsonskifte | Prisen vises pr. sæson før gem og matcher manuel beregning | FR-008, SC-004 |
| 7 | Gem bookingen | Toasten nævner det tildelte værelse, og bookingen står i listen | FR-003, FR-016 |
| 8 | Opret booking med flere gæster end typens kapacitet | Fejlen vises under "Antal gæster" | FR-006 |
| 9 | Vælg en periode, hvor alle værelser af en type er optaget | Typen er deaktiveret (udsolgt) i formularen. Selve afvisningen (409 "Ingen ledige værelser af typen …") verificeres via scenarie 14/`curl` eller samtidighedstesten | FR-007 |
| 10 | Rediger en booking til nye datoer | Prisen genberegnes, og værelset beholdes, hvis det er ledigt | FR-004 |
| 11 | Slet: annullér i dialogen, slet derefter med bekræftelse | Bookingen findes efter annullering og er væk efter bekræftelse | FR-005 |
| 12 | Barsalg: 2 × en cocktail lagt på en gæst i huset | Toasten viser beløbet fra API'et, og salget vises i dagens salg og på bookingen | FR-010, FR-010a |
| 13 | Slet bookingen fra scenarie 12 | Barsalget findes stadig, nu uden værelse | FR-010a |
| 14 | Eksternt bookingsystem (se nedenfor) | 201, og bookingen vises med kilden "Bookingsystem" | FR-013, KB-T10 |
| 15 | `docker compose restart` | Alle data findes stadig | KB-T5 |
| 16 | Åbn http://localhost:5173/docs og kør `GET /countries` via "Try it out" efter login i samme browser | Listen returneres (samme origin, så session-cookien sendes med) | KB-A3, KB-D7 |

### Scenarie 14: eksternt bookingsystem

Kør `curl`-kaldet i [README § Eksternt bookingsystem](../../README.md#eksternt-bookingsystem-curl).

Forventet: `201 Created` med `"source": "booking_system"`.

Fejlvarianter:
- Uden header og uden cookie, eller med forkert nøgle: `401`.
- Med en overlappende, udsolgt periode: `409` med `ROOM_TYPE_FULLY_BOOKED`.

I drift sendes kaldet over HTTPS gennem en reverse proxy (se `research.md` R7).

## Automatiske tests

```bash
docker compose exec backend npm test
```

Forventet: alle tests grønne. Tests af forretningsregler og priser (FR-006–FR-008, FR-010a)
kører uden database (falske repositories). API-testene nulstiller og bruger databasen
`kongarthur_test` og rører ikke udviklingsdata.
