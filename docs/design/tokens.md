# Design-tokens

**`frontend/src/index.css` er single source of truth** for alle værdier (farver, typografi,
radier, skygger og bevægelse). Denne fil beskriver kun rollerne: hvad hvert token bruges til.

Tokens ligger i Tailwind v4's `@theme`, så de virker direkte som klasser: `bg-paper`,
`text-ink-2`, `rounded-2xl`, `shadow-panel`.

## Roller: hvad bruges hvor

### Farver

| Token | Rolle |
|---|---|
| `paper` | Vinduesbaggrund og sidebar (bageste lag) |
| `canvas` | Det store afrundede indholdskort (midterste lag) |
| `surface` | Fliser, inputs, popups (forreste lag, hvid) |
| `sunken` | Hover-baggrund, neutrale badges, grupperækker |
| `line` | Tynde skillestreger, tabelrækker |
| `line-strong` | Kanter på inputs og sekundære knapper |
| `ink` | Primær tekst |
| `ink-2` | Sekundær tekst: beskrivelser, labels, inaktiv navigation |
| `ink-3` | Tertiær tekst: metadata, antal, ikoner, kolonneoverskrifter |
| `ink-4` | Placeholder, "–" i tomme celler |
| `signal` | **Kun** primærknap, fokus, links og aktivt nav-ikon |
| `signal-hover` / `signal-active` | Primærknappens hover- og aktiv-tilstand |
| `signal-soft` | Markering og fokus-halo på inputs |
| `ok` / `-ink` / `-soft` | Positiv status (fx "i huset") |
| `hold` / `-ink` / `-soft` | Advarsel (fx "ankommer i dag") |
| `danger` / `-ink` / `-soft` | Fejl, slet og valideringsfejl |

Statusfarver kommer altid i tre trin: base til markør og ikon, `-ink` til tekst og `-soft` til
pill-baggrund.

Til hover- og aktiv-tilstande bruges gennemsigtig ink i stedet for nye grå: `bg-ink/[0.04]`
(hover i navigation), `bg-ink/[0.07]` (aktiv) og `backdrop:bg-ink/20` (baggrund bag skuffe og dialog, via
`::backdrop`).

### Typografi

- Skrift: Instrument Sans Variable. Kun tre vægte: `font-normal`, `font-medium` og
  `font-semibold`.
- Sidetitel: `text-5xl font-semibold tracking-[-0.035em]`.
- Sektions- og flisetitel: `text-lg`/`text-base font-semibold tracking-[-0.01em]`.
- Store tal (`Stat`): `tnum text-5xl font-semibold tracking-[-0.035em]`.
- Jo større tekst, jo strammere tracking.
- **`tnum` på alle tal**: beløb, datoer, antal og værelsesnumre.

### Størrelser

| Højde | Bruges til |
|---|---|
| `h-8` | Lille knap |
| `h-10` | Normal knap, nav-punkt, visnings-faner |
| `h-11` | Inputs, select |
| `h-12` | Tabel-header |
| `h-16` | Tabelrække |

### Radier

| Radius | Bruges til |
|---|---|
| `rounded-md` (8) | Knapper, inputs |
| `rounded-lg` (10) | Nav-punkter, toasts |
| `rounded-xl` (14) | Bekræftelsesdialog |
| `rounded-2xl` (18) | Fliser (`Tile`) |
| `rounded-3xl` (24) | Indholdskort, skuffe |
| `rounded-full` | Status-pills |

### Skygger

Alle skygger er tonet med `ink`, aldrig sorte.

| Skygge | Bruges til |
|---|---|
| `shadow-panel` | Fliser. Bruges **i stedet for** border |
| `shadow-canvas` | Indholdskortet |
| `shadow-pop` | Dialoger, toasts, skuffe |

### Bevægelse

| Varighed | Bruges til |
|---|---|
| 100ms | Farveskift ved hover: `transition-colors duration-100` |
| 150ms | Bekræftelsesdialog ind: `transition-[opacity,scale] duration-150 starting:scale-95 starting:opacity-0` |
| 200ms | Skuffen glider ind: `transition-[translate] duration-200 ease-out starting:translate-x-8` |

Bevægelse er almindelige CSS-transitions. `starting:` er Tailwinds variant for
`@starting-style`, så animationen kører, når `<dialog>` åbnes med `showModal()`. Lukning sker
uden animation.
