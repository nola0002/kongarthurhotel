# Quickstart: validering af opgavedata (004)

Formålet er at bevise, at systemets data og bookingintegration svarer til opgaven. Tallene
kommer fra opgaven og dens datasæt (research § Fakta). Skemaændringen står i
[data-model.md](data-model.md), og kontraktændringerne i
[contracts/README.md](contracts/README.md).

## Forudsætninger

- Systemet kører som beskrevet i [README § Kom i gang](../../README.md#kom-i-gang).
- `.env` er kopieret fra `.env.example` (receptionistkonto, `BOOKING_SYSTEM_API_KEY` og
  `BI_API_KEY` på mindst 32 tegn).

Hjælpere til shellen (kør fra repo-roden):

```bash
sql() { docker compose exec -T db sh -c 'mysql -N --default-character-set=utf8mb4 -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" 2>/dev/null'; }
env_value() { grep "^$1=" .env | cut -d= -f2; }
API=http://localhost:3000/api
curl -s -c /tmp/ka.txt -H 'Content-Type: application/json' -X POST $API/auth/login \
  -d "{\"username\":\"$(env_value SEED_USERNAME)\",\"password\":\"$(env_value SEED_PASSWORD)\"}"
KEY=$(env_value BOOKING_SYSTEM_API_KEY)
```

`sql` læser SQL fra stdin, fx `echo "SELECT COUNT(*) FROM rooms" | sql`. Klienten i
containeren bruger ellers latin1, og så ville "Müller" ikke kunne sammenlignes med CSV-filen. Opslag direkte i
databasen er kun et udviklertjek. Brugerne ser data gennem API'et.

## Del 1: Start fra tom maskine (FR-015, SC-005)

| # | Trin | Forventet resultat | Krav |
|---|---|---|---|
| 1 | `docker compose down -v && time docker compose up -d --build --wait` | Kommandoen slutter med alle services "Healthy"/"Started" på under 3 minutter. Notér tiden i README | FR-015, SC-005, KB-T3 |
| 2 | `docker compose logs db \| grep -E "02_seed\|ignoring"` | `running /docker-entrypoint-initdb.d/02_seed.sql` og `ignoring /docker-entrypoint-initdb.d/source` | Research R1 |
| 3 | `docker compose exec backend node scripts/generate-seed.js && git status --short db/` | Generatoren afslutter uden assert-fejl og skriver antal bookinger og barsalg. `db/02_seed.sql` er uændret (deterministisk) | FR-014, Research R15 |
| 4 | `shasum db/source/international_names_with_rooms_1000.* db/source/drinks_menu_with_sales.xlsx` sammenlignet med filerne i https://github.com/ITAKEA/hoteldata | Samme checksummer: filerne er uændrede | FR-014 |

## Del 2: Hotellet (US1, SC-001)

| # | SQL (via `sql`) | Forventet resultat | Krav |
|---|---|---|---|
| 1 | `SELECT id, name, capacity FROM room_types ORDER BY id` | De 8 typer i opgavens rækkefølge med kapacitet 1, 2, 2, 2, 3, 2, 4, 4 | FR-001, FR-002 |
| 2 | `SELECT COUNT(*), SUM(rt.capacity) FROM rooms r JOIN room_types rt ON rt.id = r.room_type_id` | `214  428` | FR-001, FR-002 |
| 3 | `SELECT rt.name, COUNT(*), MIN(r.room_number), MAX(r.room_number) FROM rooms r JOIN room_types rt ON rt.id = r.room_type_id GROUP BY rt.id ORDER BY rt.id` | 46, 30, 50, 40, 14, 18, 10, 6 værelser med numrene fra research R5 | FR-001 |
| 4 | `SELECT s.name, rt.name, rp.price_per_night FROM room_prices rp JOIN seasons s ON s.id = rp.season_id JOIN room_types rt ON rt.id = rp.room_type_id ORDER BY rt.id, s.id` | 24 rækker med priserne i data-model.md § Værelsestyper | FR-004 |
| 5 | `SELECT s.name, p.start_date, p.end_date FROM season_periods p JOIN seasons s ON s.id = p.season_id ORDER BY p.start_date` | 18 perioder. Hvert år slutter med Lavsæson 12-01 → 12-19 og Højsæson 12-20 → 12-31 | FR-003 |
| 6 | Dækning, se nedenfor | `0` | FR-003 |
| 7 | `SELECT COUNT(*) FROM countries` og `SELECT code, name FROM countries ORDER BY name` | `20`. Opgavens lande med danske navne (research R8), ingen andre | FR-005 |

Dækningstjek (hver dag 2025–2027 ligger i præcis én periode):

```bash
sql <<'SQL'
SET SESSION cte_max_recursion_depth = 2000;
WITH RECURSIVE d (day) AS (
  SELECT DATE '2025-01-01' UNION ALL SELECT day + INTERVAL 1 DAY FROM d WHERE day < '2027-12-31')
SELECT COUNT(*) FROM d
WHERE (SELECT COUNT(*) FROM season_periods p WHERE d.day BETWEEN p.start_date AND p.end_date) <> 1;
SQL
```

Prisberegning via API'et (US1 scenarie 3–6):

| # | Kald | Forventet `totalPrice` |
|---|---|---|
| 8 | `curl -s -b /tmp/ka.txt "$API/bookings/quote?roomTypeId=1&checkIn=2027-01-10&checkOut=2027-01-11"` | `900` |
| 9 | `... roomTypeId=8&checkIn=2027-07-10&checkOut=2027-07-11` | `4000` |
| 10 | `... roomTypeId=7&checkIn=2026-12-23&checkOut=2026-12-25` | `7000` (2 × 3.500, højsæson jul) |
| 11 | `... roomTypeId=5&checkIn=2026-10-14&checkOut=2026-10-15` | `2150` |
| 12 | `... roomTypeId=3&checkIn=2026-12-19&checkOut=2026-12-21` | `2800` (1.200 lav + 1.600 høj) |

## Del 3: Opgavens 1000 bookinger (US2, SC-002, SC-004)

**Række for række**: navn, nætter og pris for booking 1–1000 skal være CSV-filen i samme
rækkefølge. Erstatningstegnet i CSV-filen rettes til "ü" før sammenligningen (research R3):

```bash
diff \
  <(echo "SELECT first_name, family_name, DATEDIFF(check_out, check_in), CAST(total_price AS SIGNED)
          FROM bookings WHERE id <= 1000 ORDER BY id" | sql) \
  <(tail -n +2 db/source/international_names_with_rooms_1000.csv | tr -d '\r' \
    | sed $'s/\xEF\xBF\xBD/ü/' | cut -d, -f1,2,5,7 | tr , '\t') \
  && echo "1000 rækker ens"
```

| # | SQL (via `sql`) | Forventet resultat | Krav |
|---|---|---|---|
| 1 | `diff` ovenfor | Ingen forskelle, "1000 rækker ens" | FR-008, SC-002 |
| 2 | `SELECT c.name, COUNT(*) FROM bookings b JOIN countries c ON c.code = b.country_code WHERE b.id <= 1000 GROUP BY c.name ORDER BY c.name` | Australien 53, Brasilien 49, Canada 46, Egypten 31, Frankrig 52, Indien 61, Italien 48, Japan 46, Kina 59, Mexico 50, Nigeria 42, Pakistan 40, Rusland 55, Spanien 48, Storbritannien 58, Sverige 61, Sydkorea 63, Tyskland 43, USA 43, Vietnam 52 | FR-005, FR-008 |
| 3 | `SELECT rt.name, COUNT(*) FROM bookings b JOIN rooms r ON r.id = b.room_id JOIN room_types rt ON rt.id = r.room_type_id WHERE b.id <= 1000 GROUP BY rt.id ORDER BY rt.id` | 117, 118, 117, 134, 136, 138, 137, 103 | FR-008 |
| 4 | Sæsontjek, se nedenfor | Lavsæson 332, Mellemsæson 335, Højsæson 333 (i alt 1000: hver booking ligger i én periode) | FR-008 |
| 5 | `SELECT COUNT(*) FROM bookings WHERE id <= 1000 AND YEAR(check_in) = 2025 AND source = 'booking_system'` | `1000` | FR-008 |
| 6 | `SELECT COUNT(*) FROM bookings WHERE id <= 1000 AND family_name = 'Müller'` og `SELECT COUNT(*) FROM bookings WHERE HEX(family_name) LIKE '%EFBFBD%'` | `54` og `0` | FR-008, Research R3 |
| 7 | `SELECT COUNT(*) FROM bookings a JOIN bookings b ON a.room_id = b.room_id AND a.id < b.id AND a.check_in < b.check_out AND b.check_in < a.check_out` | `0` (ingen overlap) | FR-010, SC-004 |
| 8 | `SELECT COUNT(*) FROM bookings b JOIN rooms r ON r.id = b.room_id JOIN room_types rt ON rt.id = r.room_type_id WHERE b.guest_count NOT BETWEEN 1 AND rt.capacity` | `0` | FR-010 |
| 9 | `SELECT COUNT(*), MIN(check_in), MAX(check_out) FROM bookings` | Ca. 21.600, `2025-01-01`–`2027-02-28` | FR-009 |
| 10 | `curl -s -H "Authorization: Bearer $(env_value BI_API_KEY)" $API/analytics/kpis` | `occupancyRate` for 2025 og 2026 mellem 0,65 og 0,80. Notér tallene i README | FR-009, SC-004 |
| 11 | 002-dashboardets belægning pr. sæson (eller `/analytics/occupancy` filtreret på sæson) | Højsæson har den højeste belægning | FR-009 |

Sæsontjek for de importerede bookinger (første og sidste nat i samme periode):

```bash
echo "SELECT s.name, COUNT(*) FROM bookings b
      JOIN season_periods p ON b.check_in BETWEEN p.start_date AND p.end_date
                           AND DATE_SUB(b.check_out, INTERVAL 1 DAY) <= p.end_date
      JOIN seasons s ON s.id = p.season_id
      WHERE b.id <= 1000 GROUP BY s.id ORDER BY s.id" | sql
```

## Del 4: Fornavn og efternavn (US3)

| # | Trin | Forventet resultat | Krav |
|---|---|---|---|
| 1 | Åbn http://localhost:5173, log ind, åbn booking 1 (`/bookinger/1`) | "Liam Nguyen", Kina, Spa executive, 1 nat, 2.577 kr., kilde "Bookingsystem" | FR-006, FR-008 |
| 2 | "Ny booking" | Formularen har felterne "Fornavn" og "Efternavn" med labels | FR-006 |
| 3 | Gem med efternavn "   " | Dansk fejl ved feltet: "Ugyldig værdi i feltet Efternavn" (kontraktens `pattern: '\S'` afviser før servicen). Intet gemmes | FR-006 |
| 4 | Opret "Ingrid Olsen" (Sverige, Standard dobbeltværelse, 2027-01-10 → 2027-01-12, 2 gæster) | Listen viser "Ingrid Olsen" | FR-006 |
| 5 | Søg på "ingrid", "OLSEN" og "ingrid ols" sammen med datoen 2027-01-11 (Ingrid og Olsen er også navne i opgavens data, så uden dato ligger bookingen ikke blandt de første 100) | Bookingen fra trin 4 findes hver gang | FR-007, SC-006 |
| 6 | Søg på "muller" | Mindst 54 bookinger, alle med efternavnet "Müller" | FR-007 |
| 7 | Barsalg: vælg en booking til et salg | Bookingen vises som "Værelse … · Fornavn Efternavn" | FR-006 |
| 8 | `docker compose exec backend npm test` | Alle tests grønne, inkl. navnevalidering og søgning | FR-006, FR-007 |

## Del 5: Drinks og barsalg (US4, SC-003)

Enheder pr. drink i 2025 sammenlignet med drinkfilen:

```bash
diff \
  <(echo "SELECT d.name, SUM(s.quantity) FROM bar_sales s JOIN drinks d ON d.id = s.drink_id
          WHERE s.sold_at >= '2025-01-01' AND s.sold_at < '2026-01-01' GROUP BY d.id ORDER BY d.id" | sql) \
  <(tail -n +2 db/source/drinks_menu_with_sales.csv | tr -d '\r' | cut -d, -f1,4 | tr , '\t') \
  && echo "30 drinks ens"
```

| # | Tjek | Forventet resultat | Krav |
|---|---|---|---|
| 1 | `diff` ovenfor | Ingen forskelle, "30 drinks ens" | FR-012, SC-003 |
| 2 | `SELECT dc.name, COUNT(*) FROM drinks d JOIN drink_categories dc ON dc.id = d.drink_category_id GROUP BY dc.id` | Cocktail 20, Kaffe 10 | FR-011 |
| 3 | `SELECT name, price FROM drinks WHERE name IN ('Margarita', 'Cosmopolitan', 'Espresso')` | 72.47, 91.40, 69.10 | FR-011 |
| 4 | `SELECT SUM(quantity), SUM(quantity * unit_price) FROM bar_sales WHERE YEAR(sold_at) = 2025` | `179958  13448640.34` | FR-012 |
| 5 | `SELECT COUNT(*) FROM bar_sales WHERE sold_at >= '2026-11-06' OR quantity NOT BETWEEN 1 AND 4` | `0` | FR-012 |
| 6 | `SELECT COUNT(*) FROM bar_sales s JOIN bookings b ON b.id = s.booking_id WHERE NOT (DATE(s.sold_at) >= b.check_in AND DATE(s.sold_at) < b.check_out)` | `0` | FR-012 |
| 7 | `SELECT YEAR(sold_at), COUNT(*), SUM(quantity) FROM bar_sales GROUP BY 1` | 2025: ca. 72.000 salg, 179.958 enheder. 2026: ca. 61.000 salg, ca. 152.000 enheder | FR-012 |
| 8 | `/analytics/kpis` for 2025 | `barRevenue` 13448640.34. `barRevenueShare` Cocktail ca. 0,528 og Kaffe ca. 0,472 | FT13–FT15 |
| 9 | `time curl -s -o /dev/null -H "Authorization: Bearer $(env_value BI_API_KEY)" $API/analytics/bar-sales` (og `/room-nights`) | Svar inden for få sekunder. Notér tiden. Er den for lang, oprettes en opgave i 002 | Research R14 |

## Del 6: Bookingsystemet (US5, SC-007)

```bash
# Opret som bookingsystemet og gem id
ID=$(curl -s -X POST $API/bookings -H "Content-Type: application/json" -H "X-API-Key: $KEY" \
  -d '{"firstName":"Test","familyName":"Ekstern","countryCode":"DE","roomTypeId":3,
       "checkIn":"2027-01-10","checkOut":"2027-01-12","guestCount":2}' | sed -E 's/^\{"id":([0-9]+).*/\1/')
# Ændr afrejsedato som bookingsystemet
curl -i -X PUT $API/bookings/$ID -H "Content-Type: application/json" -H "X-API-Key: $KEY" \
  -d '{"firstName":"Test","familyName":"Ekstern","countryCode":"DE","roomTypeId":3,
       "checkIn":"2027-01-10","checkOut":"2027-01-13","guestCount":2}'
# Slet som bookingsystemet
curl -i -X DELETE $API/bookings/$ID -H "X-API-Key: $KEY"
```

| # | Kald | Forventet resultat | Krav |
|---|---|---|---|
| 1 | `POST` ovenfor | `201`, `"source":"booking_system"` | FR-013 |
| 2 | `PUT` ovenfor | `200`, `checkOut` 2027-01-13, `nights` 3, ny `totalPrice`, `source` stadig `booking_system` | FR-013 |
| 3 | `PUT` med nøglen på en booking oprettet i back office (Del 4 trin 4) | `200`, `source` stadig `backoffice` | FR-013 |
| 4 | `PUT` med nøglen til en udsolgt periode | `409 ROOM_TYPE_FULLY_BOOKED`, bookingen er uændret | FR-013 |
| 5 | `DELETE` ovenfor | `204`. Bookingen er væk fra listen | FR-013 |
| 6 | `PUT`/`DELETE` uden header eller med `X-API-Key: forkert` | `401 UNAUTHORIZED`, intet ændret | FR-013, SC-007 |
| 7 | `GET $API/bookings` og `GET $API/bookings/1` med `X-API-Key: $KEY` og uden cookie | `401` | FR-013, SC-007 |
| 8 | `PUT`/`DELETE` med nøglen på et id, der ikke findes | `404 NOT_FOUND` | FR-013 |
| 9 | Swagger UI (http://localhost:5173/docs) → Authorize → `bookingSystemKey` | `PUT` og `DELETE /bookings/{id}` viser låsen for både session og `bookingSystemKey` | KB-A3 |

## Del 7: Resultat

Notér tider (Del 1 og Del 5 trin 9) og belægning (Del 3 trin 10) i README § Testdata. Kør
`/speckit-converge` for 004, når alle dele er grønne.
