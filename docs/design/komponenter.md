# Komponenter og opskrifter

Delte primitiver ligger samlet i **én** fil: `frontend/src/ui.jsx`. Tabeller og dialoger
skrives direkte, hvor de bruges, ud fra opskrifterne nedenfor. Lav først en fælles komponent,
når samme opskrift går igen 2–3 steder. Klasserne herunder er specifikationen og skal bruges,
som de står.

Kodeblokkene er udgangspunktet. Efter implementeringen erstattes de af henvisninger til
`frontend/src/ui.jsx`, `frontend/src/format.js` og `frontend/src/api.js` (det gør en task i
`specs/001-backoffice-bookinger/tasks.md`), så koden kun findes ét sted (SSOT).

## Primitiver (`ui.jsx`)

### Knapper

```jsx
export const cx = (...c) => c.filter(Boolean).join(' ')

export const buttonClass = (variant = 'secondary', size = 'md') =>
  cx(
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium select-none',
    'transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50',
    size === 'sm' && 'h-8 px-3 text-sm',
    size === 'md' && 'h-10 px-4 text-[0.9375rem]',
    size === 'icon' && 'size-10',
    variant === 'primary' && 'bg-signal text-white hover:bg-signal-hover active:bg-signal-active',
    variant === 'secondary' && 'border border-line-strong bg-surface text-ink shadow-[0_1px_1px_oklch(0.235_0.028_264/0.04)] hover:bg-sunken active:bg-line',
    variant === 'ghost' && 'text-ink-2 hover:bg-sunken hover:text-ink active:bg-line',
    variant === 'danger' && 'bg-danger text-white hover:bg-danger-ink',
  )

export function Button({ variant, size, className, ...props }) {
  return <button type="button" className={cx(buttonClass(variant, size), className)} {...props} />
}

export function ButtonLink({ variant, size, className, ...props }) {
  return <Link className={cx(buttonClass(variant, size), className)} {...props} />
}
```

Ikoner i sekundære knapper har `text-ink-3`. Ikonstørrelse er 16–17px i knapper og inputs.

### Øvrige primitiver

| Komponent | Props | Klasser og opbygning |
|---|---|---|
| `Kbd` | `children` | `inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-line-strong bg-surface px-1 text-xs text-ink-3` |
| `PageHeader` | `title, description?, actions?` | Container `flex flex-wrap items-end justify-between gap-4 pb-10`. H1 `text-5xl font-semibold tracking-[-0.035em]`. Beskrivelse `mt-2 text-lg text-ink-2`. Handlinger `flex gap-2.5` |
| `SectionHeading` | `title, count?, action?` | `flex min-h-9 items-center justify-between`. H2 `text-lg font-semibold tracking-[-0.01em]`. Antal `tnum ml-2 font-normal text-ink-3` |
| `Panel` | div-props | `rounded-2xl bg-surface shadow-panel` |
| `Tile` | `title?, count?, action?, flush?, className, children` | `flex min-w-0 flex-col rounded-2xl bg-surface shadow-panel`. Header `flex min-h-14 items-center justify-between px-6 pt-5 pb-1` med H2 `text-base font-semibold` + antal + handling. Body `px-6 pb-6` (`pt-6` uden titel). `flush` fjerner body-padding (tabeller og lister kant-til-kant) |
| `Stat` | `label, value, context?, tone?: 'danger' \| 'ok'` | Label `text-sm text-ink-2`. Værdi `tnum mt-1 text-5xl font-semibold tracking-[-0.035em]`. Kontekst `mt-2 text-sm` i `text-ink-3`, eller `text-danger-ink`/`text-ok-ink` efter `tone` |
| `EmptyState` | `title, body?, action?` | Centreret `flex flex-col items-center px-6 py-14 text-center`. Titel `text-lg font-medium`. Body `mt-1 max-w-sm text-ink-2`. Handling `mt-4`. Ingen illustration |
| `Field` | `label, children` | `<div className="flex items-baseline justify-between gap-4 py-3"><dt className="text-ink-2">…</dt><dd className="tnum text-right text-ink">…</dd></div>` i en `<dl className="divide-y divide-line">` |
| `inputClass` | – | `h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-ink placeholder:text-ink-4 hover:border-ink-4 focus:border-signal focus:outline-none focus:ring-3 focus:ring-signal-soft aria-invalid:border-danger` |
| `labelClass` | – | `mb-2 block text-sm font-medium text-ink` |

Der er ingen `<Input>`-komponent. Brug native `<input className={inputClass}>`.

### `StatusBadge` (opholdsstatus, form før farve)

Status-tabellen findes kun her. `status` kommer fra API'et (`booking.status`, afledt i
backend). Frontend udleder aldrig status af datoerne.

Pill: `inline-flex h-7 items-center gap-2 rounded-full px-3 text-sm font-medium`. Den indeholder
en markør (`size-2.5 rounded-[3px]`) og en label.

| `status` | Label | Markør | Pill |
|---|---|---|---|
| `upcoming` | Kommende | `ring-[1.5px] ring-inset ring-ink-3` (ring) | `bg-sunken text-ink` |
| `arriving` | Ankommer i dag | `ring-[1.5px] ring-inset ring-hold` (ring) | `bg-hold-soft text-hold-ink` |
| `in_house` | I huset | `bg-ok` (fyldt) | `bg-ok-soft text-ok-ink` |
| `departed` | Afrejst | `bg-ink-4` (fyldt) | `bg-sunken text-ink-3` |

## Formatering (`format.js`)

Alle tal og datoer formateres **kun** her. `Intl`-instanserne oprettes én gang på modulniveau.

```js
const krFmt = new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 })
const numFmt = new Intl.NumberFormat('da-DK')
const rel = new Intl.RelativeTimeFormat('da', { numeric: 'auto' })
```

| Funktion | Eksempel |
|---|---|
| `kr(n)` | `1800` → "1.800 kr." |
| `num(n)` | `1234` → "1.234" |
| `toDate(iso)` | `new Date(iso + 'T12:00:00')`. Klokken 12, så sommertid aldrig flytter datoen |
| `date(iso, opts?)` | Standard `{ weekday: 'short', day: 'numeric', month: 'short' }`: "tir. 10. mar." |
| `longDate(iso)` | "tirsdag 10. marts 2026" |
| `relative(iso)` | "i morgen", "om 3 dage", "for 2 dage siden" (dage fra `TODAY`) |
| `isoWeek(iso)` | ISO 8601-ugenummer, fx "uge 11" |
| `nightsLabel(n)` | "1 nat" / "3 nætter" |

`TODAY = new Date().toLocaleDateString('sv-SE')` er dags dato i lokal tid (`YYYY-MM-DD`). Den
bruges kun til visning (relative datoer og årstal). Status kommer fra API'et. Datoer er altid
ISO-strenge, og årstal vises kun, når det ikke er indeværende år. `nightsLabel` formaterer kun
et antal fra API'et (`booking.nights`, `quote.nights`). Frontend regner aldrig nætter ud.

## API-klient (`api.js`)

Den eneste vej til data. Base-URL, JSON og fejl håndteres ét sted:

```js
// All backend calls go through here: one place for base URL, JSON and the error format.
const BASE = '/api'

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  const data = await res.json()
  if (!res.ok) throw Object.assign(new Error(data.error?.message), data.error, { status: res.status })
  return data
}
```

En fejl indeholder `{ code, message, field }` fra backendens fælles fejlformat
(`kodekvalitet.md` §3) og `status`. `message` er den tekst, der vises. Frontend har ingen egne
fejltekster. `field` bruges til at vise fejlen under det rigtige felt.

## Shell

Kilde: `Shell.jsx`. Kun desktop, der er ingen mobilvisning.

- Ramme: `grid h-dvh grid-cols-[264px_1fr] overflow-hidden`.
- Sidebar: `flex flex-col px-4 py-5` på `paper`, oppefra:
  - Ordmærke "Kong Arthur": `text-xl font-semibold tracking-[-0.02em]`.
  - Navigation: **Bookinger** (`/bookinger`) og **Barsalg** (`/barsalg`).
  - Nav-punkt: `flex h-10 items-center gap-3 rounded-lg px-3`, Phosphor-ikon 20px.
  - Inaktivt punkt: `text-ink-2 hover:bg-ink/[0.04]`, ikon `text-ink-3`.
  - Aktivt punkt: `bg-ink/[0.07] font-medium text-ink`, ikon `weight="fill" text-signal`.
  - Nederst (`mt-auto`): den indloggede konto i `text-sm text-ink-2` og en `ghost`-knap
    "Log ud".
- Indholdskort (`<main>`): `my-2 mr-2 h-[calc(100dvh-1rem)] overflow-y-auto rounded-3xl bg-canvas shadow-canvas`. Indholdet ligger i `mx-auto max-w-[1280px] px-8 py-10`.
- Toasten (se § Toast) bor også i `Shell.jsx`.
- Tastaturgenvej: `N` åbner "Ny booking" og vises som `<Kbd>N</Kbd>` på knappen. Den ignoreres, når fokus er i `input`/`textarea`/`select`/`[contenteditable]`, eller når der holdes en modifier-tast.

## Opskrifter

### Dialog (native `<dialog>`)

Skuffe og bekræftelse er begge native `<dialog>`, åbnet med `ref.current.showModal()`. Det giver
fokusfælde, Esc og `::backdrop` gratis.

- Backdrop: `backdrop:bg-ink/20`.
- Esc lukker native. Alle lukninger (Esc, Annullér, X, baggrund) ender i dialogens
  `close`-event, så oprydning ligger ét sted (`onClose`).
- Klik på baggrunden lukker. Klik på `::backdrop` rammer selve `<dialog>`-elementet, så
  indholdet ligger i en indre `<div>`, og dialogen tjekker målet:

  ```jsx
  <dialog ref={ref} onClose={reset} onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}>
  ```

Bekræftelsesdialog: `<dialog>` med `w-[440px] rounded-xl border border-line bg-surface p-0 shadow-pop
backdrop:bg-ink/20 transition-[opacity,scale] duration-150 starting:scale-95 starting:opacity-0`.
Indholdet ligger i `<div className="p-6">`.

### Tabel (bookinglisten)

Tabellen ligger i `<Tile flush>`.

- `<table className="w-full border-separate border-spacing-0">` med sticky `thead`.
- Header-celler: `h-12 border-b border-line bg-surface px-4 text-left text-sm font-medium text-ink-3`. Første og sidste kolonne får `pl-6`/`pr-6`.
- Rækker: `h-16 cursor-pointer hover:[&>td]:bg-sunken/60`. Celler har `border-b border-line px-4`.
- Hele rækken er klikbar (`onClick` → `navigate`). Navnecellen har desuden et rigtigt `<Link>` med `stopPropagation`, så tastatur og midterklik virker.
- Beløb: `tnum text-right`. Tomme celler: "–" i `text-ink-4`.
- Sortérbare kolonner: `aria-sort` og Caret-ikoner på 13px (`CaretUpDown`/`CaretUp`/`CaretDown`).
- `<tfoot>`: "I alt, `total` bookinger" og `kr(totalPrice)` i `text-lg font-semibold`. Begge
  tal kommer fra API-svaret og gælder alle matchende rækker. Frontend summerer ikke.
- Ingen paginering. API'et returnerer højst `limit` rækker, og listen viser "Viser
  `items.length` af `total`".

### Søgning og filtre i URL'en

```jsx
const [params, setParams] = useSearchParams()
const setParam = (key, value) =>
  setParams((p) => { value ? p.set(key, value) : p.delete(key); return p }, { replace: true })
```

- Søgefelt: `<input type="search">` i `relative`-wrapper med forstørrelsesglas-ikon `absolute left-3`, input `w-80 pl-10`.
- Dato-filter: native `<input type="date">`.
- Visnings-faner: `<Link>`s med `h-10 rounded-lg px-4`. Aktiv fane: `bg-surface font-medium shadow-panel` med `aria-current="page"`. Antal vises som `tnum text-ink-3` og kommer fra `counts` i API-svaret.
- Når der søges (`q`) eller filtreres på dato, ignorerer backend visningen, og fanen "Alle"
  vises som aktiv.
- Filtreringen sker i **backend** (`GET /api/bookings?q=…&date=…&view=…`), ikke i React.

### Opret/rediger-formular i skuffe

Native `<dialog>` (se § Dialog) stylet som skuffe fra højre:

- `<dialog>`: `m-0 ml-auto h-dvh max-h-none w-full max-w-[560px] bg-transparent p-2
  backdrop:bg-ink/20 transition-[translate] duration-200 ease-out starting:translate-x-8`.
  `p-2` giver afstand til vinduets kanter. Et klik i den kant lukker ligesom baggrunden.
- Indre panel: `flex h-full flex-col overflow-hidden rounded-3xl bg-surface shadow-pop`.

- **Samme komponent til opret og rediger.** Får den en `booking`-prop, udfyldes felterne
  (`defaultValue`), og der sendes `PUT /api/bookings/:id` i stedet for `POST /api/bookings`.
- Opbygning: `<form>` med
  - sticky header (titel `text-2xl font-semibold tracking-[-0.02em]` og luk-X),
  - scrollbar body med sektioner (`space-y-9`, hver med H3 `mb-3 font-semibold`),
  - sticky footer (Annullér og primær Gem, plus `<Kbd>Esc</Kbd>`-hint).
- Ukontrollerede native inputs, der læses med `new FormData(e.currentTarget)`.
- Datoer: `<input type="date" required>` uden `min`. Bookinger bagud i tid er tilladt. Antal
  gæster: `<input type="number" name="guestCount" min="1" required>`.
- Værelsestype: radio-kort-grid `grid grid-cols-2 gap-2`.
  - Hvert kort er en `<label>` med `sr-only`-radio. Kortet viser navn, "plads til N" og "fra X kr./nat".
  - Valgt kort: `bg-signal-soft ring-1 ring-signal/40`.
  - Fokus: `has-focus-visible:outline-2 has-focus-visible:outline-signal`.
- Land: native `<select name="countryCode" required className={inputClass}>` med en tom
  første `<option value="">Vælg land</option>` og landene fra `GET /api/countries` (sorteret
  på navn af API'et).
- **Live prisvisning:** En `<dl>`-boks nederst viser én linje pr. sæson (nætter × pris) og
  total (`text-xl font-semibold`, `border-t`). Tallene hentes fra API'et
  (`GET /api/bookings/quote?...`), når type og datoer er udfyldt. Vis "–", indtil der er en
  pris. Hjælpelinjen "3 nætter" under datoerne bruger `quote.nights`. **Frontend regner aldrig
  pris eller nætter ud.**
- Skuffen lukkes med Esc, Annullér, X eller klik på baggrunden. Formularen og fejlen nulstilles
  i `onClose`.
- Svarer API'et 404 ved gem (bookingen er slettet imens), lukkes skuffen, toasten viser
  `error.message` ("Bookingen findes ikke længere"), og der navigeres til `/bookinger`.

### Inline-validering

```jsx
<label htmlFor="guestCount" className={labelClass}>Antal gæster</label>
<input id="guestCount" name="guestCount" type="number" min="1" required className={inputClass}
       aria-invalid={error?.field === 'guestCount' || undefined}
       aria-describedby={error?.field === 'guestCount' ? 'guestCount-error' : undefined} />
{error?.field === 'guestCount' && (
  <p id="guestCount-error" role="alert" className="mt-1.5 text-sm text-danger">{error.message}</p>
)}
```

- `inputClass` farver kanten rød via `aria-invalid:border-danger`.
- Fejl uden `field` (fx "ingen ledige værelser") vises som banner øverst i formularen:
  `role="alert" rounded-lg bg-danger-soft p-3 text-danger-ink`.
- Teksten er altid API'ets `error.message`. Frontend skriver ingen egne fejltekster.
- Fejlen fjernes, når brugeren ændrer feltet.
- HTML-attributterne `required` og `min` er kun hjælp. **Backendens besked er sandheden.**

### Bekræft sletning

Bekræftelsesdialogen fra § Dialog.

- Titel: "Slet booking?" (`text-lg font-semibold`).
- Brødtekst, der gentager **hvad** der slettes: "Jensen · Dobbeltværelse · 10.–12. mar. 2026.
  Tilknyttede barsalg bevares." (FR-005, FR-010a)
- Knapper højrestillet: `secondary` "Annullér" (`autoFocus`, så den har fokus som standard) og
  `danger` "Slet booking".
- Under sletning er knappen deaktiveret og viser en spinner. Ved succes lukker dialogen, der
  vises en toast, og listen opdateres.
- Svarer API'et 404 (allerede slettet), lukker dialogen, toasten viser `error.message`
  ("Bookingen findes ikke længere"), og der navigeres til `/bookinger`.

### Toast

En lille komponent i `Shell.jsx`. Siderne viser en toast via `useToast()` med
`{ title, description, tone }`.

- Live-region: `<div role="status" aria-live="polite" className="fixed right-6 bottom-6">`.
  Den er altid i DOM'en, og kun indholdet skifter, så skærmlæsere annoncerer det.
- Én toast ad gangen. En ny toast erstatter den gamle. Den skjules automatisk efter ca. 4 sek.
  (`setTimeout`, ryddes ved ny toast).
- Toast: `flex w-[360px] items-start gap-3 rounded-lg bg-surface p-4 shadow-pop`.
- Succes: `CheckCircle` (`weight="fill"`, `text-ok`), titel og beskrivelse, der nævner målet:
  "Booking oprettet" / "Jensen, 10.–12. mar. · værelse 104".
- Fejl: samme opbygning med `WarningCircle` i `text-danger` og API'ets `error.message`.
- Luk-X som ghost-ikonknap.

### Tom tilstand

`EmptyState` med årsag og vej videre:

- Ingen søgeresultater: `Ingen bookinger matcher "jens".` + "Ryd søgning".
- Ingen bookinger overhovedet: "Ingen bookinger endnu." + "Ny booking".
- Booking findes ikke (slettet): "Bookingen findes ikke længere." + "Tilbage til bookinger".

### Loading

- Liste: behold de gamle rækker og dæmp dem (`opacity-60`) under nyt kald. Ingen skeletons.
- Knap: `disabled` + `SpinnerGap className="animate-spin"` + tekst i nutid ("Gemmer…").
