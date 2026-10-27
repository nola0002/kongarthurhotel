# Skærme og flows – Kong Arthur back office

Hver skærm henviser til kravene i `specs/001-backoffice-bookinger/spec.md` og til den
Roster-skærm, den bygger på. Routes og URL-parametre er på dansk, ligesom i Roster.

## Kort over appen

```
/login                         Log ind (offentlig)
/                              → redirect til /bookinger
/bookinger                     Bookingliste  (?q=navn&dato=2026-03-10)
/bookinger/:id                 Bookingdetalje (rediger, slet, barsalg på bookingen)
/barsalg                       Registrér barsalg + dagens salg
```

Opret og rediger booking sker i en skuffe ovenpå den aktuelle side og har ingen egen route.
Alle routes undtagen `/login` beskyttes af én `loader` på layout-routen, ligesom Rosters
`requireSession` (`auth.ts`). Uden session redirectes der til `/login?fra=<sti>`.

## Shell

Kilde: `Shell.tsx`.

- Desktop: `lg:grid-cols-[264px_1fr]`. Flad sidebar på `paper`. Indholdet ligger i et
  svævende kort: `bg-canvas lg:m-2 lg:rounded-3xl lg:shadow-canvas lg:overflow-y-auto`.
- Indholdsbredde: `mx-auto max-w-[1280px] px-4 py-6 sm:px-8 sm:py-10`.
- **Sidebar**, oppefra:
  1. Ordmærke "Kong Arthur".
  2. Navigation: **Bookinger** og **Barsalg**. Phosphor-ikoner på 20px. Aktivt punkt:
     `bg-ink/[0.07] font-medium`, og ikonet skifter til `weight="fill"` i `text-signal`.
  3. Nederst (`mt-auto`): den indloggede konto og "Log ud".
- Mobil: topbar og sidebaren i en `Dialog`, der glider ind fra venstre.
- Tastatur:
  - `N` åbner "Ny booking", når fokus ikke er i et felt (Roster bruger `C`, `Shell.tsx:52-65`).
  - Genvejen vises som `<Kbd>N</Kbd>` på knappen.

## Log ind (FR-015)

Kilde: `pages/Login.tsx`.

- To kolonner på `lg`. Venstre: formular (`max-w-[400px]`). Højre: et nedtonet udsnit af
  bookinglisten (`aria-hidden inert`). Selve produktet fungerer som billede.
- Felter: brugernavn og adgangskode med vis/skjul-knap. Ingen SSO og ingen "glemt
  adgangskode" (uden for scope).
- Fejl: én generel besked, "Forkert brugernavn eller adgangskode", som `role="alert"`. Den
  afslører ikke, hvilket felt der var forkert.
- Under login: knappen viser spinner og "Logger ind…". Ved succes navigeres til `fra` eller
  `/bookinger`.

## Bookingliste (FR-001, FR-002)

Kilde: `pages/Bookings.tsx`.

- `PageHeader`: titel "Bookinger" og beskrivelse "N bookinger, M i huset i dag". Handling:
  primær "Ny booking" med `Kbd N`.
- Værktøjslinje: søgefelt (gæstenavn, `?q=`) og datofelt (`?dato=`, viser hvem der bor på
  hotellet den dag). "Ryd"-knappen vises kun, når der er filtre.
- Visnings-faner (valgfrie, som Rosters `VIEWS`): **Kommende · I huset · Afrejst · Alle**.
  Hver fane viser antal (`tnum text-ink-3`). Status *afledes* af datoerne og gemmes ikke
  (3NF).
- Kolonner:

  | Kolonne | Indhold |
  |---|---|
  | Periode | `date(check_in)`–`date(check_out)` og antal nætter i `ink-3` |
  | Gæst | Navn (link) og land i `ink-3` |
  | Værelse | Type + nr. i `ink-3` |
  | Gæster | `tnum` |
  | Status | `StatusBadge` |
  | Kilde | Lille `sunken`-badge "Bookingsystem", kun når kilden ikke er back office |
  | Pris | Højrestillet, `kr()` |

- `tfoot`: "I alt, N bookinger" og sum af pris.
- Klik på en række åbner `/bookinger/:id`.

### Opholdsstatus: form før farve

| Status | Markør | Pill |
|---|---|---|
| Kommende | Ring (`ring-[1.5px] ring-ink-3`) | `bg-sunken text-ink` |
| Ankommer i dag | Ring i `hold` | `bg-hold-soft text-hold-ink` |
| I huset | Fyldt `bg-ok` | `bg-ok-soft text-ok-ink` |
| Afrejst | Fyldt `bg-ink-4` | `bg-sunken text-ink-3` |

## Ny / rediger booking (FR-003, FR-004, FR-006–FR-008, FR-014)

Skuffe fra højre. Se opskriften i `komponenter.md`. Sektioner:

1. **Gæst**: navn (`required`) og land (Combobox med søgning).
2. **Ophold**:
   - Ankomst og afrejse (`type="date"`). Hjælpelinjen under viser "3 nætter · uge 11".
   - Antal gæster (`type="number" min=1`).
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
- Fejl fra backend: Kapacitet vises under antal gæster. "Ingen ledige værelser" vises som
  banner øverst. Skuffen forbliver åben med de indtastede data.
- Succes: Skuffen lukker, toasten "Booking oprettet – Jensen, 10.–12. mar. · værelse 104"
  vises, og listen opdateres. Det tildelte værelse nævnes, fordi systemet vælger det
  (FR-016).

## Bookingdetalje (FR-004, FR-005, FR-010a, FR-016)

Kilde: `pages/BookingDetail.tsx` (uden faner, da én side er nok).

- Brødkrumme: "Bookinger / #1042".
- Header: H1 med gæstenavn, `StatusBadge` og underlinje med periode, værelse og land.
- Handlinger til højre: sekundær "Rediger" (åbner skuffen med data) og en kebab-`Menu` med det
  røde punkt "Slet booking" (åbner `AlertDialog`, se `komponenter.md`).
- Fliser (`lg:grid-cols-12 gap-5`):
  - **Ophold** (`Field`-liste): ankomst, afrejse, nætter, gæster, værelse, kilde og oprettet.
  - **Pris**: den *gemte* totalpris (`Stat`) og antal nætter (FR-009). Der vises ingen
    opdeling pr. sæson her, fordi den ville blive beregnet ud fra dagens priser og kunne
    afvige fra den gemte total.
  - **Barsalg på værelset**: tabel med tidspunkt, drink, antal og beløb, sum i bunden og
    knappen "Registrér salg", der er forudfyldt med denne booking. Den vises kun, mens gæsten
    er i huset.
- Bookingen findes ikke: `EmptyState` "Bookingen findes ikke længere" og et link tilbage.

## Barsalg (FR-010, FR-010a, FR-011)

Én enkel side. Der er ingen tilsvarende side i Roster, så den bygges af de samme primitiver.

- `PageHeader`: titel "Barsalg" og beskrivelse "I dag: N salg · X kr.".
- Registrering (`Tile`) består af:
  - Drink: radio-kort grupperet under **Cocktails** og **Kaffe**. Hvert kort viser navn og
    pris (`tnum`).
  - Antal: `type="number" min=1`, standard 1.
  - Læg på værelse: valgfri Combobox over gæster, der er i huset i dag ("Ingen", standard).
  - Live-sum ("2 × 95 kr. = 190 kr.") og en primær "Registrér salg".
- Dagens salg: `Tile flush`-tabel med tidspunkt, drink, kategori, antal, beløb og værelse
  ("–" hvis det er et selvstændigt salg). Sum i `tfoot`.
- Succes: toasten "Salg registreret – 2 × Espresso Martini" vises, og formularen nulstilles.

## Bevidst udeladt

Kan tilføjes, hvis der bliver tid. Ingen af dem er krav.

- Kommandopalet (⌘K, Rosters `cmdk`).
- Kalender eller belægningsgrid. Rosters `WeekendGrid` er en god skabelon til værelser × nætter.
- Overbliksside med nøgletal. Den hører hjemme i Tableau (feature 002).
- Aktivitetslog pr. booking.
