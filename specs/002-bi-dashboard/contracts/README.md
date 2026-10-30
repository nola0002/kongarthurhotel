# Kontrakt

API-kontrakten ligger i [`backend/openapi.yaml`](../../../backend/openapi.yaml) og er single
source of truth, også for feature 002. Validatoren i backend og Swagger UI
(http://localhost:5173/docs) bruger samme fil. Felter og typer står kun der.

Feature 002 tilføjer fem læse-endpoints under `/api/analytics`. Alle er `GET`, returnerer en
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
