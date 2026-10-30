# Arkitekturkrav

Afskrift af kravboardet (se [README](README.md)). Bruger: it-arkitekt. Kravene er gjort
bindende i [constitution](../../.specify/memory/constitution.md), og hvordan de er løst, står i
[`plan.md`](../../specs/001-backoffice-bookinger/plan.md) og
[README § Arkitektur](../../README.md#arkitektur).

| ID | Krav | Kilde | Prioritet | Opfyldes af |
|---|---|---|---|---|
| A1 | Backend med tydelig trelagsarkitektur (præsentation, logik, data) | Systemkrav og Softwarearkitektur | Must | `backend/src/routes` → `services` → `repositories` (constitution I) |
| A2 | Præsentationslaget leverer et REST API med JSON | Softwarearkitektur | Must | `backend/src/routes/`, `/api` |
| A3 | Kontrakten leveres som OpenAPI-specifikation og vises i Swagger UI | Softwarearkitektur | Must | `backend/openapi.yaml`, Swagger UI på http://localhost:5173/docs |
| A4 | Nøgletal beregnes i logiklaget, og placeringen kan begrundes | Tillægsspørgsmål 4 | Must | `backend/src/services/` (constitution III). BI-nøgletal i `backend/src/services/analyticsService.js` (feature 002, [research R4](../../specs/002-bi-dashboard/research.md)) |
| A5 | Frontend og Tableau taler kun med API'et, aldrig direkte med databasen | Egen, afledt af A2 og FT16 | Must | `frontend/src/api.js`. MySQL-porten er ikke eksponeret i `docker-compose.yml` |
| A5 (dublet-ID) | Database og frontend kan udskiftes med begrænsede ændringer | Tillægsspørgsmål 5 | Should | Kun `repositories/` kender SQL. Frontend kender kun kontrakten |
| A6 | De enkelte lag kan udskiftes efter aflevering. Clean og modulær arkitektur | Egen | Should | Services får repositories injiceret i `backend/src/app.js` |
