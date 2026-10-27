# Tests

Målet er få, simple tests, der fanger rigtige fejl, ikke en høj coverage-procent.

## 1. Værktøj

- **Node's indbyggede testrunner** (`node:test` + `node:assert/strict`). Ingen Jest, Mocha
  eller Chai.
- API-tests starter Express-appen in-process på en tilfældig port (`app.listen(0)`) og kalder
  den med den indbyggede `fetch`. Ingen supertest.
- Alle tests køres med `npm test` (`node --test`) i `backend/`.
- Der skrives ingen frontend-tests i dette projekt.

## 2. Hvad der skal testes

Prioriteret rækkefølge:

1. **Forretningsregler** i services: kapacitet (FR-006), overlap/tildeling af værelse
   (FR-007), prisberegning inkl. ophold over to sæsoner (FR-008), barsalg på booking
   (FR-010a).
2. **Nøgletalsformler**: belægningsgrad, indtjening pr. værelsestype/sæson/land,
   cocktail/kaffe-fordeling og gennemsnit (FT5–FT15).
3. **API-kontrakt** for de vigtigste endpoints: korrekt statuskode, fejlformat og at login
   kræves.

**Ikke** tests af: Express selv, mysql2 selv, trivielle gettere, React-komponenter eller
kode uden logik.

## 3. Hvordan en god test ser ud

- **Én regel pr. test**, med et navn der siger, hvad reglen er, og henviser til kravet:

  ```js
  test('FR-007: rejects booking when every room of the type is taken', ...)
  test('FR-008: prices each night by its own season', ...)
  ```
- **Arrange → Act → Assert**, med lille og eksplicit testdata direkte i testen. Læseren skal
  kunne regne det forventede resultat ud i hovedet.

  ```js
  // 2 nights in low season (500) + 1 night in high season (800) = 1800
  ```
- **Kanttilfælde fra spec'en** er en del af testen: afrejse = anden ankomst er tilladt, 0
  gæster afvises, ophold over sæsonskifte og over årsskifte.
- **Testen skal kunne fejle.** Bryd reglen midlertidigt i koden og se testen blive rød. Ellers
  tester den ingenting.
- **Uafhængige tests.** Ingen test må afhænge af en anden tests data eller rækkefølge.

## 4. Afhængigheder i tests

- Services testes med en **simpel falsk repository**, dvs. et almindeligt objekt med de
  samme funktioner, der returnerer faste data. Ingen mock-biblioteker.
- Mock ikke det, du tester. Mock kun grænsen til databasen.
- API- og integrationstests mod rigtig MySQL kører mod en separat testdatabase, der
  nulstilles før hver kørsel. De må aldrig køre mod udviklingsdata.

## 5. Hvornår

- En ny eller ændret forretningsregel eller et nøgletal **skal** have en test i samme commit.
- En fundet fejl får først en test, der genskaber den, og så rettelsen.
- `npm test` skal være grøn før commit til `main`.
