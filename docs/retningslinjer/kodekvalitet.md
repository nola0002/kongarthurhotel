# Kodekvalitet

Gælder al kode i repoet, uanset om den er skrevet af et menneske eller en AI-agent.

## 1. Den dovne senior-udvikler

Doven betyder effektiv, ikke sjusket. Den bedste kode er den, der aldrig bliver skrevet: den
har ingen bugs, skal ikke testes og skal ikke forklares ved eksamen.

**Forstå problemet først.** Læs spec, plan og den kode, ændringen rører, før du vælger en
løsning. Den mindste ændring det forkerte sted er bare en ny fejl.

**Gå derefter stigen igennem og stop ved første trin, der holder:**

1. **Skal det overhovedet laves?** Står det ikke i spec eller tasks, så lad være (YAGNI).
2. **Findes det allerede i kodebasen?** Søg efter eksisterende services, repositories,
   hjælpefunktioner og komponenter, og genbrug dem.
3. **Kan sproget det selv?** JavaScript og Node har meget indbygget, fx `Array`, `Intl`,
   `structuredClone`, `fetch`, `crypto`, `node:test`.
4. **Kan platformen det?**
   - HTML: `<input type="date">`, `required`, `min`, `<dialog>`
   - CSS/Tailwind i stedet for JavaScript til layout og visning
   - MySQL: `CHECK`, `UNIQUE`, `FOREIGN KEY`, `SUM`, `COUNT`
5. **Løser en installeret afhængighed det?** Så brug den.
6. **Kan det skrives på én linje?** Så skriv det på én linje.
7. **Først nu:** skriv den mindste kode, der virker.

**Nye afhængigheder** kræver en begrundelse i `plan.md`. Tilføj aldrig en pakke for noget, få
linjer selv kan klare.

## 2. Single source of truth

Hver oplysning og regel bor ét sted. Alle andre steder læser derfra.

| Sandhed | Bor i | Må **ikke** dubleres i |
|---|---|---|
| Krav | `specs/*/spec.md` | kodekommentarer, README |
| API-kontrakt (endpoints, felter, fejlformat) | OpenAPI-filen | løse beskrivelser i README eller frontend |
| Databaseskema | SQL-filer under `db/` | JavaScript-konstanter |
| Priser, sæsoner, værelsestyper, drinks, kategorier | databasen | hardcodede lister i backend eller frontend |
| Forretningsregler (kapacitet, overlap, pris) | backend `services/` | frontend, SQL-triggers, routes |
| Nøgletalsformler (belægning, indtjening …) | backend `services/` | Tableau-beregninger, frontend |
| Konfiguration (porte, adgangskoder, URL'er) | `.env` (eksempel i `.env.example`) | hardcodet i kode, `docker-compose.yml`-dubletter |
| API-kald fra frontend | én API-klient-modul | `fetch` spredt rundt i komponenter |

**Validering:** Backend er autoriteten. Frontend må bruge HTML-attributter (`required`,
`min`) for brugervenlighedens skyld, men må ikke genimplementere forretningsregler. Prisen
vises ved at spørge API'et, ikke ved at regne den ud i React.

## 3. Arkitektur i backend (Express)

```
routes/        HTTP: parse input, kald service, oversæt resultat til status/JSON
services/      Forretningsregler og nøgletal. Kender ikke req/res og ikke SQL.
repositories/  SQL med mysql2. Returnerer rene objekter. Ingen forretningsregler.
```

- Et lag kalder **kun** laget direkte under sig.
- Services modtager og returnerer almindelige objekter, så de kan testes uden HTTP.
- **Fejl:** Services kaster fejl med en kode, fx `ROOM_TYPE_FULLY_BOOKED`. Én fælles
  Express-fejl-middleware oversætter til HTTP-status og JSON i ét format:
  `{ "error": { "code": "...", "message": "...", "field": "..." } }`.
- `try/catch` i hver route er ikke nødvendigt. Brug den fælles fejlhåndtering.
- **SQL:** Altid parametriserede queries (`?`-pladsholdere). Byg aldrig SQL med
  string-sammensætning.
- **Penge:** `DECIMAL` i databasen. Beløb regnes i øre (heltal) eller med `DECIMAL`-sikker
  aritmetik, aldrig med floats som `0.1 + 0.2`.
- **Datoer:** `DATE` i databasen og ISO-strenge (`2026-03-10`) i API'et.
- **Hemmeligheder** (DB-adgangskode, API-nøgle til bookingsystemet, receptionistens
  adgangskode) kommer fra miljøvariabler og må aldrig ligge i git.
- Adgangskoder gemmes som hash, fx med `bcrypt` eller Node's `crypto.scrypt`. De gemmes
  aldrig i klartekst.

## 4. Frontend (React + Tailwind)

- Små komponenter, der gør én ting. Udtræk først en fælles komponent, når samme UI optræder
  2–3 steder.
- Al kommunikation med backend går gennem **ét** API-klient-modul (base-URL, JSON og
  fejlhåndtering ét sted).
- Styling med Tailwind-klasser. Ingen separate CSS-filer, medmindre Tailwind ikke kan det.
  Ingen UI-komponentbibliotek, medmindre det står i `plan.md`.
- Brug native elementer: `<input type="date">`, `<select>`, `<dialog>` og `<form>` med
  `onSubmit`.
- Tilgængelighed som minimum: alle felter har `<label>`, knapper er `<button>`, og fejl vises
  som tekst og ikke kun som farve.
- UI-tekst er på dansk. Vis API'ets fejlbesked til brugeren og gæt ikke på en ny.
- State: `useState`/`useEffect` er nok. Ingen Redux eller andre state-biblioteker uden et
  dokumenteret behov.

## 5. Navngivning og stil

- Kode, filnavne, tabeller, kolonner og kommentarer skrives på **engelsk**. UI-tekst og
  dokumentation skrives på **dansk**.
- JavaScript (ES modules), ikke TypeScript. JSDoc-typer kun hvor de gør en kompleks
  signatur tydeligere.
- Beskrivende navne frem for forkortelser: `calculateStayPrice`, ikke `calcSP`.
- Funktioner gør én ting. Er en funktion svær at navngive, gør den for meget.
- Ingen "for en sikkerheds skyld"-abstraktioner: ingen interface med én implementering,
  ingen factory til ét produkt og ingen konfiguration af værdier, der aldrig ændrer sig.
- Prettier formaterer, så stil diskuteres ikke i reviews.

## 6. Kommentarer

- Forklar **hvorfor**, ikke **hvad**. Koden viser, hvad den gør.

  ```js
  // Bad: loop through nights
  // Good: each night is priced by its own season, so a stay can span two seasons (FR-008)
  ```
- Henvis til krav-ID'er, når koden implementerer en specifik regel (`FR-007`, `FT5`).
- Ingen udkommenteret kode. Git husker den.
- Ingen TODO uden en reference til en task eller et issue.
- Markér bevidste forenklinger med en kommentar, der siger, hvor grænsen går, og hvad
  opgraderingen er:
  `// Simplification: assigns the lowest room number; add a smarter strategy if needed`.

## 7. Når du er i tvivl

- Uklart krav: Spørg eller markér det i spec. Gæt ikke.
- To løsninger af samme størrelse: Vælg den, der er korrekt i kanttilfældene.
- Fristet til at "forbedre" kode uden for tasken: Lad være, og noter det i stedet.
- Slet frem for at tilføje. En mindre diff er en bedre diff.
