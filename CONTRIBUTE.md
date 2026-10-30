# Sådan bidrager du

## Arbejdsgang (Spec Kit)

Hver feature går igennem de samme trin (KB-D1), og alt ligger i `specs/<nnn-feature>/`:

1. `/speckit-constitution`: principper i `.specify/memory/constitution.md` (én gang for hele projektet)
2. `/speckit-specify`: krav i `spec.md`
3. `/speckit-clarify`: afklar uklarheder
4. `/speckit-plan`: teknisk plan i `plan.md`, `research.md`, `data-model.md`, `quickstart.md`
5. `/speckit-tasks`: opgaveliste i `tasks.md`
6. `/speckit-analyze`: tjek spec, plan og tasks mod hinanden (`analysis.md`)
7. `/speckit-implement`: byg tasks
8. `/speckit-converge`: sammenlign koden med spec og tasks (`converge.md`)

Constitution har forrang for alt andet. De oprindelige krav står i [`docs/krav/`](docs/krav/README.md).

## Før du committer

- Kør testene: `docker compose exec backend npm test` skal være grøn.
- Formatér: `npx prettier@3 --write .` (indstillinger i `.prettierrc.json`).
- Ændrer du API'et, så ret `backend/openapi.yaml` i samme commit.
- Ændrer du skemaet, så ret `db/01_schema.sql`, og nulstil med `docker compose down -v`.
- Ændrer du testdata, så ret `backend/scripts/generate-seed.js` og generér `db/02_seed.sql`
  igen (se [README](README.md#daglig-brug)). Redigér aldrig seed-filen i hånden.

## Commits

- Commit til `main` ved hver større ændring (KB-D12).
- Commit-beskeden refererer task- og krav-ID, fx `T032 FR-007: tildel ledigt værelse`.
- Ved parprogrammering har commit en `Co-authored-by: Navn <mail>`-trailer for hver deltager
  (KB-D11).
- Alle i gruppen skal have commits i repoet (KB-D5, KB-D10).

## Før review

Gennemgå `docs/retningslinjer/` (`kodekvalitet.md`, `database.md`, `tests.md`) og, ved
frontend-ændringer, `docs/design/`, og tjek din ændring mod dem.

## Definition of Done

Se [AGENTS.md](AGENTS.md#definition-of-done).
