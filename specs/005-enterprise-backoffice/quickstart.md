# Quickstart: Enterprise back office (005)

## Forudsætninger

```sh
docker compose down -v && docker compose up --build   # nyt skema og startdata fra 2000
docker compose exec backend npm test                  # alt grønt
```

Log ind på http://localhost:5173 med `SEED_USERNAME`/`SEED_PASSWORD` fra `.env`.

## Scenarier

| # | Gør | Forvent | Krav |
|---|---|---|---|
| Q1 | Åbn `/login` på en bred skærm | Facadefoto på den ene halvdel, formular på den anden | FR-018 |
| Q2 | Åbn Oversigt | Fire nøgletal: belægning i nat, ankomster tilbage/i alt, afrejser tilbage/i alt, gns. pris pr. nat | FR-001 |
| Q3 | Tjek en ankomst ind | Status "I huset", "ankomster tilbage" falder med 1 | FR-003 |
| Q4 | Tjek en afrejse ud | Status "Tjekket ud", tilbud om tilfredshed | FR-003 |
| Q5 | Bookinger: side 3, sortér pris faldende, filtrér "Suite", kopiér URL og åbn igen | Samme visning, "101–150 af …" | FR-005–FR-007 |
| Q6 | Åbn en booking med barsalg | Nætter med sæson og pris, barsalg, regning = ophold + bar | FR-008, FR-009 |
| Q7 | Kassen: 2 × Mojito, 1 × Espresso, læg på et værelse | Ordren registreres, ses på folioen | FR-011, FR-012 |
| Q8 | Omsætning, 2025 pr. måned | Bar i alt 13.448.640,34 kr., 12 måneder, kategoriandele = 100 % | FR-014, SC-004 |
| Q9 | Cmd+K, skriv et værelsesnummer | Gæsten på værelset i dag står øverst | FR-016 |
| Q10 | Profil: ret Suite højsæson til 3.600 kr. | Nyt prisoverslag for én nat i juli = 3.600 kr. Eksisterende bookinger uændrede | FR-020 |
| Q11 | Profil: skift adgangskode, log ud, log ind med den nye | Virker. Forkert nuværende adgangskode giver fejl ved feltet | FR-019 |
| Q12 | Swagger UI (`/docs`) | Alle nye endpoints vises | FR-022 |
