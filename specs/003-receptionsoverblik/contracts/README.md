# Kontrakt

API-kontrakten ligger i [`backend/openapi.yaml`](../../../backend/openapi.yaml) og er single
source of truth, også for feature 003. Validatoren i backend og Swagger UI
(http://localhost:5173/docs) bruger samme fil. Denne oversigt er input til implementeringen.
Når endpoints står i `openapi.yaml`, er det den, der gælder.

Alle endpoints nedenfor kræver session-cookie. Bookingsystemets `X-API-Key` og BI-nøglen giver
401 (FR-018). `Booking` er det eksisterende skema efter 004 (`firstName`, `familyName` i stedet
for `guestName`) plus `satisfactionScore`.

## Nye endpoints

| Endpoint | Svar | Fejl | Krav |
|---|---|---|---|
| `GET /reception/overview?date=YYYY-MM-DD` | `ReceptionOverview` | 400, 401 | FR-002, FR-003 |
| `GET /reception/room-plan?from=YYYY-MM-DD&days=14` | `RoomPlan` | 400, 401 | FR-005–FR-009 |
| `PUT /bookings/{id}/satisfaction` med `{ "score": 4 }` | `Booking` (opdateret) | 400, 401, 404, 422 `BOOKING_NOT_DEPARTED` | FR-011–FR-013 |

### `GET /reception/overview`

Parameter `date` (valgfri, `format: date`). Standard er dags dato i Europe/Copenhagen.

```json
{
  "date": "2026-10-30",
  "arrivals": [Booking],
  "departures": [Booking],
  "inHouse": { "bookings": 151, "guests": 297 },
  "rooms": [
    { "roomTypeId": 1, "roomType": "Standard enkeltværelse", "total": 40, "occupied": 31, "free": 9 }
  ],
  "barSalesTotal": 1240.5
}
```

- `arrivals`: bookinger med `checkIn = date`. `departures`: bookinger med `checkOut = date`.
- `inHouse`: bookinger med `checkIn <= date < checkOut` og summen af deres `guestCount`.
- `rooms`: én række pr. værelsestype, sorteret efter id. `free + occupied = total`.
- `barSalesTotal`: DKK for salg på `date`.

### `GET /reception/room-plan`

Parametre `from` (valgfri, `format: date`, standard dags dato) og `days` (valgfri, heltal 7–31,
standard 14).

```json
{
  "from": "2026-10-30",
  "to": "2026-11-13",
  "dates": ["2026-10-30", "2026-10-31", "…", "2026-11-12"],
  "roomTypes": [
    {
      "id": 1,
      "name": "Standard enkeltværelse",
      "rooms": [{ "id": 1, "number": "101" }],
      "free": [9, 12, "…"]
    }
  ],
  "stays": [
    {
      "bookingId": 10384,
      "roomId": 1,
      "firstName": "Jens",
      "familyName": "Jensen",
      "checkIn": "2026-10-28",
      "checkOut": "2026-11-02",
      "guestCount": 1,
      "status": "in_house"
    }
  ]
}
```

- `to` er **eksklusiv** (`from + days`). `dates` har præcis `days` datoer.
- `roomTypes[].free[i]` hører til `dates[i]`.
- `stays`: bookinger, der overlapper `[from, to)`, med deres egne (ikke klippede) datoer.
  `status` har samme værdier som `Booking.status`.

### `PUT /bookings/{id}/satisfaction`

Request (`additionalProperties: false`):

```json
{ "score": 4 }
```

`score` er et heltal 1–5. Svar 200 med den opdaterede `Booking`. Et nyt kald erstatter scoren.

| Status | Kode | Hvornår |
|---|---|---|
| 400 | `VALIDATION_ERROR` (felt `score`) | Score mangler, er ikke et heltal eller ligger uden for 1–5 |
| 401 | `UNAUTHORIZED` | Ingen session |
| 404 | `NOT_FOUND` | "Bookingen findes ikke længere" |
| 422 | `BOOKING_NOT_DEPARTED` (felt `score`) | `checkOut` er efter dags dato: "Tilfredshed kan først registreres på afrejsedagen" |

## Ændrede skemaer

| Skema | Ændring |
|---|---|
| `Booking` | Nyt påkrævet felt `satisfactionScore`: `integer`, `nullable: true`, 1–5 |
| `AnalyticsBooking` (`GET /analytics/bookings`) | Nyt påkrævet felt `satisfactionScore`: `integer`, `nullable: true` |
| `Kpi` (`GET /analytics/kpis`) | `kpi`-enum får `customerSatisfaction` og `satisfactionResponses`. `unit`-enum får `score` |
| `Error` | `code`-enum får `BOOKING_NOT_DEPARTED`. Fejltabellen i `info.description` og `BusinessRule`-eksemplerne opdateres |

Nye skemaer: `ReceptionOverview`, `RoomPlan`, `RoomPlanStay` og `SatisfactionInput`. Nyt tag:
`Reception`.
