# Implementation Plan: Business Intelligence – ledelsesdashboard

**Branch**: `002-bi-dashboard` (der arbejdes på `main`, jf. KB-D12) | **Date**: 2026-10-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-bi-dashboard/spec.md`

## Summary

Et interaktivt Tableau-dashboard til hoteladministratoren og ledelsen på Hotel Kong Arthur.
Det viser belægningsgrad, gæsternes lande, indtjening pr. værelsestype, sæson og land, årets
samlede indtjening, gennemsnitlig pris pr. nat og opholdslængde samt barsalg pr. drink og
fordelingen mellem cocktails og kaffe. Ledelsen kan kun læse.

Teknisk tilføjer backend fem `GET`-endpoints under `/api/analytics`. Dashboardet bygges i
Tableau Desktop. Arkitekturen er den samme som i 001:

- `analyticsRepository` henter rå rækker med SQL.
- `analyticsService` laver alle formler: fordeling af indtjening pr. nat, belægning,
  gennemsnit og andele (KB-A4, FR-011).
- `routes/analytics.js` sender resultatet som flade JSON-arrays.

Tableau forbinder med REST API Connector fra Tableau Exchange med en læse-nøgle som
Bearer-token (`BI_API_KEY`). Det må kun summere, filtrere og sortere. Der er ingen nye
tabeller og ingen nye afhængigheder. Detaljerede beslutninger står i
[research.md](research.md).

## Technical Context

**Language/Version**: JavaScript (ES modules) på Node.js 24 LTS, som i 001.

**Primary Dependencies**:
- Backend: uændret fra 001 (Express 5.3, mysql2 3.x, express-openapi-validator 5.6,
  cookie-session 2.1). Ingen nye pakker.
- BI: Tableau Desktop 2023.3+ med REST API Connector 1.0.1 fra Tableau Exchange (research R1).

**Storage**: MySQL 8.4 fra 001. Skemaet er uændret. Alt afledes ved hvert kald (research R6,
[data-model.md](data-model.md)). Tableau gemmer et extract i workbooken.

**Testing**: `node:test` + `node:assert/strict` (`npm test` i `backend/`).
`analyticsService` får et falsk repository injiceret, så formlerne testes uden database med
håndregnede eksempler. Testnavne starter med krav-ID. Der er ingen tests af Tableau. Dashboardet
valideres manuelt med [quickstart.md](quickstart.md).

**Target Platform**: Backend i Docker Compose (som 001). Tableau Desktop på en udviklermaskine
kalder `http://localhost:3000/api/analytics/*`.

**Project Type**: Web-service (læse-API) plus et Tableau-dashboard.

**Performance Goals**: Hvert endpoint svarer på få sekunder med seed-data (ca. 32.000
værelsesnætter, ca. 4.400 belægningsdage og ca. 20.000 barsalg). En opdatering af alle
extracts tager under et minut. Tallene er skøn og måles ved quickstart.

**Constraints**:
- Ingen direkte databaseforbindelse fra Tableau og ingen statisk CSV (KB-A5, FT4, FR-013).
- Tableau må ikke have egen nøgletalslogik ud over aggregering og filtrering (FR-011).
- Skrivebeskyttet: kun `GET`, og nøglen gælder kun `/api/analytics` (FR-014, FT17).
- Ingen AI i UI (KB-T8). Fremlæggelse 2026-11-06.

**Scale/Scope**: 5 endpoints, 1 ny miljøvariabel, ca. 8 ark på ét dashboard.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princip | Krav | Plan | Status |
|---|---|---|---|
| I. Trelagsarkitektur | Præsentation → logik → data. Kun repositories kender SQL | `routes/analytics.js` → `services/analyticsService.js` → `repositories/analyticsRepository.js`. Servicen kender hverken `req`/`res` eller SQL | ✅ |
| II. API-først + OpenAPI | Tableau taler kun med API'et. Kontrakten i repoet og Swagger | Tableau bruger REST API Connector mod `/api/analytics` (research R1). Endpoints og Bearer-skema står i `backend/openapi.yaml` i samme commit | ✅ |
| III. Logik og nøgletal i logiklaget | Tableau genberegner ikke nøgletal | Fordeling, belægning, gennemsnit og andele ligger i `analyticsService` (research R4). Tableau summerer, filtrerer og sorterer og viser belægning for et udsnit som forholdet mellem to backend-summer, som constitution v1.2.1 tillader | ✅ |
| IV. Container og reproducerbart miljø | Én `docker compose up`, reproducerbart skema | Ingen nye containere eller tabeller. `BI_API_KEY` kommer i `.env.example`. Compose læser allerede `.env` | ✅ |
| V. Testbar forretningslogik | Nøgletal har tests, én kommando | `backend/test/analyticsService.test.js` dækker FR-001–FR-003, FR-006–FR-008, FR-010 og FR-015 med falsk repository (testnavne med FT-ID). `api.test.js` dækker FR-014 | ✅ |
| VI. Enkelhed og ejerskab | YAGNI, ingen AI i UI | Ingen nye pakker, tabeller, views eller cache. Ingen query-parametre eller paginering (research R3). WDC-kode er fravalgt | ✅ |
| Retningslinjer | `AGENTS.md`, `docs/retningslinjer/*` | Penge i øre i servicen og kroner ved kanten (`money.js`). Parametriseret SQL. Ingen afledte data gemmes. Fejlformat `{error:{code,message,field}}` | ✅ |

**Gate (før research)**: Bestået. Spørgsmålet om, hvordan Tableau forbinder, og hvilken
autentificering det kræver, blev afklaret 2026-10-30 (spec.md § Clarifications, research R1–R2).

**Gate (efter design)**: Bestået. Designet tilføjer ingen tabeller. De fem afledte entiteter i
data-model.md kommer alle fra tabellerne i 001. Tableau dividerer to backend-summer for at vise
belægning for et vilkårligt udsnit. Det er tilladt efter præciseringen af princip III
(constitution v1.2.1, 2026-10-30) og forklaret nedenfor.

## Project Structure

### Documentation (this feature)

```text
specs/002-bi-dashboard/
├── spec.md              # Krav (/speckit-specify, /speckit-clarify)
├── plan.md              # Denne fil
├── research.md          # Phase 0: beslutninger og begrundelser (R1–R7)
├── data-model.md        # Phase 1: afledte entiteter, ingen nye tabeller
├── quickstart.md        # Phase 1: curl- og Tableau-scenarier, SC-001–SC-005
├── contracts/
│   └── README.md        # peger på backend/openapi.yaml
├── checklists/
│   └── requirements.md
├── tasks.md             # Phase 2 (/speckit-tasks)
└── converge.md          # /speckit-converge (oprettes ved afslutning, KB-D4)
```

### Source Code (repository root)

Kun nye og ændrede filer. Resten er som i
[001 plan.md](../001-backoffice-bookinger/plan.md#project-structure).

```text
.env.example                       # ÆNDRET: BI_API_KEY (placeholder ≥ 32 tegn)
README.md                          # ÆNDRET: status, Tableau-pil i diagrammet, BI_API_KEY
backend/
├── openapi.yaml                   # ÆNDRET: 5 × GET /analytics/*, Bearer-skema
├── src/
│   ├── app.js                     # ÆNDRET: createAnalyticsService({ analyticsRepo }) og montering af routeren
│   ├── auth.js                    # ÆNDRET: session ELLER Bearer BI_API_KEY, kun på /analytics
│   ├── routes/
│   │   └── analytics.js           # NY: 5 tynde GET-handlere, kroner ved kanten
│   ├── services/
│   │   ├── pricing.js             # ÆNDRET: nat-gennemløbet eksporteres, så der er én definition af en nat
│   │   └── analyticsService.js    # NY: fordeling pr. nat, belægning, gennemsnit, andele, nøgletal
│   └── repositories/
│       └── analyticsRepository.js # NY: rå rækker (bookinger, perioder, priser, værelser, barsalg)
└── test/
    └── analyticsService.test.js   # NY: formler med falsk repository
tableau/
└── kong-arthur.twbx               # NY: workbook med extract (se tasks.md)
```

**Structure Decision**: Samme web-applikation som 001. De nye backendfiler følger de tre lag
(princip I). `tableau/` er en ny mappe i roden til workbooken, så dashboardet ligger i repoet
sammen med resten af afleveringen (KB-D2, KB-D5). Der er ingen frontend-ændringer.

## Adgang (overblik)

| Kalder | Header | `/api/analytics/*` | Alle andre endpoints |
|---|---|---|---|
| Tableau | `Authorization: Bearer <BI_API_KEY>` | ✅ | 401 |
| Receptionist / Swagger UI | session-cookie | ✅ | ✅ (som i 001) |
| Bookingsystem | `X-API-Key` | 401 | Kun `POST /bookings` |
| Ingen | – | 401 | 401 |

Nøglen fejler lukket: mangler `BI_API_KEY`, eller er den under 32 tegn, afvises alle
Bearer-nøgler (research R2).

## Implementeringsrækkefølge (input til /speckit-tasks)

1. **Fundament**: `BI_API_KEY` i `.env.example`, auth-middleware, nat-hjælperen i `pricing.js`,
   kontrakten i `openapi.yaml`, repository, router og kobling i `app.js`. Workbook med fem
   datakilder.
2. **US1 Indtjening** (fordeling pr. nat og `roomRevenue`) og **US2 Belægning** (P1).
   Tests skrives sammen med formlerne.
3. **US3 Lande**, **US4 Barsalg** og **US5 Selvvalgte nøgletal** (P2).
4. **US6 Aktuelle data og læseadgang** (P3): `generatedAt`, API-tests af adgang og
   opdateringstjek.
5. **Afslutning**: saml dashboardet med filtre og "Use as Filter", gennemgå quickstart,
   opdatér dokumentation og kør `/speckit-converge`.

## Complexity Tracking

Ingen uberettigede overtrædelser. Tabellen noterer ét bevidst valg, så det kan forklares ved
fremlæggelsen.

| Valg | Hvorfor | Simplere alternativ fravalgt, fordi |
|---|---|---|
| Arket "Belægning pr. måned" bruger det beregnede felt `SUM(soldRoomNights) / SUM(availableRoomNights)` i Tableau (research R4) | FR-001 og US2 scenarie 2 kræver belægning for en valgt sæson, værelsestype og periode i vilkårlig kombination. Tæller og nævner er beregnet af backend pr. dato og værelsestype, og Tableau dividerer kun summerne for det valgte udsnit. De autoritative årstal kommer fra `/analytics/kpis` | Et endpoint pr. filterkombination ville give mange endpoints og alligevel ikke reagere på klik (FR-012). AVG(`occupancyRate`) ville give forkerte tal, fordi typerne har forskelligt antal værelser |
