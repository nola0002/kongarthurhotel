import { useState } from 'react'
import { Link, useLoaderData, useNavigate } from 'react-router'
import { api } from '../api.js'
import { addDays, guestName, kr, longDate, nightsLabel, num } from '../format.js'
import SatisfactionDialog from '../SatisfactionDialog.jsx'
import { Button, DateNav, EmptyState, Field, PageHeader, Stat, StatusBadge, Tile, cx } from '../ui.jsx'

// The date is only sent when it is in the URL, so "today" is always the server's date (research R11)
export function loader({ request }) {
  const dato = new URL(request.url).searchParams.get('dato')
  return api('/reception/overview' + (dato ? '?' + new URLSearchParams({ date: dato }) : ''))
}

const th = 'h-12 border-b border-line px-4 text-left text-sm font-medium text-ink-3'
const td = 'border-b border-line px-4'

// Every number on this page comes from the API; React only shows it (FR-017)
export default function Overview() {
  const { date, arrivals, departures, inHouse, rooms, barSalesTotal } = useLoaderData()
  const navigate = useNavigate()
  const [rating, setRating] = useState(null)

  return (
    <>
      <PageHeader
        title="Oversigt"
        description={longDate(date)}
        actions={
          <DateNav
            label="Vælg dato"
            value={date}
            prevTo={'?dato=' + addDays(date, -1)}
            todayTo="/oversigt"
            nextTo={'?dato=' + addDays(date, 1)}
            onChange={(d) => navigate('?dato=' + d)}
          />
        }
      />

      <div className="mb-5 grid grid-cols-4 gap-5">
        <Tile>
          <Stat label="Ankomster" value={num(arrivals.length)} />
        </Tile>
        <Tile>
          <Stat label="Afrejser" value={num(departures.length)} />
        </Tile>
        <Tile>
          <Stat label="I huset" value={num(inHouse.bookings)} context={`${num(inHouse.guests)} gæster`} />
        </Tile>
        <Tile>
          <Stat label="Barsalg" value={kr(barSalesTotal)} />
        </Tile>
      </div>

      <div className="grid grid-cols-12 items-start gap-5">
        <div className="col-span-8 space-y-5">
          <Tile title="Ankomster" count={num(arrivals.length)} flush>
            <BookingTable bookings={arrivals} empty="Ingen ankomster på datoen." />
          </Tile>
          <Tile title="Afrejser" count={num(departures.length)} flush>
            <BookingTable bookings={departures} empty="Ingen afrejser på datoen." onRate={setRating} />
          </Tile>
        </div>

        <Tile title="Ledige værelser" className="col-span-4">
          <dl className="divide-y divide-line">
            {rooms.map((r) => (
              <Field key={r.roomTypeId} label={r.roomType}>
                {r.free === 0 ? (
                  <span className="text-danger-ink">Udsolgt</span>
                ) : (
                  `${num(r.free)} ledige af ${num(r.total)}`
                )}
              </Field>
            ))}
          </dl>
        </Tile>
      </div>

      {rating && <SatisfactionDialog booking={rating} onClose={() => setRating(null)} />}
    </>
  )
}

// Arrivals and departures share the table; departures add the satisfaction column (onRate)
function BookingTable({ bookings, empty, onRate }) {
  const navigate = useNavigate()
  if (bookings.length === 0) return <EmptyState title={empty} />
  return (
    <table className="w-full border-separate border-spacing-0">
      <thead>
        <tr>
          <th className={cx(th, 'pl-6')}>Gæst</th>
          <th className={th}>Værelse</th>
          <th className={th}>Nætter</th>
          <th className={cx(th, 'text-right')}>Gæster</th>
          <th className={cx(th, !onRate && 'pr-6')}>Status</th>
          {onRate && <th className={cx(th, 'pr-6')}>Tilfredshed</th>}
        </tr>
      </thead>
      <tbody>
        {bookings.map((b) => (
          <tr
            key={b.id}
            onClick={() => navigate(`/bookinger/${b.id}`)}
            className="h-16 cursor-pointer hover:[&>td]:bg-sunken/60"
          >
            <td className={cx(td, 'pl-6')}>
              <Link
                to={`/bookinger/${b.id}`}
                onClick={(e) => e.stopPropagation()}
                className="font-medium hover:text-signal"
              >
                {guestName(b)}
              </Link>
            </td>
            <td className={td}>
              <div className="tnum">{b.room.number}</div>
              <div className="text-sm text-ink-3">{b.roomType.name}</div>
            </td>
            <td className={cx(td, 'tnum')}>{nightsLabel(b.nights)}</td>
            <td className={cx(td, 'tnum text-right')}>{num(b.guestCount)}</td>
            <td className={cx(td, !onRate && 'pr-6')}>
              <StatusBadge status={b.status} />
            </td>
            {onRate && (
              <td className={cx(td, 'tnum pr-6')}>
                {b.satisfactionScore != null ? (
                  `${b.satisfactionScore} af 5`
                ) : b.status === 'departed' ? (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRate(b)
                    }}
                  >
                    Registrér tilfredshed
                  </Button>
                ) : (
                  <span className="text-ink-4">–</span>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
