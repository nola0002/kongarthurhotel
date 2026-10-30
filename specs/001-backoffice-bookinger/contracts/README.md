# Kontrakt

API-kontrakten ligger i [`backend/openapi.yaml`](../../../backend/openapi.yaml) og er single
source of truth. Validatoren i backend og Swagger UI (http://localhost:5173/docs) bruger
samme fil. Den lå tidligere her som `contracts/openapi.yaml` og blev flyttet i T001, så der aldrig findes
to versioner.
