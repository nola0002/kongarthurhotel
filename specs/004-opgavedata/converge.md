# Converge: 004-opgavedata

**Dato**: 2026-10-30 · **Task**: T038 · **Krav**: KB-D4

Koden og data er sammenholdt med `spec.md`, `plan.md`, `tasks.md` og constitution v1.2.1.
Udgangspunktet var den nuværende kode og den kørende udviklingsdatabase, ikke afkrydsningerne
i `tasks.md`. Grundlaget er:

- `docker compose exec -T backend npm test` giver `ℹ tests 98 · ℹ pass 98 · ℹ fail 0`. Det
  inkluderer 003's tests og de 10 tests med `004 FR-0xx` (FR-006 og FR-007 i `api.test.js`,
  3 × FR-006 i `bookingService.test.js` og 5 × FR-013 i `api.test.js`).
- `generate-seed.js` er kørt i en kopi uden for repoet (Node 25). Selvtjekket er bestået, og
  resultatet er byte for byte lig `db/02_seed.sql` (`cmp`). Seed er altså genereret og ikke
  rettet i hånden.
- `db/source/*` har samme `shasum` som ITAKEA/hoteldata `e1f90f3`, både i arbejdskopien og som
  committet blob. `git check-attr` giver `text: unset` (CRLF bevares).
- Drinkfilens CSV-eksport er sammenlignet med xlsx-filens rå XML. Der er 30 rækker og 0
  afvigelser i navn, kategori, pris (to decimaler) og Units Sold.
- Alle optællinger nedenfor er lavet med SQL mod udviklingsdatabasen. Den er indlæst fra tomt
  volume kl. 13:42:46 og var klar kl. 13:42:52, dvs. ca. 6 sekunder for skema og seed.
  Databasen svarer til seed-filen. Den eneste forskel er 2 tilfredshedsscorer, som er
  registreret i hånden i dag på bookinger med afrejse 2026-10-30 (id 18268 og 18333).

**Resultat**: ✅ Converged. Implementeringen opfylder spec, plan og tasks. `tasks.md` har ingen
ny Convergence-fase. Se dog afvigelse 1 om datoen 2026-11-05.

## Krav → implementering

| Krav | Status | Hvor og målt |
|---|---|---|
| FR-001 214 værelser, 8 typer i opgavens rækkefølge | ✅ | `generate-seed.js` (`roomTypes`, `rooms`). DB: 214 værelser (101–634). Typerne har id 1–8 i opgavens rækkefølge, og `roomRepository` sorterer på `rt.id` |
| FR-002 Kapacitet 1–4, i alt 428 | ✅ | Kapacitet 1/2/2/2/3/2/4/4 × 46/30/50/40/14/18/10/6 værelser. DB: Σ = 428 |
| FR-003 Tre sæsoner inkl. jul, dækning 2025–2027 | ✅ | `yearPeriods`. DB: 18 perioder pr. år (lav 1/1–28/2 og 1/12–19/12, mellem 1/3–31/5 og 1/9–30/11, høj 1/6–31/8 og 20/12–31/12). Selvtjekket viser, at hver dag ligger i præcis én periode |
| FR-004 Prisliste | ✅ | `pricesKr`. DB: lav = opgavens min., høj = opgavens maks., mellem = midtpunktet afrundet til 50 for alle 8 typer (fx 900/1.050/1.200 og 3.000/3.500/4.000) |
| FR-005 20 lande | ✅ | `countryCodeByCsvName` og `Intl.DisplayNames('da')`. DB: 20 lande, de samme 20 som i CSV-filen (fx Sydkorea, USA, Storbritannien) |
| FR-006 Fornavn og efternavn | ✅ | `db/01_schema.sql` (to kolonner med `CHECK TRIM`), `bookingRepository.js`, `bookingService.js` (`validate`, `toApi`), `errors.js`, `openapi.yaml`, `BookingForm.jsx` (to felter med `<label>`, `required` og `maxLength`) og `format.js` (`guestName`), som bruges i alle visninger. Der er ingen `guestName`-felter tilbage i API'et |
| FR-007 Søgning | ✅ | `CONCAT(first_name, ' ', family_name) LIKE …` med `utf8mb4_0900_ai_ci`. Test `004 FR-007`. DB: "muller" finder alle 54 importerede "Müller" |
| FR-008 De 1000 CSV-rækker | ✅ | `imported`. Række for række mod CSV: 1000/1000 ens i fornavn, efternavn, land, type, nætter, sæson (alle nætter i én sæson i 2025) og pris. `source = booking_system`, id = rækkenummer og 54 × "Müller" |
| FR-009 Øvrige bookinger, belægning 65–80 % | ✅ | DB: 20.570 genererede bookinger fra 2025-01-01 til 2027-02-28 med 1–10 nætter. Der er 0 prisafvigelser mod prislisten, og navne og lande er de 20 + 20 + 20 fra CSV-filen. Belægningen er 69,9 % for hele perioden (2025: 70,5 %, 2026: 70,6 %): høj 79,0 %, mellem 68,0 % og lav 64,2 % |
| FR-010 Antal gæster og ingen overlap | ✅ | DB: 0 bookinger over kapaciteten og 0 overlap pr. værelse |
| FR-011 30 drinks | ✅ | `drinks_menu_with_sales.csv` → `drinks`. DB: 20 Cocktail og 10 Kaffe med xlsx-filens navne og priser (Margarita 72,47, Espresso 69,10) |
| FR-012 Barsalg | ✅ (se afvigelse 1) | DB: 2025 giver præcis Units Sold for 30/30 drinks, i alt 179.958 enheder og 13.448.640,34 kr. `quantity` er 1–4, og der er 0 bookingkoblede salg uden for opholdet. Sidste salg er 2026-11-05 23:58 |
| FR-013 Bookingsystemets nøgle på PUT/DELETE | ✅ | `routes/bookings.js` (`allowBookingSystemKey` på POST/PUT/DELETE, `requireSession` på GET og `/satisfaction`), `auth.js` og `openapi.yaml` (`security` og beskrivelser). `updateBooking` skriver ikke `source`. 5 tests `004 FR-013` |
| FR-014 Kildefiler uændrede og deterministisk seed | ✅ | `db/source/` (shasum = `e1f90f3`), `db/.gitattributes` `source/* -text` og regenerering byte for byte |
| FR-015 Én kommando fra tom maskine | ✅ | Init-scripts 00–02 kører fra tomt volume. Healthchecket er uændret (60 s + 40 × 3 s) |
| SC-001 Optælling 214/8/428/3/20/30 | ✅ | SQL ovenfor |
| SC-002 1000/1000 rækker | ✅ | Sammenligning række for række, 0 afvigelser |
| SC-003 Units Sold 30/30 | ✅ | SQL ovenfor |
| SC-004 0 overlap, belægning 65–80 %, højsæson højest | ✅ | 0 overlap, 69,9 %, højsæson 79,0 % |
| SC-005 Under 3 minutter | ✅ | Ca. 6 s for databasens init (MySQL-loggen). Billedbygning er ikke medregnet |
| SC-006 Find en booking på navn på under 15 s | ✅ API · ⏳ ikke tidsmålt | Søgning på fuldt navn giver fx 61 hits for "liam nguyen". Kombinér med dato (bemærkning 2) |
| SC-007 Nøglen | ✅ | Tests: 200/204 med nøgle, 401 med forkert nøgle og på `GET`. 404 og 409 deler kodevej med session (FR-005/FR-007-testene) |
| Constitution I–VI | ✅ | SQL kun i `repositories/`, regler i `services/`, kontrakt og kode stemmer overens, én `docker compose up` og ingen nye afhængigheder, tabeller eller endpoints fra 004 |

## Afvigelser

1. **Data efter "i dag" indtil fremlæggelsen.** Spec 004 FR-012 og clarification fastlægger
   salget "til og med 2026-11-05" (`SEED_SALES_END`, fast dato, så seed er deterministisk).
   Koden følger spec, så der er ingen converge-task. Beslutningsnoten sagde dog "2026 frem til
   i dag, intet salg i fremtiden". I dag (2026-10-30) har databasen derfor data, der ligger
   efter dags dato:
   - 1.195 barsalg (3.062 enheder) fra 2026-10-31 til 2026-11-05.
   - 2.635 bookinger med `created_at` mellem 2026-10-31 og 2026-11-05 (`createdAt` er loftet
     til `SEED_SALES_END`).
   - Fra feature 003: 134 tilfredshedsscorer på bookinger med afrejse efter i dag. Det
     strider mod 003's egen regel (`BOOKING_NOT_DEPARTED`), set fra i dag.

   Fra 2026-11-06 (fremlæggelsen) ligger alt i fortiden, og så er data konsistente.
   Kommentaren ved `SEED_SALES_END` ("no sales and no booking created in the future") passer
   først fra den dag. Skal der aldrig være fremtidige data, skal brugeren beslutte det. Så
   ændres spec FR-012 og 003's seed-krav, `SEED_SALES_END` flyttes til en dato før i dag, og
   seed, README og research genereres eller rettes igen.
2. **Fejlteksten ved et navn af kun mellemrum** kommer fra validatoren (`pattern: '\S'` i
   `openapi.yaml`): "Ugyldig værdi i feltet Efternavn" og ikke servicens "Efternavn skal
   udfyldes". US3/AC4 er opfyldt (dansk tekst ved feltet). Servicens tjek er sidste værn, og
   det er testet.
3. **Drinkkortet sorteres alfabetisk** (`ORDER BY dc.name, d.name`) og ikke i drinkfilens
   rækkefølge. Hverken opgaven eller spec kræver en rækkefølge.

## Mangler

Ingen i 004's scope. Disse punkter er åbne, men ikke kodearbejde:

- SC-006 er ikke tidsmålt i en browser. Det svarer til 001's T069.
- Beslutningen om afvigelse 1 (behold 2026-11-05 eller flyt datoen) ligger hos brugeren. Den
  berører også 003's tilfredshedsscorer.

## Analyze (speckit-analyze, read-only)

22 krav (FR-001–FR-015, SC-001–SC-007) og 38 tasks. Dækningen er 100 %: hvert krav har mindst
én task. Der er 0 CRITICAL og 0 HIGH fund og ingen konflikter med constitution.

| ID | Kategori | Alvor | Sted | Fund |
|---|---|---|---|---|
| A1 | Inkonsistens | MEDIUM | spec FR-012, US4/AC3, `generate-seed.js` `SEED_SALES_END` | En fast slutdato 2026-11-05 mod beslutningen "intet salg i fremtiden". Data er tidsafhængigt inkonsistente indtil 2026-11-06 (afvigelse 1) |
| A2 | Dækning | LOW | spec Edge Cases ("müller"/"muller"), US5/AC5 | Ingen automatisk test af søgning uden accenter eller af 404 med nøglen. Begge er verificeret manuelt og afhænger af collation eller delt kodevej |
| A3 | Utestbart | LOW | spec SC-006 | Tidsmålet har ingen task, der måler det. Generiske navne giver mange hits |
| A4 | Inkonsistens | LOW | spec US3/AC4 vs. `openapi.yaml` | Teksten er validatorens og ikke servicens (afvigelse 2) |
| A5 | Ordlyd | LOW | spec.md `Status: Draft` | Featuren er implementeret, men status er ikke opdateret |
