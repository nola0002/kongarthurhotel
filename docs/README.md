# Dokumentation

Oversigt over al dokumentation i repoet. Start med [README](../README.md) for at køre systemet.

## I roden

| Fil | Indhold |
|---|---|
| [`README.md`](../README.md) | Arkitektur, sådan hænger koden sammen, start, login, Swagger, tests, nulstilling, fejlfinding |
| [`CONTRIBUTE.md`](../CONTRIBUTE.md) | Arbejdsgang (Spec Kit), commits, review |
| [`AGENTS.md`](../AGENTS.md) | Regler for alle, der skriver kode, og Definition of Done |
| [`.specify/memory/constitution.md`](../.specify/memory/constitution.md) | Projektets principper. Har forrang for alt andet |

## `docs/krav/`: oprindelige krav (kravboardet)

| Fil | Indhold |
|---|---|
| [`README.md`](krav/README.md) | Overblik, ID-konventioner, proces- og afleveringskrav (D1–D12), kendte uklarheder |
| [`backoffice.md`](krav/backoffice.md) | Back office (FR1–FR9) |
| [`businessinteligence.md`](krav/businessinteligence.md) | BI og Tableau (FT2–FT17) |
| [`architecture.md`](krav/architecture.md) | Arkitektur (A1–A6) |
| [`technical.md`](krav/technical.md) | Teknik (T1–T10) |

## `docs/retningslinjer/`: bindende regler

| Fil | Indhold |
|---|---|
| [`kodekvalitet.md`](retningslinjer/kodekvalitet.md) | Den dovne senior-udvikler, single source of truth, lag, frontend, navngivning, kommentarer |
| [`database.md`](retningslinjer/database.md) | 3NF, constraints, datatyper, navngivning, queries, samtidighed |
| [`tests.md`](retningslinjer/tests.md) | Værktøj, hvad der testes, og hvordan en god test ser ud |

## `docs/design/`: back office-design

| Fil | Indhold |
|---|---|
| [`README.md`](design/README.md) | Designprincipper, frontend-afhængigheder og filstruktur |
| [`tokens.md`](design/tokens.md) | Farver, typografi, størrelser, radier, skygger og bevægelse |
| [`komponenter.md`](design/komponenter.md) | UI-primitiver, formatering, API-klient og opskrifter |
| [`skaerme.md`](design/skaerme.md) | Skærme og flows koblet til kravene |

## `specs/`: én mappe pr. feature

| Fil | Indhold |
|---|---|
| [`001-backoffice-bookinger/spec.md`](../specs/001-backoffice-bookinger/spec.md) | User stories, krav (FR-001–FR-016) og succeskriterier |
| [`plan.md`](../specs/001-backoffice-bookinger/plan.md) | Teknisk plan, projektstruktur, Docker Compose, constitution-tjek |
| [`research.md`](../specs/001-backoffice-bookinger/research.md) | Beslutninger og begrundelser (R1–R13) og afhængigheder |
| [`data-model.md`](../specs/001-backoffice-bookinger/data-model.md) | ER-diagram, tabeller, afledte værdier og valideringsregler |
| [`quickstart.md`](../specs/001-backoffice-bookinger/quickstart.md) | 16 valideringsscenarier fra ende til anden |
| [`analysis.md`](../specs/001-backoffice-bookinger/analysis.md) | `/speckit-analyze`: fund og bindende beslutninger (B1–B18) |
| [`tasks.md`](../specs/001-backoffice-bookinger/tasks.md) | Opgaveliste (T001–T071) |
| [`converge.md`](../specs/001-backoffice-bookinger/converge.md) | Implementeret vs. mangler (KB-D4) |
| [`checklists/requirements.md`](../specs/001-backoffice-bookinger/checklists/requirements.md) | Kvalitetstjek af spec'en |
| [`002-bi-dashboard/spec.md`](../specs/002-bi-dashboard/spec.md) | Tableau-dashboardet: REST API-nøgletal og stjerneskema. Byggevejledning i [`tableau-guide.md`](tableau-guide.md) |

## Single source of truth

Disse sandheder står kun ét sted. Dokumentationen linker dertil i stedet for at gentage dem.

| Sandhed | Bor i |
|---|---|
| API-kontrakt | [`backend/openapi.yaml`](../backend/openapi.yaml), vist i Swagger UI på http://localhost:5173/docs |
| Databaseskema | [`db/01_schema.sql`](../db/01_schema.sql) |
| Testdata | [`backend/scripts/generate-seed.js`](../backend/scripts/generate-seed.js) (genererer `db/02_seed.sql`) |
| Krav | `specs/*/spec.md` |
| Design-tokens | [`frontend/src/index.css`](../frontend/src/index.css) |
| Konfiguration | `.env` (eksempel i [`.env.example`](../.env.example)) |
