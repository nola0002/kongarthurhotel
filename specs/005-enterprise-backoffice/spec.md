# Feature Specification: Enterprise back office – receptionens daglige arbejdsværktøj

**Feature Branch**: `005-enterprise-backoffice`

**Created**: 2026-11-02

**Status**: Draft

**Input**: User description: "Login skal være en flottere side med hotellets facadefoto. Cmd+K-søgning.
En mere kategoriseret navbar, så det er enterprise grade. Forsiden skal være en rigtig hotelstyring
med status for dagen: 4 interessante KPI'er i toppen, en liste over ind og ud, opret booking og
andet, der giver receptionisten et godt overblik. Bookinger skal laves ordentligt, så det ikke er
1000 ting ad gangen uden at skifte sider. En bookings underside skal være mere detaljeret. Barsalg
skal være en salgsorienteret side, ikke både salg og historik. Lav i stedet en omsætningsside med
omsætningen for barsalg og lidt for bookinger. Lav en profilside med log ud og administration.
Tænk det som et reelt bookingsystem for et hotel, men som stadig er en opgave ift. test osv."

## Clarifications

### Session 2026-11-02

Brugeren bad om at køre uden afklaringsrunde ("Bare kør"). Agenten har truffet valgene nedenfor
*(gruppens valg)*. De skal bekræftes ved næste gennemgang.

- Q: Login "skal have en Cmd+K-søgning", men man kan ikke søge før login. → A: Cmd+K er en global
  kommandopalet i hele back office efter login. Login-siden viser genvejen som et hint.
- Q: Hvad er "administration" på profilsiden? → A: Skift egen adgangskode og ret prislisten
  (værelsespris pr. type og sæson) og drinkkortets priser. Der er stadig én fælles
  receptionistkonto (001), så brugeradministration er ikke med.
- Q: "Ankomster tilbage" kræver, at receptionisten kan tjekke gæster ind. → A: Receptionen kan
  registrere ind- og udtjekning på dagens ankomster og afrejser. Ophold før i dag regnes som
  gennemført efter datoerne, så startdata ikke skal ændres.
- Q: Hvordan opgøres bookingomsætning på omsætningssiden? → A: Fordelt pr. nat efter samme regel
  som BI (002 FR-015), så en booking over et månedsskifte tæller i begge måneder.
- Q: Hvordan betales barsalg uden værelse? → A: "Betalt direkte" er et salg uden booking. Systemet
  registrerer ikke betalingsmiddel (kort/kontant).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dagens drift på forsiden (Priority: P1)

Som receptionist vil jeg starte vagten på en forside, der viser dagens status: hvor fuldt hotellet
er i nat, hvor mange ankomster og afrejser der mangler, og hvad der skal ske nu, så jeg kan
arbejde fra én side.

**Why this priority**: Forsiden er receptionens arbejdsplads. Den bruges hele vagten.

**Independent Test**: Åbn Oversigt for en dato med ankomster og afrejser. Fire nøgletal, listen
over ankomster og listen over afrejser vises. Tjek én gæst ind, og tallet "ankomster tilbage"
falder med én uden at genindlæse siden manuelt.

**Acceptance Scenarios**:

1. **Given** 40 ankomster i dag, hvoraf 12 er tjekket ind, **When** forsiden vises, **Then** viser
   nøgletallet "Ankomster" 28 tilbage af 40.
2. **Given** 214 værelser og 180 optaget i nat, **When** forsiden vises, **Then** viser
   nøgletallet "Belægning i nat" 84 % (180 af 214).
3. **Given** en ankomst, der ikke er tjekket ind, **When** receptionisten vælger "Tjek ind",
   **Then** får bookingen status "Tjekket ind", og den forsvinder fra "tilbage".
4. **Given** en afrejse i dag, **When** receptionisten vælger "Tjek ud", **Then** får bookingen
   status "Tjekket ud", og receptionisten tilbydes at registrere tilfredshed.
5. **Given** forsiden, **When** receptionisten vælger "Ny booking", **Then** åbnes
   bookingformularen.
6. **Given** forsiden, **When** den vises, **Then** ses ledige værelser pr. værelsestype i nat og
   dagens barsalg.

---

### User Story 2 - Bookinglisten med sider, sortering og filtre (Priority: P1)

Som receptionist vil jeg bladre, sortere og filtrere i bookinger, fordi hotellet har over
200.000 bookinger, og listen ikke kan vise dem alle på én gang.

**Why this priority**: Listen er ubrugelig med de nye data, hvis den viser op til 1000 rækker
uden sider.

**Independent Test**: Åbn Bookinger. Der vises 50 rækker og sidevalg. Gå til side 3, sortér på
pris faldende, filtrér på "Suite", og ryd filtrene. Linket i adresselinjen gengiver samme visning.

**Acceptance Scenarios**:

1. **Given** 233.644 bookinger, **When** listen åbnes, **Then** vises højst 50 rækker,
   "1–50 af 233.644" og knapper til forrige/næste side og første/sidste side.
2. **Given** listen, **When** receptionisten sorterer på en kolonne (ankomst, gæst, pris,
   nætter), **Then** sorteres alle bookinger efter kolonnen og ikke kun den viste side.
3. **Given** listen, **When** receptionisten filtrerer på status, værelsestype, land, periode eller
   søger på navn, **Then** gælder filteret alle sider, og listen starter på side 1.
4. **Given** en filtreret og sorteret side, **When** linket kopieres og åbnes igen, **Then** vises
   samme side, sortering og filtre.
5. **Given** antal pr. side, **When** receptionisten vælger 25, 50 eller 100, **Then** vises det
   antal rækker.

---

### User Story 3 - Bookingens detaljeside som gæstens folio (Priority: P1)

Som receptionist vil jeg se alt om én booking på én side: gæst, ophold, værelse, prisen pr. nat,
barsalg på værelset og den samlede regning, og have handlingerne lige ved hånden.

**Why this priority**: Receptionisten slår bookinger op hele dagen, ved ankomst, ved spørgsmål og
ved afrejse.

**Independent Test**: Åbn en booking over et sæsonskifte med to barsalg på værelset. Siden viser
hver nat med sæson og pris, de to barsalg og regningen i alt = opholdets pris + barsalg.

**Acceptance Scenarios**:

1. **Given** en booking på 3 nætter, hvor 2 er i mellemsæson og 1 i højsæson, **When** detaljen
   vises, **Then** vises tre linjer med dato, sæson og pris, og summen er opholdets pris.
2. **Given** to barsalg lagt på værelset (2 × Mojito og 1 × Espresso), **When** detaljen vises,
   **Then** vises begge salg med tidspunkt, antal og beløb, og regningen er opholdets pris plus
   barsalgets sum.
3. **Given** detaljen, **When** receptionisten bruger en handling (ret, slet, tjek ind, tjek ud,
   registrér tilfredshed, sælg på værelset), **Then** udføres den, og siden viser det nye resultat.
4. **Given** en booking med en fastfrosset pris, der afviger fra prislisten, **When** detaljen
   vises, **Then** er regningens opholdspris den fastfrosne pris, og nætterne vises som en
   fordeling af den.

---

### User Story 4 - Barsalg som kasse (Priority: P2)

Som bartender eller receptionist vil jeg slå et salg ind hurtigt: vælg drinks i kategorierne
Cocktail og Kaffe, se en ordre med antal og total, og afslut den som "betalt direkte" eller "læg
på værelse".

**Why this priority**: Barsalg er hotellets anden indtægt. Siden skal være til at sælge, ikke til
at se historik.

**Independent Test**: Tryk Mojito to gange og Espresso én gang. Ordren viser 2 × Mojito og
1 × Espresso og totalen. Vælg værelse 214, og afslut. Ordren tømmes, og de tre enheder ses på
gæstens booking.

**Acceptance Scenarios**:

1. **Given** kassen, **When** en drink vælges flere gange, **Then** stiger antallet på samme
   ordrelinje.
2. **Given** en ordre, **When** antal ændres eller en linje fjernes, **Then** opdateres totalen.
3. **Given** en ordre og et værelse, hvor gæsten bor i dag, **When** ordren afsluttes "på
   værelse", **Then** registreres alle linjer på bookingen på én gang.
4. **Given** en ordre, hvor én linje ikke kan registreres (fx værelset er ikke beboet), **When**
   ordren afsluttes, **Then** registreres ingen af linjerne, og fejlen vises.
5. **Given** kassen, **When** den vises, **Then** er der ingen salgshistorik på siden, kun et link
   til Omsætning.

---

### User Story 5 - Omsætning (Priority: P2)

Som receptionschef vil jeg se omsætningen for baren for en valgt periode, pr. dag, måned eller år,
fordelt på cocktails og kaffe og med de bedst sælgende drinks, og sekundært omsætningen fra
værelser, så jeg kan følge salget uden at åbne Tableau.

**Why this priority**: Salgshistorikken flyttes fra kassen hertil. Tableau er stadig ledelsens BI.

**Independent Test**: Vælg perioden "2025". Baromsætningen er 13.448.640,34 kr. (opgavens
"Units Sold"), fordelt på 12 måneder og to kategorier, og top 5-drinks vises.

**Acceptance Scenarios**:

1. **Given** perioden 2025 grupperet pr. måned, **When** siden vises, **Then** vises 12 måneder
   med barsalg, og summen er 13.448.640,34 kr.
2. **Given** en periode, **When** siden vises, **Then** vises andelen for Cocktail og Kaffe, og
   andelene summerer til 100 %.
3. **Given** en periode, **When** siden vises, **Then** vises top 5-drinks efter omsætning med
   antal og beløb.
4. **Given** en periode, **When** siden vises, **Then** vises værelsesomsætningen for samme
   periode fordelt pr. nat og summen af bar + værelser.
5. **Given** en periode uden salg, **When** siden vises, **Then** vises 0 kr. og en tom tilstand,
   ikke en fejl.

---

### User Story 6 - Navigation og Cmd+K (Priority: P2)

Som receptionist vil jeg finde alt hurtigt: en navigation med grupper og en kommandopalet
(Cmd+K / Ctrl+K), hvor jeg kan søge en gæst, et bookingnummer eller et værelsesnummer og hoppe
til sider eller handlinger.

**Why this priority**: Gør systemet hurtigt at bruge, men alle sider kan nås uden.

**Independent Test**: Tryk Cmd+K, skriv "214", og vælg gæsten, der bor på værelse 214 i dag.
Bookingen åbnes. Tryk Cmd+K, skriv "barsalg", og tryk Enter. Kassen åbnes.

**Acceptance Scenarios**:

1. **Given** en side i back office, **When** Cmd+K eller Ctrl+K trykkes, **Then** åbnes paletten
   med fokus i søgefeltet, og Escape lukker den.
2. **Given** paletten, **When** der skrives et navn, **Then** vises op til 8 bookinger med de
   bookinger tættest på i dag først.
3. **Given** paletten, **When** der skrives et tal, **Then** vises bookingen med det nummer og
   bookingerne på værelset med det nummer, med gæsten, der bor der i dag, først.
4. **Given** paletten, **When** der skrives et sidenavn eller "ny booking", **Then** kan siden eller
   handlingen vælges med piletaster og Enter.
5. **Given** navigationen, **When** den vises, **Then** er siderne grupperet i Reception, Bar,
   Økonomi og Konto, og den aktive side er markeret.

---

### User Story 7 - Login med hotellets facade (Priority: P3)

Som receptionist vil jeg mødes af en login-side, der ligner hotellets eget system, med
hotellets facadefoto.

**Why this priority**: Første indtryk ved fremlæggelsen. Funktionen er uændret.

**Independent Test**: Åbn /login på en bred skærm: facadefotoet fylder den ene halvdel og
formularen den anden. På en smal skærm vises kun formularen. Login virker som før.

**Acceptance Scenarios**:

1. **Given** login-siden på en skærm over 1024 px, **When** den vises, **Then** fylder fotoet den
   ene side med hotellets navn, og formularen står på den anden.
2. **Given** forkert adgangskode, **When** der logges ind, **Then** vises API'ets fejlbesked som
   før.

---

### User Story 8 - Profil og administration (Priority: P3)

Som receptionist vil jeg have en profilside, hvor jeg kan logge ud og skifte adgangskode, og hvor
hotellets prisliste og drinkkortets priser kan rettes.

**Why this priority**: Priserne ændres sjældent, men skal kunne ændres uden SQL.

**Independent Test**: Ret prisen på "Suite" i højsæson fra 3.500 til 3.600 kr. Et nyt prisoverslag
for én nat i juli giver 3.600 kr. En eksisterende booking beholder sin pris.

**Acceptance Scenarios**:

1. **Given** profilsiden, **When** receptionisten skifter adgangskode med den rigtige nuværende
   adgangskode og en ny på mindst 8 tegn, **Then** virker den nye adgangskode ved næste login.
2. **Given** forkert nuværende adgangskode, **When** der skiftes, **Then** afvises det med en
   dansk fejlbesked, og adgangskoden er uændret.
3. **Given** prislisten, **When** en pris ændres, **Then** bruges den nye pris til nye bookinger og
   prisoverslag, og eksisterende bookinger beholder deres fastfrosne pris.
4. **Given** drinkkortet, **When** en drinkpris ændres, **Then** bruges den til nye salg, og gamle
   salg beholder deres pris.
5. **Given** en negativ pris, **When** den gemmes, **Then** afvises den med en fejl ved feltet.
6. **Given** profilsiden, **When** receptionisten logger ud, **Then** vises login-siden.

### Edge Cases

- En side efter den sidste (fx `?side=99999`): Listen viser den sidste side.
- Filtre, der giver 0 bookinger: Tom tilstand med "Ryd filtre".
- Tjek ind på en booking, der ikke ankommer i dag: Afvises med en fejl.
- Tjek ud på en booking, der ikke rejser i dag, eller som ikke er tjekket ind: Afvises med en fejl.
  Gæster, der ankom før i dag, regnes som tjekket ind.
- Tjek ind to gange: Afvises.
- Kurven er tom: "Afslut" er ikke mulig.
- En drinkpris ændres, mens en ordre er åben: Ordren registreres med prisen på salgstidspunktet.
- Omsætningsperioden er længere end 3 år grupperet pr. dag: Gruppering pr. dag afvises med en fejl,
  så siden ikke viser over 1.000 punkter.
- Cmd+K i et indtastningsfelt: Åbner stadig paletten. "N" for ny booking virker kun uden for felter
  (som i dag).
- Den nye adgangskode er den samme som den gamle: Tilladt.
- En booking slettes, mens dens detalje er åben: Næste handling får "findes ikke".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (FR4, 003 FR-001): Forsiden MUST vise fire nøgletal for den valgte dato: belægning i
  nat (optagne/alle værelser), ankomster tilbage/i alt, afrejser tilbage/i alt og gæster i huset.
  Alle tal MUST beregnes i backend.
- **FR-002**: Forsiden MUST vise dagens ankomster og afrejser med status, en knap til ny booking,
  ledige værelser pr. type, dagens barsalg og gennemsnitlig pris pr. nat for nattens ophold.
- **FR-003**: Receptionen MUST kunne registrere indtjekning på en booking, der ankommer i dag, og
  udtjekning på en booking, der rejser i dag. Tidspunktet MUST gemmes. En booking, der ankom før
  i dag, regnes som tjekket ind, og en, der rejste før i dag, som tjekket ud.
- **FR-004**: Status MUST vises som én af: Kommende, Ankommer i dag, Tjekket ind, Rejser i dag,
  Tjekket ud, Afrejst.
- **FR-005** (FR2, FR5): Bookinglisten MUST pagineres på serveren med 25, 50 (standard) eller 100
  pr. side og vise "fra–til af total".
- **FR-006** (FR5): Bookinglisten MUST kunne sorteres på ankomst, afrejse, gæst, nætter og pris,
  stigende og faldende, over alle bookinger.
- **FR-007** (FR5): Bookinglisten MUST kunne filtreres på visning (kommende, i huset, afrejst,
  alle), værelsestype, land, en periode (ophold, der overlapper perioden) og navnesøgning. Filtre,
  sortering og side MUST stå i URL'en.
- **FR-008**: Bookingdetaljen MUST vise gæst, land, kilde, ophold, værelse, antal gæster, status,
  ind- og udtjekningstidspunkt, tilfredshed og hver nat med dato, sæson og pris. Nætternes priser
  MUST summere til bookingens fastfrosne pris (fordelt som 002 FR-015).
- **FR-009**: Bookingdetaljen MUST vise barsalg på bookingen og en regning: opholdets pris,
  barsalg i alt og total. Beløbene MUST beregnes i backend.
- **FR-010**: Bookingdetaljen MUST give handlingerne ret, slet (med bekræftelse), tjek ind, tjek
  ud, registrér tilfredshed og sælg på værelset, når de er gyldige for bookingens status.
- **FR-011** (FR9): Barsalg MUST være en kasse: drinks grupperet i kategorierne fra databasen, en
  ordre med linjer (drink, antal, beløb), total, og afslutning som "betalt direkte" eller "på
  værelse" (en booking i huset i dag).
- **FR-012** (FR9, 001 FR-010): En ordre MUST registreres samlet: alle linjer som barsalg med
  prisen på salgstidspunktet, eller ingen, hvis én linje er ugyldig.
- **FR-013**: Barsalgssiden MUST NOT vise salgshistorik.
- **FR-014** (FT13–FT15, A4): Omsætningssiden MUST vise baromsætning for en valgt periode
  grupperet pr. dag, måned eller år, andelen pr. kategori, top 5-drinks (antal og beløb) og
  værelsesomsætning fordelt pr. nat, samt bar + værelser i alt. Alle tal MUST beregnes i backend.
- **FR-015**: Gruppering pr. dag MUST afvises for perioder over 3 år.
- **FR-016**: En kommandopalet MUST åbne med Cmd+K/Ctrl+K på alle sider efter login og kunne søge
  bookinger på navn, bookingnummer og værelsesnummer (op til 8, tættest på i dag først), sider og
  handlingerne "Ny booking" og "Nyt barsalg", med tastaturnavigation.
- **FR-017**: Navigationen MUST være grupperet: Reception (Oversigt, Belægningsplan, Bookinger),
  Bar (Kasse), Økonomi (Omsætning) og Konto (Profil).
- **FR-018**: Login-siden MUST vise hotellets facadefoto ved siden af formularen på brede skærme
  og være uændret i funktion.
- **FR-019**: Profilsiden MUST vise brugernavnet og give log ud og skift af adgangskode. Skift
  kræver den nuværende adgangskode, og den nye MUST have mindst 8 tegn. Adgangskoden MUST gemmes
  som hash.
- **FR-020** (FR8, 001 FR-009): Profilsiden MUST give mulighed for at rette værelsesprisen pr.
  værelsestype og sæson og drinkkortets priser. Priser MUST være ≥ 0. Ændringer MUST NOT ændre
  eksisterende bookingers eller salgs priser.
- **FR-021**: Alle nye endpoints MUST kræve en receptionistsession og MUST NOT kunne kaldes med
  bookingsystemets eller BI-nøglen.
- **FR-022** (D7): Alle API-ændringer MUST stå i OpenAPI-kontrakten.

### Key Entities *(include if feature involves data)*

- **Booking**: Som før, nu med tidspunkt for indtjekning og udtjekning (tomme, indtil de
  registreres).
- **Ordre**: Et øjebliksbillede i kassen med linjer. Gemmes ikke som egen tabel. Den bliver til ét
  barsalg pr. linje.
- **Prisliste**: Værelsespris pr. værelsestype og sæson (eksisterende).
- **Drink**: Drinkkortets pris (eksisterende).
- **Bruger**: Den fælles receptionistkonto med adgangskode-hash (eksisterende).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En side i bookinglisten vises på under 1 sekund med 233.644 bookinger, også sorteret
  og filtreret.
- **SC-002**: En receptionist finder gæsten på et værelsesnummer via Cmd+K på under 5 sekunder.
- **SC-003**: En ordre med tre drinks slås ind og lægges på et værelse med højst 6 klik/tryk.
- **SC-004**: Omsætningen for 2025 på omsætningssiden er præcis 13.448.640,34 kr. for baren, samme
  tal som i Tableau.
- **SC-005**: Summen af nætternes priser på bookingdetaljen er præcis bookingens pris for 100 % af
  bookingerne.
- **SC-006**: Alle nøgletal på forsiden og omsætningssiden har en backend-test, og `npm test` er
  grøn.

## Assumptions

- Der er stadig én fælles receptionistkonto (001). Roller og brugere er uden for scope.
- Betalingsmiddel, kvitteringer, fakturaer og afregning ved udtjekning er uden for scope. Regningen
  vises kun.
- Ind- og udtjekning registreres kun for i dag. Datoer før i dag følger datoerne.
- Facadefotoet er hotellets eget billede, leveret af brugeren.
- Ingen nye UI-biblioteker: paletten, paginering og kassen bygges med de eksisterende tokens og
  komponenter (`docs/design/`).
- Tableau er stadig ledelsens BI (002). Omsætningssiden er receptionens hurtige overblik.
- Der er ingen AI-funktionalitet i brugergrænsefladen (KB-T8).
