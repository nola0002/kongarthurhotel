# AGENTS.md – regler for AI-agenter og udviklere

Denne fil gælder for **alle**, der skriver kode i repoet: Claude, Copilot, Cursor, Codex og
mennesker. Reglerne er ikke forslag. Kode, der bryder dem, skal laves om, før den merges.

## Projektet

Hotel Kong Arthur: back office til receptionen (bookinger, barsalg) og et Tableau-dashboard
til ledelsen. Stack: **Docker Compose · MySQL · Node.js + Express · React + Tailwind**.
Tableau henter data via REST API'et.

## Læs før du skriver kode

| Hvad | Hvor | Status |
|---|---|---|
| Principper (overordnet) | `.specify/memory/constitution.md` | Har forrang for alt andet |
| Krav pr. feature | `specs/<nnn-feature>/spec.md` | |
| Teknisk plan og tasks | `specs/<nnn-feature>/plan.md`, `tasks.md` | |
| Kodekvalitet, genbrug, kommentarer | `docs/retningslinjer/kodekvalitet.md` | **Skal følges** |
| Database (3NF, constraints) | `docs/retningslinjer/database.md` | **Skal følges** |
| Tests | `docs/retningslinjer/tests.md` | **Skal følges** |
| Back office-design (tokens, komponenter, skærme) | `docs/design/` | **Skal følges** i frontend |

## De ti vigtigste regler

1. **Tænk som en doven senior-udvikler.** Den bedste kode er den, der aldrig skrives. Gå
   stigen igennem i `kodekvalitet.md`, før du skriver noget nyt.
2. **Genbrug frem for nyt.** Søg i kodebasen efter en eksisterende funktion, hjælper eller
   komponent, før du laver en ny. Dupleret logik er en fejl.
3. **Genopfind ikke hjulet.** Brug Node, Express, React, HTML, CSS eller MySQL's indbyggede
   muligheder før egen kode og før nye afhængigheder.
4. **Single source of truth.** Hver oplysning og regel findes ét sted. Se tabellen i
   `kodekvalitet.md`.
5. **Trelagsarkitektur.** Routes → services → repositories. Kun repositories kender SQL. Kun
   services kender forretningsregler og nøgletal.
6. **Databasen er i 3NF** og håndhæver selv integriteten med constraints og fremmednøgler.
7. **Tests skal være simple og meningsfulde.** Test forretningsregler og nøgletal, ikke
   framework-kode. En test skal fejle, når reglen brydes.
8. **Kommentarer forklarer *hvorfor*, ikke *hvad*.** Ingen udkommenteret kode.
9. **Små diffs, ingen ubestilte features.** Byg det, som tasken beder om, og intet andet.
   Hvis noget er uklart, så spørg i stedet for at gætte.
10. **Ejerskab.** Skriv kun kode, som gruppen kan forklare ved fremlæggelsen (D8). Ingen
    AI-funktionalitet i brugergrænsefladen (T8).

## Definition of Done

- [ ] Koden følger de tre retningslinjer ovenfor.
- [ ] Ny eller ændret forretningsregel eller nøgletal har en test, og `npm test` er grøn.
- [ ] API-ændringer er afspejlet i OpenAPI-specifikationen i samme commit.
- [ ] Skemaændringer er lavet som ny migration/init-script, ikke som manuel ændring.
- [ ] `docker compose up` starter stadig hele systemet fra en tom maskine.
- [ ] Commit-beskeden refererer krav- eller task-ID (fx `FR-007`, `T012`).
- [ ] Ved parprogrammering har commit en `Co-authored-by:`-trailer for hver deltager.
