# Datamodel: Receptionsoverblik

**Feature**: `003-receptionsoverblik` | **Dato**: 2026-10-30

Featuren tilføjer **én kolonne** og ingen tabeller. Resten er afledte entiteter, som beregnes
ved hvert kald og aldrig gemmes (`docs/retningslinjer/database.md`, "Gem aldrig afledte data").
Tabellerne står i [`001 data-model.md`](../001-backoffice-bookinger/data-model.md) med 004's
ændringer (gæstens navn som `first_name` og `family_name`, 214 værelser i 8 typer).
`db/01_schema.sql` er sandheden for skemaet, og `backend/openapi.yaml` er sandheden for
felterne i API'et.

## Ny kolonne: `bookings.satisfaction_score`

| Kolonne | Type | Constraints |
|---|---|---|
| `satisfaction_score` | `TINYINT` | NULL, `CHECK (satisfaction_score BETWEEN 1 AND 5)` |

- `NULL` = ikke registreret. Kolonnen placeres efter `source`.
- **3NF**: Scoren afhænger kun af bookingens nøgle. Den er et faktum om opholdet, ikke en
  afledt værdi eller en kopi af stamdata.
- Ingen index. Den filtreres aldrig alene, kun læses med bookingen.
- Sletning af bookingen fjerner scoren (hard delete, som 001).
- API-feltet hedder `satisfactionScore` (heltal eller `null`) på `Booking` og `AnalyticsBooking`.

### Validering

| Regel | Database | Service (dansk besked) | Fejlkode |
|---|---|---|---|
| Score er et heltal 1–5 | `CHECK` | – (kontrakten: `integer`, `minimum: 1`, `maximum: 5`) | `VALIDATION_ERROR` 400 (felt `score`) |
| Bookingen findes | – | ja ("Bookingen findes ikke længere") | `NOT_FOUND` 404 |
| Kun når gæsten er rejst: `checkOut <= today` (status `departed`) | – | ja ("Tilfredshed kan først registreres på afrejsedagen") | `BOOKING_NOT_DEPARTED` 422 (felt `score`) |

### Livscyklus

`NULL` → score (registrering på eller efter afrejsedagen) → ny score (rettelse). Scoren kan
ikke sættes tilbage til `NULL`. `PUT /bookings/{id}` (redigering) ændrer den ikke. Flyttes
afrejsen efter registrering ud i fremtiden, bevares scoren (bevidst forenkling, sjælden
situation).

## Afledt: Dagsoverblik (`GET /reception/overview`)

Beregnes i `receptionService.overview(date)`. `d` = den valgte dato, standard `today()`
(Europe/Copenhagen).

| Felt | Afledt af |
|---|---|
| `date` | `d` |
| `arrivals` | `Booking[]` med `check_in = d` (bookingRepo-grænserne `checkInAfter: d−1`, `checkInOnOrBefore: d`) |
| `departures` | `Booking[]` med `check_out = d` (`checkOutAfter: d−1`, `checkOutOnOrBefore: d`) |
| `inHouse.bookings` | Antal bookinger med `isInHouseOn(booking, d)` (`check_in <= d < check_out`) |
| `inHouse.guests` | Σ `guest_count` for de samme bookinger |
| `rooms[].roomTypeId`, `rooms[].roomType` | `room_types.id`, `room_types.name` (sorteret efter `id`) |
| `rooms[].total` | Antal `rooms` af typen |
| `rooms[].occupied` | Antal bookinger af typen med `isInHouseOn(booking, d)` |
| `rooms[].free` | `total − occupied` |
| `barSalesTotal` | `COALESCE(SUM(quantity × unit_price), 0)` for salg på `d` (DKK), fra `barRepo.listSales` |

`status` på hver `Booking` er stadig relativ til dags dato (001), også når `d` er en anden dag.

**Invarianter** (testes i `receptionService.test.js`):

- `free + occupied = total` for hver type.
- En booking med afrejse `d` tæller under `departures`, men ikke i `inHouse` eller `occupied`.
- En booking med ankomst `d` tæller under `arrivals` og i `inHouse` og `occupied`.

## Afledt: Belægningsplan (`GET /reception/room-plan`)

Beregnes i `receptionService.roomPlan({ from, days })`. `from` er standard `today()`, og
`days` er 7–31 med standard 14.

| Felt | Afledt af |
|---|---|
| `from` | Første viste dato |
| `to` | `from + days`. **Eksklusiv**: dagen efter sidste viste dato og `from` for næste periode |
| `dates` | `days` ISO-datoer fra `from` (`eachNight(from, to)`) |
| `roomTypes[].id`, `.name` | `room_types` (sorteret efter `id`) |
| `roomTypes[].rooms[]` | `{ id, number }` for typens værelser, sorteret numerisk efter værelsesnummer (som `lockRoomsOfType`) |
| `roomTypes[].free[i]` | Antal værelser af typen − antal ophold af typen med `isInHouseOn(stay, dates[i])` |
| `stays[]` | Bookinger med `check_in < to AND check_out > from` (overlap med vinduet, `OVERLAPS` i `roomRepository`) |
| `stays[].bookingId`, `roomId`, `firstName`, `familyName`, `checkIn`, `checkOut`, `guestCount` | `bookings` (datoerne er bookingens **egne**, ikke klippede) |
| `stays[].status` | `deriveStatus(stay, today())` |

**Invarianter**:

- `free[i]` ligger mellem 0 og antal værelser af typen.
- Et ophold, der starter før `from` eller slutter efter `to`, er med i `stays`, men tæller kun
  i `free` på de viste nætter.
- Afrejsedagen tæller som ledig (halvåbent interval, 001 R12).

Frontend placerer bjælken over kolonnerne `max(checkIn, from)` til (men ikke med)
`min(checkOut, to)`. Det er geometri. Ledighed og status kommer fra API'et.

## Afledt: Nøgletal (udvidelse af 002)

To nye rækker pr. kalenderår i `/analytics/kpis` (se
[002 data-model.md § Nøgletal](../002-bi-dashboard/data-model.md#nøgletal)):

| `kpi` | Formel (i `analyticsService`) | `unit` | Krav |
|---|---|---|---|
| `customerSatisfaction` | Gennemsnit af `satisfactionScore` for bookinger med `checkOut` i året og en registreret score. 0, når der ingen er | `score` | FR-014, FT12 |
| `satisfactionResponses` | Antal bookinger med `checkOut` i året og en registreret score | `count` | FR-014, FT12 |

- Årene er årene med værelsesnætter, barsalg **eller afrejser**.
- `dimension` er `null`. Værdien afrundes ikke.
- `/analytics/bookings` får feltet `satisfactionScore` (heltal eller `null`).

## Edge cases fra spec'en

| Edge case | Hvordan modellen håndterer det |
|---|---|
| 214 værelser × 31 dage | Én forespørgsel for værelser og én for ophold i vinduet. Ledighed beregnes i hukommelsen |
| Ophold klippet ved vinduets kanter | `stays` har de rigtige datoer, og `free` tæller kun viste nætter |
| Afrejsedag = ledig for ny ankomst | `isInHouseOn` er halvåben |
| Booking slettet, mens skærmen er åben | Detaljesiden og `PUT …/satisfaction` giver 404 "Bookingen findes ikke længere" |
| Score før afrejse | `BOOKING_NOT_DEPARTED` 422 |
| Score uden for 1–5 | 400 fra kontrakten, `CHECK` som sidste værn |
| Dato uden bookinger | Tomme lister, `free = total`, `barSalesTotal = 0` |
| År uden scores | `customerSatisfaction = 0`, `satisfactionResponses = 0` |
