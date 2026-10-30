# Datamodel: Opgavedata – data og integration som i opgaven

**Feature**: `004-opgavedata` | **Dato**: 2026-10-30

Datamodellen fra [001 data-model.md](../001-backoffice-bookinger/data-model.md) gælder
stadig. Her står kun ændringerne. `db/01_schema.sql` er sandheden for skemaet, og
`backend/scripts/generate-seed.js` er sandheden for startdata.

## Skemaændring: `bookings`

Kun én tabel ændres. ER-diagrammet fra 001 er uændret.

| Kolonne | Før (001) | Efter (004) |
|---|---|---|
| `guest_name` | `VARCHAR(150) NOT NULL`, `CHECK (CHAR_LENGTH(TRIM(guest_name)) > 0)` | **fjernet** |
| `first_name` | – | `VARCHAR(75) NOT NULL`, `CHECK (CHAR_LENGTH(TRIM(first_name)) > 0)` |
| `family_name` | – | `VARCHAR(75) NOT NULL`, `CHECK (CHAR_LENGTH(TRIM(family_name)) > 0)` |
| `INDEX (guest_name)` | index | **fjernet** uden erstatning (research R9) |

- Kolonnerne placeres, hvor `guest_name` stod (efter `id`).
- **1NF**: Fornavn og efternavn er to oplysninger og får hver sin kolonne, som i opgavens data.
- **Uændret**: `country_code`, `room_id`, `check_in`, `check_out`, `guest_count`,
  `total_price` (fastfrosset pris), `source`, `created_at` og de øvrige indexes og
  constraints.
- Skemaet ændres i `db/01_schema.sql` og indlæses med `docker compose down -v` (init-scripts
  kører kun på et tomt volume). Der er ingen migration af eksisterende data, fordi al data
  genereres igen.

## Dataindhold (startdata)

Alle tabeller undtagen `users` fyldes af generatoren. Tallene er krav (spec FR-001–FR-012) og
tjekkes af generatoren (research R15) og i [quickstart.md](quickstart.md).

| Tabel | Rækker | Indhold | Kilde |
|---|---|---|---|
| `room_types` | 8 | Opgavens navne og rækkefølge (id 1–8), kapacitet 1–4 | Opgaven, research R4 |
| `rooms` | 214 | 101–136, 201–236, 301–336, 401–436, 501–536, 601–634. Σ kapacitet = 428 | Research R4, R5 |
| `seasons` | 3 | 1 Lavsæson, 2 Mellemsæson, 3 Højsæson | Opgaven |
| `season_periods` | 18 | 6 pr. år for 2025–2027, inkl. jul 12-20 → 12-31 | Research R6 |
| `room_prices` | 24 | 8 typer × 3 sæsoner. Lav = min, høj = max, mellem = midtpunkt | Opgaven, research R7 |
| `countries` | 20 | CSV-filens lande med ISO-kode og dansk navn | CSV, research R8 |
| `bookings` | ca. 21.600 | id 1–1000 = CSV-rækkerne (kilde `booking_system`). id 1001+ genereret (kilde `backoffice`) | CSV, research R10, R11 |
| `drink_categories` | 2 | 1 Cocktail, 2 Kaffe | Drinkfilen |
| `drinks` | 30 | Drinkfilens navne og priser (2 decimaler), id i filens rækkefølge | Drinkfilen, research R12 |
| `bar_sales` | ca. 133.000 | 2025 = "Units Sold" pr. drink. 2026 til og med 2026-11-05 | Drinkfilen, research R12 |
| `users` | 0 | Oprettes ved start fra `.env` som i 001 | – |

### Værelsestyper

| id | Navn | Kapacitet | Værelser | Lav | Mellem | Høj |
|---|---|---|---|---|---|---|
| 1 | Standard enkeltværelse | 1 | 46 | 900 | 1.050 | 1.200 |
| 2 | Grand lit værelse | 2 | 30 | 1.100 | 1.250 | 1.400 |
| 3 | Standard dobbeltværelse | 2 | 50 | 1.200 | 1.400 | 1.600 |
| 4 | Superior dobbeltværelse | 2 | 40 | 1.400 | 1.700 | 2.000 |
| 5 | Junior suite | 3 | 14 | 1.800 | 2.150 | 2.500 |
| 6 | Spa executive | 2 | 18 | 2.000 | 2.400 | 2.800 |
| 7 | Suite | 4 | 10 | 2.500 | 3.000 | 3.500 |
| 8 | LOFT suite | 4 | 6 | 3.000 | 3.500 | 4.000 |

Priser i kr. pr. nat. Begrundelsen for fordeling og kapacitet står i research R4.

### Sæsonperioder (hvert år 2025–2027)

| Sæson | Perioder |
|---|---|
| Lavsæson | 01-01 → sidste dag i februar · 12-01 → 12-19 |
| Mellemsæson | 03-01 → 05-31 · 09-01 → 11-30 |
| Højsæson | 06-01 → 08-31 · 12-20 → 12-31 |

### Import af CSV-rækker (oversættelse)

| CSV-felt | Bliver til |
|---|---|
| `First Name` | `bookings.first_name` |
| `Family Name` | `bookings.family_name` (U+FFFD → "ü", research R3) |
| `Country` | `bookings.country_code` via tabellen i research R8 |
| `Room Type` | værelsestype via research R4 → `bookings.room_id` (første ledige værelse) |
| `Days Rented` | `check_out − check_in` i dage |
| `Season` | `low`/`mid`/`high` → alle nætter i en periode af Lav-/Mellem-/Højsæson i 2025 |
| `Price` | `bookings.total_price` (uændret, fastfrosset) |
| – | `guest_count` 1..kapacitet, `source = 'booking_system'`, `created_at` = ankomst − 14 dage kl. 12:00 |

## API-felter (kontrakten)

| Skema | Før | Efter |
|---|---|---|
| `BookingInput` | `guestName` (påkrævet) | `firstName`, `familyName` (begge påkrævede, 1–75 tegn, `pattern: '\S'`) |
| `Booking` | `guestName` | `firstName`, `familyName` |

Detaljer i [contracts/README.md](contracts/README.md).

## Valideringsregler (ændret i forhold til 001)

| Regel | Database | Service (dansk besked) | Fejlkode |
|---|---|---|---|
| Fornavn udfyldt | `CHECK` + OpenAPI `pattern: '\S'` | trimmer ("Fornavn skal udfyldes") | `VALIDATION_ERROR` 400 (felt `firstName`) |
| Efternavn udfyldt | `CHECK` + OpenAPI `pattern: '\S'` | trimmer ("Efternavn skal udfyldes") | `VALIDATION_ERROR` 400 (felt `familyName`) |
| Bookingsystemets nøgle | – | `allowBookingSystemKey` på `POST`, `PUT` og `DELETE` | `UNAUTHORIZED` 401 ved forkert nøgle |

Reglen "Gæstens navn udfyldt" fra 001 udgår. Alle andre regler fra 001 er uændrede.

## Afledte værdier

Ingen nye. Gæstens fulde navn (`fornavn efternavn`) gemmes ikke. Frontend sætter det sammen
til visning ét sted (`frontend/src/format.js`).
