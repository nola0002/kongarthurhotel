# Feature Specification: Receptionsoverblik – dagsoverblik, belægningsplan og kundetilfredshed

**Feature Branch**: `003-receptionsoverblik` (der arbejdes på `main`, jf. KB-D12)

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "Gør receptionist-dashboardet mere detaljeret. Lige nu er der to
faner, som gør alt. Det må gerne deles lidt mere ud og gøres mere detaljeret, så man som
receptionist har mere overblik. Lav gerne et kalenderoverblik." Opgavens nøgletal
"belægningsgrader, indtjening, kundetilfredshed mm." skal også dækkes, så kundetilfredshed
registreres ved check-out og vises som nøgletal (FT12). (Kravboard: FR1, FR4, FR5, FT4, FT12,
KB-A4)

## Clarifications

### Session 2026-10-30

Beslutningerne er truffet med brugeren før specifikationen. Brugerens overordnede regel er, at
systemet skal svare 100 % til opgaven.

- Q: Hvilken slags kalenderoverblik skal receptionisten have? → A: En belægningsplan
  (værelser som rækker grupperet efter type, dage som kolonner), standard 14 dage fra i dag og
  7–31 dage efter valg. Klik på en bjælke åbner bookingen.
- Q: Hvordan deles back office ud, så det ikke er "to faner, der gør alt"? → A: Navigationen
  bliver Oversigt (ny startside), Belægningsplan, Bookinger og Barsalg. Oversigt viser én dag:
  ankomster, afrejser, i huset, ledige værelser pr. type og dagens barsalg.
- Q: Hvordan registreres kundetilfredshed, når opgaven nævner den som nøgletal, men datasættet
  ingen har? → A: Receptionisten registrerer en score 1–5 ved check-out, tidligst på
  afrejsedagen. FT12 løftes fra Could til Must. Startdata får genererede historiske scores
  (ca. 80 % svarprocent, overvejende 4–5), dokumenteret som genererede.
- Q: Hvordan opgøres kundetilfredshed som nøgletal? → A: Pr. kalenderår som gennemsnittet af
  registrerede scores for bookinger med afrejse i året (0, når der ingen er), plus antal
  besvarelser. Begge leveres med dashboardets øvrige nøgletal, og bookingrækkerne får scoren.
- Q: Skal barsiden vise, hvem der sælger? → A: Ja. Barsalget er receptionisten Helene
  Christines i lobbybaren, og barsiden viser "Helene Christine · lobbybaren".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dagsoverblik (Priority: P1)

Som receptionist ønsker jeg at se dagens ankomster, afrejser, gæster i huset, ledige værelser
pr. værelsestype og dagens barsalg på én side, så jeg ved, hvad dagen byder på, uden at lede i
bookinglisten.

**Why this priority**: Det er det første, receptionisten har brug for, når vagten starter, og
det er den direkte løsning på, at "to faner gør alt". Siden bliver back officens startside.

**Independent Test**: Med et kendt datasæt åbnes overblikket for en bestemt dato. Ankomster,
afrejser, antal bookinger og gæster i huset, ledige værelser pr. type og barsalg for dagen
stemmer med en manuel optælling.

**Acceptance Scenarios**:

1. **Given** receptionisten logger ind, **When** back office åbnes, **Then** vises overblikket
   for dags dato som startside, og navigationen indeholder Oversigt, Belægningsplan, Bookinger
   og Barsalg.
2. **Given** tre bookinger har ankomst i dag, **When** overblikket vises, **Then** står præcis
   de tre under "Ankomster" med gæstens navn, værelse, værelsestype, antal gæster og nætter.
3. **Given** to bookinger har afrejse i dag, **When** overblikket vises, **Then** står de under
   "Afrejser" med de samme oplysninger. (Registrering af tilfredshed ved afrejse er US3.)
4. **Given** en værelsestype har 30 værelser, og 26 af dem er optaget i nat, **When**
   overblikket vises, **Then** står typen med "4 ledige af 30".
5. **Given** receptionisten vælger en anden dato (forrige dag, næste dag eller via datovælger),
   **When** datoen skiftes, **Then** viser alle dele af overblikket den valgte dato, og datoen
   står i adressen, så visningen kan genindlæses.
6. **Given** der er solgt drinks for 1.240 kr. i dag, **When** overblikket vises, **Then** står
   "1.240 kr." som dagens barsalg.
7. **Given** receptionisten klikker på en booking i overblikket, **When** klikket udføres,
   **Then** åbnes bookingens detaljeside.

---

### User Story 2 - Belægningsplan (Priority: P1)

Som receptionist ønsker jeg en belægningsplan med værelserne som rækker og dagene som kolonner,
så jeg på et øjeblik kan se, hvilke værelser der er optaget og ledige de kommende dage, og
finde et ledigt værelse af en bestemt type på en bestemt dato.

**Why this priority**: Det er det kalenderoverblik, brugeren beder om. Bookinglisten kan ikke
vise ledighed over tid.

**Independent Test**: Med et kendt datasæt åbnes planen fra en bestemt dato. Hver booking står
som en bjælke på sit værelse fra ankomst til afrejse, og "Ledige"-rækken for hver type viser det
antal ledige værelser, en manuel optælling giver.

**Acceptance Scenarios**:

1. **Given** receptionisten åbner Belægningsplan, **When** siden vises, **Then** vises alle
   hotellets værelser grupperet efter værelsestype og de næste 14 dage fra i dag som kolonner.
2. **Given** en booking på værelse 204 fra 10. til 13. marts, **When** planen viser marts,
   **Then** står bookingen som én bjælke med gæstens navn på række 204 over nætterne 10., 11. og
   12. marts.
3. **Given** værelse 204 har en afrejse 13. marts og en ny ankomst 13. marts, **When** planen
   vises, **Then** står de to bjælker side om side uden overlap (afrejsedagen er ledig for en
   ny ankomst).
4. **Given** et ophold starter før eller slutter efter de viste dage, **When** planen vises,
   **Then** vises kun den del af opholdet, der ligger inden for de viste dage, og det kan ses,
   at opholdet fortsætter uden for visningen.
5. **Given** en værelsestype har 30 værelser, og 26 er optaget natten til 11. marts, **When**
   planen vises, **Then** står "4" i typens "Ledige"-række under 11. marts.
6. **Given** planen er åben, **When** receptionisten bladrer frem, tilbage, vælger "I dag",
   vælger en startdato eller ændrer antal viste dage (7, 14 eller 31), **Then** viser planen den valgte
   periode, og periodens startdato og længde står i adressen.
7. **Given** receptionisten klikker på en bjælke, **When** klikket udføres, **Then** åbnes
   bookingens detaljeside.
8. **Given** hotellets 214 værelser og 31 dage vises, **When** receptionisten scroller,
   **Then** forbliver datoer og værelsesnumre synlige, og visningen reagerer uden mærkbar
   forsinkelse.

---

### User Story 3 - Registrere kundetilfredshed ved check-out (Priority: P2)

Som receptionist ønsker jeg at registrere gæstens tilfredshed på en skala fra 1 til 5, når
gæsten checker ud, så hotellet får data om kundetilfredshed.

**Why this priority**: Opgaven nævner kundetilfredshed som nøgletal, og der findes ingen data
uden registrering. Det er dog en tilføjelse til de daglige arbejdsgange i US1 og US2.

**Independent Test**: En booking med afrejse i dag får registreret score 4 fra overblikket, og
bookingen viser derefter 4. Et forsøg på at registrere en score på en booking, hvor gæsten endnu
ikke er rejst, afvises med en forståelig besked.

**Acceptance Scenarios**:

1. **Given** en booking har afrejse i dag, **When** receptionisten vælger "Registrér
   tilfredshed", vælger 4 og gemmer, **Then** gemmes scoren på bookingen, og overblikket og
   bookingdetaljen viser "4 af 5".
2. **Given** en booking har afrejse i morgen, **When** der forsøges registreret en score,
   **Then** afvises den med beskeden, at tilfredshed først kan registreres på afrejsedagen.
3. **Given** en afrejst booking har score 3, **When** receptionisten registrerer 5, **Then**
   erstattes scoren med 5 (en fejlindtastning kan rettes).
4. **Given** der forsøges registreret en score uden for 1–5, **When** den gemmes, **Then**
   afvises den, og intet ændres.
5. **Given** bookingen er slettet, mens skærmen var åben, **When** scoren gemmes, **Then**
   får receptionisten beskeden "Bookingen findes ikke længere".

---

### User Story 4 - Kundetilfredshed som nøgletal (Priority: P2)

Som hoteladministrator ønsker jeg at se den gennemsnitlige kundetilfredshed og antallet af
besvarelser pr. år i ledelsesdashboardet, så jeg kan følge gæsternes oplevelse ved siden af
belægning og indtjening.

**Why this priority**: Opgaven kræver kundetilfredshed som nøgletal (FT12 løftes fra Could til
Must), men det bygger på registreringen i US3 og på dashboardet fra feature 002.

**Independent Test**: Med et kendt sæt scores matcher gennemsnit og antal besvarelser pr. år en
manuel beregning, og bookingrækkerne til dashboardet indeholder scoren.

**Acceptance Scenarios**:

1. **Given** tre bookinger med afrejse i 2025 har scores 5, 4 og 3, og en fjerde har ingen
   score, **When** nøgletallene hentes, **Then** er kundetilfredsheden for 2025 4,0, og antal
   besvarelser er 3.
2. **Given** et år uden registrerede scores, **When** nøgletallene hentes, **Then** er
   kundetilfredsheden 0, og antal besvarelser er 0.
3. **Given** en booking har score 5, **When** dashboardets bookingrækker hentes, **Then** har
   bookingens række scoren 5. En booking uden score har en tom værdi.

---

### User Story 5 - Barsalget er Helene Christines (Priority: P3)

Som receptionist, der også står i lobbybaren, ønsker jeg, at barsiden viser, at salget er
Helene Christines i lobbybaren, så det er tydeligt, hvem og hvilken bar barsalget og
nøgletallene handler om.

**Why this priority**: Det gør systemet tro mod opgaveteksten, men ændrer ingen arbejdsgang.

**Independent Test**: Barsiden åbnes, og overskriften viser "Helene Christine · lobbybaren".

**Acceptance Scenarios**:

1. **Given** receptionisten åbner Barsalg, **When** siden vises, **Then** står "Helene
   Christine · lobbybaren" under titlen sammen med dagens salg.

---

### Edge Cases

- **214 værelser × 31 dage**: Planen viser op til ca. 6.600 celler. Den skal stadig indlæses
  hurtigt og kunne scrolles, mens datoer og værelsesnumre bliver stående.
- **Ophold, der starter før eller slutter efter de viste dage**: Kun den synlige del vises, og
  det fremgår, at opholdet fortsætter. Opholdet tæller kun som optaget på de viste nætter.
- **Afrejsedag**: Afrejsedagen er ledig for en ny ankomst. En booking 10.–13. marts optager
  nætterne 10., 11. og 12. og tæller ikke som optaget eller i huset 13. marts.
- **Ophold over årsskifte eller sæsonskifte**: Planen og ledigheden følger kun datoerne.
  Sæsoner har ingen betydning for visningen.
- **Dato uden bookinger**: Ankomster og afrejser viser en tom tilstand på én linje, alle
  værelser er ledige, og barsalget er 0 kr.
- **Bookingen slettes, mens overblik eller plan er åben**: Klik på bookingen viser "Bookingen
  findes ikke længere". Registrering af tilfredshed giver samme besked. Næste indlæsning viser
  ikke bookingen.
- **Score før afrejse**: Afvises. Scoren kan tidligst registreres på afrejsedagen.
- **Score uden for 1–5 eller ikke et helt tal**: Afvises.
- **Bookingen redigeres, efter scoren er registreret**: Scoren bevares uændret.
- **Ugyldig dato eller et antal dage uden for 7–31 i adressen**: Afvises med en forståelig
  besked i stedet for en forkert visning.
- **Booking oprettet i et andet vindue eller af bookingsystemet**: Den vises i overblik og plan,
  næste gang siden indlæses eller datoen skiftes.
- **"I dag"** er dags dato i Danmark (Europe/Copenhagen), også for statussen og reglen om
  afrejse.

## Requirements *(mandatory)*

### Functional Requirements

**Navigation**

- **FR-001** (FR4): Back office MUST have navigationen Oversigt, Belægningsplan, Bookinger og
  Barsalg i den rækkefølge. Oversigt MUST være startsiden efter login.

**Dagsoverblik (US1)**

- **FR-002** (FR4, FR5): Systemet MUST for en valgt dato (standard dags dato) vise:
  ankomster (bookinger med ankomst på datoen), afrejser (bookinger med afrejse på datoen),
  antal bookinger og gæster i huset (gæsten bor på hotellet på datoen efter 001's definition:
  ankomst ≤ dato < afrejse), ledige værelser pr. værelsestype som "ledige af i alt" og det
  samlede barsalg på datoen.
- **FR-003**: Hver booking under ankomster og afrejser MUST vise gæstens navn, værelse,
  værelsestype, antal gæster, nætter og status, og MUST føre til bookingens detaljeside.
- **FR-004**: Receptionisten MUST kunne skifte dato med forrige dag, næste dag, "I dag" og en
  datovælger. Datoen MUST ligge i adressen.

**Belægningsplan (US2)**

- **FR-005**: Systemet MUST vise en belægningsplan med alle værelser som rækker, grupperet efter
  værelsestype og sorteret efter værelsesnummer, og en kolonne pr. dag. Standard er 14 dage fra
  dags dato. Receptionisten MUST kunne vælge 7, 14 eller 31 dage. Systemet MUST acceptere
  ethvert antal fra 7 til 31 og afvise andre.
- **FR-006**: Hver booking, der overlapper de viste dage, MUST vises som én bjælke på det
  tildelte værelse over de nætter, den optager (ankomst til dagen før afrejse), med gæstens navn.
  Et ophold, der går ud over de viste dage, MUST klippes ved kanten og vise, at det fortsætter.
- **FR-007**: Planen MUST for hver værelsestype og hver dag vise antallet af ledige værelser i en
  "Ledige"-række.
- **FR-008**: Receptionisten MUST kunne bladre en periode frem og tilbage, gå til "I dag" og
  vælge startdato og antal dage. Startdato og antal dage MUST ligge i adressen.
- **FR-009**: Klik på en bjælke MUST åbne bookingens detaljeside. Bjælken MUST vise bookingens
  status med form og tekst (fx i en forklaring og i bjælkens tilgængelige navn), ikke kun med
  farve.
- **FR-010**: Klik på en ledig celle MAY åbne "Ny booking" med værelsestype og ankomstdato
  udfyldt. Systemet tildeler stadig selv værelset (001 FR-007, FR-016), så det tildelte værelse
  kan være et andet ledigt værelse af typen.

**Kundetilfredshed (US3, US4)**

- **FR-011** (FT12): Receptionisten MUST kunne registrere kundetilfredshed som et helt tal fra 1
  til 5 på en booking. Systemet MUST afvise registreringen, hvis afrejsedatoen ligger efter dags
  dato. En registreret score MAY erstattes af en ny. En booking uden registrering har ingen
  score.
- **FR-012**: Handlingen "Registrér tilfredshed" MUST findes ved afrejser i overblikket og på
  detaljesiden for afrejste bookinger. En registreret score MUST vises begge steder.
- **FR-013**: Scoren MUST gemmes på bookingen. Redigering af bookingen MUST NOT ændre scoren, og
  sletning af bookingen fjerner den.
- **FR-014** (FT12, KB-A4): Systemet MUST pr. kalenderår beregne kundetilfredshed som
  gennemsnittet af de registrerede scores for bookinger med afrejse i året (0, når der ingen er)
  og antallet af besvarelser. Begge MUST leveres færdigberegnet til ledelsesdashboardet sammen
  med de øvrige nøgletal, og bookingrækkerne til dashboardet MUST indeholde scoren.
- **FR-015**: Startdata MUST indeholde historiske scores for afrejste bookinger (ca. 80 %
  svarprocent, overvejende 4 og 5), dokumenteret som genererede, fordi opgavens datasæt ingen
  tilfredshedsdata har.

**Fælles**

- **FR-016** (FR9): Barsiden MUST vise, at salget er Helene Christines i lobbybaren.
- **FR-017** (KB-A4): Alle antal, ledige værelser, status og nøgletal i denne feature MUST
  beregnes i systemets logik og leveres færdige. Brugergrænsefladen MUST NOT tælle, beregne
  ledighed eller udlede status selv.
- **FR-018**: Overblik, belægningsplan og registrering af tilfredshed MUST kræve login som resten
  af back office (001 FR-015). Bookingsystemets nøgle MUST NOT give adgang til dem.
- **FR-019**: Al tekst MUST være på dansk. Alle felter MUST have en label, og status og ledighed
  MUST kunne aflæses som tekst, ikke kun som farve.

### Key Entities *(include if feature involves data)*

Featuren bygger på entiteterne fra 001 (Booking, Værelse, Værelsestype, Barsalg) og 004
(gæstens fornavn og efternavn, 214 værelser i 8 typer).

- **Kundetilfredshed**: En valgfri score 1–5 på en booking, registreret ved check-out. Den
  eneste nye gemte oplysning i featuren.
- **Dagsoverblik** (afledt): Dato, ankomster, afrejser, i huset (bookinger og gæster), ledige
  værelser pr. værelsestype (i alt, optaget, ledige) og dagens barsalg. Gemmes ikke.
- **Belægningsplan** (afledt): En periode (startdato og antal dage), værelsestyperne med deres
  værelser og antal ledige pr. dag samt de ophold, der overlapper perioden. Gemmes ikke.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Efter login ser receptionisten dagens ankomster og afrejser uden yderligere klik,
  og siden er vist på under 2 sekunder.
- **SC-002**: En receptionist kan finde et ledigt værelse af en given type på en given dato
  inden for de næste 31 dage på under 30 sekunder via belægningsplanen.
- **SC-003**: Belægningsplanen med 214 værelser og 31 dage vises på under 2 sekunder, og datoer
  og værelsesnumre forbliver synlige under scroll.
- **SC-004**: I 100 % af testscenarierne matcher ankomster, afrejser, i huset, ledige værelser
  og dagens barsalg en manuel optælling, og ledige + optagede værelser er lig antallet af
  værelser af typen.
- **SC-005**: 100 % af forsøg på at registrere tilfredshed før afrejsedagen eller uden for 1–5
  afvises.
- **SC-006**: Gennemsnitlig kundetilfredshed og antal besvarelser pr. år matcher en manuel
  beregning på et kendt datasæt med 0 afvigelser.
- **SC-007**: En receptionist kan registrere en tilfredshedsscore på under 10 sekunder fra
  overblikket.

## Assumptions

- Featuren bygger videre på 001 (bookinger, barsalg, login) og 004 (opgavens data: 214
  værelser i 8 typer, gæstens navn som fornavn og efternavn). 004 implementeres først.
- "Check-out" er ikke en registreret handling i systemet. En booking er afrejst, når
  afrejsedatoen er i dag eller tidligere (001's afledte status). Tilfredshed registreres derfor
  tidligst på afrejsedagen.
- Der er én score pr. booking, ikke pr. gæst. En score kan rettes, men ikke fjernes igen.
- Opgavens datasæt har ingen tilfredshedsdata. Historiske scores i startdata er genererede og
  markeret som sådan (FR-015).
- Belægningsplanen er kun til visning og navigation. At flytte bookinger mellem værelser ved at
  trække i planen er uden for scope. Systemet tildeler fortsat værelset (001 FR-007).
- Værelser ude af drift og rengøringsstatus modelleres ikke.
- Overblik og plan henter friske data ved hver indlæsning og hvert dato- eller periodeskift. Der
  er ingen automatisk opdatering i baggrunden (som 001 SC-006 og 002's afklaring).
- Overblikket viser ingen nøgletal som belægningsgrad eller indtjening. De hører til i
  dashboardet (feature 002). Undtagelsen er kundetilfredsheden, som tilføjes dashboardets
  nøgletal (US4).
- Denne spec erstatter Assumption-punktet om FT12 i 001 og 002 ("kundetilfredshed er uden for
  scope"). FT12 er nu Must.
- Brugergrænsefladen bruges på desktop i receptionen og følger designsystemet i `docs/design/`.
  Ingen AI-funktionalitet (KB-T8).

## Sporbarhed

| Kilde | Krav | Dækket af |
|---|---|---|
| Opgaven: 214 værelser, 1–4 personer pr. værelse | Plan og ledighed for alle værelser | FR-005–FR-007, SC-003 |
| Opgaven: nøgletal "belægningsgrader, indtjening, kundetilfredshed mm." | Kundetilfredshed registreres og opgøres | FR-011–FR-015, US3, US4 |
| Opgaven: receptionisten Helene Christine står også i lobbyens cocktailbar | Barsiden viser det | FR-016, US5 |
| Opgaven: data opdateres løbende og kan ses live | Friske data ved hver indlæsning | Assumptions, Edge Cases |
| FR1, FR4, FR5 | Receptionisten finder bookinger efter dato | FR-002–FR-004, FR-009 |
| FT4 | Data via API'et, live | FR-014, FR-017 |
| FT12 (Could → Must) | Kundetilfredshed som nøgletal | FR-011–FR-015 |
| KB-A4 | Nøgletal og regler i logiklaget | FR-014, FR-017 |
| KB-T8 | Ingen AI i UI | Assumptions |
| D3 | User stories med INVEST og Given/When/Then | US1–US5 |
