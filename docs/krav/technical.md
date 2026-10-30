# Tekniske krav

Afskrift af kravboardet (se [README](README.md)). Kravene er gjort bindende i
[constitution](../../.specify/memory/constitution.md) (princip IV og V), og hvordan de er løst,
står i [`plan.md`](../../specs/001-backoffice-bookinger/plan.md).

| ID | Krav | Kilde | Prioritet | Opfyldes af |
|---|---|---|---|---|
| T1 | Databasen er MySQL | Opgaven (systemkrav) | Must | `mysql:8.4` i `docker-compose.yml` |
| T2 | Alle dele kører i Docker-containere | Opgaven (systemkrav) | Must | Fire services: `db`, `backend`, `frontend`, `swagger` |
| T3 | Hele systemet starter med én `docker compose up` | Opgaven (Softwarearkitektur) | Must | [README § Kom i gang](../../README.md#kom-i-gang) |
| T4 | Databasen er klar, før backend forbinder (healthcheck) | Tillægsspørgsmål 8 | Must | `healthcheck` på `db` og `depends_on: condition: service_healthy` |
| T5 | Data overlever genstart af containere (named volume) | Tillægsspørgsmål 8 | Must | Volumen `db-data` |
| T6 | Databasestrukturen oprettes reproducerbart (migrations eller init-script) | Egen | Should | `db/01_schema.sql` og `db/02_seed.sql` via `docker-entrypoint-initdb.d` |
| T6 (dublet-ID) | Automatiske tests af API og nøgletalsberegninger | Egen | Should | `backend/test/`, `npm test` |
| T7 | Værelsestyper, priser og sæsonvariation som egne tabeller i databasen | Egen | Must | `room_types`, `seasons`, `season_periods`, `room_prices` i `db/01_schema.sql`. Indholdet er opgavens 8 værelsestyper, priser og sæsoner inkl. jul (spec 004 FR-001–FR-004) |
| T8 | Ingen AI-løsning implementeret i brugergrænsefladen | Egen | Must | `AGENTS.md` regel 10 |
| T9 | Al data går gennem REST API'et | – | – | Som A5 |
| T10 | Hotellets eget bookingsystem opdaterer via HTTPS-request gennem API'et | – | Must | `POST`, `PUT` og `DELETE /api/bookings` med `X-API-Key` (spec 001 FR-013, spec 004 FR-013). HTTPS: [README § HTTPS](../../README.md#https) |
