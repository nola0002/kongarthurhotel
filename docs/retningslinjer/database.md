# Database (MySQL)

## 1. Tredje normalform (3NF)

Alle tabeller skal være i 3NF:

1. **1NF:** Ét atomart værdi pr. felt. Ingen kommaseparerede lister og ingen gentagne
   kolonner (`drink1`, `drink2`).
2. **2NF:** Alle ikke-nøglekolonner afhænger af **hele** primærnøglen.
3. **3NF:** Ingen ikke-nøglekolonne afhænger af en anden ikke-nøglekolonne. Et eksempel på
   et brud er `bookings.room_type_name`: navnet afhænger af `room_type_id` og hører derfor
   til i `room_types`.

**Opslagsværdier får egne tabeller:** lande, værelsestyper, sæsoner og drinkkategorier.
Tekstværdier, der gentages i en anden tabel, er en lugt.

### Bevidste, dokumenterede undtagelser

Historiske fakta, som **ikke** må ændre sig, når stamdata ændres, gemmes på transaktionen.
Det er ikke et 3NF-brud, fordi værdien er et fastfrosset faktum på tidspunktet:

- `bookings.total_price`: prisen på bookingtidspunktet (FR-009).
- `bar_sales.unit_price`: drinkens pris på salgstidspunktet (FR-010).

Andre undtagelser kræver en kommentar i skemafilen, der forklarer hvorfor.

### Gem aldrig afledte data

Nøgletal (belægningsgrad, indtjening pr. land …) beregnes. De gemmes ikke i tabeller (A4).
Antal nætter afledes af `check_in`/`check_out` og gemmes ikke.

## 2. Lad databasen håndhæve integriteten

Det er det lavest hængende sikkerhedsnet. Brug det før applikationskode:

- **Primærnøgle** på hver tabel: `id INT AUTO_INCREMENT PRIMARY KEY`. Naturlige nøgler kun
  hvor de er stabile, fx ISO-landekode `CHAR(2)`.
- **Fremmednøgler** med `FOREIGN KEY ... REFERENCES` på alle relationer. Vælg `ON DELETE`
  bevidst. Fx `bar_sales.booking_id ... ON DELETE SET NULL` (salget bevares, FR-010a).
- **`NOT NULL`** på alt, der er påkrævet.
- **`UNIQUE`** hvor der er unikhed, fx `(room_type_id, season_id)` i `room_prices` og
  `rooms.room_number`.
- **`CHECK`** til simple regler: `guests > 0`, `check_out > check_in`, `quantity >= 1`,
  `price >= 0`.

Services validerer også, så brugeren får en pæn fejlbesked. Databasen er det sidste værn,
hvis en fejl slipper igennem.

## 3. Datatyper

| Data | Type |
|---|---|
| Penge | `DECIMAL(10,2)`, aldrig `FLOAT`/`DOUBLE` |
| Datoer | `DATE` (ankomst/afrejse), `DATETIME` (tidspunkt for barsalg) |
| Land | `CHAR(2)` ISO 3166-1 alpha-2 som FK til `countries` |
| Kategori/type | FK til opslagstabel, ikke `VARCHAR` med fri tekst |
| Tekst | `VARCHAR(n)` med realistisk `n` |

## 4. Navngivning

- `snake_case` og engelske navne.
- Tabeller i flertal: `bookings`, `room_types`, `bar_sales`.
- Primærnøgle hedder `id`. Fremmednøgler hedder `<ental>_id`: `room_type_id`, `guest_id`.
- Booleans starter med `is_`/`has_`.

## 5. Skema og startdata

- Skemaet er **single source of truth** og ligger som nummererede SQL-filer i `db/`, fx
  `01_schema.sql`, `02_seed.sql`, der køres via MySQL-containerens
  `/docker-entrypoint-initdb.d`.
- Init-scripts kører **kun på et tomt volume**. Efter en skemaændring skal I nulstille med
  `docker compose down -v`. Skriv det i README.
- Skema og startdata holdes i separate filer.
- Ændr aldrig skemaet manuelt i en kørende database. Ret SQL-filen.

## 6. Queries (mysql2)

- Kun i `repositories/`.
- Altid pladsholdere: `pool.execute('SELECT ... WHERE id = ?', [id])`.
- Brug én fælles connection pool (single source of truth for forbindelsen).
- mysql2 returnerer `DECIMAL` som **streng**. Konvertér ét sted, i repositoriet. Beløb, der
  skal summeres, omregnes til øre (heltal), så floats ikke giver afrundingsfejl.
- `SELECT` kun de kolonner, I bruger. Undgå `SELECT *` i kode, der sendes ud af API'et.
- SQL-aggregering (`SUM`, `COUNT`, `GROUP BY`) må gerne ske i repositories af hensyn til
  ydelsen. **Formlen** for et nøgletal (fx belægning = solgte ÷ tilgængelige værelsesnætter)
  hører dog til i en service (A4).

### Samtidighed ved booking

Tildeling af ledigt værelse skal ske i en **transaktion** med `SELECT ... FOR UPDATE` på
kandidatværelserne. Ellers kan to samtidige bookinger få det samme værelse (FR-007).
