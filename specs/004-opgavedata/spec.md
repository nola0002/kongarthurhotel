# Feature Specification: Opgavedata – data og integration som i opgaven

**Feature Branch**: `004-opgavedata`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "Systemets data og integration skal svare 100 % til opgaven
'E26 Tværfaglig Opgave Hotel Kong Arthur' og dens datasæt (ITAKEA/hoteldata): 214 værelser
med plads til ca. 428 gæster, de 8 værelsestyper og prisintervaller fra opgaven, lav-,
mellem- og højsæson (højsæson er sommer og jul), de 1000 bookinger fra opgavens CSV-fil, de 20
lande i filen, gæstens navn som fornavn og efternavn, Helene Christines 20 cocktails og 10
kaffetyper med opgavens priser og årssalg, og hotellets bookingsystem, der må oprette, ændre
og slette bookinger via API'et. Feature 004 er fundamentet og implementeres før 003.
(Kravboard: FR1, FR5, FR8, FR9, FT4, FT6–FT8, FT13–FT15, KB-T3, KB-T6, KB-T7, KB-T10)"

## Clarifications

### Session 2026-10-30

Brugerens overordnede krav: systemet skal svare 100 % til opgaven, uden forskelle i UI, data
eller andet. Beslutningerne er truffet med brugeren 2026-10-30. Svar markeret *(gruppens valg)*
er ikke afgjort af brugeren. Agenten har valgt den løsning, der ligger tættest på opgaven, og
de skal bekræftes ved næste gennemgang.

- Q: Hvilke datoer udgør sæsonerne, og hvornår er julehøjsæsonen? → A: Højsæson er sommer og
  jul, og julen er 20.–31. december (brugeren). Månederne følger de danske meteorologiske
  årstider: Lavsæson er vinter (1. januar–udgangen af februar og 1.–19. december),
  Mellemsæson er forår og efterår (marts–maj og september–november), og Højsæson er sommer
  (juni–august) og jul (20.–31. december) *(gruppens valg af månedsgrænser)*.
- Q: Hvornår ligger opgavens 1000 bookinger, og hvilket år gælder drinkfilens "Units Sold"? →
  A: Bookingerne placeres i 2025 med alle nætter i rækkens sæson, og "Units Sold" er salget i
  kalenderåret 2025. 2026 følger samme fordeling til og med 2026-11-05 (brugeren).
- Q: Hvad må hotellets bookingsystem gøre med sin nøgle? → A: Oprette, ændre og slette
  bookinger, men ikke læse. Kilden er uændret ved ændring (brugeren). Det må også ændre og
  slette bookinger, der er oprettet i back office, fordi opgaven ikke begrænser det *(gruppens
  valg)*.
- Q: Opgavens CSV-fil har et ødelagt tegn i "Müller" (54 rækker). Hvordan gemmes navnet? → A:
  Som "Müller". Opgavens xlsx-udgave af samme fil har "Müller", og ellers er de to filer ens.
  Det er derfor en tegnfejl i CSV-eksporten og ikke en del af data *(gruppens valg)*.
- Q: Hvilken kilde vises på de 1000 importerede bookinger? → A: "Bookingsystem". Filen er
  hotellets egne bookinger, og hotellet booker i dag via sit bookingsystem. De genererede
  bookinger har kilden "Back office" *(gruppens valg)*.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Opgavens hotel: værelser, typer, priser og sæsoner (Priority: P1)

Som hoteladministrator ønsker jeg, at systemet har præcis opgavens 214 værelser, 8
værelsestyper, priser og sæsoner, så bookinger, priser og belægning svarer til det hotel,
opgaven beskriver.

**Why this priority**: Alle andre data (bookinger, priser, belægning i BI) bygger på
værelsestyper, værelser, sæsoner og priser. Uden dem kan de 1000 bookinger ikke placeres.

**Independent Test**: Efter en start fra tom database viser værelsestypelisten i back office
de 8 typer med opgavens navne i opgavens rækkefølge. Der er i alt 214 værelser, og summen af
kapaciteterne er 428 gæster. En prisberegning for én nat i hver sæson giver opgavens laveste
pris i lavsæson og højeste i højsæson.

**Acceptance Scenarios**:

1. **Given** systemet er startet fra tom database, **When** receptionisten åbner listen over
   værelsestyper, **Then** vises præcis "Standard enkeltværelse", "Grand lit værelse",
   "Standard dobbeltværelse", "Superior dobbeltværelse", "Junior suite", "Spa executive",
   "Suite" og "LOFT suite" i den rækkefølge.
2. **Given** startdata er indlæst, **When** værelserne tælles, **Then** er der 214 værelser,
   hver værelsestype har plads til mellem 1 og 4 gæster, og summen af kapaciteten over alle
   værelser er 428.
3. **Given** en "Standard enkeltværelse" bookes for én nat i januar, **When** prisen beregnes,
   **Then** er den 900 kr. (opgavens laveste pris, lavsæson).
4. **Given** en "LOFT suite" bookes for én nat i juli, **When** prisen beregnes, **Then** er
   den 4.000 kr. (opgavens højeste pris, højsæson).
5. **Given** en "Suite" bookes 23.–25. december, **When** prisen beregnes, **Then** prissættes
   begge nætter som højsæson (jul).
6. **Given** en "Junior suite" bookes for én nat i oktober, **When** prisen beregnes, **Then**
   er den 2.150 kr. (mellemsæson = midtpunktet af 1.800–2.500).

---

### User Story 2 - Opgavens 1000 bookinger i systemet (Priority: P1)

Som hoteladministrator ønsker jeg, at opgavens 1000 bookinger findes uændret i systemet
sammen med et realistisk datasæt for resten af perioden, så back office og dashboard viser
hotellets egne data og ikke opdigtede tal.

**Why this priority**: Opgaven leverer datasættet, og brugeren kræver, at systemet svarer
100 % til opgaven. BI-nøgletallene (FT6–FT10) skal kunne følges tilbage til filen.

**Independent Test**: Hver af de 1000 rækker i opgavens CSV-fil kan genfindes som præcis én
booking med samme fornavn, efternavn, land, værelsestype, antal nætter, sæson og pris, og
ingen værelser er dobbeltbooket.

**Acceptance Scenarios**:

1. **Given** startdata er indlæst, **When** bookingerne sammenlignes med CSV-filen række for
   række, **Then** findes alle 1000 rækker med samme fornavn, efternavn, land, værelsestype,
   antal nætter og samlet pris (fx Liam Nguyen, Kina, Spa executive, 1 nat, 2.577 kr.).
2. **Given** en CSV-række har sæsonen "low", **When** dens booking slås op, **Then** ligger
   alle bookingens nætter i 2025 i lavsæson.
3. **Given** startdata er indlæst, **When** alle bookinger kontrolleres, **Then** har intet
   værelse to bookinger med overlappende perioder.
4. **Given** startdata er indlæst, **When** administratoren ser på belægningen for hele
   perioden, **Then** ligger den samlet mellem 65 % og 80 %, og den er højest i højsæson.
5. **Given** en importeret booking, **When** receptionisten åbner den, **Then** vises den
   samlede pris fra CSV-filen, også når prisen pr. nat afviger fra den aktuelle prisliste.

---

### User Story 3 - Fornavn og efternavn (Priority: P1)

Som receptionist ønsker jeg at registrere og se gæstens fornavn og efternavn hver for sig, så
bookingerne har samme form som hotellets data, og jeg kan finde en gæst på begge navne.

**Why this priority**: Opgavens data har to navnefelter. Et samlet navnefelt ville ikke kunne
gemme de 1000 rækker uændret og bryder 1NF (to oplysninger i ét felt).

**Independent Test**: Receptionisten opretter en booking med fornavn "Ingrid" og efternavn
"Olsen", ser "Ingrid Olsen" i listen og finder bookingen ved at søge på "ingrid",
"olsen" og "ingrid ols".

**Acceptance Scenarios**:

1. **Given** formularen "Ny booking", **When** receptionisten udfylder fornavn, efternavn og de
   øvrige felter og gemmer, **Then** gemmes bookingen med fornavn og efternavn hver for sig.
2. **Given** en booking for "Ingrid Olsen", **When** listen og detaljesiden vises, **Then**
   vises navnet som "Ingrid Olsen".
3. **Given** en booking for "Ingrid Olsen", **When** receptionisten søger på "ingrid",
   "OLSEN" eller "ingrid ols", **Then** vises bookingen.
4. **Given** formularen, **When** fornavn eller efternavn er tomt eller kun mellemrum, **Then**
   afvises bookingen med en dansk fejlbesked ved det felt, der mangler.

---

### User Story 4 - Helene Christines drinkkort og årssalg (Priority: P2)

Som hoteladministrator ønsker jeg, at drinkkortet og barens salg svarer til opgavens
drinkdata, så baromsætningen i dashboardet er opgavens tal for Helene Christines 20 cocktails
og 10 kaffetyper.

**Why this priority**: FT13–FT15 skal vise opgavens barsalg. Det er uafhængigt af bookingerne
og kan leveres efter US1–US3.

**Independent Test**: Drinkkortet har 30 drinks med opgavens navne og priser. Antal solgte
enheder pr. drink i kalenderåret 2025 er præcis lig opgavens "Units Sold".

**Acceptance Scenarios**:

1. **Given** startdata er indlæst, **When** receptionisten åbner drinkkortet ved barsalg,
   **Then** vises 20 drinks i kategorien "Cocktail" og 10 i "Kaffe" med opgavens navne og
   priser (fx Margarita 72,47 kr., Espresso 69,10 kr.).
2. **Given** startdata er indlæst, **When** solgte enheder i 2025 tælles pr. drink, **Then**
   er tallet lig opgavens "Units Sold" for alle 30 drinks (fx Mojito 3.350, Espresso 14.656), i
   alt 179.958 enheder.
3. **Given** startdata er indlæst, **When** salget i 2026 vises, **Then** findes der salg til og
   med 5. november 2026 i omtrent samme tempo og fordeling som 2025, og intet salg efter.
4. **Given** et barsalg i startdata er knyttet til en booking, **When** salget slås op, **Then**
   bor gæsten på hotellet på salgsdatoen.

---

### User Story 5 - Bookingsystemet kan ændre og slette (Priority: P2)

Som hoteladministrator ønsker jeg, at hotellets nuværende bookingsystem kan oprette, ændre og
slette bookinger via API'et, så ændringer i bookingsystemet straks er afspejlet i back office
og dashboard.

**Why this priority**: Opgaven siger, at bookingsystemet sender oprettelser, ændringer og
sletninger. I dag kan det kun oprette (spec 001, FR-013). Back office virker uden.

**Independent Test**: Et simuleret bookingsystem med gyldig nøgle opretter en booking, ændrer
dens afrejsedato og sletter den. Hver ændring ses i bookinglisten. Uden nøgle afvises alle
tre, og med nøglen afvises læsning.

**Acceptance Scenarios**:

1. **Given** bookingsystemet har en gyldig nøgle, **When** det ændrer afrejsedatoen på en
   booking, **Then** gemmes ændringen efter de samme regler som i back office (kapacitet,
   ledigt værelse, pris), og bookingens kilde er uændret.
2. **Given** bookingsystemet har en gyldig nøgle, **When** det sletter en booking, **Then**
   forsvinder bookingen fra listen, og tilknyttede barsalg bevares som selvstændige salg.
3. **Given** en afsender uden gyldig nøgle, **When** den forsøger at ændre eller slette en
   booking, **Then** afvises forsøget, og intet ændres.
4. **Given** bookingsystemet har en gyldig nøgle, **When** det forsøger at hente bookinglisten
   eller en enkelt booking, **Then** afvises forsøget.
5. **Given** bookingsystemet ændrer en booking, der ikke findes, **When** ændringen modtages,
   **Then** afvises den med en maskinlæsbar "findes ikke"-fejl.

---

### Edge Cases

- Opgavens CSV-fil har et ødelagt tegn (erstatningstegnet "�") i efternavnet "Müller" (54
  rækker): Navnet gemmes og vises som "Müller", som i opgavens xlsx-udgave af filen. Søgning på
  "müller" og "muller" finder rækkerne.
- Prisen pr. nat i CSV-filen varierer fra række til række og ligger for nogle rækker over
  opgavens prisinterval (fx Standard enkeltværelse i højsæson op til ca. 1.498 kr. pr. nat).
  Den samlede pris bevares uændret som et historisk faktum. Prislisten følger opgavens
  intervaller.
- En importeret booking redigeres: Prisen beregnes igen efter prislisten, som for alle
  bookinger (spec 001, FR-009).
- Et ophold krydser grænsen til julehøjsæson eller nytår: Hver nat prissættes efter sin egen
  sæson.
- Samme kombination af fornavn og efternavn optræder i flere CSV-rækker (284 kombinationer):
  Det er forskellige bookinger. Der er ingen fælles gæsteprofil.
- En CSV-række kan ikke placeres på et ledigt værelse i sin sæson: Genereringen af startdata
  fejler tydeligt i stedet for at springe rækken over.
- En gæst kommer fra et land, der ikke er blandt de 20: Landet kan ikke vælges, fordi listen
  er præcis opgavens lande.
- Bookingsystemet ændrer en booking, der er oprettet i back office: Det er tilladt, og kilden
  forbliver "back office".
- Bookingsystemet sletter en booking med barsalg: Barsalgene bevares som selvstændige salg.
- Fornavn eller efternavn mangler eller er kun mellemrum: Bookingen afvises.
- De 1000 importerede bookinger vises med kilden "Bookingsystem", de genererede med "Back
  office".
- Bookingsystemet sender en ændring med en gyldig nøgle til en booking, hvor perioden er
  udsolgt: Ændringen afvises, og den oprindelige booking er uændret (som i back office).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (KB-T7): Systemet MUST have præcis 214 værelser fordelt på præcis 8
  værelsestyper med opgavens danske navne i opgavens rækkefølge: Standard enkeltværelse,
  Grand lit værelse, Standard dobbeltværelse, Superior dobbeltværelse, Junior suite, Spa
  executive, Suite, LOFT suite.
- **FR-002** (KB-T7): Hver værelsestype MUST have en kapacitet mellem 1 og 4 gæster, og summen
  af kapaciteten over alle 214 værelser MUST være præcis 428 gæster.
- **FR-003** (KB-T7): Systemet MUST have tre sæsoner: Lavsæson (vintermånederne), Mellemsæson
  (forår og efterår) og Højsæson (sommer og jul). Hvert år MUST inddeles sådan: Lavsæson
  1. januar–udgangen af februar og 1.–19. december, Mellemsæson 1. marts–31. maj og
  1. september–30. november, Højsæson 1. juni–31. august og 20.–31. december.
  Sæsonperioderne MUST dække hver dag fra 2025-01-01 til 2027-12-31 præcis én gang.
- **FR-004** (KB-T7, FR8): Prisen pr. nat for hver værelsestype MUST være opgavens laveste
  pris i lavsæson, opgavens højeste pris i højsæson og midtpunktet afrundet til nærmeste 50 kr.
  i mellemsæson.
- **FR-005** (FT6, FT8): Landelisten MUST være præcis de 20 lande, der forekommer i opgavens
  bookingdata, med danske navne.
- **FR-006** (FR1, 1NF): En booking MUST registrere gæstens fornavn og efternavn som to
  separate, påkrævede oplysninger. Et navn, der kun består af mellemrum, MUST afvises. Navnet
  MUST vises som "fornavn efternavn" i lister, detaljer, bekræftelser og ved barsalg.
- **FR-007** (FR5): Søgning på gæstenavn MUST matche delvist fornavn, delvist efternavn og
  "fornavn efternavn" samlet, uden hensyn til store og små bogstaver.
- **FR-008** (opgavens datasæt, FT7–FT10): Alle 1000 rækker i opgavens CSV-fil MUST findes som
  præcis én booking hver med samme fornavn, efternavn, land, værelsestype, antal nætter
  ("Days Rented") og samlet pris ("Price"), der gemmes som fastfrosset pris. Hver booking MUST
  ligge i 2025 med alle nætter i rækkens sæson og på et ledigt værelse af typen, og den MUST
  have kilden "Bookingsystem". Det ødelagte tegn i "Müller" gemmes som "ü".
- **FR-009**: Øvrige bookinger i startdata MUST dække perioden 2025-01-01 til 2027-02-28 med
  navne og lande fra opgavens data, 1–10 nætter pr. ophold og en samlet belægning på 65–80 %,
  højest i højsæson. Deres priser MUST beregnes efter prislisten.
- **FR-010** (FR6): Antal gæster på hver booking i startdata MUST ligge mellem 1 og
  værelsestypens kapacitet. Intet værelse må have overlappende bookinger (FR7).
- **FR-011** (FR9, FT14, FT15): Drinkkortet MUST være præcis opgavens 30 drinks med opgavens
  navne og priser i kr. og øre: 20 i kategorien "Cocktail" og 10 i kategorien "Kaffe".
- **FR-012** (FT13–FT15): Barsalg i startdata MUST for kalenderåret 2025 give præcis opgavens
  "Units Sold" pr. drink. Fra 2026-01-01 til og med 2026-11-05 MUST salget følge samme
  fordeling og tempo, og der MUST NOT være salg efter 2026-11-05. Et salg MUST have 1–4
  enheder, og et salg, der er knyttet til en booking, MUST ligge på en dato, hvor gæsten bor
  på hotellet.
- **FR-013** (KB-T10, spec 001 FR-013): Hotellets bookingsystem MUST kunne oprette, ændre og
  slette bookinger med sin egen nøgle og MUST NOT kunne læse eller ændre andet. Det gælder alle
  bookinger, også dem, der er oprettet i back office. Ændringer valideres efter samme regler
  som i back office, og bookingens kilde MUST være uændret ved ændring.
- **FR-014** (KB-T6): Opgavens kildefiler MUST ligge uændret i repoet, og startdata MUST kunne
  genskabes deterministisk fra dem. Startdata MUST NOT redigeres i hånden.
- **FR-015** (KB-T3, KB-T4): Hele systemet MUST stadig starte med én kommando fra en tom
  maskine og være klar til brug med de nye startdata.

### Key Entities *(include if feature involves data)*

- **Værelsestype**: Opgavens navn, kapacitet (1–4) og placering i opgavens rækkefølge.
- **Værelse**: Værelsesnummer pr. etage. Tilhører én værelsestype.
- **Sæson og sæsonperiode**: Lav-, mellem- og højsæson med datoperioder, inkl. julehøjsæson.
- **Pris**: Pris pr. nat for en værelsestype i en sæson.
- **Land**: De 20 lande fra opgavens data med ISO-kode og dansk navn.
- **Booking**: Som i spec 001, men gæsten har fornavn og efternavn i stedet for ét navn.
- **Drink og drinkkategori**: Opgavens 30 drinks i kategorierne Cocktail og Kaffe.
- **Barsalg**: Som i spec 001. Alle salg er Helene Christines.
- **Kildefil**: Opgavens CSV-fil med bookinger og opgavens drinkfil. De er sandheden for
  startdata.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En optælling efter start fra tom database giver 214 værelser, 8 værelsestyper,
  428 i samlet kapacitet, 3 sæsoner, 20 lande og 30 drinks (20 cocktails, 10 kaffe). 0
  afvigelser fra opgaven.
- **SC-002**: 1000 af 1000 CSV-rækker genfindes én-til-én med samme fornavn, efternavn, land,
  værelsestype, antal nætter, sæson og pris.
- **SC-003**: Solgte enheder i 2025 matcher opgavens "Units Sold" for 30 af 30 drinks, i alt
  179.958 enheder.
- **SC-004**: Startdata har 0 overlappende bookinger pr. værelse og en samlet belægning på
  65–80 % med højsæson som den højeste.
- **SC-005**: Systemet er klar til brug under 3 minutter efter start fra tom database på en
  almindelig udviklermaskine.
- **SC-006**: En receptionist kan finde en booking fra opgavens data på fornavn og efternavn på
  under 15 sekunder.
- **SC-007**: 100 % af ændringer og sletninger fra bookingsystemet med gyldig nøgle behandles
  efter samme regler som i back office, og 100 % af forsøg uden gyldig nøgle eller på læsning
  afvises.

## Assumptions

- Opgavens datasæt er filerne i https://github.com/ITAKEA/hoteldata:
  `international_names_with_rooms_1000.csv` (1000 bookinger) og
  `drinks_menu_with_sales.xlsx` (30 drinks med årssalg). Repoet indeholder også en
  xlsx-udgave af bookingfilen.
- CSV-filen har ingen datoer. Bookingerne placeres i 2025, året før systemet præsenteres, og
  "Units Sold" fortolkes som salget i 2025.
- CSV-filen har intet antal gæster. Det vælges mellem 1 og værelsestypens kapacitet.
- Opgaven angiver ikke en etageplan eller fordelingen af værelser på typer. Gruppen vælger en
  fordeling, der opfylder 214 værelser og 428 gæster.
- Helene Christine er den eneste bartender, så barsalg registreres ikke pr. medarbejder.
- Danske gæster og andre lande end de 20 i opgavens data forekommer ikke.
- Kundetilfredshed, receptionsoverblik og belægningsplan hører til feature 003, som bygger på
  denne feature.
- Testenes egne små fixtures (fx et land "DK" i API-testene) er testdata og behøver ikke
  svare til opgavens data.
- Der er ingen AI-funktionalitet i brugergrænsefladen (KB-T8).
