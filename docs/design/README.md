# Back office – design og principper

Back office-frontenden (React + Tailwind) genbruger designet fra **Roster**
(`~/Developer/Roster`), et færdigt back office til booking af koncerter. Vi kopierer det
gennemprøvede i stedet for at designe fra bunden. Det er "genbrug frem for nyt" anvendt på
UI.

| Fil | Indhold |
|---|---|
| `README.md` (denne) | Principperne: *hvorfor* det ser ud og opfører sig, som det gør |
| [`tokens.md`](tokens.md) | Farver, typografi, radier, skygger og bevægelse, klar til at kopiere ind i `index.css` |
| [`komponenter.md`](komponenter.md) | UI-primitiver og opskrifter: knap, input, tabel, skuffe-formular, bekræftelse, toast m.m. |
| [`skaerme.md`](skaerme.md) | Kong Arthurs skærme og flows koblet til kravene i `specs/001-backoffice-bookinger` |

Retningslinjerne i `docs/retningslinjer/` gælder også her. Denne mappe beskriver kun det
visuelle og UX'en.

## Principper

Hvert princip har et konkret eksempel. Er du i tvivl om en designbeslutning, så find det
princip, der afgør den.

1. **Dybde i tre lag i stedet for streger.** Baggrund `paper` → indholdskort `canvas` →
   fliser `surface`. Fliser adskilles med en tynd skygge-ring (`shadow-panel`), ikke med
   borders. Hele indholdsområdet er ét svævende, afrundet kort ved siden af en flad sidebar.

2. **Én accentfarve, brugt sparsomt.** `signal`-blå bruges kun til primær handling, fokus,
   links og aktivt menupunkt. Resten er gråtoner, der alle stammer fra samme blålige nuance.
   Ser noget ud til at mangle farve, er svaret næsten altid en gråtone, ikke en ny farve.

3. **Status vises med form før farve.** En statusmarkør er en lille firkant, hvis *form*
   fortæller tilstanden (ring, fyldt, stiplet). Farve kommer bagefter, og der er altid en
   tekst-label ved siden af. Det kan læses i gråtoner og af farveblinde.

4. **Tal er førsteklasses.** Alle tal har `tnum` (tabeltal, så cifre står under hinanden).
   Beløb er højrestillede og formateres ét sted (`format.js`). Lister viser sum i bunden.

5. **Hierarki med gråtoner, ikke med fed skrift eller farver.** Der er fire tekstniveauer
   (`ink` → `ink-4`) og tre vægte (normal/medium/semibold). Et antal ved siden af en titel
   skrives i lysere `ink-3`, ikke i fed.

6. **Behagelig tæthed.** Brødtekst er 15px, og intet er mindre end 12px. Knapper og felter er
   40–44px høje, og tabelrækker er 64px. Rolig frem for proppet, for receptionen bruger
   systemet hele dagen.

7. **Native og tilgængeligt som udgangspunkt.** Brug native inputs (`type="date"`,
   `<select>`), der læses via `FormData`. Headless Base UI bruges kun, hvor native ikke rækker
   (skuffe, bekræftelsesdialog, select med søgning, toast). Brug `aria-invalid`,
   `role="alert"`, `aria-sort`, en global fokus-ring og respekt for reduceret bevægelse.

8. **Hurtig, stille bevægelse.** 100ms på hover og 150ms på popups med en lille skalering. Det
   eneste udtryksfulde er skuffen, der glider ind.

9. **Vis kun det, der hjælper.** Skjul kolonner, der ikke betyder noget i den aktuelle visning,
   og vis kun årstal, når det ikke er indeværende år. En tom tilstand er én linje plus én
   handling.

10. **Næste skridt er tydeligt, og alt giver feedback.** Hver handling ender med en toast, der
    nævner hvad og hvem ("Booking oprettet – Jensen, 10.–12. mar."). Beregnede værdier (pris)
    vises live, mens der tastes.

11. **URL'en er tilstanden.** Søgning, filtre og visning ligger i URL'en (`?q=…&dato=…`), så en
    visning kan deles og genindlæses. Ved indtastning bruges `replace: true`, så historikken
    ikke fyldes op.

12. **Dansk og lokale formater.** Danske ugedage, `da-DK`-valuta ("1.800 kr."), relative datoer
    ("i morgen") og danske URL'er (`/bookinger`, `/barsalg`).

## Hvor Kong Arthur afviger fra Roster

Roster er en mock uden backend. Tre ting mangler dér, og vores krav kræver dem:

| Mangler i Roster | Kong Arthur gør | Krav |
|---|---|---|
| Ingen redigering, kun oprettelse | Samme skuffe-formular bruges til både opret og rediger | FR-004 |
| Destruktive handlinger uden bekræftelse | `AlertDialog`, der gentager gæst og periode, med rød bekræftknap | FR-005 |
| Ingen inline-fejl, kun deaktiveret knap | Fejl fra API'et vises under feltet med `aria-invalid` og `role="alert"` | FR-014 |
| Mock-data og falsk login | Data fra REST API'et og rigtigt login mod backend | FR-015 |
| Ingen loading- eller fejltilstande | Knap deaktiveres med spinner under kald, og der vises en fejl-toast | – |
| Advarer, men blokerer ikke ved konflikt | **Backend blokerer** (kapacitet, udsolgt). Frontend viser bare fejlen | FR-006/007 |
| Udregninger i frontend (provision) | Pris hentes fra API'et, frontend regner ingenting | A4, princip III |

## Afhængigheder (frontend)

**Tilladt**, fordi det er det, Roster er bygget på, og det er gennemprøvet:

- `react`, `react-dom`, `react-router`
- `tailwindcss` v4 + `@tailwindcss/vite`, `vite`, `@vitejs/plugin-react`
- `@base-ui/react`: headless og tilgængelig. Bruges til Drawer, AlertDialog, Select,
  Toast og Menu.
- `@phosphor-icons/react`: ikoner
- `@fontsource-variable/instrument-sans`: skrifttype, hostet lokalt

**Ikke** (fravalgt med vilje, ligesom i Roster):

- `clsx`/`tailwind-merge`/`cva`: en `cx()` på én linje er nok.
- Formular-, dato- eller state-biblioteker: `FormData`, `Intl` og `useState` er nok.
- `recharts`: grafer hører til i Tableau, ikke i back office.
- `cmdk`-kommandopalet: Den er god, men ikke et krav. Tilføj den, hvis der bliver tid.
- TypeScript: Vi skriver JavaScript, se `docs/retningslinjer/kodekvalitet.md`.
- Dark mode: Roster har det ikke, og det har vi heller ikke.

## Filstruktur (frontend)

Fladt som i Roster. Opret kun en undermappe, når en mappe bliver uoverskuelig.

```
frontend/src/
  main.jsx        router + login-guard (loader)
  index.css       tokens (@theme) – single source of truth for design
  ui.jsx          alle delte primitiver (Button, Tile, Stat, EmptyState …)
  format.js       kr(), date(), relative() … – al formatering ét sted
  api.js          ÉT modul til alle kald mod backend
  Shell.jsx       sidebar + indholdskort + toast-provider
  BookingForm.jsx skuffe-formular til opret OG rediger
  pages/          én fil pr. route
```
