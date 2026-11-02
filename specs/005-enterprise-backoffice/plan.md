# Implementation Plan: Enterprise back office

**Branch**: `005-enterprise-backoffice` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-enterprise-backoffice/spec.md`

## Summary

Back office'et bliver receptionens arbejdsværktøj: forside med dagens drift og ind-/udtjekning,
paginerede bookinger med sortering og filtre, bookingens folio, barsalg som kasse, en
omsætningsside, grupperet navigation med Cmd+K-palet, login med facadefoto og en profilside med
adgangskode og prisadministration. Backend får nye endpoints i de eksisterende lag. Frontend får
nye sider med de eksisterende tokens og komponenter. Ingen nye afhængigheder.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node 22+ i containeren

**Primary Dependencies**: Express 5, express-openapi-validator, mysql2, cookie-session · React 19,
react-router 8, Tailwind v4, Phosphor icons (alle installeret)

**Storage**: MySQL 8.4. To nye kolonner på `bookings` (`checked_in_at`, `checked_out_at`). Ingen nye tabeller

**Testing**: `node:test` i `backend/`. Service-tests med falske repositories, API-tests mod
`kongarthur_test`. `npm test` kører filerne serielt (`--test-concurrency=1`), fordi API-testene
deler testdatabasen

**Target Platform**: Docker Compose, desktop-browser i receptionen (≥ 1280 px). Login skal også virke smalt

**Project Type**: Web application (backend + frontend)

**Performance Goals**: En side i bookinglisten < 1 s med 233.644 bookinger (SC-001). Omsætning for et år < 2 s

**Constraints**: Ingen nye npm-pakker og intet UI-bibliotek (kodekvalitet §1, §4). Al logik i services (A4)

**Scale/Scope**: 233.644 bookinger, 407.708 barsalg, 214 værelser, 6 skærme

## Constitution Check

| Princip | Vurdering |
|---|---|
| I. Trelagsarkitektur | ✅ Nye endpoints følger routes → services → repositories. Kun repositories kender SQL |
| II. API-først/OpenAPI | ✅ Kontrakten er skrevet i `backend/openapi.yaml` før implementering (research R1). Validatoren håndhæver den |
| III. Logik i logiklaget | ✅ Status, nøgletal på forsiden, folioens natfordeling, regning, ordretotal og omsætning beregnes i services. Frontend viser kun tal fra API'et |
| IV. Docker | ✅ Skemaændringen ligger i `db/01_schema.sql`. Nulstilling med `docker compose down -v` |
| V. Tests | ✅ Hver ny regel får en service-test (status, ind-/udtjek, paginering, folio, ordre, omsætning, adgangskode, priser) og de vigtigste en API-test |
| VI. Enkelhed | ✅ Kurven er state i React, ikke en tabel. Paletten genbruger `GET /bookings`. Ingen roller/brugere |

Ingen overtrædelser. Re-evalueret efter design: uændret.

## Project Structure

### Documentation (this feature)

```text
specs/005-enterprise-backoffice/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md, tasks.md
├── contracts/README.md   # Adfærd og ejerskab. Selve kontrakten er backend/openapi.yaml
└── checklists/requirements.md
```

### Source Code (repository root)

Ejerskab pr. agent (implementeringen køres parallelt, research R2). En agent må kun ændre sine
egne filer. Fælles filer (`openapi.yaml`, `errors.js`, `01_schema.sql`, `package.json`) er
ændret før start og må ikke ændres af agenterne.

```text
backend/src/
├── services/bookingService.js       B1  status, paginering, søgning, folio, ind-/udtjek
├── services/receptionService.js     B1  kpis på forsiden
├── repositories/bookingRepository.js B1
├── routes/bookings.js, reception.js B1
├── services/barService.js           B2  ordre i én transaktion
├── services/revenueService.js       B2  ny
├── services/adminService.js         B2  ny: prisliste og drinkpriser
├── services/authService.js          B2  skift adgangskode
├── repositories/barRepository.js, revenueRepository.js (ny), pricingRepository.js,
│   referenceRepository.js, userRepository.js     B2
├── routes/barSales.js, revenue.js (ny), admin.js (ny), auth.js   B2
└── app.js                           B2  wiring af nye services og routes
backend/test/
├── bookingService.test.js, receptionService.test.js, api.test.js   B1
└── barService.test.js, revenueService.test.js (ny), adminService.test.js (ny),
    authService.test.js, api.admin.test.js (ny)                      B2

frontend/src/
├── main.jsx, Shell.jsx, ui.jsx, format.js, api.js   F1  (F1 ejer de fælles komponenter)
├── CommandPalette.jsx (ny)                          F1
├── pages/Login.jsx, pages/Profile.jsx (ny)          F1
├── pages/Overview.jsx, Bookings.jsx, BookingDetail.jsx, RoomPlan.jsx,
│   BookingForm.jsx, SatisfactionDialog.jsx, Pagination.jsx (ny)   F2
└── pages/BarSales.jsx, pages/Revenue.jsx (ny)       F3
frontend/public/kong-arthur-facade.webp              (lagt ind af brugeren)
```

**Structure Decision**: Den eksisterende web-app-struktur. Nye filer kun hvor et nyt domæne
opstår (omsætning, administration, palet, profil).

## Complexity Tracking

Ingen afvigelser fra constitution.
