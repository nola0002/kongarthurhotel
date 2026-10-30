# Skærme og flows – Kong Arthur back office

Hver skærm henviser til kravene i `specs/001-backoffice-bookinger/spec.md` (Oversigt og
Belægningsplan til `specs/003-receptionsoverblik/spec.md`). Primitiver og
opskrifter står i `komponenter.md`. Routes og URL-parametre er på dansk.

## Kort over appen

```
/login                         Log ind (offentlig)
/                              → redirect til /oversigt
/oversigt                      Dagsoverblik  (?dato=2026-03-10)
/belaegningsplan               Belægningsplan (?fra=2026-03-10&dage=14)
/bookinger                     Bookingliste  (?q=navn&dato=2026-03-10)
/bookinger/:id                 Bookingdetalje (rediger, slet, barsalg på bookingen)
/barsalg                       Registrér barsalg + dagens salg
```

Opret og rediger booking sker i en skuffe ovenpå den aktuelle side og har ingen egen route.
`/login` er en top-level route **uden for** layout-routen. Alle andre routes ligger under
layout-routen (`<Shell>`), som har én `loader` (`requireSession`). Uden session redirectes der
til `/login?fra=<sti>`.

## Shell

Kilde: `Shell.jsx`. Sidebar (ordmærke, Oversigt, Belægningsplan, Bookinger, Barsalg, konto og
"Log ud"), indholdskort,
toast og genvejen `N` er specificeret i [`komponenter.md` § Shell](komponenter.md#shell).

## Log ind (FR-015)

Kilde: `pages/Login.jsx`. Siden ligger uden for `<Shell>`.

- Én kolonne med formularen: `grid min-h-dvh place-items-center bg-paper`, formular
  `w-full max-w-[400px]` med ordmærket "Kong Arthur" over titlen. Ingen produktvisning og
  ingen data før login.
- Felter: brugernavn og adgangskode med vis/skjul-knap. Ingen SSO og ingen "glemt
  adgangskode" (uden for scope).
- Fejl: API'ets `error.message` (én generel besked, "Forkert brugernavn eller adgangskode") som
  `role="alert"`. Den afslører ikke, hvilket felt der var forkert.
- Under login: knappen viser spinner og "Logger ind…". Ved succes navigeres til `fra` eller
  `/` (Oversigt, 003 FR-001).

## Oversigt (003: FR-001–FR-004, FR-012, FR-017)

Kilde: `pages/Overview.jsx`. Startsiden. Ét kald: `GET /api/reception/overview?date=`. Datoen
sendes kun, når `?dato=` står i adressen, så "i dag" er serverens dato.

- `PageHeader`: titel "Oversigt", beskrivelse `longDate(date)` og
  [`DateNav`](komponenter.md#datenav) (forrige/næste dag, "I dag" = `/oversigt`, datovælger).
- Fire `Stat`-fliser (`grid grid-cols-4 gap-5`): Ankomster, Afrejser, I huset (`inHouse.bookings`
  med konteksten "N gæster") og Barsalg (`kr(barSalesTotal)`).
- `grid grid-cols-12 gap-5`:
  - Venstre (`col-span-8`): `Tile flush` "Ankomster" og "Afrejser" efter tabel-opskriften med
    kolonnerne Gæst (`guestName`, link), Værelse (nummer og type i `ink-3`), Nætter, Gæster og
    Status. Hele rækken er klikbar og åbner `/bookinger/:id`. Afrejser har desuden kolonnen
    Tilfredshed: "4 af 5", når `satisfactionScore` er sat, ellers knappen "Registrér
    tilfredshed" (`size="sm"`), når `status` er `departed`, ellers "–". Knappen åbner
    [`SatisfactionDialog`](komponenter.md#kundetilfredshed-satisfactiondialog).
  - Højre (`col-span-4`): `Tile` "Ledige værelser" med én `Field` pr. type: "4 ledige af 30" og
    "Udsolgt", når `free` er 0.
- Tomme lister: `EmptyState` på én linje ("Ingen ankomster på datoen.").
- React tæller ikke. Antal i `Tile count` og `Stat` er listernes længde og tallene fra API'et.

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

## Bookingliste (FR-001, FR-002)

Kilde: `pages/Bookings.jsx`.

- `PageHeader`: titel "Bookinger" og beskrivelse "N bookinger, M i huset i dag", hvor N og M er
  `counts.all` og `counts.in_house` fra API-svaret. Handling: primær "Ny booking" med `Kbd N`.
- Værktøjslinje: søgefelt (fornavn, efternavn eller "fornavn efternavn", `?q=`) og datofelt (`?dato=`, viser hvem der bor på
  hotellet den dag). "Ryd"-knappen vises kun, når der er filtre.
- Visnings-faner: **Kommende · I huset · Afrejst · Alle**.
  - Fanerne er disjunkte. "I huset" inkluderer gæster, der ankommer i dag.
  - Hver fane viser sit antal fra `counts` i API-svaret.
  - Når der søges eller filtreres på dato, vises "Alle" som aktiv fane.
  - Status kommer fra API'et (`booking.status`). Den afledes i backend og gemmes ikke (3NF).
- Kolonner:

  | Kolonne | Indhold |
  |---|---|
  | Periode | `date(checkIn)`–`date(checkOut)` og `nightsLabel(nights)` i `ink-3` |
  | Gæst | `guestName(booking)` (fornavn og efternavn fra `format.js`, link) og `country.name` i `ink-3` |
  | Værelse | `roomType.name` + `room.number` i `ink-3` |
  | Gæster | `guestCount`, `tnum` |
  | Status | [`StatusBadge`](komponenter.md#statusbadge-opholdsstatus-form-før-farve) |
  | Kilde | Lille `sunken`-badge "Bookingsystem", kun når kilden ikke er back office |
  | Pris | `kr(totalPrice)`, højrestillet |

- `tfoot`: "I alt, `total` bookinger" og `kr(totalPrice)` fra API-svaret (se `komponenter.md`
  § Tabel).
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

## Bookingdetalje (FR-004, FR-005, FR-010a, FR-016, 003 FR-012)

Kilde: `pages/BookingDetail.jsx` (uden faner, da én side er nok).

- Brødkrumme: "Bookinger / #1042".
- Header: H1 med gæstenavn, `StatusBadge` og underlinje med periode, værelse og land.
- Handlinger til højre: `secondary` "Registrér tilfredshed" (kun når `status` er `departed`,
  åbner [`SatisfactionDialog`](komponenter.md#kundetilfredshed-satisfactiondialog), som også
  retter en registreret score), `secondary` "Rediger" (åbner skuffen med data) og `danger` "Slet
  booking" (åbner bekræftelsesdialogen, se `komponenter.md` § Bekræft sletning).
- Fliser (`grid grid-cols-12 gap-5`):
  - **Ophold** (`Field`-liste): ankomst, afrejse, nætter (`nights`), gæster (`guestCount`),
    værelse, tilfredshed ("4 af 5" eller "–"), kilde og oprettet.
  - **Pris**: den *gemte* totalpris (`Stat`) og `nightsLabel(nights)` (FR-009). Der vises ingen
    opdeling pr. sæson her, fordi den ville blive beregnet ud fra dagens priser og kunne
    afvige fra den gemte total.
  - **Barsalg på værelset**: tabel med tidspunkt, drink, antal og beløb, `kr(total)` fra
    `GET /api/bar-sales?bookingId=` i bunden og knappen "Registrér salg", der er forudfyldt
    med denne booking. Knappen vises, når `status` er `arriving` eller `in_house`.
- Bookingen findes ikke: `EmptyState` "Bookingen findes ikke længere" og et link tilbage.

## Barsalg (FR-010, FR-010a, FR-011, 003 FR-016)

Kilde: `pages/BarSales.jsx`. Én enkel side, bygget af de samme primitiver.

- `PageHeader`: titel "Barsalg" og beskrivelse "Helene Christine · lobbybaren · I dag: X kr.",
  hvor X er `kr(total)` fra `GET /api/bar-sales`. Hun er hotellets eneste bartender, så salget
  har ingen medarbejderkolonne.
- Registrering (`Tile`) består af:
  - Drink: radio-kort grupperet efter `category` fra API'et (fx Cocktail og Kaffe). Hvert kort viser navn og
    pris (`tnum`).
  - Antal: `type="number" min=1`, standard 1.
  - Læg på værelse: valgfri native `<select>` over gæster, der er i huset i dag
    (`GET /api/bookings?view=in_house`). Første valg er "Ingen" (standard).
  - En primær "Registrér salg".
- Dagens salg: `Tile flush`-tabel med tidspunkt, drink, kategori, antal, beløb og værelse
  ("–" hvis det er et selvstændigt salg). `kr(total)` fra API-svaret i `tfoot`.
- Succes: toasten "Salg registreret – 2 × Espresso Martini · 190 kr." vises med `amount` fra
  API-svaret, og formularen nulstilles.

## Bevidst udeladt

Kan tilføjes, hvis der bliver tid. Ingen af dem er krav.

- Kommandopalet (⌘K, `cmdk`).
- Nøgletal som belægningsgrad og indtjening på Oversigt. De hører hjemme i Tableau (feature
  002).
- Aktivitetslog pr. booking.
