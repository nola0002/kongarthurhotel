# Design-tokens

Kopieret fra Roster (`src/index.css`). Når frontenden er oprettet, er
**`frontend/src/index.css` single source of truth**. Hvis en værdi ændres dér, opdateres denne
fil, eller også slettes tabellen og der henvises til CSS-filen.

Tokens ligger i Tailwind v4's `@theme`, så de virker direkte som klasser: `bg-paper`,
`text-ink-2`, `rounded-2xl`, `shadow-panel`.

## `index.css` (klar til at kopiere)

```css
@import '@fontsource-variable/instrument-sans';
@import 'tailwindcss';

/*
  Neutral surfaces, one accent (signal blue).
  Status is encoded by shape first, colour second.
*/
@theme {
  --font-sans: 'Instrument Sans Variable', ui-sans-serif, system-ui, sans-serif;

  /* Layers, back to front: paper (window + sidebar) → canvas (the big card) → surface (tiles). */
  --color-paper: oklch(0.988 0.002 264);
  --color-canvas: oklch(0.948 0.005 264);
  --color-surface: oklch(1 0 0);
  --color-sunken: oklch(0.965 0.003 264);
  --color-line: oklch(0.912 0.003 264);
  --color-line-strong: oklch(0.85 0.003 264);

  --color-ink: oklch(0.235 0.028 264);
  --color-ink-2: oklch(0.45 0.018 264);
  --color-ink-3: oklch(0.58 0.012 264);
  --color-ink-4: oklch(0.72 0.008 264);

  /* Focus, selection, links. Used sparingly. */
  --color-signal: oklch(0.52 0.19 264);
  --color-signal-soft: oklch(0.95 0.03 264);

  /* Status. Always paired with a label and a shape. */
  --color-hold: oklch(0.76 0.15 75);
  --color-hold-ink: oklch(0.47 0.11 65);
  --color-hold-soft: oklch(0.96 0.04 85);
  --color-ok: oklch(0.56 0.12 155);
  --color-ok-ink: oklch(0.42 0.1 155);
  --color-ok-soft: oklch(0.95 0.035 155);
  --color-danger: oklch(0.54 0.19 25);
  --color-danger-ink: oklch(0.47 0.17 25);
  --color-danger-soft: oklch(0.96 0.03 25);

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 10px;
  --radius-xl: 14px;
  --radius-2xl: 18px;
  --radius-3xl: 24px;

  /* Type scale. Body is 15px; nothing below 12px. */
  --text-xs: 0.75rem;
  --text-xs--line-height: 1rem;
  --text-sm: 0.875rem;
  --text-sm--line-height: 1.25rem;
  --text-base: 0.9375rem;
  --text-base--line-height: 1.5rem;
  --text-lg: 1.0625rem;
  --text-lg--line-height: 1.5rem;
  --text-xl: 1.25rem;
  --text-xl--line-height: 1.75rem;
  --text-2xl: 1.5rem;
  --text-2xl--line-height: 2rem;
  --text-3xl: 1.75rem;
  --text-3xl--line-height: 2.25rem;
  --text-4xl: 2.25rem;
  --text-4xl--line-height: 2.5rem;
  --text-5xl: 2.75rem;
  --text-5xl--line-height: 1.1;

  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);

  --shadow-panel: 0 0 0 1px oklch(0.235 0.028 264 / 0.045), 0 1px 2px oklch(0.235 0.028 264 / 0.03);
  --shadow-canvas: 0 0 0 1px oklch(0.235 0.028 264 / 0.07), 0 1px 2px oklch(0.235 0.028 264 / 0.05), 0 8px 24px -8px oklch(0.235 0.028 264 / 0.1);
  --shadow-pop: 0 1px 2px oklch(0.235 0.028 264 / 0.06), 0 8px 24px -6px oklch(0.235 0.028 264 / 0.16);
}

@layer base {
  html {
    background: var(--color-paper);
    color: var(--color-ink);
    font-family: var(--font-sans);
    font-size: 16px;
  }
  body {
    font-size: var(--text-base);
    line-height: var(--text-base--line-height);
    -webkit-font-smoothing: antialiased;
  }
  #root { isolation: isolate; }
  ::selection { background: var(--color-signal-soft); }
  :focus-visible {
    outline: 2px solid var(--color-signal);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      transition-duration: 1ms !important;
      animation-duration: 1ms !important;
    }
  }
}

@utility tnum {
  font-variant-numeric: tabular-nums;
}
```

Fjernet i forhold til Roster: `--text-6xl` og `hatch`-mønstret (Rosters "option"-status), som
vi ikke har brug for.

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
| `signal-soft` | Markering og fokus-halo på inputs |
| `ok` / `-ink` / `-soft` | Positiv status (fx "i huset") |
| `hold` / `-ink` / `-soft` | Advarsel (fx "ankommer i dag") |
| `danger` / `-ink` / `-soft` | Fejl, slet og valideringsfejl |

Statusfarver kommer altid i tre trin: base til markør og ikon, `-ink` til tekst og `-soft` til
pill-baggrund.

Til hover- og aktiv-tilstande bruges gennemsigtig ink i stedet for nye grå: `bg-ink/[0.04]`
(hover i navigation), `bg-ink/[0.07]` (aktiv) og `bg-ink/20` (baggrund bag skuffe og dialog).

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
| `h-8` | Lille knap, menupunkt |
| `h-10` | Normal knap, nav-punkt, visnings-faner |
| `h-11` | Inputs, select |
| `h-12` | Tabel-header |
| `h-16` | Tabelrække |

### Radier

| Radius | Bruges til |
|---|---|
| `rounded-md` (8) | Knapper, inputs |
| `rounded-lg` (10) | Nav-punkter, menuer, toasts |
| `rounded-xl` (14) | Select-popup |
| `rounded-2xl` (18) | Fliser (`Tile`/`Panel`) |
| `rounded-3xl` (24) | Indholdskort, skuffe |
| `rounded-full` | Status-pills |

### Skygger

Alle skygger er tonet med `ink`, aldrig sorte.

| Skygge | Bruges til |
|---|---|
| `shadow-panel` | Fliser. Bruges **i stedet for** border |
| `shadow-canvas` | Indholdskortet |
| `shadow-pop` | Menuer, dialoger, toasts, skuffe |

### Bevægelse

| Varighed | Bruges til |
|---|---|
| 100ms | Farveskift ved hover: `transition-colors duration-100` |
| 150ms | Popups ind/ud: `transition-[opacity,scale]`, start og slut `scale-95 opacity-0` |
| 420ms | Skuffen glider ind: `cubic-bezier(0.32,0.72,0,1)` |

Base UI styres via `data-starting-style:`/`data-ending-style:`-attributter.
