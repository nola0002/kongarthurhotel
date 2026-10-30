# Kravboardet

Her står gruppens oprindelige krav, skrevet af fra FigJam-boardet "systemudvikling", siden
"Krav" (læst 2026-10-29). Kravene er prioriteret efter MoSCoW og kommer fra opgaveteksten,
de tre kurser (Systemudvikling, Softwarearkitektur, Forretningsdesign og -analytics),
tillægsspørgsmålene eller gruppens egne valg.

Kravboardet er **input**. De præcise, testbare krav står i specs, som henviser tilbage hertil:

| Fil | Krav | Præciseret i |
|---|---|---|
| [`backoffice.md`](backoffice.md) | Back office, receptionist (FR1–FR9) | [`specs/001-backoffice-bookinger/spec.md`](../../specs/001-backoffice-bookinger/spec.md) |
| [`businessinteligence.md`](businessinteligence.md) | BI og Tableau (FT2–FT17) | [`specs/002-bi-dashboard/spec.md`](../../specs/002-bi-dashboard/spec.md), FT12 i [`specs/003-receptionsoverblik/spec.md`](../../specs/003-receptionsoverblik/spec.md) |
| [`architecture.md`](architecture.md) | Arkitektur (A1–A6) | [constitution](../../.specify/memory/constitution.md) og [`plan.md`](../../specs/001-backoffice-bookinger/plan.md) |
| [`technical.md`](technical.md) | Teknik (T1–T10) | constitution og `plan.md` |
| Denne fil, nedenfor | Proces og aflevering (D1–D12) | [`CONTRIBUTE.md`](../../CONTRIBUTE.md) og [`AGENTS.md`](../../AGENTS.md) |

Hvad der faktisk er bygget, står i
[`converge.md`](../../specs/001-backoffice-bookinger/converge.md) (001) og
[`converge.md`](../../specs/002-bi-dashboard/converge.md) (002).

## Sådan læses ID'erne

- **Kravboardet**: `FR1`, `FT5`, `A4`, `T10`, `D8`.
- **Spec**: `FR-001`, `SC-003`. Hver spec har sin egen nummerering, så `FR-001` i 001 og
  `FR-001` i 002 er to forskellige krav. Kravboardets ID står i parentes efter specens krav,
  fx `FR-005 (FR1, FR3)`.
- **Tasks**: `T001`… i hver features `tasks.md` (001: `T001`–`T071`, 002: `T001`–`T036`). Spec, plan og tasks skriver derfor kravboardets
  `T`-, `A`- og `D`-ID'er med præfikset `KB-`, så `KB-T10` (bookingsystemet) ikke forveksles
  med task `T010`.

## Proces og aflevering (D)

| ID | Krav | Kilde | Prioritet | Opfyldes af |
|---|---|---|---|---|
| D1 | Spec Kit-flow: Constitution → Specify → Clarify → Plan → Tasks → Implement → Converge | Systemudvikling | Must | [`CONTRIBUTE.md`](../../CONTRIBUTE.md) § Arbejdsgang |
| D2 | Constitution, spec, plan og tasks ligger i repoet (fx `specs/`) | Systemudvikling | Must | `.specify/memory/constitution.md`, `specs/` |
| D3 | User stories i formatet "Som … ønsker jeg … så …", INVEST, med acceptkriterier | Systemudvikling | Must | User stories i `specs/*/spec.md` |
| D4 | Resultat af sidste Converge-tjek: implementeret vs. mangler | Systemudvikling | Must | `specs/001-backoffice-bookinger/converge.md`, `specs/002-bi-dashboard/converge.md` |
| D5 | Kildekode på GitHub. Alle gruppemedlemmer har commits | Softwarearkitektur | Must | Git-historikken |
| D6 | README.md med arkitekturdiagram og CONTRIBUTE.md | Softwarearkitektur | Must | [`README.md`](../../README.md), [`CONTRIBUTE.md`](../../CONTRIBUTE.md) |
| D7 | Swagger UI kører i en Docker-container | Softwarearkitektur | Must | Servicen `swagger` i `docker-compose.yml` |
| D8 | Brug af AI med ejerskab: gruppen kan forklare og vurdere alt | Softwarearkitektur | Must | `AGENTS.md` regel 10, constitution VI |
| D9 | Fremlæggelse: 10 min præsentation + 10 min spørgsmål, fredag 6/11 (2026) | Præsentation | Must | – |
| D10 | Alle laver git commits | Softwarearkitektur | Should | Git-historikken |
| D11 | Co-authored git commits | Softwarearkitektur | Must | `Co-authored-by:`-trailer, jf. `CONTRIBUTE.md` |
| D12 | Commit til `main` ved hver større ændring, så vi kan følge og gå tilbage | Softwarearkitektur | Must | `CONTRIBUTE.md` § Commits |

## Kendte uklarheder på boardet

- `A5` og `T6` er brugt to gange hver. Vi skelner ved at nævne kravets indhold.
- `FT2` er en dublet af `FR2`. `FT1` og `FT3` findes ikke.
- `FT16` og `A5` henviser til en ældre nummerering (`F1`, `F5–F15`, `F16`). Det svarer til
  `FT1`, `FT5–FT15` og `FT16`.
- `FR3`–`FR9`, `FT17` og `T9` har ingen prioritet eller bruger på boardet. Specs behandler dem
  som Must.
