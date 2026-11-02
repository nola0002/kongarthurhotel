# Kontrakt (005)

**Kontrakten er [`backend/openapi.yaml`](../../../backend/openapi.yaml).** Denne fil gentager den
ikke, men peger på de nye dele og fortæller, hvem der bygger dem.

| Endpoint / felt | Krav | Backend | Frontend |
|---|---|---|---|
| `Booking.status` (6 værdier), `checkedInAt`, `checkedOutAt` | FR-003, FR-004 | B1 | F1 (statustabellen i `ui.jsx`), F2 |
| `GET /bookings` med `page`, `pageSize`, `sort`, `order`, `roomTypeId`, `countryCode`, `from`, `to`, tal i `q` | FR-005–FR-007, FR-016 | B1 | F2 (liste), F1 (palet) |
| `GET /bookings/{id}/folio` | FR-008, FR-009 | B1 | F2 |
| `POST /bookings/{id}/check-in`, `/check-out` | FR-003 | B1 | F2 |
| `ReceptionOverview.kpis` | FR-001, FR-002 | B1 | F2 |
| `POST /bar-sales/orders` | FR-011, FR-012 | B2 | F3 |
| `GET /revenue` | FR-014, FR-015 | B2 | F3 |
| `GET /admin/prices`, `PUT /admin/prices/{roomTypeId}/{seasonId}`, `PUT /admin/drinks/{id}` | FR-020 | B2 | F1 |
| `PUT /auth/password` | FR-019 | B2 | F1 |

Alle nye endpoints kræver en receptionistsession (`requireSession`), FR-021.

Fejlkoderne `INVALID_STATUS` og `WRONG_PASSWORD` er tilføjet i `backend/src/errors.js`.

## Frontend-ruter

| Rute | Side | Agent |
|---|---|---|
| `/login` | Login med facadefoto | F1 |
| `/oversigt` | Dagens drift | F2 |
| `/belaegningsplan` | Uændret (statusser udvidet) | F2 |
| `/bookinger?side=&pr-side=&sorter=&orden=&visning=&q=&type=&land=&fra=&til=` | Pagineret liste | F2 |
| `/bookinger/:id` | Folio | F2 |
| `/barsalg?booking=` | Kasse | F3 |
| `/omsaetning?fra=&til=&pr=` | Omsætning | F3 |
| `/profil` | Profil og administration | F1 |

Navigationens grupper (FR-017): Reception (Oversigt, Belægningsplan, Bookinger), Bar (Kasse),
Økonomi (Omsætning), Konto (Profil). `main.jsx` (F1) importerer `pages/Revenue.jsx` med `default`
og `loader`, som F3 laver.
