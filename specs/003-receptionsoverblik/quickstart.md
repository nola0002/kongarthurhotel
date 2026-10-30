# Quickstart: validering af receptionsoverblikket (003)

Formålet er at bevise, at featuren virker fra ende til anden. Kontrakten står i
[`backend/openapi.yaml`](../../backend/openapi.yaml) (oversigt i
[`contracts/README.md`](contracts/README.md)), og de afledte entiteter står i
[`data-model.md`](data-model.md).

## Forudsætninger

- 004 er implementeret (214 værelser, 8 typer, gæstens navn som fornavn og efternavn).
- Skemaet er ændret, så databasen startes fra et tomt volume:

  ```bash
  docker compose down -v && cp .env.example .env && docker compose up --build
  ```

- Log ind med curl og gem session-cookien:

  ```bash
  set -a; . ./.env; set +a
  curl -s -c /tmp/ka.txt -H 'Content-Type: application/json' \
    -d "{\"username\":\"$SEED_USERNAME\",\"password\":\"$SEED_PASSWORD\"}" \
    http://localhost:3000/api/auth/login
  ```

## Del 1: API'et med curl

| # | Kald | Forventet resultat | Krav |
|---|---|---|---|
| 1 | `curl -s -b /tmp/ka.txt http://localhost:3000/api/reception/overview` | `200`. `date` er dags dato. `arrivals` og `departures` er `Booking`-objekter med `firstName`, `familyName` og `satisfactionScore`. `rooms` har 8 rækker, og for hver er `free + occupied = total`. Summen af `total` er 214 | FR-002, SC-004 |
| 2 | Samme kald med `?date=2025-07-15` | Alle felter gælder 15. juli 2025. Tjek én type mod `GET /api/bookings?date=2025-07-15`: antal bookinger af typen = `occupied` | FR-002, FR-004 |
| 3 | `curl -s -b /tmp/ka.txt 'http://localhost:3000/api/reception/room-plan?from=2025-12-20&days=31'` | `200`. `to` er `2026-01-20`, `dates` har 31 datoer. Hver `free` har 31 tal. Ophold over nytår står i `stays` med deres egne datoer | FR-005–FR-007 |
| 4 | Room-plan med `days=6` eller `days=32` | `400 VALIDATION_ERROR` med `field: "days"` | FR-005 |
| 5 | Overview med `?date=2026-02-30` | `400 VALIDATION_ERROR` med `field: "date"` | Edge case |
| 6 | Vælg en booking med `checkOut` i morgen: `curl -s -b /tmp/ka.txt -X PUT -H 'Content-Type: application/json' -d '{"score":4}' http://localhost:3000/api/bookings/<id>/satisfaction` | `422 BOOKING_NOT_DEPARTED`, "Tilfredshed kan først registreres på afrejsedagen" | FR-011, SC-005 |
| 7 | Samme kald på en booking fra `departures` i dag | `200` og `"satisfactionScore": 4`. Et nyt kald med `{"score":5}` giver `5` | FR-011, FR-013 |
| 8 | `{"score":0}`, `{"score":6}` eller `{"score":3.5}` | `400 VALIDATION_ERROR` med `field: "score"` | FR-011, SC-005 |
| 9 | Et af kaldene uden `-b /tmp/ka.txt`, med `X-API-Key: $BOOKING_SYSTEM_API_KEY` eller med `Authorization: Bearer $BI_API_KEY` | `401` | FR-018 |
| 10 | `curl -s -H "Authorization: Bearer $BI_API_KEY" http://localhost:3000/api/analytics/kpis` | For hvert år er der rækker med `customerSatisfaction` (unit `score`, ca. 4,1 i seed) og `satisfactionResponses` (unit `count`) | FR-014, FT12 |
| 11 | `/api/analytics/bookings` med BI-nøglen | Hver række har `satisfactionScore` (heltal eller `null`) | FR-014 |
| 12 | Tjek for ét år: gennemsnittet af `satisfactionScore` (ikke `null`) for rækker med `checkOut` i året = `customerSatisfaction`, og antallet = `satisfactionResponses` | Ens | SC-006 |

## Del 2: browseren

Åbn http://localhost:5173 og log ind.

| # | Scenarie | Forventet resultat | Krav |
|---|---|---|---|
| 1 | Efter login | Oversigt for dags dato vises. Navigationen er Oversigt, Belægningsplan, Bookinger, Barsalg | FR-001, SC-001 |
| 2 | Oversigt: læs fliserne | Ankomster, Afrejser, I huset (med antal gæster) og dagens barsalg. "Ledige værelser" viser "N ledige af M" for alle 8 typer og "Udsolgt" ved 0 | FR-002 |
| 3 | Klik "Næste", "Forrige", "I dag" og vælg en dato | Adressen skifter (`?dato=`), og alle fliser følger datoen | FR-004 |
| 4 | Klik på en gæst under Ankomster | Bookingdetaljen åbnes | FR-003 |
| 5 | Afrejser i dag: "Registrér tilfredshed", vælg 4, "Gem" | Toasten "Tilfredshed registreret – … · 4 af 5". Rækken viser "4 af 5" | FR-011, FR-012, SC-007 |
| 6 | Åbn en afrejst booking i Bookinger | Detaljesiden viser scoren eller knappen "Registrér tilfredshed". En kommende booking har ingen knap | FR-012 |
| 7 | Belægningsplan | 14 dage fra i dag. Værelser grupperet efter type, en "Ledige"-række pr. type. Bjælker med gæstens navn og en forklaring over statusmarkørerne | FR-005–FR-007, FR-009 |
| 8 | Vælg "31 dage" og scroll ned og til siden | Datorækken og værelsesnumrene bliver stående. Planen vises på under 2 sekunder | SC-003 |
| 9 | Find en type med 0 ledige en dag og bladr "Næste"/"Forrige" | Adressen har `?fra=&dage=`. Et ophold, der går ud over kanten, har en lige kant og fortsætter i næste periode | FR-006, FR-008 |
| 10 | Find et ledigt værelse af typen "Suite" på en bestemt dato | Lykkes på under 30 sekunder via "Ledige"-rækken og den tomme celle | SC-002 |
| 11 | Klik på en bjælke | Bookingdetaljen åbnes | FR-009 |
| 12 | Slet en booking i en anden fane, og klik derefter på dens bjælke i planen | "Bookingen findes ikke længere". Efter genindlæsning er bjælken væk | Edge case |
| 13 | Barsalg | Under titlen står "Helene Christine · lobbybaren" og dagens salg | FR-016 |
| 14 | (Valgfri FR-010) Klik på en ledig celle | "Ny booking" åbner med værelsestype og ankomst udfyldt | FR-010 |

## Del 3: dashboardet

Åbn `tableau/kong-arthur.twbx`, kør Data → Refresh All Extracts, og tjek, at arket
"Kundetilfredshed" viser `customerSatisfaction` og `satisfactionResponses` pr. år fra
`/analytics/kpis` uden egne formler (FR-014, KB-A4).

## Automatiske tests

```bash
docker compose exec backend npm test
```

Forventet: alle tests grønne, inkl. `receptionService.test.js`, FT12-testene i
`analyticsService.test.js`, tilfredshedsreglen i `bookingService.test.js` og de nye API-tests.
