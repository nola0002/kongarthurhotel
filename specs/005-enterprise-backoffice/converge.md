# Converge: 005 Enterprise back office

**Dato**: 2026-11-02 · **Metode**: kode læst mod spec/plan/tasks, `npm test` (161/161 grønne),
`vite build` grøn, API-kald gennem frontendens proxy mod udviklingsdatabasen (233.644 bookinger).
Siderne er **ikke** klikket igennem i en browser (ingen browser i sessionen). Det står som T037.

## Krav

| Krav | Status | Belæg |
|---|---|---|
| FR-001 Fire nøgletal | ✅ | `receptionService.overview().kpis`, test i `receptionService.test.js`. Dev: 135/214 = 63,1 %, ankomster 24/24, afrejser 33/33, gns. 1.475,92 kr. |
| FR-002 Lister, ny booking, ledige, barsalg | ✅ | `pages/Overview.jsx` |
| FR-003 Ind-/udtjek kun i dag | ✅ | `bookingService.checkIn/checkOut`, `INVALID_STATUS`, service- og API-tests (200, derefter 422, bookingsystemets nøgle 401) |
| FR-004 Seks statusser | ✅ | `deriveStatus`, test pr. status. `STATUS` i `ui.jsx` |
| FR-005 Paginering 25/50/100 | ✅ | `page`/`pageSize` klemmes. `Pagination.jsx`. Dev: side 3 sorteret på pris 0,03–0,04 s |
| FR-006 Sortering over alle | ✅ | Whitelist i `bookingRepository`, ukendt `sort` giver 400 |
| FR-007 Filtre i URL'en | ✅ | `roomTypeId`, `countryCode`, `from`/`to`, `view`, `q`. `Bookings.jsx` URL-state |
| FR-008 Nætter summerer til prisen | ✅ | `getFolio` med `allocateRevenue`. Test over sæsonskifte. Dev: 10 nætter = 10.200 kr. |
| FR-009 Barsalg og regning | ✅ | `folio.bill` = 10.200 + 411,70 = 10.611,70 kr. |
| FR-010 Handlinger efter status | ✅ | `BookingDetail.jsx` |
| FR-011 Kasse | ✅ | `BarSales.jsx` |
| FR-012 Ordre alle eller ingen | ✅ | `registerOrder` i `withTransaction`. Service- og API-test: ukendt drink → intet indsat |
| FR-013 Ingen historik på kassen | ✅ | Kun et link til Omsætning |
| FR-014 Omsætning | ✅ | `revenueService`. Dev 2025: bar 13.448.640,34 kr. (= Units Sold), 0,42 s |
| FR-015 Dag over 3 år afvises | ✅ | Test ved 1096/1097 dage |
| FR-016 Cmd+K | ✅ | `CommandPalette.jsx`. `q=214&sort=nearest` giver gæsten på værelse 214 først (0,2 s) |
| FR-017 Grupperet navigation | ✅ | `NAV` i `Shell.jsx` |
| FR-018 Login med facadefoto | ✅ | `Login.jsx`, `/kong-arthur-facade.webp` svarer 200 |
| FR-019 Skift adgangskode | ✅ | `changePassword`, `WRONG_PASSWORD`, API-test: ny virker, gammel afvises |
| FR-020 Priser | ✅ | `adminService`. API-test: ny pris i prisoverslag, gammel booking og gammelt salg uændret |
| FR-021 Kun session | ✅ | `requireSession` på alle nye routes. API-tests med bookingsystemets nøgle giver 401 |
| FR-022 OpenAPI | ✅ | Kontrakten skrevet først. Validatoren håndhæver den |

## Success criteria

| SC | Status | Belæg |
|---|---|---|
| SC-001 < 1 s | ✅ | Langsomst: `view=all&sort=guest&page=2000` 0,40 s |
| SC-002 Cmd+K < 5 s | ⏳ | API 0,2 s. Ikke målt i browser |
| SC-003 Ordre ≤ 6 tryk | ⏳ | 3 drinks + "Læg på værelse" + vælg + "Afslut" = 6. Ikke klikket |
| SC-004 Bar 2025 | ✅ | 13.448.640,34 kr. |
| SC-005 Nætter = pris | ✅ | Test og stikprøver (2014, 2026) |
| SC-006 Tests | ✅ | 161/161 |

## Afvigelser og opfølgning

1. Siderne er ikke klikket igennem i en browser (T037). Gruppen bør køre quickstart Q1–Q12.
2. `GET /bookings` returnerer ikke den anvendte `sort`/`order`. Listen kopierer derfor API'ets
   standardrækkefølge for at markere den aktive kolonne. Det kan rettes ved at returnere dem.
3. Tre tekster er skrevet af agenten og bør godkendes: "Den gentagne adgangskode er ikke den
   samme.", "Receptionens fælles konto" og "Ved søerne i hjertet af København." (login).
4. `PriceInput` havde `multipleOf: 0.01`, som afviste fx 19,99 (kommatal i validatoren). Fjernet.
