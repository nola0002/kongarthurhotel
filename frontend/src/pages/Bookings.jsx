import { useState } from 'react'
import { Link, useLoaderData, useLocation, useNavigate, useNavigation, useSearchParams } from 'react-router'
import { MagnifyingGlassIcon, PlusIcon } from '@phosphor-icons/react'
import { api } from '../api.js'
import { date, guestName, kr, nightsLabel, num } from '../format.js'
import { Pagination, SortHeader } from '../Pagination.jsx'
import { useShell } from '../Shell.jsx'
import { Button, EmptyState, Kbd, PageHeader, SourceBadge, StatusBadge, Tile, cx, inputClass } from '../ui.jsx'

// Danish URL slug → API view
const VIEWS = { kommende: 'upcoming', 'i-huset': 'in_house', afrejst: 'departed', alle: 'all' }
const TABS = [
  ['kommende', 'Kommende'],
  ['i-huset', 'I huset'],
  ['afrejst', 'Afrejst'],
  ['alle', 'Alle'],
]
// Danish URL parameter → API parameter (contracts/README.md)
const PARAMS = {
  side: 'page',
  'pr-side': 'pageSize',
  sorter: 'sort',
  orden: 'order',
  q: 'q',
  type: 'roomTypeId',
  land: 'countryCode',
  fra: 'from',
  til: 'to',
}
const FILTERS = ['q', 'type', 'land', 'fra', 'til']
const PAGE_SIZES = [25, 50, 100]

// Paging, sorting and filtering all happen in the backend; the URL is the state (005 FR-005–FR-007)
export async function loader({ request }) {
  const url = new URL(request.url).searchParams
  const query = new URLSearchParams({ view: VIEWS[url.get('visning')] ?? 'upcoming' })
  for (const [da, en] of Object.entries(PARAMS)) if (url.get(da)) query.set(en, url.get(da))
  const [list, roomTypes, countries] = await Promise.all([
    api('/bookings?' + query),
    api('/room-types'),
    api('/countries'),
  ])
  return { ...list, roomTypes, countries }
}

// px-3, not px-4: with a year on both dates and a long name the eight columns only just fit 1440px unwrapped
const th = 'sticky top-0 h-12 border-b border-line bg-surface px-3 text-left text-sm font-medium text-ink-3'
const td = 'border-b border-line px-3'
const readFilters = (params) => Object.fromEntries(FILTERS.map((k) => [k, params.get(k) ?? '']))

export default function Bookings() {
  const { total, totalPrice, counts, page, pageSize, pageCount, items, roomTypes, countries } = useLoaderData()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const navigation = useNavigation()
  const loading = navigation.state === 'loading'
  const { newBooking } = useShell()
  // Local copies, because the URL only updates once the loader has answered and typing must not lag
  const [filters, setFilters] = useState(() => readFilters(params))
  // A navigation from elsewhere (sidebar link, back/forward, a tab) resets them to the URL. Only once idle: while
  // the user types, an older keystroke's URL can commit after a newer one has started and must not overwrite it.
  const locationKey = useLocation().key
  const [syncedKey, setSyncedKey] = useState(locationKey)
  if (locationKey !== syncedKey && navigation.state === 'idle') {
    setSyncedKey(locationKey)
    setFilters(readFilters(params))
  }

  // Any change but a page step starts on page 1 again (FR-007). Typing replaces the history entry.
  const update = (changes, replace) =>
    setParams(
      (p) => {
        for (const [key, value] of Object.entries(changes)) value ? p.set(key, value) : p.delete(key)
        p.delete('side')
        return p
      },
      { replace },
    )
  const setFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }))
    update({ [key]: value }, true)
  }
  const clear = () => {
    setFilters(readFilters(new URLSearchParams()))
    update(Object.fromEntries(FILTERS.map((k) => [k, ''])), true)
  }
  const withParams = (changes) => {
    const p = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) value ? p.set(key, value) : p.delete(key)
    return '?' + p
  }

  const filtered = FILTERS.some((k) => filters[k])
  // The API ignores the view while searching (openapi GET /bookings), so "Alle" is shown as active
  const activeTab = filters.q ? 'alle' : (params.get('visning') ?? 'kommende')
  // Mirrors the API's defaults (openapi: sort=checkIn, order desc for departed) only to mark the active header
  const sort = params.get('sorter') ?? 'checkIn'
  const order = params.get('orden') ?? (VIEWS[activeTab] === 'departed' ? 'desc' : 'asc')
  const sortHeader = (field, label, className) => (
    <SortHeader
      label={label}
      active={sort === field}
      order={order}
      className={cx(th, className)}
      onSort={() => update({ sorter: field, orden: sort === field && order === 'asc' ? 'desc' : 'asc' })}
    />
  )

  return (
    <>
      <PageHeader
        title="Bookinger"
        description={`${num(counts.all)} bookinger, ${num(counts.in_house)} i huset i dag`}
        actions={
          <Button variant="primary" onClick={newBooking}>
            <PlusIcon size={16} weight="bold" />
            Ny booking
            <Kbd>N</Kbd>
          </Button>
        }
      />

      {/* A grid, not flex: inputClass has w-full, which beats w-auto, so each field fills its own column */}
      <div className="mb-4 grid grid-cols-[20rem_14rem_12rem_auto] items-center justify-start gap-3">
        <div className="relative">
          <MagnifyingGlassIcon size={17} className="pointer-events-none absolute top-3 left-3 text-ink-3" />
          <label htmlFor="booking-search" className="sr-only">
            Søg på navn, bookingnummer eller værelse
          </label>
          <input
            id="booking-search"
            type="search"
            placeholder="Navn, bookingnr. eller værelse"
            value={filters.q}
            onChange={(e) => setFilter('q', e.target.value)}
            className={cx(inputClass, 'pl-10')}
          />
        </div>
        <label htmlFor="booking-type" className="sr-only">
          Værelsestype
        </label>
        <select
          id="booking-type"
          value={filters.type}
          onChange={(e) => setFilter('type', e.target.value)}
          className={inputClass}
        >
          <option value="">Alle værelsestyper</option>
          {roomTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <label htmlFor="booking-country" className="sr-only">
          Land
        </label>
        <select
          id="booking-country"
          value={filters.land}
          onChange={(e) => setFilter('land', e.target.value)}
          className={inputClass}
        >
          <option value="">Alle lande</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <fieldset className="grid grid-cols-[9.5rem_auto_9.5rem] items-center gap-2">
          <legend className="sr-only">Ophold i perioden</legend>
          <label htmlFor="booking-from" className="sr-only">
            Fra
          </label>
          <input
            id="booking-from"
            type="date"
            value={filters.fra}
            onChange={(e) => setFilter('fra', e.target.value)}
            className={inputClass}
          />
          <label htmlFor="booking-to" className="text-ink-3">
            <span aria-hidden>–</span>
            <span className="sr-only">til</span>
          </label>
          <input
            id="booking-to"
            type="date"
            value={filters.til}
            onChange={(e) => setFilter('til', e.target.value)}
            className={inputClass}
          />
        </fieldset>
      </div>

      {/* "Ryd filtre" sits on the tab row: the filter row has no room left for it at 1440px */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <nav aria-label="Visning" className="flex gap-1">
          {TABS.map(([slug, label]) => (
            <Link
              key={slug}
              // A tab keeps the other filters but leaves the search, which would override the view
              to={withParams({ visning: slug, q: '', side: '' })}
              aria-current={activeTab === slug ? 'page' : undefined}
              className={cx(
                'flex h-10 items-center gap-2 rounded-lg px-4 transition-colors duration-100',
                activeTab === slug ? 'bg-surface font-medium shadow-panel' : 'text-ink-2 hover:bg-ink/[0.04]',
              )}
            >
              {label}
              <span className="tnum font-normal text-ink-3">{num(counts[VIEWS[slug]])}</span>
            </Link>
          ))}
        </nav>
        {/* The empty state has its own */}
        {filtered && items.length > 0 && (
          <Button variant="ghost" onClick={clear}>
            Ryd filtre
          </Button>
        )}
      </div>

      <Tile flush>
        {items.length === 0 ? (
          filtered ? (
            <EmptyState
              title={filters.q ? `Ingen bookinger matcher "${filters.q}".` : 'Ingen bookinger matcher filtrene.'}
              action={<Button onClick={clear}>Ryd filtre</Button>}
            />
          ) : (
            <EmptyState
              title={counts.all === 0 ? 'Ingen bookinger endnu.' : 'Ingen bookinger i denne visning.'}
              action={<Button onClick={newBooking}>Ny booking</Button>}
            />
          )
        ) : (
          // Dimmed on the table, not the tbody: Chrome does not always repaint a table section that has its own
          // opacity (and transition) when its rows are swapped, so the new rows stayed blank until hovered
          <table className={cx('w-full border-separate border-spacing-0', loading && 'opacity-60')}>
            <thead>
              <tr>
                {sortHeader('checkIn', 'Ankomst', 'rounded-tl-2xl pl-6')}
                {sortHeader('checkOut', 'Afrejse')}
                {sortHeader('nights', 'Nætter', 'text-right')}
                {sortHeader('guest', 'Gæst')}
                <th className={th}>Værelse</th>
                <th className={cx(th, 'text-right')}>Gæster</th>
                <th className={th}>Status</th>
                {sortHeader('totalPrice', 'Pris', 'rounded-tr-2xl pr-6 text-right')}
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => navigate(`/bookinger/${b.id}`)}
                  // No wrapping: a date, status or amount broken over two lines is hard to read, and rows stay h-16
                  className="h-16 cursor-pointer whitespace-nowrap hover:[&>td]:bg-sunken/60"
                >
                  <td className={cx(td, 'tnum pl-6')}>{date(b.checkIn)}</td>
                  <td className={cx(td, 'tnum')}>{date(b.checkOut)}</td>
                  <td className={cx(td, 'tnum text-right')}>{nightsLabel(b.nights)}</td>
                  {/* The only cell allowed to wrap, and only the country line, so the table fits next to long names */}
                  <td className={cx(td, 'whitespace-normal')}>
                    <Link
                      to={`/bookinger/${b.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium whitespace-nowrap hover:text-signal"
                    >
                      {guestName(b)}
                    </Link>
                    <div className="flex flex-wrap items-center gap-x-2 text-sm text-ink-3">
                      <span className="tnum">#{b.id}</span>
                      {b.country.name}
                      {b.source === 'booking_system' && <SourceBadge />}
                    </div>
                  </td>
                  <td className={td}>
                    <div>{b.roomType.name}</div>
                    <div className="tnum text-sm text-ink-3">Værelse {b.room.number}</div>
                  </td>
                  <td className={cx(td, 'tnum text-right')}>{num(b.guestCount)}</td>
                  <td className={td}>
                    <StatusBadge status={b.status} />
                  </td>
                  <td className={cx(td, 'tnum pr-6 text-right')}>{kr(b.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="h-16">
                <td colSpan={6} className="tnum pl-6 text-ink-2">
                  I alt, {num(total)} bookinger
                </td>
                {/* Spans Status too, so the large total does not widen the Pris column */}
                <td colSpan={2} className="tnum pr-6 text-right text-lg font-semibold">
                  {kr(totalPrice)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </Tile>
      {items.length > 0 && (
        <Pagination
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          total={total}
          shown={items.length}
          sizes={PAGE_SIZES}
          hrefFor={(n) => withParams({ side: n > 1 && String(n) })}
          onPageSize={(n) => update({ 'pr-side': n })}
        />
      )}
    </>
  )
}
