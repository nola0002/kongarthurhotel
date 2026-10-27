# Komponenter og opskrifter

**Genbrug først.** Alt herunder findes i Roster (`~/Developer/Roster/src/`). Kopiér derfra,
fjern TypeScript-typerne og tilpas teksterne. Skriv det ikke fra bunden. Fil og linje står ved
hvert punkt.

Delte primitiver ligger samlet i **én** fil: `frontend/src/ui.jsx`. Tabeller, dialoger og
selects skrives direkte, hvor de bruges, ud fra opskrifterne nedenfor. Lav først en
fælles komponent, når samme opskrift går igen 2–3 steder.

## Primitiver (`ui.jsx`)

| Komponent | Kilde i Roster | Brug |
|---|---|---|
| `cx(...c)` | `ui.tsx:6` | `c.filter(Boolean).join(' ')`. Erstatter clsx |
| `buttonClass(variant, size)`, `Button`, `ButtonLink` | `ui.tsx:8-31` | Varianter: `primary`, `secondary`, `ghost`. Størrelser: `sm`, `md`, `icon` |
| `PageHeader` | `ui.tsx:140` | Stor H1, beskrivelse og handlinger til højre |
| `SectionHeading` | `ui.tsx:152` | H2 med antal i `ink-3` |
| `Panel`, `Tile` | `ui.tsx:164-195` | Hvide kort med `shadow-panel`. `Tile flush` bruges til tabeller |
| `Stat` | `ui.tsx:197` | Stort tal med label og kontekst-linje |
| `EmptyState` | `ui.tsx:209` | Titel, én linje og én handling. Ingen illustration |
| `Field` | `ui.tsx:220` | Label/værdi-række i en `<dl>` på detaljesider |
| `inputClass`, `labelClass` | `ui.tsx:231-234` | Klassestrenge til native `<input>`/`<select>`. Ingen `<Input>`-komponent |
| `Kbd` | `ui.tsx:33` | Tastaturgenvej-badge (fx `Esc`) |

Tilføjes til Kong Arthur:

- `buttonClass` får en **`danger`-variant** til slet-bekræftelse:
  `bg-danger text-white hover:bg-danger-ink`.
- `StatusBadge` til opholdsstatus (se `skaerme.md`). Det er samme opbygning som Rosters
  `StatusSwatch`/`StatusBadge` (`ui.tsx:43-87`), med form før farve.

### Knap (JavaScript-version)

```jsx
export const cx = (...c) => c.filter(Boolean).join(' ')

export const buttonClass = (variant = 'secondary', size = 'md') =>
  cx(
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium select-none',
    'transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50',
    size === 'sm' && 'h-8 px-3 text-sm',
    size === 'md' && 'h-10 px-4 text-[0.9375rem]',
    size === 'icon' && 'size-10',
    variant === 'primary' && 'bg-signal text-white hover:bg-[oklch(0.47_0.19_264)] active:bg-[oklch(0.43_0.18_264)]',
    variant === 'secondary' && 'border border-line-strong bg-surface text-ink shadow-[0_1px_1px_oklch(0.235_0.028_264/0.04)] hover:bg-sunken active:bg-line',
    variant === 'ghost' && 'text-ink-2 hover:bg-sunken hover:text-ink active:bg-line',
    variant === 'danger' && 'bg-danger text-white hover:bg-danger-ink',
  )

export function Button({ variant, size, className, ...props }) {
  return <button type="button" className={cx(buttonClass(variant, size), className)} {...props} />
}
```

## Formatering (`format.js`)

Kopiér `format.ts` fra Roster. Alle tal og datoer formateres **kun** her.

| Funktion | Eksempel |
|---|---|
| `kr(n)` | `1800` → "1.800 kr." (`da-DK`, 0 decimaler) |
| `num(n)` | `1234` → "1.234" |
| `date(iso, opts?)` | `'2026-03-10'` → "tir. 10. mar." |
| `longDate(iso)` | "tirsdag 10. marts 2026" |
| `relative(iso)` | "i morgen", "om 3 dage", "for 2 dage siden" |
| `toDate(iso)` | Sætter klokken til 12:00, så sommertid aldrig flytter datoen |

Forskel fra Roster: `TODAY` er den **rigtige** dato (`new Date()`), ikke en fast mock-dato.

## API-klient (`api.js`)

Roster har ingen. Det er Kong Arthurs eneste vej til data (single source of truth for
base-URL, JSON og fejl):

```js
// All backend calls go through here: one place for base URL, JSON and the error format.
const BASE = import.meta.env.VITE_API_URL

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  const data = await res.json()
  if (!res.ok) throw Object.assign(new Error(data.error?.message), data.error)
  return data
}
```

En fejl indeholder `{ code, message, field }` fra backendens fælles fejlformat
(`kodekvalitet.md` §3). `field` bruges til at vise fejlen under det rigtige felt.

## Opskrifter

### Tabel (bookinglisten)

Kilde: `pages/Bookings.tsx`. Tabellen ligger i `<Tile flush>`.

- `<table className="w-full border-separate border-spacing-0">` med sticky `thead`.
- Header-celler: `h-12 border-b border-line bg-surface px-4 text-sm font-medium text-ink-3`.
  Første og sidste kolonne får `pl-6`/`pr-6`.
- Rækker: `h-16 border-b border-line hover:[&>td]:bg-sunken/60`. Hele rækken er klikbar, og
  der er et rigtigt `<Link>` i navnecellen for tastatur og midterklik.
- Beløb: højrestillet + `tnum`. Tomme celler: "–" i `text-ink-4`.
- Sortérbare kolonner: `aria-sort` med Caret-ikoner (`SortHeader`, `Bookings.tsx:184-196`).
- Valgfrit: gruppér pr. måned med `Map.groupBy` og vis subtotal (`Bookings.tsx:152-161`).
- `<tfoot>` med antal og sum.
- Under `md` erstattes tabellen af en kortliste (`MobileList`, `Bookings.tsx:293-331`).
- Ingen paginering.

### Søgning og filtre i URL'en

Kilde: `Bookings.tsx:50-55, 114-124`.

```jsx
const [params, setParams] = useSearchParams()
const setParam = (key, value) =>
  setParams((p) => { value ? p.set(key, value) : p.delete(key); return p }, { replace: true })
```

- Søgefelt: `<input type="search">` med forstørrelsesglas-ikon (`pl-10`, `sm:w-80`).
- Dato-filter: native `<input type="date">`.
- Filtreringen sker i **backend** (`GET /bookings?q=…&date=…`), ikke i React. Frontend sender
  bare URL-parametrene videre.

### Opret/rediger-formular i skuffe

Kilde: `NewBooking.tsx` (Base UI `Drawer` fra højre, `max-w-[560px] rounded-3xl`).

- **Samme komponent til opret og rediger.** Får den en `booking`-prop, udfyldes felterne
  (`defaultValue`), og der sendes `PUT /api/bookings/:id` i stedet for `POST /api/bookings`.
- Opbygning: `<form>` med sticky header (titel + luk-X), scrollbar body med `Section`-blokke
  (`space-y-9`) og sticky footer (Annullér + primær Gem).
- Ukontrollerede native inputs, der læses med `new FormData(e.currentTarget)`.
- Datoer: `<input type="date" required>`. Antal gæster: `<input type="number" min="1" required>`.
- Værelsestype: radio-kort-grid (`NewBooking.tsx:87-107`). Hvert kort viser navn, kapacitet og
  pris pr. nat. Valgt kort: `bg-signal-soft ring-1 ring-signal/40`.
- Land: Base UI `Combobox` med søgning (`NewBooking.tsx:259-293`).
- **Live prisvisning:** En `<dl>`-boks nederst (`NewBooking.tsx:218-222`) viser nætter, pris
  pr. nat pr. sæson og total. Tallene hentes fra API'et (`GET /bookings/quote?...`), når type
  og datoer er udfyldt. Vis "–", indtil der er en pris. **Frontend regner aldrig prisen ud.**
- Skuffen lukkes med Esc, Annullér, X eller klik på baggrunden. Formularen nulstilles først
  *efter* lukke-animationen (`onOpenChangeComplete`).

### Inline-validering (mangler i Roster)

Mønstret fra `Login.tsx:99-117`, udvidet til at gælde alle felter:

```jsx
<input name="guests" className={inputClass} aria-invalid={error?.field === 'guests' || undefined}
       aria-describedby={error?.field === 'guests' ? 'guests-error' : undefined} />
{error?.field === 'guests' && (
  <p id="guests-error" role="alert" className="mt-1.5 text-sm text-danger">{error.message}</p>
)}
```

- `inputClass` farver allerede kanten rød via `aria-invalid:border-danger`.
- Fejl uden `field` (fx "ingen ledige værelser") vises som banner øverst i formularen:
  `role="alert" bg-danger-soft text-danger-ink rounded-lg p-3`.
- Fejlen fjernes, når brugeren ændrer feltet.
- HTML-attributterne `required` og `min` er kun hjælp. **Backendens besked er sandheden.**

### Bekræft sletning (mangler i Roster)

Base UI `AlertDialog`, opbygget med Rosters popup-opskrift (`rounded-xl border border-line
bg-surface shadow-pop`, backdrop `bg-ink/20`).

- Titel: "Slet booking?"
- Brødtekst, der gentager **hvad** der slettes: "Jensen · Dobbeltværelse · 10.–12. mar. 2026.
  Tilknyttede barsalg bevares." (FR-005, FR-010a)
- Knapper: `secondary` "Annullér" (fokus som standard) og `danger` "Slet booking".
- Under sletning er knappen deaktiveret og viser en spinner. Ved succes lukker dialogen, der
  vises en toast, og listen opdateres.

### Toast

Kilde: `Shell.tsx` (Base UI `Toast.Provider limit={1}`, nederst til højre).

- Succes: grønt `CheckCircle` (fill), titel og beskrivelse, der nævner målet:
  "Booking oprettet" / "Jensen, 10.–12. mar."
- Fejl: samme opbygning med `danger`-ikon og API'ets fejlbesked.

### Tom tilstand

`EmptyState` med årsag og vej videre:

- Ingen søgeresultater: `Ingen bookinger matcher "jens".` + "Ryd søgning".
- Ingen bookinger overhovedet: "Ingen bookinger endnu." + "Ny booking".
- Booking findes ikke (slettet): "Bookingen findes ikke længere." + "Tilbage til bookinger".

### Loading

Roster har ingen loading-tilstande. Kong Arthur bruger:

- Liste: behold de gamle rækker og dæmp dem (`opacity-60`) under nyt kald. Ingen skeletons.
- Knap: `disabled` + `SpinnerGap className="animate-spin"` + tekst i nutid ("Gemmer…").
