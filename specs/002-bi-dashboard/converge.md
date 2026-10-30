# Converge: 002-bi-dashboard

**Dato**: 2026-10-30 · **Task**: T036 (foreløbig kørsel) · **Krav**: KB-D4

Koden er sammenholdt med `spec.md`, `plan.md`, `tasks.md` og constitution v1.2.1. Udgangspunktet
var den nuværende kode, ikke afkrydsningerne i `tasks.md`. Grundlaget er dette:

- `docker compose exec backend npm test` giver 67/67 grønne.
- Alle fem endpoints svarer `200` med Bearer-nøglen på under 0,2 sekunder med seed-data.
- `POST` på `/analytics/kpis` giver `405`.
- Værelsesnætternes indtjening summerer præcis til `total_price` for alle 10.396 bookinger.

**Tableau-workbooken er ikke bygget endnu.** Kørslen skal gentages, når T009–T035 er
færdige. Derfor er T036 stadig åben.

## Krav → implementering

| Krav | Status | Hvor |
|---|---|---|
| FR-001 Belægningsgrad (FT5) | ✅ API · ⏳ Tableau | `analyticsService.js` (`occupancyRows`, KPI `occupancyRate`), `/analytics/occupancy`. Arket mangler (T017) |
| FR-002 Bookinger og gæster pr. land (FT6) | ✅ API · ⏳ Tableau | `/analytics/bookings`, KPI `bookings`/`guests`. Arket mangler (T020) |
| FR-003 Indtjening pr. type × sæson (FT7) | ✅ API · ⏳ Tableau | `/analytics/room-nights`. Arket mangler (T012) |
| FR-004/005 Indtjening og rangering pr. land og type (FT8, FT9) | ✅ API · ⏳ Tableau | `/analytics/room-nights`. Arkene mangler (T013) |
| FR-006 Årets indtjening (FT10) | ✅ API · ⏳ Tableau | KPI `roomRevenue` pr. nattens år. Flisen mangler (T014) |
| FR-007 Gns. pris pr. nat og opholdslængde (FT11) | ✅ API · ⏳ Tableau | KPI `avgPricePerNight`, `avgStayLength`. Fliserne mangler (T027) |
| FR-008–010 Barsalg, pr. drink, kategoriandele (FT13–FT15) | ✅ API · ⏳ Tableau | `/analytics/bar-sales`, KPI `barRevenue`, `barRevenueShare` (kategorier fra databasen). Arkene mangler (T023, T024) |
| FR-011 Formler kun i backend (KB-A4) | ✅ | Alle formler ligger i `analyticsService.js`. Tableau må kun summere, filtrere, sortere og dividere to backend-summer (constitution III, v1.2.1) |
| FR-012 Interaktivitet (FT16) | ⏳ | T032 |
| FR-013 Data via API (FT4, KB-A5) | ✅ API · ⏳ Tableau | REST API Connector (research R1). Datakilderne mangler (T009) |
| FR-014 Skrivebeskyttet (FT17) | ✅ | `allowBiKey` i `backend/src/auth.js`, kun `GET`-routes. 6 FT17-tests i `api.test.js` |
| FR-015 Indtjening fordelt pr. nat | ✅ | `allocateRevenue` + `eachNight`/`periodOn` fra `pricing.js`. Tests for sæsonskifte, årsskifte og ligelig deling |
| FR-016 Seneste opdatering | ✅ API · ⏳ Tableau | `generatedAt` på `/analytics/kpis`. Arket mangler (T030) |
| SC-001 Tal matcher manuel beregning | ✅ API | 11 håndregnede tests i `analyticsService.test.js` |
| SC-002–SC-005 | ⏳ | Måles i Tableau (T031, T035) |
| Edge cases | ✅ | `data-model.md` § edge cases. Tomme år giver 0, aldrig NaN (test) |
| Constitution I–VI | ✅ | Tre lag, OpenAPI med `biKey`, formler i services, ingen nye containere, tabeller eller pakker, `npm test` |

## Afvigelser (bevidste og dokumenterede)

1. **Belægning for et udsnit beregnes i Tableau.** Tableau bruger `SUM(soldRoomNights) / SUM(availableRoomNights)`, fordi
   filtrering på vilkårlige kombinationer kræver det. Constitution III er præciseret i v1.2.1, og valget står i
   `plan.md` § Complexity Tracking.
2. **Testnavne bruger kravboardets FT-ID'er.** Spec 002's `FR-0xx` kolliderer med 001's.
3. **Kategoriandelene er almindelig division.** De summerer til 1 på dev-data og i testen med tre lige store kategorier,
   men den sidste kategori tvinges ikke til `1 − resten`.
4. **Uverificerede antagelser om Tableau-connectoren.** Fem punkter står som "verificeres i Tableau" i research og
   quickstart. De afklares i T035.

## Mangler

Converge fandt ingen nye mangler, så der er ikke tilføjet en Convergence-fase til `tasks.md`.
Det resterende arbejde er de åbne Tableau-tasks, der allerede findes:

- T003 og T009: connector og datakilder.
- T012–T014, T017, T020, T023, T024, T027 og T030: arkene.
- T031 og T032: dashboard og opdateringstjek.
- T035: gennemgang af quickstart.
- T036: den endelige converge.
