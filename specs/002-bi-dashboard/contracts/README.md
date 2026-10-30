# Kontrakt

API-kontrakten ligger i [`backend/openapi.yaml`](../../../backend/openapi.yaml) og er single
source of truth, også for feature 002. Validatoren i backend og Swagger UI
(http://localhost:5173/docs) bruger samme fil. Felter og typer står kun der.

Feature 002 tilføjer fem læse-endpoints under `/api/analytics` (otte efter ændringen
2026-10-30, se nederst). Alle er `GET`, returnerer en
JSON-array af flade objekter uden query-parametre (research R3) og kræver enten
`Authorization: Bearer <BI_API_KEY>` eller en session-cookie (research R2).

| Endpoint | Én række pr. | Entitet i [`data-model.md`](../data-model.md) | Krav |
|---|---|---|---|
| `GET /analytics` | tabel (navn og sti) | – | Connectorens forbindelsestest (FR-013) |
| `GET /analytics/room-nights` | solgt værelsesnat | Værelsesnat | FR-003–FR-006, FR-015 (FT7–FT10) |
| `GET /analytics/occupancy` | dato × værelsestype | Belægningsdag | FR-001 (FT5) |
| `GET /analytics/bookings` | booking | Booking-række | FR-002 (FT6), FR-007 |
| `GET /analytics/bar-sales` | barsalg | Barsalg-række | FR-008, FR-009 (FT13, FT14) |
| `GET /analytics/kpis` | nøgletal × kalenderår | Nøgletal | FR-001, FR-002, FR-006–FR-008, FR-010, FR-011, FR-016 |

## Ændring 2026-10-30: stjerneskema

Kontrakten bliver i [`backend/openapi.yaml`](../../../backend/openapi.yaml) og ændres i samme
commit som koden (tasks T037–T043). Begrundelserne står i research R8–R11, og felternes
oprindelse i [`data-model.md` § Stjerneskema](../data-model.md#stjerneskema-ændring-2026-10-30).

### Nye endpoints (dimensioner)

Samme regler som ovenfor: `GET`, flad JSON-array, ingen query-parametre, session **eller**
`Authorization: Bearer <BI_API_KEY>`, `401` med `Error` uden gyldig adgang.

| Endpoint | Én række pr. | Felter (alle `required`) | Sortering | Krav |
|---|---|---|---|---|
| `GET /analytics/calendar` | dato i hele kalenderår (research R10) | `date` (string, `format: date`), `year` (integer), `month` (integer 1–12), `season` (string, `nullable: true`) | `date` | FR-012, FR-017 |
| `GET /analytics/room-types` | værelsestype | `roomType` (string), `capacity` (integer), `rooms` (integer) | `room_types.id` | FR-012, FR-017 |
| `GET /analytics/countries` | land | `countryCode` (string, 2 tegn), `country` (string) | `country` | FR-012, FR-017 |

`GET /analytics` (connectorens forbindelsestest) lister derefter **otte** tabeller: de fem
fakta og de tre dimensioner, hver med `table` og `path`.

### Ændrede faktafelter

Kun fjernelser. Ingen felter skifter navn eller type.

| Skema | Endpoint | Fjernes | Tilbage |
|---|---|---|---|
| `RoomNight` | `/analytics/room-nights` | `year`, `month`, `season`, `country` | `bookingId`, `date`, `roomType`, `countryCode`, `revenue` |
| `OccupancyDay` | `/analytics/occupancy` | `year`, `month`, `season` | `date`, `roomType`, `availableRoomNights`, `soldRoomNights`, `occupancyRate` |
| `AnalyticsBooking` | `/analytics/bookings` | `year`, `month`, `country` | `bookingId`, `checkIn`, `checkOut`, `roomType`, `countryCode`, `guestCount`, `nights`, `revenue`, `satisfactionScore` |
| `AnalyticsBarSale` | `/analytics/bar-sales` | `year`, `month` | `saleId`, `date`, `drink`, `category`, `quantity`, `revenue` |
| `Kpi` | `/analytics/kpis` | – (felterne er uændrede) | Beskrivelsen ændres: én række pr. nøgletal for **hvert år i `/analytics/calendar`** i stedet for "hvert år med værelsesnætter, barsalg eller afrejser" (FR-018) |

Ingen anden klient end Tableau bruger `/analytics` (frontend kalder det ikke), så fjernelserne
bryder ikke noget, der er bygget (research R11).
