# Feature Specification: Back Office – bookinger og barsalg

**Feature Branch**: `001-backoffice-bookinger`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "Back office til receptionisten på Hotel Kong Arthur: se, søge,
oprette, redigere og slette bookinger med validering af kapacitet og dobbeltbooking,
automatisk prisberegning ud fra værelsestype, sæson og antal nætter, registrering af barsalg
samt modtagelse af bookinger fra hotellets eget bookingsystem. (Kravboard: FR1–FR9, T7, T10)"

## Clarifications

### Session 2026-10-27

- Q: Skal receptionisten logge ind i back office? → A: Simpelt login. Én fælles
  receptionistkonto med brugernavn og adgangskode.
- Q: Bookes et konkret værelse eller kun en værelsestype? → A: Kun værelsestype. Systemet
  tildeler et ledigt værelse af typen.
- Q: Skal barsalg kunne knyttes til en booking? → A: Ja, valgfrit. Et salg kan lægges på en
  booking (værelsesregningen) eller registreres som selvstændigt salg.

## User Scenarios & Testing *(mandatory)*

### User Story 0 - Logge ind (Priority: P1)

Som receptionist ønsker jeg at logge ind i back office, så kun hotellets personale kan se og
ændre bookinger.

**Why this priority**: Alle øvrige back office-funktioner forudsætter adgang. Bookinger
indeholder persondata.

**Independent Test**: Uden login afvises adgang til bookinglisten. Med korrekt brugernavn og
adgangskode gives adgang. Med forkert adgangskode afvises login.

**Acceptance Scenarios**:

1. **Given** receptionisten ikke er logget ind, **When** back office åbnes, **Then** vises
   login-siden, og ingen bookingdata vises.
2. **Given** login-siden, **When** receptionisten angiver korrekt brugernavn og adgangskode,
   **Then** får receptionisten adgang til back office.
3. **Given** login-siden, **When** der angives forkert adgangskode, **Then** afvises login med
   en generel fejlbesked, der ikke afslører, om brugernavnet findes.
4. **Given** receptionisten er logget ind, **When** receptionisten logger ud, **Then** kræver
   videre adgang nyt login.

---

### User Story 1 - Se og søge i bookinger (Priority: P1)

Som receptionist ønsker jeg at se en liste over bookinger og kunne søge på gæstenavn og dato,
så jeg hurtigt kan finde den rigtige booking, når en gæst henvender sig.

**Why this priority**: Listen er forudsætningen for at kunne redigere og slette (FR2), og det
er den handling, receptionisten udfører oftest.

**Independent Test**: Med startdata indlæst kan receptionisten åbne bookinglisten, søge på et
kendt gæstenavn og en dato og få præcis de forventede bookinger vist.

**Acceptance Scenarios**:

1. **Given** der findes bookinger i systemet, **When** receptionisten åbner bookinglisten,
   **Then** vises bookingerne med gæstenavn, værelse, ankomst, afrejse, antal gæster og pris.
2. **Given** der findes en booking for gæsten "Jensen", **When** receptionisten søger på
   "jens", **Then** vises den booking (søgning uden hensyn til store/små bogstaver og på
   delvist navn).
3. **Given** der findes bookinger i forskellige perioder, **When** receptionisten filtrerer på
   en dato, **Then** vises kun bookinger, hvor gæsten bor på hotellet den dato.
4. **Given** ingen bookinger matcher søgningen, **When** søgningen udføres, **Then** vises en
   tydelig besked om, at der ikke er nogen resultater.

---

### User Story 2 - Oprette booking med validering og pris (Priority: P1)

Som receptionist ønsker jeg at oprette en booking og få prisen beregnet automatisk, så gæsten
får den korrekte pris, og hotellet undgår overbookede eller overfyldte værelser.

**Why this priority**: Oprettelse er kernen i back office (FR1). Kapacitetstjek, forhindring
af dobbeltbooking og prisberegning (FR6–FR8) er de vigtigste forretningsregler.

**Independent Test**: Receptionisten opretter en gyldig booking og ser den korrekte pris og
det tildelte værelse. Derefter forsøger receptionisten at booke en værelsestype, der er
udsolgt i perioden, og at overskride kapaciteten. Begge forsøg afvises med en forståelig
begrundelse.

**Acceptance Scenarios**:

1. **Given** der er et ledigt værelse af typen "Dobbeltværelse" i perioden, **When**
   receptionisten indtaster gæstenavn, gæstens land, værelsestype, ankomst, afrejse og antal
   gæster, **Then** gemmes bookingen, systemet tildeler et ledigt værelse af typen, og den
   viste pris svarer til summen af nattepriserne for værelsestypen i de sæsoner, opholdet
   dækker.
2. **Given** alle værelser af typen "Suite" er booket 10.–12. marts, **When** receptionisten
   forsøger at booke en suite 11.–13. marts, **Then** afvises bookingen med beskeden "ingen
   ledige værelser af typen Suite i perioden".
3. **Given** værelse 101 er booket 10.–12. marts, **When** en ny booking af samme type har
   ankomst 12. marts, **Then** kan værelse 101 tildeles (afrejsedag og ankomstdag må
   overlappe).
4. **Given** en værelsestype har plads til 2 gæster, **When** receptionisten forsøger at booke
   3 gæster på den type, **Then** afvises bookingen med beskeden "antal gæster overstiger
   værelsestypens kapacitet (2)".
5. **Given** receptionisten har udfyldt periode og værelsestype, **When** formularen vises,
   **Then** kan receptionisten se den beregnede pris, og om der er ledige værelser, før
   bookingen gemmes.

---

### User Story 3 - Redigere booking (Priority: P2)

Som receptionist ønsker jeg at ændre en eksisterende booking, så jeg kan håndtere, at gæster
ændrer datoer, antal personer eller værelsestype.

**Why this priority**: Ændringer er hyppige, men systemet giver værdi uden dem, da en booking
kan slettes og oprettes på ny.

**Independent Test**: En eksisterende booking ændres til nye datoer. Prisen genberegnes, og
ændringen afvises, hvis der ikke er et ledigt værelse af typen, eller hvis kapaciteten
overskrides.

**Acceptance Scenarios**:

1. **Given** en booking findes, **When** receptionisten ændrer afrejsedatoen og gemmer,
   **Then** gemmes ændringen, og prisen genberegnes.
2. **Given** en booking findes, og det tildelte værelse stadig er ledigt i den nye periode,
   **When** ændringen gemmes, **Then** beholder bookingen sit værelse.
3. **Given** det tildelte værelse er optaget i den nye periode, men et andet værelse af samme
   type er ledigt, **When** ændringen gemmes, **Then** tildeles det ledige værelse.
4. **Given** ingen værelser af typen er ledige i den nye periode, **When** ændringen gemmes,
   **Then** afvises ændringen, og den oprindelige booking er uændret.
5. **Given** en booking findes, **When** receptionisten ændrer den uden at ændre periode eller
   værelsestype, **Then** afvises den ikke på grund af overlap med sig selv.

---

### User Story 4 - Slette booking med bekræftelse (Priority: P2)

Som receptionist ønsker jeg at kunne slette en booking efter at have bekræftet det, så
aflyste ophold ikke tæller med, uden at jeg sletter noget ved et uheld.

**Why this priority**: Kræves af FR1/FR3, men er sjældnere end oprettelse og søgning.

**Independent Test**: Receptionisten vælger at slette en booking, annullerer i
bekræftelsesdialogen og ser bookingen stadig findes. Derefter slettes den med bekræftelse og
forsvinder fra listen.

**Acceptance Scenarios**:

1. **Given** en booking findes, **When** receptionisten vælger "slet", **Then** bliver
   receptionisten bedt om at bekræfte med gæstenavn og periode vist, før noget slettes.
2. **Given** bekræftelsesdialogen vises, **When** receptionisten annullerer, **Then** er
   bookingen uændret.
3. **Given** bekræftelsesdialogen vises, **When** receptionisten bekræfter, **Then** fjernes
   bookingen fra listen, og værelset bliver ledigt i perioden.

---

### User Story 5 - Registrere barsalg (Priority: P2)

Som receptionist ønsker jeg at registrere et salg i baren med drink og antal, så hotellets
barsalg indgår i ledelsens nøgletal.

**Why this priority**: Barsalg er datagrundlaget for BI-kravene FT13–FT15, men er uafhængigt
af bookingflowet.

**Independent Test**: Receptionisten registrerer "2 × Espresso Martini". Salget gemmes med
tidspunkt og den pris, drinken havde på salgstidspunktet.

**Acceptance Scenarios**:

1. **Given** drinkkortet indeholder "Espresso Martini", **When** receptionisten vælger drinken,
   angiver antal 2 og gemmer, **Then** registreres salget med tidspunkt, antal og samlet beløb.
2. **Given** receptionisten angiver antal 0 eller et negativt antal, **When** salget gemmes,
   **Then** afvises det med en forståelig fejlbesked.
3. **Given** en gæst bor på hotellet i dag, **When** receptionisten registrerer et salg og
   vælger gæstens booking, **Then** knyttes salget til bookingen og vises på bookingen.
4. **Given** receptionisten forsøger at knytte et salg til en booking, hvor gæsten ikke bor på
   hotellet på salgsdatoen, **When** salget gemmes, **Then** afvises koblingen med en
   forståelig fejlbesked.
5. **Given** en booking med tilknyttede barsalg slettes, **When** sletningen bekræftes,
   **Then** bevares barsalgene som selvstændige salg, så barens omsætning er uændret.

---

### User Story 6 - Bookinger fra hotellets eget bookingsystem (Priority: P3)

Som hoteladministrator ønsker jeg, at bookinger fra hotellets eget bookingsystem automatisk
kommer ind i systemet, så back office og dashboard altid viser aktuelle data uden manuel
indtastning.

**Why this priority**: Krav T10 og forudsætning for "live"-data i BI (FT4), men back office
kan bruges uden.

**Independent Test**: Et simuleret eksternt bookingsystem sender en ny booking. Den vises i
bookinglisten og overholder samme regler som manuelle bookinger.

**Acceptance Scenarios**:

1. **Given** det eksterne bookingsystem sender en gyldig booking, **When** den modtages,
   **Then** vises den i bookinglisten med angivelse af, at den kommer fra bookingsystemet.
2. **Given** det eksterne bookingsystem sender en booking på en værelsestype, der er udsolgt
   i perioden, **When** den modtages, **Then** afvises den med en maskinlæsbar
   fejlbegrundelse.
3. **Given** en afsender uden gyldig adgang, **When** den sender en booking, **Then** afvises
   den, og intet gemmes.

---

### Edge Cases

- Afrejse er samme dag som eller før ankomst: Bookingen afvises.
- Opholdet strækker sig over to sæsoner: Hver nat prissættes efter den sæson, natten ligger i.
- Der mangler en pris for værelsestypen i en sæson, opholdet dækker: Bookingen afvises med en
  besked om manglende prisopsætning i stedet for at gemme en forkert pris.
- Antal gæster er 0 eller negativt: Bookingen afvises.
- To receptionister booker samtidig det sidste ledige værelse af en type: Kun den ene booking
  accepteres.
- Login mislykkes gentagne gange: Fejlbeskeden afslører ikke, om brugernavn eller adgangskode
  var forkert.
- Bookingen, der forsøges redigeret eller slettet, er allerede slettet: Brugeren får besked om,
  at bookingen ikke findes længere.
- Prisen ændres efter oprettelse: Eksisterende bookinger beholder den pris, de blev oprettet
  med, indtil de redigeres.
- Bookinger tilbage i tiden er tilladt, så historiske data kan registreres.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (FR2, FR4): Systemet MUST vise en liste over bookinger med gæstenavn, gæstens land,
  værelse, værelsestype, ankomst, afrejse, antal gæster og pris.
- **FR-002** (FR5): Receptionisten MUST kunne søge bookinger på delvist gæstenavn uden hensyn
  til store/små bogstaver og filtrere på en dato (bookinger, hvor gæsten bor på hotellet den
  dato).
- **FR-003** (FR1): Receptionisten MUST kunne oprette en booking med gæstenavn, gæstens land,
  værelsestype, ankomstdato, afrejsedato og antal gæster.
- **FR-004** (FR1): Receptionisten MUST kunne redigere alle felter i en eksisterende booking.
- **FR-005** (FR1, FR3): Receptionisten MUST kunne slette en booking, og systemet MUST kræve en
  eksplicit bekræftelse, før sletningen udføres.
- **FR-006** (FR6): Systemet MUST afvise oprettelse og redigering, hvis antal gæster overstiger
  værelsestypens kapacitet.
- **FR-007** (FR7): Systemet MUST tildele hver booking et konkret værelse af den valgte
  værelsestype, som ikke er booket i en overlappende periode. Et værelse MUST aldrig være
  tildelt to bookinger med overlappende perioder. Afrejsedagen for én booking må være
  ankomstdag for en anden. Findes der intet ledigt værelse af typen, MUST bookingen afvises.
- **FR-008** (FR8): Systemet MUST beregne opholdets pris som summen af nattepriser, hvor hver
  nat prissættes efter værelsestype og den sæson, natten ligger i. Prisen MUST vises, før
  bookingen gemmes.
- **FR-009** (FR8): Den beregnede pris MUST gemmes på bookingen, så senere prisændringer ikke
  ændrer eksisterende bookinger.
- **FR-010** (FR9): Receptionisten MUST kunne registrere et barsalg med drink og antal (heltal
  ≥ 1). Systemet MUST gemme tidspunkt, antal og drinkens pris på salgstidspunktet.
- **FR-010a** (FR9): Et barsalg MAY knyttes til en booking, hvor gæsten bor på hotellet på
  salgsdatoen. Når en booking slettes, MUST tilknyttede barsalg bevares som selvstændige salg.
- **FR-011** (FR9): Hver drink MUST tilhøre en kategori (mindst "cocktail" og "kaffe"), så
  fordelingen kan opgøres i BI-dashboardet.
- **FR-012** (T7): Værelsestyper (inkl. kapacitet), værelser, sæsoner (med datoperioder),
  priser pr. værelsestype pr. sæson samt drinks og drinkpriser MUST ligge som data og ikke
  være hardcodet.
- **FR-013** (T10): Systemet MUST kunne modtage bookinger fra hotellets eget bookingsystem via
  en sikret integration. Disse bookinger MUST valideres efter samme regler som manuelle
  bookinger og markeres med kilde.
- **FR-014**: Valideringsfejl MUST vises for receptionisten som en forståelig dansk besked, der
  angiver, hvilket felt eller hvilken regel der fejlede.
- **FR-015**: Adgang til back office MUST kræve login med én fælles receptionistkonto
  (brugernavn og adgangskode). Uden gyldigt login MUST ingen bookingdata kunne ses eller
  ændres. Adgangskoden MUST NOT gemmes i klartekst.
- **FR-016** (FR7): Det tildelte værelse MUST vises på bookingen, men receptionisten vælger kun
  værelsestype. Ved redigering MUST bookingen beholde sit værelse, hvis det stadig er ledigt.

### Key Entities *(include if feature involves data)*

- **Gæst**: Navn og oprindelsesland. Land bruges i BI (FT6, FT8). En gæst kan have flere
  bookinger.
- **Værelsestype**: Navn og maksimal kapacitet (antal gæster).
- **Værelse**: Værelsesnummer. Tilhører én værelsestype.
- **Sæson**: Navn og datoperiode. Sæsoner dækker hele året uden overlap.
- **Pris**: Pris pr. nat for en værelsestype i en sæson.
- **Booking**: Gæst, valgt værelsestype, tildelt værelse, ankomst, afrejse, antal gæster,
  beregnet samlet pris og kilde (back office eller bookingsystem).
- **Drink**: Navn, kategori (cocktail/kaffe) og aktuel pris.
- **Barsalg**: Drink, antal, tidspunkt, pris på salgstidspunktet og eventuelt en booking.
- **Bruger**: Den fælles receptionistkonto med brugernavn og beskyttet adgangskode.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En receptionist kan oprette en gyldig booking på under 2 minutter.
- **SC-002**: En receptionist kan finde en bestemt booking via navn eller dato på under 15
  sekunder.
- **SC-003**: 100 % af forsøg på dobbeltbooking og kapacitetsoverskridelse i testscenarierne
  afvises med en forståelig begrundelse.
- **SC-004**: Den beregnede pris matcher en manuel beregning i 100 % af testscenarierne, også
  for ophold over to sæsoner.
- **SC-005**: Ingen booking kan slettes uden et eksplicit bekræftelsestrin.
- **SC-006**: En booking sendt fra det eksterne bookingsystem er synlig i bookinglisten inden
  for 5 sekunder.
- **SC-007**: Et barsalg kan registreres på under 30 sekunder.

## Assumptions

- Der er intet datasæt fra opgaven. Gruppen genererer et stort, realistisk testdatasæt som
  startdata (bookinger, gæster fra mange lande og barsalg over mindst ét helt år), så
  bookinglisten og BI-dashboardet har meningsfuldt indhold fra start.
- Sæsoner defineres som datoperioder i data. Den konkrete inddeling (fx lav-, mellem- og
  højsæson) hentes fra hotellets datagrundlag.
- Én booking dækker ét værelse. Flere værelser kræver flere bookinger.
- Den fælles receptionistkonto oprettes via startdata. Brugeradministration, roller og
  nulstilling af adgangskode er uden for scope.
- Tildeling af værelse vælger det første ledige værelse af typen (laveste værelsesnummer).
  Receptionisten kan ikke vælge værelsesnummer manuelt.
- Det eksterne bookingsystem bruger sin egen adgangsnøgle, adskilt fra receptionistens login.
- Check-in/check-out, betaling og fakturering er uden for scope.
- Administration af værelsestyper, priser, sæsoner og drinkkort sker via data/startscript i
  denne version, ikke via en brugergrænseflade.
- Kundetilfredshed registreres ikke (FT12 er "Could", og der findes ingen data).
- Brugergrænsefladen er på dansk og bruges på desktop i receptionen. Mobil er uden for scope.
- Der er ingen AI-funktionalitet i brugergrænsefladen (T8).
