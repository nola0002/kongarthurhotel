# Research: Opgavedata – data og integration som i opgaven

**Feature**: `004-opgavedata` | **Dato**: 2026-10-30

Beslutningerne bygger på brugerens beslutninger fra 2026-10-30 (spec § Clarifications) og på
en gennemgang af opgavens datasæt fra https://github.com/ITAKEA/hoteldata (commit `e1f90f3`).
Stigen i `docs/retningslinjer/kodekvalitet.md` §1 er fulgt: ingen nye afhængigheder, og den
eksisterende generator, `calculateStayPrice`, `toOre` og `allowBookingSystemKey` genbruges.

## Fakta om kildefilerne

| Fil | Indhold | Bemærkninger |
|---|---|---|
| `international_names_with_rooms_1000.csv` | 1000 rækker: `First Name`, `Family Name`, `Country`, `Room Type`, `Days Rented`, `Season` (`low`/`mid`/`high`), `Price` | Gyldig UTF-8 med CRLF-linjeskift. Ingen anførselstegn og ingen kommaer i felter. 20 fornavne, 20 efternavne, 20 lande, 8 værelsestyper, 1–10 nætter. 5.379 nætter og 11.234.034 kr. i alt. Efternavnet "Müller" er ødelagt (R3) |
| `international_names_with_rooms_1000.xlsx` | Samme 1000 rækker plus en sumrække (5379 nætter) | Har "Müller" korrekt. Ellers identisk med CSV-filen |
| `drinks_menu_with_sales.xlsx` | 30 rækker: `Drink Name`, `Category` (`Cocktail`/`Coffee`), `Price (DKK)`, `Units Sold` | 20 cocktails og 10 kaffer. 179.958 enheder (62.077 cocktails, 117.881 kaffe). Priser med float-støj, fx `91.40000000000001` |

Fordeling i CSV-filen: sæson low 332, mid 335, high 333. Værelsestype fra 103 (LOFT Suite) til
138 (Spa Executive). Lande fra 31 (Egypt) til 63 (South Korea).

## R1. Kildefilerne i repoet

- **Beslutning**: Opgavens tre filer kopieres byte for byte til `db/source/`. Hertil kommer
  den eksporterede `drinks_menu_with_sales.csv` (R2). `db/.gitattributes` får linjen
  `source/* -text`, så git aldrig konverterer linjeskift.
- **Rationale**:
  - Proveniensen er synlig. Censor kan sammenligne filerne med opgavens repo
    (`shasum db/source/*`).
  - Maskinen har `core.autocrlf=input`. Uden `-text` ville CSV-filens CRLF blive til LF ved
    commit, og filen ville ikke længere være "uændret".
  - `db/` er monteret som `/docker-entrypoint-initdb.d`. MySQL-entrypointet kører kun `*.sh`,
    `*.sql` og komprimerede `.sql`-filer og skriver "ignoring" for alt andet, også mappen
    `source`. Backend monterer allerede `./db` som `/db`, så generatoren kan læse filerne i
    containeren.
  - Bookingfilens xlsx-udgave bruges ikke af generatoren. Den ligger der kun som bevis for
    stavningen "Müller" (R3).
- **Alternativer**: `backend/data/` (filerne er databasens startdata, ikke backend-kode).
  Hente filerne fra GitHub ved generering (kræver netværk og er ikke reproducerbart).

## R2. Indlæsning uden nye afhængigheder

- **Beslutning**:
  - CSV læses med `readFileSync(..., 'utf8')`, `split(/\r?\n/)` og `split(',')`. Generatoren
    kræver præcis 7 felter pr. række og 1000 rækker, ellers stopper den.
  - Drinkfilen eksporteres **én gang** fra xlsx til `db/source/drinks_menu_with_sales.csv`
    (UTF-8, komma-separeret, samme fire kolonneoverskrifter) med et regneark (Excel, Numbers
    eller LibreOffice: "CSV UTF-8"). Priserne skal stå med højst to decimaler, som regnearket
    viser dem (`91.4`, `69.1`), ikke som rå float-værdier (`91.40000000000001`,
    `69.09999999999999`).
  - Med danske regionale indstillinger skriver Excel og Numbers semikolon som skilletegn og
    decimalkomma (`72,47`). Eksporten skal have komma som skilletegn og decimalpunktum, ellers
    afviser generatorens kolonnetjek filen. En BOM i starten af filen er ufarlig, fordi
    overskriftslinjen springes over.
- **Rationale**:
  - CSV-formatet er så simpelt (ingen anførselstegn, ingen kommaer i felter), at to `split`
    er nok. Det er stigens trin 3 (sproget kan det).
  - `toOre` afkorter efter to decimaler. `"69.09999999999999"` ville give 69,09 kr. i stedet
    for 69,10 kr. Eksporten med to decimaler undgår det uden ekstra kode, og selvtjekket (R15)
    fanger en forkert eksport.
  - En xlsx-fil er en zip med XML. En parser med `node:zlib` ville være ca. 40 linjer, som
    gruppen skal kunne forklare, til en fil, der ikke ændrer sig.
- **Alternativer**: npm-pakken `xlsx`/`exceljs` (ny afhængighed for én fil, afvist efter
  `kodekvalitet.md` §1). Egen zip/XML-læser med `node:zlib` (mere kode end gevinst).

## R3. Tegnsæt og "Müller"

- **Fund**: Beslutningsnotatet antog, at CSV-filen er latin-1/cp1252. Den er gyldig UTF-8 og
  indeholder kun ASCII plus erstatningstegnet U+FFFD (bytes `EF BF BD`) i 54 rækker med
  efternavnet "M�ller". Opgavens xlsx-udgave af samme fil har "Müller", og alle andre felter
  er ens i de to filer. Tegnet gik altså tabt ved CSV-eksporten hos opgavestilleren.
- **Beslutning**: CSV-filen læses som UTF-8, og U+FFFD erstattes med "ü". Generatoren kræver,
  at der er præcis 54 erstatninger, og at alle står i "Müller", ellers stopper den.
- **Rationale**: Opgavens data er "Müller". Et erstatningstegn i UI'et ville være en synlig
  forskel fra opgaven. Kildefilen forbliver uændret, og rettelsen er én linje med en
  kommentar, der peger på xlsx-filen.
- **Alternativer**: Gemme "M�ller" (byte-tro, men forkert navn i UI og søgning). Læse
  xlsx-udgaven i stedet (kræver en xlsx-læser, R2). Rette kildefilen (den ville ikke længere
  være opgavens fil).

## R4. Værelsestyper, kapacitet og fordeling (214 værelser, 428 gæster)

- **Krav**: 214 værelser med 1–4 personer, maks. ca. 428 gæster ad gangen. 428 / 214 = 2, så
  gennemsnitskapaciteten skal være præcis 2. Det kræver
  Σ antal × (kapacitet − 2) = 0: hver enkeltværelsesplads under 2 skal opvejes af en plads
  over 2 i en suite.
- **Beslutning**:

  | id | Værelsestype (opgaven) | CSV-navn | Kapacitet | Værelser | Gæster |
  |---|---|---|---|---|---|
  | 1 | Standard enkeltværelse | Standard Single | 1 | 46 | 46 |
  | 2 | Grand lit værelse | Grand Lit | 2 | 30 | 60 |
  | 3 | Standard dobbeltværelse | Standard Double | 2 | 50 | 100 |
  | 4 | Superior dobbeltværelse | Superior Double | 2 | 40 | 80 |
  | 5 | Junior suite | Junior Suite | 3 | 14 | 42 |
  | 6 | Spa executive | Spa Executive | 2 | 18 | 36 |
  | 7 | Suite | Suite | 4 | 10 | 40 |
  | 8 | LOFT suite | LOFT Suite | 4 | 6 | 24 |
  | | **I alt** | | | **214** | **428** |

  Kontrol: 46 + 30 + 50 + 40 + 14 + 18 + 10 + 6 = 214 værelser.
  46·1 + (30 + 50 + 40 + 18)·2 + 14·3 + (10 + 6)·4 = 46 + 276 + 42 + 64 = 428 gæster.
  Balancen: −46 (enkelt) + 14·1 (junior) + 16·2 (suite og loft) = 0.
- **Rationale**:
  - Hele spændet 1–4 fra opgaven er med: enkeltværelset tager 1, junior suiten 3, suite og
    loft 4. Grand lit (fransk seng), de to dobbeltværelser og Spa executive tager 2.
  - Fordelingen ligner et byhotel: mange standardværelser og få suiter. De dyreste typer har
    færrest værelser.
  - `id` følger opgavens rækkefølge, og listen sorteres allerede på `id`
    (`roomRepository`), så UI'et viser typerne i opgavens rækkefølge uden ny kolonne.
  - Navneoversættelsen CSV → opgaven står kun i generatoren (kolonnen "CSV-navn"). Den bruges
    kun ved import, så den hører ikke hjemme i databasen.
- **Alternativer**:
  - Lige mange værelser pr. type (ca. 27, som CSV-filens næsten jævne fordeling): så kan
    gennemsnittet kun blive 2, hvis der er lige så mange 1-personers- som 3-personerspladser.
    Med kapacitet 4 på suiterne kræver det over 50 enkeltværelser. Det går ikke med 27.
  - Kapacitet 2 på alle typer: 428 passer, men opgavens "1–4 personer" er ikke opfyldt.

## R5. Værelsesnumre og etager

- **Beslutning**: Samme nummerering som i 001 (etage × 100 + løbenummer). Værelserne
  fordeles i typeordenen på 6 etager med 36 værelser (øverste etage 34):

  | Etage | Værelser |
  |---|---|
  | 1 | 101–136 Standard enkeltværelse |
  | 2 | 201–210 Standard enkeltværelse, 211–236 Grand lit værelse |
  | 3 | 301–304 Grand lit værelse, 305–336 Standard dobbeltværelse |
  | 4 | 401–418 Standard dobbeltværelse, 419–436 Superior dobbeltværelse |
  | 5 | 501–522 Superior dobbeltværelse, 523–536 Junior suite |
  | 6 | 601–618 Spa executive, 619–628 Suite, 629–634 LOFT suite |

- **Rationale**: 214 = 2 × 107 kan ikke deles i ens etager, så 001's mønster (samme typer på
  hver etage) kan ikke bruges. At fylde i typeordenen er det enkleste og lægger LOFT-suiterne
  øverst. `rooms.id` følger rækkefølgen, så tildelingen af "laveste ledige værelse"
  (`ORDER BY CHAR_LENGTH(room_number), room_number`) er uændret.
- **Alternativer**: Blandede typer pr. etage (mere kode og ingen krav). Opgaven angiver ingen
  etageplan.

## R6. Sæsoner og julehøjsæson

- **Beslutning**: Hvert år inddeles efter de danske meteorologiske årstider plus jul:

  | Sæson | Perioder pr. år | Dage (2025) |
  |---|---|---|
  | Lavsæson | 01-01 → sidste dag i februar, 12-01 → 12-19 | 59 + 19 = 78 |
  | Mellemsæson | 03-01 → 05-31, 09-01 → 11-30 | 92 + 91 = 183 |
  | Højsæson | 06-01 → 08-31, 12-20 → 12-31 | 92 + 12 = 104 |

  Seks perioder pr. år for 2025, 2026 og 2027, i alt 18. De dækker hver dag præcis én gang
  (78 + 183 + 104 = 365). Sidste dag i februar beregnes som dagen før 1. marts, så skudår også
  virker.
- **Rationale**:
  - Opgaven: lavsæson er "typisk vintermånederne", mellemsæson "forår og efterår", højsæson
    "sommer og jul". De meteorologiske årstider (DMI: vinter dec–feb, forår mar–maj, sommer
    jun–aug, efterår sep–nov) er den mest direkte læsning.
  - Julen er 20.–31. december (brugerens beslutning). Det dækker juleferien og nytårsaften.
    Natten 31/12 → 1/1 er højsæson, og natten 1/1 → 2/1 er lavsæson.
  - 001's inddeling (lav jan–mar og nov–dec, ingen jul) afviger fra opgaven og erstattes.
- **Alternativer**: Jul 20/12–2/1 over årsskiftet (to perioder pr. årsskifte og ingen kilde
  for 1.–2. januar). Bevare marts og november i lavsæson (afviger fra "vintermånederne").

## R7. Priser

- **Beslutning**: `room_prices` pr. (type, sæson): lav = opgavens laveste pris, høj = højeste
  pris og mellem = midtpunktet afrundet til nærmeste 50 kr. Alle midtpunkter er allerede
  delelige med 50, så afrundingen ændrer intet:

  | Værelsestype | Lav | Mellem | Høj |
  |---|---|---|---|
  | Standard enkeltværelse | 900 | 1.050 | 1.200 |
  | Grand lit værelse | 1.100 | 1.250 | 1.400 |
  | Standard dobbeltværelse | 1.200 | 1.400 | 1.600 |
  | Superior dobbeltværelse | 1.400 | 1.700 | 2.000 |
  | Junior suite | 1.800 | 2.150 | 2.500 |
  | Spa executive | 2.000 | 2.400 | 2.800 |
  | Suite | 2.500 | 3.000 | 3.500 |
  | LOFT suite | 3.000 | 3.500 | 4.000 |

- **Fund**: CSV-filens pris pr. nat (`Price / Days Rented`) varierer fra række til række og
  følger ikke en fast prisliste. For de fire billigste typer ligger højsæson over opgavens
  interval:

  | Type (CSV) | Lav | Mellem | Høj | Opgavens interval |
  |---|---|---|---|---|
  | Standard Single | 909–1.171 | 1.007–1.298 | 1.213–1.498 | 900–1.200 |
  | Grand Lit | 1.107–1.381 | 1.210–1.596 | 1.417–1.793 | 1.100–1.400 |
  | Standard Double | 1.202–1.589 | 1.308–1.677 | 1.611–1.973 | 1.200–1.600 |
  | Superior Double | 1.400–1.791 | 1.511–1.997 | 1.807–2.189 | 1.400–2.000 |
  | Junior Suite | 1.812–2.195 | 2.002–2.387 | 2.206–2.498 | 1.800–2.500 |
  | Spa Executive | 2.028–2.496 | 2.205–2.591 | 2.501–2.795 | 2.000–2.800 |
  | Suite | 2.509–2.986 | 2.709–3.294 | 3.004–3.483 | 2.500–3.500 |
  | LOFT Suite | 3.000–3.474 | 3.227–3.766 | 3.505–3.996 | 3.000–4.000 |

- **Konsekvens**: CSV-prisen gemmes uændret som `total_price` (fastfrosset historisk pris,
  001 FR-009), selv om den ikke kan genberegnes fra prislisten. Prislisten følger opgavens
  tekst. Redigeres en importeret booking, beregnes prisen efter prislisten som for alle
  bookinger.
- **Alternativer**: En pris pr. booking i prislisten (umuligt: samme type og sæson har
  forskellige priser). Udlede prislisten af CSV-gennemsnit (afviger fra opgavens tekst).

## R8. Lande

- **Beslutning**: `countries` indeholder præcis de 20 lande fra CSV-filen. Oversættelsen fra
  CSV-navn til ISO 3166-1 alpha-2 står som en fast tabel i generatoren. Det danske navn kommer
  fra `Intl.DisplayNames('da', { type: 'region' })` som i 001:

  | CSV | ISO | Dansk | CSV | ISO | Dansk |
  |---|---|---|---|---|---|
  | Australia | AU | Australien | Japan | JP | Japan |
  | Brazil | BR | Brasilien | Mexico | MX | Mexico |
  | Canada | CA | Canada | Nigeria | NG | Nigeria |
  | China | CN | Kina | Pakistan | PK | Pakistan |
  | Egypt | EG | Egypten | Russia | RU | Rusland |
  | France | FR | Frankrig | South Korea | KR | Sydkorea |
  | Germany | DE | Tyskland | Spain | ES | Spanien |
  | India | IN | Indien | Sweden | SE | Sverige |
  | Italy | IT | Italien | United Kingdom | GB | Storbritannien |
  | United States | US | USA | Vietnam | VN | Vietnam |

- **Rationale**: En baglæns opslagstabel via `Intl.DisplayNames('en')` over alle
  bogstavpar giver forældede koder (France → `FX`, Russia → `SU`, United Kingdom → `UK`) og
  er derfor forkert. 20 faste linjer er det enkleste korrekte.
- **Konsekvens**: Danmark og de øvrige 20 lande fra 001 forsvinder. Receptionisten kan kun
  vælge opgavens 20 lande (brugerens beslutning, spec Assumptions).

## R9. Fornavn og efternavn (1NF)

- **Beslutning**:
  - Skema: `bookings.guest_name` erstattes af `first_name VARCHAR(75) NOT NULL` og
    `family_name VARCHAR(75) NOT NULL` med hver sin `CHECK (CHAR_LENGTH(TRIM(...)) > 0)`.
    `INDEX (guest_name)` fjernes uden erstatning.
  - API: `firstName` og `familyName` erstatter `guestName` i `BookingInput` og `Booking`. Begge
    er påkrævede med `minLength: 1`, `maxLength: 75` og `pattern: '\S'`.
  - Service: begge trimmes. Tomt navn giver `VALIDATION_ERROR` med `field: 'firstName'`
    ("Fornavn skal udfyldes") eller `field: 'familyName'` ("Efternavn skal udfyldes").
  - Søgning: `q` matcher `CONCAT(b.first_name, ' ', b.family_name) LIKE CONCAT('%', ?, '%')`.
    Ét prædikat dækker fornavn, efternavn og "fornavn efternavn". Collation
    `utf8mb4_0900_ai_ci` ignorerer store/små bogstaver og accenter, så "muller" finder
    "Müller".
  - Visning: én hjælper i `frontend/src/format.js`, `guestName(booking)`, returnerer
    `` `${firstName} ${familyName}` ``. Liste, detalje, slet-dialog, toast og barsalg bruger
    den. Formularen får to felter med labels "Fornavn" og "Efternavn".
- **Rationale**:
  - Opgavens data har to felter, og ét felt med to oplysninger bryder 1NF
    (`database.md` §1).
  - 75 + 75 = 150 tegn som det gamle felt.
  - Indexet på `guest_name` blev aldrig brugt, fordi `LIKE '%…%'` med jokertegn foran ikke
    kan bruge et B-tree-index. Med ca. 21.600 rækker er en fuld scanning hurtig nok.
  - Navnet sættes sammen i frontend, fordi det er formatering og ikke en forretningsregel.
    API'et sender kun de to felter (brugerens beslutning: de erstatter `guestName`).
- **Alternativer**: Beholde `guestName` som afledt felt i svaret (to sandheder i kontrakten).
  En `guests`-tabel (der er stadig ingen gæsteidentitet, 001 B15). Søge med
  `first_name LIKE ? OR family_name LIKE ?` (finder ikke "ingrid ols").

## R10. Import af de 1000 bookinger

- **Beslutning**:
  1. Rækkerne læses i filens rækkefølge og får booking-id 1–1000, så booking-id N er række N.
  2. Oversættelse: værelsestype via R4, land via R8, sæson `low`/`mid`/`high` → Lavsæson,
     Mellemsæson, Højsæson.
  3. Placering: For hver række vælges en tilfældig ankomstdato i 2025 blandt de datoer, hvor
     alle `Days Rented` nætter ligger i én periode af rækkens sæson (R6). Bookingen får det
     første ledige værelse af typen (laveste nummer). Er ingen værelser ledige, prøves en ny
     dato. Efter 200 forsøg stopper generatoren med en fejl, der nævner rækken.
  4. `total_price` = `Price` (kr., heltal i filen). `source` = `booking_system`
     (spec Clarifications). `guest_count` = tilfældigt 1..kapacitet. `created_at` = 14 dage
     før ankomst kl. 12:00, som i 001.
  5. Placeringen sker før de genererede bookinger, så de altid finder plads.
- **Rationale**: Alle nætter i rækkens sæson betyder, at BI's indtjening pr. sæson for de 1000
  bookinger svarer til filen. Faste id'er gør tjekket i quickstart til et simpelt opslag.
  En simulering med fordelingen fra R4 placerede alle 1000 rækker i første forsøg.
- **Alternativer**: Lade rækker krydse sæsongrænser (sæsonen i filen ville ikke passe).
  Fordele rækkerne over 2025–2026 (opgavens årssalg og bookinger ville ikke ligge i samme år).

## R11. Øvrige bookinger

- **Beslutning**: Generatoren fylder hvert værelse fra 2025-01-01 til 2027-02-28 som i 001,
  men uden om de importerede bookinger:
  - Ophold: 1–10 nætter jævnt fordelt (som CSV-filen). Fornavn, efternavn og land vælges
    jævnt blandt CSV-filens 20 + 20 navne og 20 lande. `source` = `backoffice`.
  - Overlapper et nyt ophold en importeret booking på værelset, springes der til den
    importerede bookings afrejsedag.
  - Efter hvert ophold er der en chance for 1–5 tomme dage. Chancen afhænger af sæsonen på
    afrejsedagen: lav 1,0, mellem 0,85, høj 0,45.
  - Prisen beregnes med `calculateStayPrice` og prislisten (R7). `guest_count` er 1..kapacitet.
  - Id'er fra 1001 og opefter, sorteret efter ankomst og værelse.
- **Forventet resultat** (simulering med R4–R6): ca. 20.600 genererede bookinger, i alt ca.
  21.600. Belægning ca. 64 % i lav-, 68 % i mellem- og 79 % i højsæson, ca. 70 % samlet. Det
  ligger inden for spec FR-009 (65–80 %, højest i højsæson). De præcise tal måles i
  quickstart og skrives i README.
- **Alternativer**: 1–7 nætter som i 001 (afviger fra opgavens fordeling).

## R12. Drinks og barsalg

- **Beslutning**:
  - `drink_categories`: 1 Cocktail, 2 Kaffe (CSV "Coffee" → "Kaffe", dansk UI).
  - `drinks`: de 30 drinks i filens rækkefølge (id 1–30) med filens engelske navne og priser
    med to decimaler (fx Margarita 72,47, Cosmopolitan 91,40, Espresso 69,10).
  - **2025**: For hver drink deles `Units Sold` i salg på 1–4 enheder (tilfældigt, det sidste
    salg får resten). Hvert salg får en tilfældig dag i 2025 og et tidspunkt 08:00–23:59.
    Summen pr. drink er derfor præcis `Units Sold`.
  - **2026**: Samme metode fra 2026-01-01 til og med `SEED_SALES_END = 2026-11-05` (309
    dage) med `round(Units Sold × 309 / 365)` enheder pr. drink. Ingen salg efter.
  - `unit_price` = drinkens pris. Ca. en tredjedel af salgene lægges på en booking, hvor
    gæsten bor på hotellet på salgsdatoen (`check_in <= dato < check_out`), som i 001.
  - Salgene sorteres efter tidspunkt og får id derefter.
- **Forventet resultat**: ca. 72.000 salg i 2025 og ca. 61.000 i 2026, i alt ca. 133.000.
  2025: 179.958 enheder og 13.448.640,34 kr. (cocktails 7.104.755,43 kr., kaffe
  6.343.884,91 kr.).
- **Rationale**: Opgaven: Helene Christine laver 20 cocktails og 10 kaffetyper, og
  dashboardet viser hendes salg for året. Præcis "Units Sold" i 2025 gør FT13–FT15
  sammenlignelige med filen. Ca. 493 enheder om dagen er filens tal, ikke et valg.
- **Bartender**: Helene Christine er den eneste, så der er ingen medarbejderkolonne på
  `bar_sales` (YAGNI). 003 viser navnet på barsiden.
- **Alternativer**: Større antal pr. salg for færre rækker (brugeren har valgt 1–4). Kun ét
  salg pr. drink pr. dag (urealistisk).

## R13. Bookingsystemet: PUT og DELETE (KB-T10)

- **Beslutning**: `backend/src/routes/bookings.js` monterer den eksisterende
  `allowBookingSystemKey` på `PUT /bookings/:id` og `DELETE /bookings/:id` i stedet for
  `requireSession`. `GET`-routes, `/bookings/quote` og alt andet er uændret (kun session).
  I kontrakten får `PUT` og `DELETE` `security: [{ session: [] }, { bookingSystemKey: [] }]`.
- **Kilde**: `updateBooking` ændrer aldrig `source`, så en booking beholder den kilde, den
  blev oprettet med. Middlewarens `req.bookingSource` bruges kun af `POST`.
- **Rationale**: Én middleware tjekker alle nøgler (`isValidKey`), så nøglen på `PUT`/`DELETE`
  tjekkes præcis som på `POST`. Uden nøgle falder den tilbage til sessionen. Nøglen gælder
  alle bookinger, også dem fra back office (spec Clarifications).
- **Alternativer**: En separat integrations-route `/integrations/bookings` (to veje til samme
  regel). Kun bookinger med `source = booking_system` (opgaven begrænser det ikke).

## R14. Seedens størrelse og opstartstid

- **Skøn**: 214 værelser, ca. 21.600 bookinger og ca. 133.000 barsalg. `02_seed.sql` bliver
  ca. 10 MB (i dag ca. 2 MB). Rækkerne indsættes stadig 1000 pr. `INSERT`, så hver statement
  ligger langt under `max_allowed_packet` (64 MB i MySQL 8.4).
- **Opstart**: Init-scripts kører, før MySQL lytter på TCP, så healthchecket først bliver grønt
  efter indlæsningen. Budgettet er `start_period` 60 s + 40 × 3 s = 180 s. ca. 155.000 rækker
  forventes at tage under et minut. Tiden måles i quickstart Del 1. Rækker den ikke, hæves
  `retries` i `docker-compose.yml`.
- **Følger for 002**: `/analytics/bar-sales` returnerer alle salg (ca. 133.000 rækker), og
  `/analytics/room-nights` ca. 120.000 nætter. Svartiderne måles i quickstart Del 5.
  Ændringer i 002's endpoints er uden for 004.

## R15. Selvtjek i generatoren

- **Beslutning**: Generatoren slutter med `node:assert/strict`-tjek, før den skriver filen:
  - 214 værelser, 8 typer, Σ kapacitet = 428, 3 sæsoner, 20 lande, 30 drinks (20 + 10).
  - Periodedækning: hver dag 2025-01-01–2027-12-31 ligger i præcis én periode.
  - 1000 importerede bookinger. Hver ligger i 2025 med alle nætter i rækkens sæson.
  - Ingen overlap pr. værelse og `guest_count` ≤ kapacitet for alle bookinger.
  - 54 rettede "Müller" og intet U+FFFD tilbage.
  - Enheder pr. drink i 2025 = `Units Sold`. Omsætning 2025 = 13.448.640,34 kr. (fanger en
    eksport med forkerte priser, R2).
  - Intet salg efter `SEED_SALES_END`, og alle bookingkoblede salg ligger i opholdet.
- **Rationale**: Generatoren er et script og ikke en forretningsregel, så `tests.md` kræver
  ingen test. Tjekkene er den mindste kontrol, der fejler, hvis data afviger fra opgaven, og
  de kører hver gang seedet genereres.
- **Alternativer**: En separat testfil til generatoren (den skulle eksportere sine
  mellemresultater og blive mere kompleks).
