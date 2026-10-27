<!--
Sync Impact Report
- Version change: template → 1.0.0 (første udfyldte version) → 1.1.0 (teknologisk stack
  fastlagt: Docker Compose, MySQL, Node.js/Express, React + Tailwind; jf. FigJam-siden
  "Arkitektur") → 1.2.0 (JS, mysql2, node:test, engelsk kode/dansk UI; bindende
  retningslinjer i AGENTS.md og docs/retningslinjer/)
- Principper tilføjet: I. Trelagsarkitektur, II. API-først med OpenAPI-kontrakt,
  III. Forretningslogik og nøgletal i logiklaget, IV. Containeriseret og reproducerbart miljø,
  V. Testbar forretningslogik, VI. Enkelhed og ejerskab
- Sektioner tilføjet: Teknologiske rammer, Udviklingsproces og aflevering, Governance
- Sektioner fjernet: ingen
- Kilde: kravtabeller på FigJam-boardet "systemudvikling" (side "Krav"), ID'er A*, T*, D*
- Templates: plan/spec/tasks-templates læser constitution ved kørsel; ingen ændringer nødvendige
- Follow-up TODOs:
  - Dublet-ID'er på kravboardet (A5 x2, T6 x2) bør omnummereres; her refereres A5b og T6b
- Fjern denne kommentar før commit.
-->

# Kong Arthur Hotelsystem Constitution

## Core Principles

### I. Trelagsarkitektur

Backend MUST være opdelt i tre tydeligt adskilte lag: præsentation (REST API), logik
(forretningsregler og nøgletal) og data (persistens). Et lag MUST kun kalde laget direkte
under sig; præsentationslaget MUST NOT tilgå databasen direkte, og datalaget MUST NOT
indeholde forretningsregler.

Hvert lag MUST kunne udskiftes med begrænsede ændringer i de øvrige lag — fx skift af
database eller frontend (A5b, A6).

**Rationale**: Krav A1/A6 og tillægsspørgsmål 5. Adskillelsen gør det muligt at forklare og
begrunde, hvor logik ligger, og at udskifte lag efter aflevering.

### II. API-først med OpenAPI-kontrakt

Al data MUST gå gennem REST API'et med JSON (A2, T9). Frontend, Tableau og hotellets
eksterne bookingsystem MUST kun tale med API'et og aldrig direkte med databasen (A5, T10).

API-kontrakten MUST være beskrevet i en OpenAPI-specifikation, der ligger i repoet og vises
i Swagger UI (A3, D7). Kontrakten er sandhedskilden: ændringer i endpoints MUST opdatere
specifikationen i samme commit.

**Rationale**: Én indgang til data giver ens validering, ét sted at teste og en kontrakt,
som frontend- og BI-delen kan bygges parallelt imod.

### III. Forretningslogik og nøgletal i logiklaget

Alle forretningsregler MUST ligge i logiklaget, bl.a. kapacitetstjek, forhindring af
dobbeltbooking og prisberegning ud fra værelsestype, sæson og antal nætter. Det samme gælder
nøgletal: belægningsgrad, indtjening, barsalg og selvvalgte nøgletal (A4).

Frontend og Tableau MUST NOT genberegne nøgletal eller forretningsregler. De viser kun det,
API'et returnerer. Placeringen af hver beregning MUST kunne begrundes ved fremlæggelsen.

**Rationale**: Krav A4 og tillægsspørgsmål 4. Samme tal overalt, og reglerne kan testes uden UI.

### IV. Containeriseret og reproducerbart miljø

Alle dele (database, backend, frontend, Swagger UI) MUST køre i Docker-containere, og hele
systemet MUST starte med én `docker compose up` (T2, T3, D7). Databasen MUST være MySQL (T1).

Databasen MUST være klar (healthcheck), før backend forbinder (T4). Data MUST overleve
genstart via et named volume (T5). Databasestruktur og startdata SHOULD oprettes
reproducerbart via migrations eller init-script (T6). Værelsestyper, priser og
sæsonvariation MUST ligge i egne tabeller, ikke hardcodet (T7).

**Rationale**: Alle i gruppen og censor skal kunne starte præcis samme system på få minutter.

### V. Testbar forretningslogik

API-endpoints og nøgletalsberegninger SHOULD have automatiske tests (T6b). Hver
forretningsregel i princip III SHOULD have mindst én test, der fejler, hvis reglen brydes.
Tests MUST kunne køres med én kommando.

**Rationale**: Nøgletal, der vises for ledelsen, skal være korrekte og må ikke forringes
stille ved ændringer.

### VI. Enkelhed og ejerskab

Løsningen MUST holdes så enkel som kravene tillader (YAGNI). Ingen abstraktioner, lag eller
afhængigheder ud over dem, et krav kræver. Brugergrænsefladen MUST NOT indeholde
AI-funktionalitet (T8).

AI må bruges som udviklingsværktøj, men gruppen MUST kunne forklare og vurdere al kode og
alle beslutninger (D8). Kode, som ingen i gruppen kan forklare, MUST NOT merges.

**Rationale**: Krav D8/T8. Fremlæggelsen og spørgsmålene forudsætter fuldt ejerskab.

## Teknologiske rammer

- **Orkestrering**: Docker Compose. Én `docker compose up` starter database, backend,
  frontend og Swagger UI.
- **Database**: MySQL i egen container med named volume og healthcheck.
- **Backend**: Node.js med Express i JavaScript (ES modules, ikke TypeScript), REST/JSON.
  Trelagsarkitekturen afspejles i mappestrukturen: præsentation (routes/controllers), logik
  (services) og data (repositories med rå, parametriseret SQL via mysql2 — ingen ORM).
- **Tests**: Node's indbyggede `node:test`. Kun backend testes.
- **Sprog**: Kode, tabeller og kommentarer på engelsk. UI og dokumentation på dansk.
- **Kontrakt**: OpenAPI-specifikation i repoet, serveret af Swagger UI i egen container.
- **Back Office-frontend**: React med Tailwind CSS i egen container. Den kalder kun API'et.
- **Business Intelligence**: Interaktivt Tableau-dashboard, som henter data via API'et og
  ikke kun fra en statisk CSV-fil (FT4, FT16). Ledelsen har kun læseadgang (FT17).
- **Ekstern integration**: Hotellets bookingsystem opdaterer data via HTTPS-requests til
  API'et (T10).

## Udviklingsproces og aflevering

- **Spec Kit-flow** (D1): Constitution → Specify → Clarify → Plan → Tasks → Implement →
  Converge. Artefakterne MUST ligge i repoet under `specs/` (D2).
- **User stories** (D3): Formatet "Som … ønsker jeg … så …", INVEST, med acceptkriterier
  (Given/When/Then).
- **Converge** (D4): Resultatet af sidste converge-tjek (implementeret vs. mangler) MUST
  dokumenteres i repoet før aflevering.
- **Git** (D5, D10–D12): Kildekoden ligger på GitHub. Alle gruppemedlemmer MUST have commits.
  Der committes til `main` ved hver større ændring, så historikken kan følges og rulles
  tilbage. Parprogrammering registreres med `Co-authored-by`-trailers.
- **Dokumentation** (D6): `README.md` med arkitekturdiagram og opstartsvejledning samt
  `CONTRIBUTE.md`.
- **Retningslinjer** (bindende for mennesker og AI-agenter): `AGENTS.md` samt
  `docs/retningslinjer/kodekvalitet.md`, `database.md` og `tests.md`. De dækker genbrug frem
  for nyt, single source of truth, 3NF, kommentarer og tests. `/speckit-plan` og
  `/speckit-implement` MUST følge dem.
- **Sporbarhed**: Specs, tasks og commits SHOULD referere krav-ID'er (FR*, FT*, A*, T*, D*)
  fra kravboardet.
- **Fremlæggelse** (D9): 10 minutters oplæg + 10 minutters spørgsmål fredag 2026-11-06.

## Governance

Denne constitution har forrang for anden praksis i projektet. `/speckit-plan` MUST
indeholde et Constitution Check, og afvigelser MUST begrundes i planens Complexity
Tracking-sektion.

Ændringer kræver enighed i gruppen og opdateres via `/speckit-constitution` med
versionsbump:

- MAJOR: Et princip fjernes eller omdefineres.
- MINOR: Et nyt princip eller en ny sektion tilføjes.
- PATCH: Formulering og præciseringer.

Ved hvert converge-tjek og før aflevering MUST implementeringen kontrolleres mod
principperne.

**Version**: 1.2.0 | **Ratified**: 2026-10-27 | **Last Amended**: 2026-10-27
