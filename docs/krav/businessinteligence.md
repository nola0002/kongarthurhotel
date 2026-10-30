# Business Intelligence: funktionelle krav (Tableau)

Afskrift af kravboardet (se [README](README.md)). De præcise krav står i
[`specs/002-bi-dashboard/spec.md`](../../specs/002-bi-dashboard/spec.md). Feature 002 er
planlagt ([`plan.md`](../../specs/002-bi-dashboard/plan.md),
[`tasks.md`](../../specs/002-bi-dashboard/tasks.md)). Backend-API'et til Tableau er bygget,
og workbooken er under arbejde.

Bruger: hoteladministrator (og ledelsen, der kun læser).

| ID | Krav | Kilde | Prioritet | Præciseret i (spec 002) |
|---|---|---|---|---|
| FT2 | Hente en liste af bookinger (dublet af `FR2`) | Afledt af FR1 | Must | Spec 001, FR-001 |
| FT4 | Data opdateres løbende og kan vises "live", ikke kun statisk fra CSV | – | Must | FR-013 |
| FT5 | Belægningsgrad beregnes | Systemudvikling | Must | FR-001 |
| FT6 | Gæsternes oprindelseslande vises | Forretningsdesign og -analytics | Must | FR-002 |
| FT7 | Indtjening pr. værelsestype pr. sæson | Forretningsdesign og -analytics | Must | FR-003 |
| FT8 | Indtjening pr. land | Forretningsdesign og -analytics | Must | FR-004 |
| FT9 | Hvilke værelsestyper og lande tjener mest | Forretningsdesign og -analytics | Must | FR-005 |
| FT10 | Årets samlede indtjening | Forretningsdesign og -analytics | Must | FR-006 |
| FT11 | Mindst ét selvvalgt nøgletal (fx gennemsnitlig pris pr. nat eller gennemsnitlig opholdslængde) | Forretningsdesign og -analytics | Must | FR-007 |
| FT12 | Kundetilfredshed nævnes som nøgletal, men der findes ingen data | Forretningsdesign og -analytics | Must | Spec 003, FR-011–FR-015: registreres ved check-out, nøgletal i `/analytics/kpis` |
| FT13 | Cocktailbarens samlede salg for året | – | Must | FR-008 |
| FT14 | Omsætning pr. drink | – | Must | FR-009 |
| FT15 | Procentfordeling mellem cocktails og kaffe | – | Must | FR-010 |
| FT16 | Interaktivt Tableau-dashboard med FT5–FT15, bygget på REST API'et | Systemudvikling og Forretningsdesign og -analytics | Must | FR-012 |
| FT17 | Ledelsen kan kun se data i dashboardet, ikke ændre dem | – | – | FR-014 |

Back office (001) leverer allerede grunddata til nøgletallene: drinkkategorier (FT15),
gæstens land (FT6, FT8), priser fastfrosset på booking og barsalg (FT7–FT10, FT13–FT14) og et
genereret datasæt over to år (`backend/scripts/generate-seed.js`).
