import { useState } from 'react'
import { Link, useLoaderData, useLocation, useNavigate, useNavigation, useSearchParams } from 'react-router'
import { MagnifyingGlassIcon, PlusIcon } from '@phosphor-icons/react'
import { api } from '../api.js'
import { date, guestName, kr, nightsLabel, num } from '../format.js'
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

// Filtering happens in the backend; the URL is the state (?q=, ?dato=, ?visning=)
export function loader({ request }) {
  const url = new URL(request.url).searchParams
  const query = new URLSearchParams({ view: VIEWS[url.get('visning')] ?? 'upcoming' })
  if (url.get('q')) query.set('q', url.get('q'))
  if (url.get('dato')) query.set('date', url.get('dato'))
  return api('/bookings?' + query)
}

const th = 'sticky top-0 h-12 border-b border-line bg-surface px-4 text-left text-sm font-medium text-ink-3'
const td = 'border-b border-line px-4'

export default function Bookings() {
  const { total, totalPrice, counts, items } = useLoaderData()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const navigation = useNavigation()
  const loading = navigation.state === 'loading'
  const { newBooking } = useShell()
  // Local copies, because the URL only updates once the loader has answered and typing must not lag
  const [q, setQ] = useState(params.get('q') ?? '')
  const [dato, setDato] = useState(params.get('dato') ?? '')
  // A navigation from elsewhere (sidebar link, back/forward, a tab) resets them to the URL. Only once idle: while
  // the user types, an older keystroke's URL can commit after a newer one has started and must not overwrite it.
  const locationKey = useLocation().key
  const [syncedKey, setSyncedKey] = useState(locationKey)
  if (locationKey !== syncedKey && navigation.state === 'idle') {
    setSyncedKey(locationKey)
    setQ(params.get('q') ?? '')
    setDato(params.get('dato') ?? '')
  }

  const setParam = (key, value) =>
    setParams(
      (p) => {
        value ? p.set(key, value) : p.delete(key)
        return p
      },
      { replace: true },
    )
  const filtered = Boolean(q || dato)
  const activeTab = filtered ? 'alle' : (params.get('visning') ?? 'kommende')
  const clear = () => {
    setQ('')
    setDato('')
    setParams(
      (p) => {
        p.delete('q')
        p.delete('dato')
        return p
      },
      { replace: true },
    )
  }

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

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative">
          <MagnifyingGlassIcon size={17} className="pointer-events-none absolute top-3 left-3 text-ink-3" />
          <label htmlFor="booking-search" className="sr-only">
            Søg på gæstenavn
          </label>
          <input
            id="booking-search"
            type="search"
            placeholder="Søg på gæstenavn"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setParam('q', e.target.value)
            }}
            className={cx(inputClass, 'w-80 pl-10')}
          />
        </div>
        <label htmlFor="booking-date" className="sr-only">
          Bor på hotellet den
        </label>
        <input
          id="booking-date"
          type="date"
          value={dato}
          onChange={(e) => {
            setDato(e.target.value)
            setParam('dato', e.target.value)
          }}
          className={cx(inputClass, 'w-auto')}
        />
        {filtered && (
          <Button variant="ghost" onClick={clear}>
            Ryd
          </Button>
        )}

        <nav aria-label="Visning" className="ml-auto flex gap-1">
          {TABS.map(([slug, label]) => (
            <Link
              key={slug}
              to={'?visning=' + slug}
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
      </div>

      <Tile flush>
        {items.length === 0 ? (
          filtered ? (
            <EmptyState
              title={q ? `Ingen bookinger matcher "${q}".` : 'Ingen bookinger på den valgte dato.'}
              action={<Button onClick={clear}>Ryd søgning</Button>}
            />
          ) : (
            <EmptyState
              title={counts.all === 0 ? 'Ingen bookinger endnu.' : 'Ingen bookinger i denne visning.'}
              action={<Button onClick={newBooking}>Ny booking</Button>}
            />
          )
        ) : (
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={cx(th, 'rounded-tl-2xl pl-6')}>Periode</th>
                <th className={th}>Gæst</th>
                <th className={th}>Værelse</th>
                <th className={cx(th, 'text-right')}>Gæster</th>
                <th className={th}>Status</th>
                <th className={th}>Kilde</th>
                <th className={cx(th, 'rounded-tr-2xl pr-6 text-right')}>Pris</th>
              </tr>
            </thead>
            <tbody className={cx('transition-opacity duration-100', loading && 'opacity-60')}>
              {items.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => navigate(`/bookinger/${b.id}`)}
                  className="h-16 cursor-pointer hover:[&>td]:bg-sunken/60"
                >
                  <td className={cx(td, 'tnum pl-6')}>
                    <div>
                      {date(b.checkIn)} – {date(b.checkOut)}
                    </div>
                    <div className="text-sm text-ink-3">{nightsLabel(b.nights)}</div>
                  </td>
                  <td className={td}>
                    <Link
                      to={`/bookinger/${b.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium hover:text-signal"
                    >
                      {guestName(b)}
                    </Link>
                    <div className="text-sm text-ink-3">{b.country.name}</div>
                  </td>
                  <td className={td}>
                    <div>{b.roomType.name}</div>
                    <div className="tnum text-sm text-ink-3">Værelse {b.room.number}</div>
                  </td>
                  <td className={cx(td, 'tnum text-right')}>{num(b.guestCount)}</td>
                  <td className={td}>
                    <StatusBadge status={b.status} />
                  </td>
                  <td className={td}>
                    {b.source === 'booking_system' ? <SourceBadge /> : <span className="text-ink-4">–</span>}
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
                <td className="tnum pr-6 text-right text-lg font-semibold">{kr(totalPrice)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </Tile>
      {items.length > 0 && (
        <p className="tnum mt-3 text-sm text-ink-3">
          Viser {num(items.length)} af {num(total)}
        </p>
      )}
    </>
  )
}
