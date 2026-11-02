import { useState } from 'react'
import { Link, useLoaderData, useNavigate } from 'react-router'
import { api } from '../api.js'
import { date, kr, krExact, krShort, nightsLabel, num, pct, period, today } from '../format.js'
import { EmptyState, ErrorBanner, PageHeader, Stat, Tile, cx, inputClass, invalidProps, labelClass } from '../ui.jsx'

// Danish URL values (design principle 12) for the API's groupBy
const GROUP_PARAM = { day: 'dag', month: 'maaned', year: 'aar' }
const GROUP_LABEL = { day: 'Dag', month: 'Måned', year: 'År' }
const PER = { day: 'pr. dag', month: 'pr. måned', year: 'pr. år' }

const toSearch = ({ from, to, groupBy }) => '?' + new URLSearchParams({ fra: from, til: to, pr: GROUP_PARAM[groupBy] })

// Shortcuts only build links; every amount comes from GET /revenue
function shortcuts() {
  const d = today()
  const year = Number(d.slice(0, 4))
  return [
    { label: 'Denne måned', from: d.slice(0, 8) + '01', to: d, groupBy: 'day' },
    { label: 'I år', from: `${year}-01-01`, to: d, groupBy: 'month' },
    { label: 'Sidste år', from: `${year - 1}-01-01`, to: `${year - 1}-12-31`, groupBy: 'month' },
    { label: '2000–i dag', from: '2000-01-01', to: d, groupBy: 'year' },
  ]
}

export async function loader({ request }) {
  const p = new URL(request.url).searchParams
  const query = {
    from: p.get('fra') || today().slice(0, 4) + '-01-01',
    to: p.get('til') || today(),
    groupBy: Object.keys(GROUP_PARAM).find((g) => GROUP_PARAM[g] === p.get('pr')) ?? 'month',
  }
  try {
    return { query, revenue: await api('/revenue?' + new URLSearchParams(query)) }
  } catch (error) {
    // A rejected period (e.g. per day over 3 years) is shown next to the filter, not as an error page (FR-015)
    if (error.status !== 400) throw error
    return { query, error }
  }
}

// "2025", "mar." / "mar. 2025", "10. mar." – the API's period key, year only when not this year
const periodLabel = (p) =>
  p.length === 4
    ? p
    : p.length === 7
      ? date(p + '-01', { month: 'short' })
      : date(p, { day: 'numeric', month: 'short' })

// Categories come from the database, so the colour follows their position, not their name
const SHADES = ['bg-signal', 'bg-signal/35', 'bg-ink-3', 'bg-ink-4']
const shade = (i) => SHADES[i % SHADES.length]

const th = 'sticky top-0 h-12 border-b border-line bg-surface px-4 text-left text-sm font-medium text-ink-3'
const td = 'h-12 border-b border-line px-4'

export default function Revenue() {
  const { query, revenue, error } = useLoaderData()
  const navigate = useNavigate()
  // Local draft as in DateNav: the fields follow the URL (shortcuts), and typing a date is not interrupted
  const [draft, setDraft] = useState(query)
  const [shown, setShown] = useState(query)
  if (query !== shown) {
    setShown(query)
    setDraft(query)
  }
  function set(key, value) {
    const next = { ...draft, [key]: value }
    setDraft(next)
    // A date field reports '' until the date is complete
    if (next.from && next.to) navigate(toSearch(next), { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Omsætning"
        description={`${period(query.from, query.to)} · ${PER[query.groupBy]}`}
        actions={
          <nav aria-label="Genveje" className="flex gap-1">
            {shortcuts().map((s) => {
              const active = s.from === query.from && s.to === query.to && s.groupBy === query.groupBy
              return (
                <Link
                  key={s.label}
                  to={toSearch(s)}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'inline-flex h-10 items-center rounded-lg px-4 transition-colors duration-100',
                    active ? 'bg-surface font-medium shadow-panel' : 'text-ink-2 hover:bg-ink/[0.04]',
                  )}
                >
                  {s.label}
                </Link>
              )
            })}
          </nav>
        }
      />

      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="fra" className={labelClass}>
            Fra
          </label>
          <input
            id="fra"
            type="date"
            required
            value={draft.from}
            onChange={(e) => set('from', e.target.value)}
            className={cx(inputClass, 'w-auto')}
            {...invalidProps(error, 'from')}
          />
        </div>
        <div>
          <label htmlFor="til" className={labelClass}>
            Til
          </label>
          <input
            id="til"
            type="date"
            required
            value={draft.to}
            onChange={(e) => set('to', e.target.value)}
            className={cx(inputClass, 'w-auto')}
            {...invalidProps(error, 'to')}
          />
        </div>
        <div>
          <label htmlFor="pr" className={labelClass}>
            Gruppér pr.
          </label>
          <select
            id="pr"
            value={draft.groupBy}
            onChange={(e) => set('groupBy', e.target.value)}
            className={cx(inputClass, 'w-auto')}
            {...invalidProps(error, 'groupBy')}
          >
            {Object.entries(GROUP_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <ErrorBanner error={error} /> : <RevenueReport revenue={revenue} />}
    </>
  )
}

function RevenueReport({ revenue }) {
  const { bar, rooms, groupBy } = revenue
  const roomsMax = maxTotal(rooms.byPeriod)
  const categories = bar.byCategory.map((c) => c.category)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-5">
        <Tile>
          <Stat label="Bar i alt" value={krShort(bar.total)} context={krExact(bar.total)} />
        </Tile>
        <Tile>
          <Stat label="Solgte enheder" value={num(bar.quantity)} context="drinks i perioden" />
        </Tile>
        <Tile>
          <Stat label="Værelser i alt" value={krShort(rooms.total)} context={nightsLabel(rooms.nights)} />
        </Tile>
        <Tile>
          <Stat label="Samlet" value={krShort(revenue.total)} context={krExact(revenue.total)} />
        </Tile>
      </div>

      <div className="grid grid-cols-12 items-start gap-5">
        <Tile
          title={`Baromsætning ${PER[groupBy]}`}
          className="col-span-8"
          action={
            <ul className="flex gap-4 text-sm text-ink-2">
              {categories.map((c, i) => (
                <li key={c} className="flex items-center gap-2">
                  <span aria-hidden className={cx('size-2.5 rounded-[3px]', shade(i))} />
                  {c}
                </li>
              ))}
            </ul>
          }
        >
          {bar.byPeriod.length === 0 ? (
            <EmptyState title="Ingen barsalg i perioden." />
          ) : (
            <>
              <BarChart byPeriod={bar.byPeriod} categories={categories} />
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-ink-2 hover:text-ink">Vis som tabel</summary>
                <div className="mt-3 max-h-96 overflow-auto">
                  <table className="w-full border-separate border-spacing-0">
                    <thead>
                      <tr>
                        <th className={th}>Periode</th>
                        {categories.map((c) => (
                          <th key={c} className={cx(th, 'text-right')}>
                            {c}
                          </th>
                        ))}
                        <th className={cx(th, 'text-right')}>I alt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bar.byPeriod.map((p) => (
                        <tr key={p.period}>
                          <td className={cx(td, 'tnum')}>{periodLabel(p.period)}</td>
                          {categories.map((c) => (
                            <td key={c} className={cx(td, 'tnum text-right')}>
                              {krExact(p.categories.find((x) => x.category === c)?.total ?? 0)}
                            </td>
                          ))}
                          <td className={cx(td, 'tnum text-right font-medium')}>{krExact(p.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </Tile>

        <div className="col-span-4 space-y-5">
          <Tile title="Kategorier">
            <ul className="space-y-4">
              {bar.byCategory.map((c, i) => (
                <li key={c.category}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{c.category}</span>
                    <span className="tnum text-ink-2">{pct(c.share)}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-sunken">
                    <div className={cx('h-full rounded-full', shade(i))} style={{ width: `${c.share * 100}%` }} />
                  </div>
                  <div className="tnum mt-1.5 flex justify-between text-sm text-ink-3">
                    <span>{num(c.quantity)} stk.</span>
                    <span>{krExact(c.total)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Tile>

          <Tile title="Top 5 drinks" flush>
            {bar.topDrinks.length === 0 ? (
              <EmptyState title="Ingen salg i perioden." />
            ) : (
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className={cx(th, 'pl-6')}>Drink</th>
                    <th className={cx(th, 'text-right')}>Antal</th>
                    <th className={cx(th, 'pr-6 text-right')}>Beløb</th>
                  </tr>
                </thead>
                <tbody>
                  {bar.topDrinks.map((d) => (
                    <tr key={d.drink}>
                      <td className={cx(td, 'h-14 pl-6')}>
                        {d.drink}
                        <span className="block text-sm text-ink-3">{d.category}</span>
                      </td>
                      <td className={cx(td, 'tnum text-right')}>{num(d.quantity)}</td>
                      <td className={cx(td, 'tnum pr-6 text-right')}>{kr(d.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Tile>
        </div>
      </div>

      <Tile title={`Værelser ${PER[groupBy]}`} count={nightsLabel(rooms.nights)} flush>
        {rooms.byPeriod.length === 0 ? (
          <EmptyState title="Ingen overnatninger i perioden." />
        ) : (
          <div className="max-h-96 overflow-auto rounded-b-2xl">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className={cx(th, 'w-40 pl-6')}>Periode</th>
                  <th className={th}>
                    <span className="sr-only">Andel</span>
                  </th>
                  <th className={cx(th, 'w-48 pr-6 text-right')}>Omsætning</th>
                </tr>
              </thead>
              <tbody>
                {rooms.byPeriod.map((p) => (
                  <tr key={p.period}>
                    <td className={cx(td, 'tnum pl-6')}>{periodLabel(p.period)}</td>
                    <td className={td} aria-hidden>
                      <div className="h-2 rounded-full bg-ink-4" style={{ width: `${(p.total / roomsMax) * 100}%` }} />
                    </td>
                    <td className={cx(td, 'tnum pr-6 text-right')}>{krExact(p.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="h-14">
                  <td colSpan={2} className="pl-6 text-ink-2">
                    I alt, {nightsLabel(rooms.nights)}
                  </td>
                  <td className="tnum pr-6 text-right text-lg font-semibold">{krExact(rooms.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Tile>
    </div>
  )
}

// Bar heights are a display scale (share of the largest period), not a key figure; the numbers are in the table
const maxTotal = (rows) => Math.max(...rows.map((r) => r.total))

function BarChart({ byPeriod, categories }) {
  const max = maxTotal(byPeriod)
  const labelled = byPeriod.length <= 31
  return (
    <div role="img" aria-label="Søjlediagram over baromsætningen pr. periode. Tallene står i tabellen nedenfor.">
      <p className="tnum text-xs text-ink-3">{kr(max)}</p>
      <div
        className={cx(
          'mt-1 flex h-64 items-end border-b border-line',
          byPeriod.length <= 60 ? 'gap-1.5' : byPeriod.length <= 200 && 'gap-px',
        )}
      >
        {byPeriod.map((p) => (
          <div
            key={p.period}
            title={`${periodLabel(p.period)}: ${krExact(p.total)}`}
            className="flex min-w-0 flex-1 flex-col-reverse overflow-hidden rounded-t-sm"
            style={{ height: `${(p.total / max) * 100}%` }}
          >
            {/* flex-grow by amount: CSS splits the bar between the categories */}
            {categories.map((c, i) => (
              <div
                key={c}
                className={shade(i)}
                style={{ flexGrow: p.categories.find((x) => x.category === c)?.total ?? 0 }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className={cx('mt-2 flex text-xs text-ink-3', labelled ? 'gap-1.5' : 'justify-between')}>
        {labelled
          ? byPeriod.map((p) => (
              <span key={p.period} className="tnum min-w-0 flex-1 truncate text-center">
                {periodLabel(p.period)}
              </span>
            ))
          : [byPeriod[0], byPeriod.at(-1)].map((p) => (
              <span key={p.period} className="tnum">
                {periodLabel(p.period)}
              </span>
            ))}
      </div>
    </div>
  )
}
