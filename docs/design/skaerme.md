# Skærme og flows – Kong Arthur back office

Hver skærm henviser til kravene i `specs/001-backoffice-bookinger/spec.md` (Oversigt og
Belægningsplan til `specs/003-receptionsoverblik/spec.md`). Feature 005
(`specs/005-enterprise-backoffice/spec.md`) har gjort back office'et til receptionens
arbejdsværktøj: forside med dagens drift, pagineret liste, folio, kasse, omsætning, profil og
kommandopalet. Primitiver og
opskrifter står i `komponenter.md`. Routes og URL-parametre er på dansk.

## Kort over appen

```
/login                         Log ind (offentlig)
/                              → redirect til /oversigt
/oversigt                      Dagens drift  (?dato=2026-03-10)
/belaegningsplan               Belægningsplan (?fra=2026-03-10&dage=14)
/bookinger                     Bookingliste  (?side=&pr-side=&sorter=&orden=&visning=&q=&type=&land=&fra=&til=)
/bookinger/:id                 Folio: ophold, nætter, barsalg, regning og handlinger
/barsalg                       Kasse (?booking=1042 forvælger værelset)
/omsaetning                    Omsætning (?fra=&til=&pr=dag|maaned|aar)
/profil                        Profil, adgangskode og administration af priser
```

Opret og rediger booking sker i en skuffe ovenpå den aktuelle side og har ingen egen route.
`/login` er en top-level route **uden for** layout-routen. Alle andre routes ligger under
layout-routen (`<Shell>`), som har én `loader` (`requireSession`). Uden session redirectes der
til `/login?fra=<sti>`.

## Shell

Kilde: `Shell.jsx`. Sidebar med søgeknap, navigation i grupperne Reception, Bar, Økonomi og
Konto og kontoen nederst, indholdskort, toast, kommandopalet (⌘K) og genvejen `N` er
specificeret i [`komponenter.md` § Shell](komponenter.md#shell).

## Log ind (FR-015, 005 FR-018)

Kilde: `pages/Login.jsx`. Siden ligger uden for `<Shell>`.

- Fra `lg:` to kolonner (`lg:grid-cols-[1fr_1.15fr]`): formularen til venstre og hotellets
  facadefoto (`/kong-arthur-facade.webp`, `object-cover` i et afrundet kort med en diskret
  gradient og "Hotel Kong Arthur · København") til højre. På smalle skærme kun formularen.
- Felter: brugernavn og adgangskode med vis/skjul-knap. Ingen SSO og ingen "glemt
  adgangskode" (uden for scope).
- Fejl: API'ets `error.message` (én generel besked) som `role="alert"`.
- Under login: spinner og "Logger ind…". Ved succes navigeres til `fra` eller `/`. Et hint
  fortæller, at ⌘K søger efter login.

## Oversigt – dagens drift (003 FR-001–FR-004, 005 FR-001–FR-004)

Kilde: `pages/Overview.jsx`. Startsiden. Ét kald: `GET /api/reception/overview?date=`. Datoen
sendes kun, når `?dato=` står i adressen, så "i dag" er serverens dato.

- `PageHeader`: titel "Oversigt", `longDate(date)`, [`DateNav`](komponenter.md#datenav) og
  primær "Ny booking" med `Kbd N`.
- Fire `Stat`-fliser fra `kpis`: **Belægning i nat** (`pct(rate)`, "135 af 214 værelser"),
  **Ankomster tilbage** (remaining af total), **Afrejser tilbage** og **Gns. pris pr. nat**.
- Venstre (`col-span-8`): "Ankomster" og "Afrejser" med gæst, land, værelse, nætter, gæster,
  status og ét næste skridt pr. række: "Tjek ind" (`arriving`), "Tjek ud" (`departing`) eller
  "Registrér tilfredshed" (`checked_out`/`departed` uden score). Efter udtjek åbner
  tilfredshedsdialogen med det samme. Ind-/udtjek ligger i `useStayActions()` i
  `SatisfactionDialog.jsx`, så Oversigt og folio deler det.
- Højre (`col-span-4`): "I huset i nat" (bookinger og gæster), "Barsalg" med beløbet og linket
  "Åbn kassen", og "Ledige værelser" pr. type ("Udsolgt", når `free` er 0).
- React tæller ikke. Alle tal kommer fra API'et.

## Belægningsplan (003: FR-005–FR-009, FR-017)

Kilde: `pages/RoomPlan.jsx`. Ét kald: `GET /api/reception/room-plan?from=&days=`. `?fra=` og
`?dage=` sendes kun, når de står i adressen (standard: i dag og 14 dage).

- `PageHeader`: titel "Belægningsplan", beskrivelse `period(from, sidste dato)` og handlingerne
  `DateNav` (Forrige = `fra − dage`, Næste = API'ets `to`, "I dag" = samme antal dage fra i dag)
  og en native `<select>` "Vis" med 7, 14 og 31 dage.
- Forklaring under headeren: `StatusMarker` og label for hver status.
- `Tile flush` med plan-tabellen (se [`komponenter.md` § Belægningsplan](komponenter.md#belægningsplan-tabel)):
  en grupperække pr. værelsestype, en række pr. værelse og en "Ledige"-række pr. type med
  `free` fra API'et.
- En booking er én bjælke med statusmarkør og gæstens navn. Klik åbner `/bookinger/:id`.
  `aria-label` og `title` gentager navn, periode og status, så status ikke kun er farve.
- Ophold, der fortsætter uden for perioden, har ingen afrundet kant på den side.
- Ugyldige parametre (fx `?dage=40`) giver API'ets fejlbesked på fejlsiden.

## Bookingliste (FR-001, FR-002, 005 FR-005–FR-007)

Kilde: `pages/Bookings.jsx` og `Pagination.jsx`. Der er over 200.000 bookinger, så alt sker på
serveren: `GET /api/bookings` med side, sortering og filtre fra URL'en.

- `PageHeader`: titel "Bookinger", "N bookinger, M i huset i dag" (`counts`) og primær "Ny
  booking" med `Kbd N`.
- Filterlinje: søgning (navn, bookingnummer eller værelse, `?q=`), værelsestype (`?type=`), land
  (`?land=`), periode (`?fra=`/`?til=`, ophold der overlapper) og "Ryd filtre".
- Faner **Kommende · I huset · Afrejst · Alle** med antal fra `counts`. Fanerne beholder de
  andre filtre, men ikke søgningen, fordi API'et ignorerer visningen under søgning.
- Kolonner: Ankomst, Afrejse og Nætter (sorterbare), Gæst (sorterbar; navn som link, `#id`, land
  og kildebadge "Bookingsystem"), Værelse, Gæster, Status og Pris (sorterbar). Sortering via
  [`SortHeader`](komponenter.md#paginering-og-sorterbare-kolonner-paginationjsx).
- Under tabellen: [`Pagination`](komponenter.md#paginering-og-sorterbare-kolonner-paginationjsx).
  `tfoot` viser `kr(totalPrice)` for alle matchende bookinger.
- Klik på en række åbner `/bookinger/:id`.

## Ny / rediger booking (FR-003, FR-004, FR-006–FR-008, FR-014)

Skuffe fra højre. Se opskriften i `komponenter.md`. Sektioner:

1. **Gæst**: "Fornavn" (`firstName`) og "Efternavn" (`familyName`) side om side
   (`grid grid-cols-2 gap-4`, begge `required`, `maxLength={75}`) og land (`countryCode`,
   native `<select>`). Opgavens data har to navnefelter (spec 004 FR-006).
2. **Ophold**:
   - Ankomst og afrejse (`type="date"`, ingen min-dato, så bookinger bagud i tid er
     tilladt). Hjælpelinjen under viser "3 nætter · uge 11" ud fra `quote.nights`.
   - Antal gæster (`guestCount`, `type="number" min=1`).
3. **Værelsestype**: radio-kort med navn, "plads til 2" og "fra 650 kr./nat". Typer, der er
   udsolgt i perioden, vises deaktiveret med teksten "Udsolgt i perioden". Dataen kommer
   fra API'et.
4. **Pris** (live, fra API'et):

   | Linje | Eksempel |
   |---|---|
   | Pr. sæson | 2 nætter × 650 kr. (lavsæson) |
   | Pr. sæson | 1 nat × 900 kr. (højsæson) |
   | **I alt** | **2.200 kr.** (`text-xl font-semibold`, `border-t`) |

- Footer: "Annullér" og primær "Opret booking" eller "Gem ændringer".
- Fejl fra backend vises med API'ets `error.message`. Kapacitet (field `guestCount`) vises under
  antal gæster. "Ingen ledige værelser" vises som banner øverst. Skuffen forbliver åben med de
  indtastede data.
- Findes bookingen ikke længere (404 ved gem): toasten "Bookingen findes ikke længere" og
  navigation til `/bookinger`.
- Succes: Skuffen lukker, toasten "Booking oprettet – Jensen, 10.–12. mar. · værelse 104"
  vises, og listen opdateres. Det tildelte værelse nævnes, fordi systemet vælger det
  (FR-016).

## Folio – bookingdetalje (FR-004, FR-005, 003 FR-012, 005 FR-008–FR-010)

Kilde: `pages/BookingDetail.jsx`. Ét kald: `GET /api/bookings/:id/folio`.

- Header: gæstens navn, `StatusBadge` og "Booking #id · periode · type, værelse".
- Handlinger, kun når de passer til status: "Tjek ind" (`arriving`) og "Tjek ud" (`departing`)
  som primære, "Sælg på værelset" (→ `/barsalg?booking=:id`, når gæsten er i huset),
  "Registrér/Ret tilfredshed" (fra afrejsedagen), "Ret" (skuffen) og "Slet booking" (bekræftelse).
- Fliser: **Gæst** (navn, land, gæster, kilde, oprettet), **Ophold** (datoer, nætter, værelse,
  ind- og udtjekningstid, tilfredshed) og **Regning** (ophold, bar, total).
- **Nætter**: dato, sæson og nattens andel af den fastfrosne pris. Summen er bookingens pris.
- **Barsalg på værelset**: tidspunkt, drink, antal og beløb med sum.
- Alle beløb kommer fra API'et. Bookingen findes ikke: `EmptyState` og et link tilbage.

## Kasse (FR-010, FR-010a, 005 FR-011–FR-013)

Kilde: `pages/BarSales.jsx`. En salgsside uden historik (historikken er på Omsætning).

- Venstre: drinks som store knapper grupperet efter kategori fra API'et (Cocktail, Kaffe). Et
  tryk lægger 1 i ordren, og knappen viser antallet, mens drinken er i ordren.
- Højre: "Ordre" (bliver stående ved scroll) med linjer (+/−, fjern), "Ryd", antal og et
  visningsoverslag af totalen. Betaling: "Betalt direkte" eller "Læg på værelse" (gæster i huset
  som "værelse · navn", forvalgt fra `?booking=`).
- "Afslut ordre" sender `POST /api/bar-sales/orders`. Alle linjer registreres eller ingen.
  Toasten viser API'ets total. Ordren tømmes, og betalingen nulstilles til direkte.

## Omsætning (005 FR-014, FR-015)

Kilde: `pages/Revenue.jsx`. Ét kald: `GET /api/revenue?from=&to=&groupBy=`.

- Periode og gruppering i URL'en (`?fra=`, `?til=`, `?pr=`), genveje: Denne måned, I år, Sidste
  år og 2000–i dag. Standard: i år pr. måned.
- Fire fliser: Bar i alt, Solgte enheder, Værelser i alt (med nætter) og Samlet (`krShort` og
  `krExact`).
- Baren (primær): stablede søjler pr. periode (cocktail/kaffe; højden er kun en visningsskala),
  "Vis som tabel", kategoriandele og top 5-drinks.
- Værelser (sekundær): omsætning pr. periode og antal nætter.
- API-fejl (fx pr. dag over 3 år) vises som banner ved feltet.

## Profil og administration (005 FR-019, FR-020)

Kilde: `pages/Profile.jsx`.

- Konto: brugernavn og "Log ud".
- Skift adgangskode: nuværende, ny (mindst 8 tegn) og gentag. Kun gentagelsen tjekkes i
  formularen. Resten afgøres af API'et, og fejlen vises ved feltet.
- Administration: prislisten som tabel (værelsestyper × sæsoner, "Gem" pr. række sender kun
  ændrede celler) og drinkkortet (pris og "Gem" pr. drink). Nye priser gælder kun nye bookinger
  og salg. Toast efter hver gemning.

## Bevidst udeladt

Kan tilføjes, hvis der bliver tid. Ingen af dem er krav.

- Ledelsens nøgletal og trends. De hører hjemme i Tableau (feature 002). Omsætningssiden er
  receptionens hurtige overblik.
- Betalingsmiddel, kvitteringer og fakturaer (005 Assumptions).
- Aktivitetslog pr. booking.
