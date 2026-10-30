# Back office – design og principper

Her beskrives designsystemet for back office-frontenden (React + Tailwind). Mappen er
selvstændig: alt, der skal til for at bygge UI'et, står her.

| Fil | Indhold |
|---|---|
| `README.md` (denne) | Principperne: *hvorfor* det ser ud og opfører sig, som det gør |
| [`tokens.md`](tokens.md) | Roller for farver, typografi, radier, skygger og bevægelse (værdierne bor i `frontend/src/index.css`) |
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
   links og aktivt nav-punkt. Resten er gråtoner, der alle stammer fra samme blålige nuance.
   Ser noget ud til at mangle farve, er svaret næsten altid en gråtone, ikke en ny farve.

3. **Status vises med form før farve.** En statusmarkør er en lille firkant, hvis *form*
   fortæller tilstanden (ring, fyldt). Farve kommer bagefter, og der er altid en tekst-label
   ved siden af. Det kan læses i gråtoner og af farveblinde.

4. **Tal er førsteklasses.** Alle tal har `tnum` (tabeltal, så cifre står under hinanden).
   Beløb er højrestillede og formateres ét sted (`format.js`). Lister viser summen fra API'et i
   bunden.

5. **Hierarki med gråtoner, ikke med fed skrift eller farver.** Der er fire tekstniveauer
   (`ink` → `ink-4`) og tre vægte (normal/medium/semibold). Et antal ved siden af en titel
   skrives i lysere `ink-3`, ikke i fed.

6. **Behagelig tæthed.** Brødtekst er 15px, og intet er mindre end 12px. Knapper og felter er
   40–44px høje, og tabelrækker er 64px. Rolig frem for proppet, for receptionen bruger
   systemet hele dagen.

7. **Native og tilgængeligt som udgangspunkt.** Brug native inputs (`type="date"`,
   `<select>`), der læses via `FormData`. Skuffe og bekræftelse er native `<dialog>`, og toasten
   er en lille komponent i `Shell.jsx`. Brug `aria-invalid`, `role="alert"`, `aria-sort`, en
   global fokus-ring og respekt for reduceret bevægelse.

8. **Hurtig, stille bevægelse.** 100ms på hover og 150ms på dialogen med en lille skalering.
   Skuffen glider kort ind. Alt er almindelige CSS-transitions, og lukning sker uden animation.

9. **Vis kun det, der hjælper.** Skjul kolonner, der ikke betyder noget i den aktuelle visning,
   og vis kun årstal, når det ikke er indeværende år. En tom tilstand er én linje plus én
   handling.

10. **Næste skridt er tydeligt, og alt giver feedback.** Hver handling ender med en toast, der
    nævner hvad og hvem ("Booking oprettet – Jensen, 10.–12. mar."). Beregnede værdier (pris og
    nætter) hentes live fra API'et, mens der tastes.

11. **URL'en er tilstanden.** Søgning, filtre og visning ligger i URL'en (`?q=…&dato=…`), så en
    visning kan deles og genindlæses. Ved indtastning bruges `replace: true`, så historikken
    ikke fyldes op.

12. **Dansk og lokale formater.** Danske ugedage, `da-DK`-valuta ("1.800 kr."), datoer som
    "tir. 10. mar." og danske URL'er (`/bookinger`, `/barsalg`).

13. **Bekræft det destruktive, valider tæt på feltet.** Sletning kræver en dialog, der gentager
    hvad der slettes. Fejl fra API'et vises under det felt, de handler om. Backend er
    autoriteten. Frontend regner, tæller og summerer ikke selv, og fejltekster kommer altid fra
    API'ets `error.message` (eneste undtagelse: et fejlsvar uden JSON, se `api.js`). Frontendens egne tekster er kun overskrifter, knapper, tomme
    tilstande og succes-toasts.

## Afhængigheder (frontend)

**Tilladt:**

- `react`, `react-dom`, `react-router`
- `tailwindcss` v4 + `@tailwindcss/vite`, `vite`, `@vitejs/plugin-react`
- `@phosphor-icons/react`: ikoner
- `@fontsource-variable/instrument-sans`: skrifttype, hostet lokalt

**Ikke** (fravalgt med vilje):

- `@base-ui/react` og andre headless-biblioteker: native `<dialog>` og `<select>` dækker skuffe,
  bekræftelse og valg af land og værelse. Toasten er få linjer i `Shell.jsx`.
- `clsx`/`tailwind-merge`/`cva`: en `cx()` på én linje er nok.
- Formular-, dato- eller state-biblioteker: `FormData`, `Intl` og `useState` er nok.
- Graf-biblioteker: grafer hører til i Tableau, ikke i back office.
- Kommandopalet (`cmdk`): Den er god, men ikke et krav. Tilføj den, hvis der bliver tid.
- TypeScript: Vi skriver JavaScript, se `docs/retningslinjer/kodekvalitet.md`.
- Dark mode og mobilvisning: ikke krav. Back office er kun til desktop.

## Filstruktur (frontend)

Fladt. Opret kun en undermappe, når en mappe bliver uoverskuelig.

```
frontend/src/
  main.jsx        router + login-guard (loader)
  index.css       tokens (@theme) – single source of truth for design
  ui.jsx          alle delte primitiver (Button, Tile, Stat, EmptyState …)
  format.js       kr(), date(), period() … – al formatering ét sted
  api.js          ÉT modul til alle kald mod backend
  Shell.jsx       sidebar + indholdskort + toast-provider
  BookingForm.jsx skuffe-formular til opret OG rediger
  pages/          én fil pr. route
```
