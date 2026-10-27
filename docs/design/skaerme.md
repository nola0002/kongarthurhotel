# Skærme og flows – Kong Arthur back office

Hver skærm henviser til kravene i `specs/001-backoffice-bookinger/spec.md`. Primitiver og
opskrifter står i `komponenter.md`. Routes og URL-parametre er på dansk.

## Kort over appen

```
/login                         Log ind (offentlig)
/                              → redirect til /bookinger
/bookinger                     Bookingliste  (?q=navn&dato=2026-03-10)
/bookinger/:id                 Bookingdetalje (rediger, slet, barsalg på bookingen)
/barsalg                       Registrér barsalg + dagens salg
```

Opret og rediger booking sker i en skuffe ovenpå den aktuelle side og har ingen egen route.
`/login` er en top-level route **uden for** layout-routen. Alle andre routes ligger under
layout-routen (`<Shell>`), som har én `loader` (`requireSession`). Uden session redirectes der
til `/login?fra=<sti>`.

## Shell

Kilde: `Shell.jsx`. Sidebar (ordmærke, Bookinger, Barsalg, konto og "Log ud"), indholdskort,
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
  `/bookinger`.

## Bookingliste (FR-001, FR-002)

Kilde: `pages/Bookings.jsx`.

- `PageHeader`: titel "Bookinger" og beskrivelse "N bookinger, M i huset i dag", hvor N og M er
  `counts.all` og `counts.in_house` fra API-svaret. Handling: primær "Ny booking" med `Kbd N`.
- Værktøjslinje: søgefelt (gæstenavn, `?q=`) og datofelt (`?dato=`, viser hvem der bor på
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
  | Gæst | `guestName` (link) og `country.name` i `ink-3` |
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

1. **Gæst**: navn (`guestName`, `required`) og land (`countryCode`, native `<select>`).
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

## Bookingdetalje (FR-004, FR-005, FR-010a, FR-016)

Kilde: `pages/BookingDetail.jsx` (uden faner, da én side er nok).

- Brødkrumme: "Bookinger / #1042".
- Header: H1 med gæstenavn, `StatusBadge` og underlinje med periode, værelse og land.
- Handlinger til højre, to almindelige knapper: `secondary` "Rediger" (åbner skuffen med data)
  og `danger` "Slet booking" (åbner bekræftelsesdialogen, se `komponenter.md` § Bekræft
  sletning).
- Fliser (`grid grid-cols-12 gap-5`):
  - **Ophold** (`Field`-liste): ankomst, afrejse, nætter (`nights`), gæster (`guestCount`),
    værelse, kilde og oprettet.
  - **Pris**: den *gemte* totalpris (`Stat`) og `nightsLabel(nights)` (FR-009). Der vises ingen
    opdeling pr. sæson her, fordi den ville blive beregnet ud fra dagens priser og kunne
    afvige fra den gemte total.
  - **Barsalg på værelset**: tabel med tidspunkt, drink, antal og beløb, `kr(total)` fra
    `GET /api/bar-sales?bookingId=` i bunden og knappen "Registrér salg", der er forudfyldt
    med denne booking. Knappen vises, når `status` er `arriving` eller `in_house`.
- Bookingen findes ikke: `EmptyState` "Bookingen findes ikke længere" og et link tilbage.

## Barsalg (FR-010, FR-010a, FR-011)

Én enkel side, bygget af de samme primitiver.

- `PageHeader`: titel "Barsalg" og beskrivelse "I dag: X kr.", hvor X er `kr(total)` fra
  `GET /api/bar-sales`.
- Registrering (`Tile`) består af:
  - Drink: radio-kort grupperet under **Cocktails** og **Kaffe**. Hvert kort viser navn og
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
- Kalender eller belægningsgrid (værelser × nætter).
- Overbliksside med nøgletal. Den hører hjemme i Tableau (feature 002).
- Aktivitetslog pr. booking.
