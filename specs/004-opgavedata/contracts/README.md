# Kontrakt

API-kontrakten ligger i [`backend/openapi.yaml`](../../../backend/openapi.yaml) og er single
source of truth (som i 001 og 002). Feature 004 tilføjer ingen endpoints. Ændringerne
herunder laves i den fil, i samme commit som koden (constitution II).

## Ændringer

### Gæstens navn (spec FR-006, FR-007)

| Sted | Ændring |
|---|---|
| `components.schemas.BookingInput` | `guestName` fjernes. `firstName` og `familyName` tilføjes og er påkrævede: `{ type: string, minLength: 1, maxLength: 75, pattern: '\S' }`. Eksempel: `firstName: Ingrid`, `familyName: Olsen`, `countryCode: SE`, `roomTypeId: 3` |
| `components.schemas.Booking` | `guestName` fjernes fra `properties` og `required`. `firstName` og `familyName` (`type: string`) tilføjes og er påkrævede. Eksemplet bruger data, der findes i seed (fx `country: { code: SE, name: Sverige }`, `roomType: { id: 3, name: Standard dobbeltværelse }`) |
| `GET /bookings`, parameter `q` | Beskrivelse: "Case-insensitive partial match on first name, family name or 'first family'" |
| `components.responses.ValidationError` | Eksemplet bruger `field: firstName` og "Fornavn skal udfyldes" |

### Bookingsystemets nøgle (spec FR-013, KB-T10)

| Sted | Ændring |
|---|---|
| `paths./bookings/{id}.put` | `security: [{ session: [] }, { bookingSystemKey: [] }]` |
| `paths./bookings/{id}.delete` | `security: [{ session: [] }, { bookingSystemKey: [] }]` |
| `components.securitySchemes.bookingSystemKey.description` | "Key for the hotel's external booking system (KB-T10); valid for POST /bookings, PUT /bookings/{id} and DELETE /bookings/{id}" |
| `info.description` | Afsnittene om `X-API-Key` og "Trying it out" nævner `POST`, `PUT` og `DELETE` i stedet for kun `POST`. `PUT` beholder bookingens `source` |

`GET /bookings`, `GET /bookings/{id}`, `GET /bookings/quote` og alle øvrige stier er uændrede.
Bookingsystemets nøgle afvises fortsat med `401` på dem.

### Uændret

- Fejlformatet `{ error: { code, message, field } }` og alle fejlkoder.
- `/room-types`, `/countries`, `/drinks` og `/bar-sales`. Indholdet ændres (opgavens data),
  men ikke formen.
- `/analytics/*` (002). `AnalyticsBooking` har intet navnefelt og påvirkes ikke.

## Afhængighed til 003

Feature 003 udvider samme fil bagefter (`Booking.satisfactionScore`, `/reception/*` og
`PUT /bookings/{id}/satisfaction`) og bruger `firstName`/`familyName` fra 004.
