import { Link, useLoaderData, useNavigate } from 'react-router'
import { PlusIcon, SpinnerGapIcon } from '@phosphor-icons/react'
import { api } from '../api.js'
import { addDays, guestName, kr, longDate, nightsLabel, num, pct } from '../format.js'
import { useStayActions } from '../SatisfactionDialog.jsx'
import { useShell } from '../Shell.jsx'
import { Button, DateNav, EmptyState, Field, Kbd, PageHeader, Stat, StatusBadge, Tile, cx } from '../ui.jsx'

// The date is only sent when it is in the URL, so "today" is always the server's date (research R11)
export function loader({ request }) {
  const dato = new URL(request.url).searchParams.get('dato')
  return api('/reception/overview' + (dato ? '?' + new URLSearchParams({ date: dato }) : ''))
}

const th = 'h-12 border-b border-line px-4 text-left text-sm font-medium text-ink-3'
const td = 'border-b border-line px-4'

// The reception's workplace: every number comes from the API's kpis; React only shows them (005 FR-001, FR-002)
export default function Overview() {
  const { date, kpis, arrivals, departures, inHouse, rooms, barSalesTotal } = useLoaderData()
  const navigate = useNavigate()
  const { newBooking } = useShell()
  const stay = useStayActions()

  return (
    <>
      <PageHeader
        title="Oversigt"
        description={longDate(date)}
        actions={
          <>
            <DateNav
              label="Vælg dato"
              value={date}
              prevTo={'?dato=' + addDays(date, -1)}
              todayTo="/oversigt"
              nextTo={'?dato=' + addDays(date, 1)}
              onChange={(d) => navigate('?dato=' + d, { replace: true })}
            />
            <Button variant="primary" onClick={newBooking}>
              <PlusIcon size={16} weight="bold" />
              Ny booking
              <Kbd>N</Kbd>
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-4 gap-5">
        <Tile>
          <Stat
            label="Belægning i nat"
            value={pct(kpis.occupancy.rate)}
            context={`${num(kpis.occupancy.occupied)} af ${num(kpis.occupancy.total)} værelser`}
          />
        </Tile>
        <Tile>
          <Stat
            label="Ankomster tilbage"
            value={num(kpis.arrivals.remaining)}
            context={`af ${num(kpis.arrivals.total)}`}
          />
        </Tile>
        <Tile>
          <Stat
            label="Afrejser tilbage"
            value={num(kpis.departures.remaining)}
            context={`af ${num(kpis.departures.total)}`}
          />
        </Tile>
        <Tile>
          <Stat label="Gns. pris pr. nat" value={kr(kpis.averageRate)} />
        </Tile>
      </div>

      {/* The side column needs 20rem next to a table without wrapped text; on narrower screens it moves below the lists */}
      <div className="grid items-start gap-5 min-[1400px]:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          <Tile title="Ankomster" count={num(arrivals.length)} flush>
            <BookingTable
              bookings={arrivals}
              empty="Ingen ankomster på datoen."
              action={(b) =>
                b.status === 'arriving' && (
                  <ActionButton pending={stay.pending === b.id} onClick={() => stay.run(b, 'check-in')}>
                    Tjek ind
                  </ActionButton>
                )
              }
            />
          </Tile>
          <Tile title="Afrejser" count={num(departures.length)} flush>
            <BookingTable
              bookings={departures}
              empty="Ingen afrejser på datoen."
              action={(b) =>
                b.status === 'departing' ? (
                  <ActionButton pending={stay.pending === b.id} onClick={() => stay.run(b, 'check-out')}>
                    Tjek ud
                  </ActionButton>
                ) : b.satisfactionScore != null ? (
                  <span className="tnum text-sm whitespace-nowrap text-ink-3">{b.satisfactionScore} af 5</span>
                ) : (
                  ['checked_out', 'departed'].includes(b.status) && (
                    <ActionButton onClick={() => stay.rate(b)}>Tilfredshed</ActionButton>
                  )
                )
              }
            />
          </Tile>
        </div>

        <div className="grid grid-cols-2 items-start gap-5 min-[1400px]:grid-cols-1">
          <Tile title="I huset">
            <dl className="divide-y divide-line">
              <Field label="Bookinger">{num(inHouse.bookings)}</Field>
              <Field label="Gæster">{num(inHouse.guests)}</Field>
              <Field label="Barsalg">{kr(barSalesTotal)}</Field>
            </dl>
          </Tile>
          <Tile title="Ledige værelser">
            <dl className="divide-y divide-line">
              {rooms.map((r) => (
                <Field key={r.roomTypeId} label={r.roomType}>
                  {r.free === 0 ? (
                    <span className="text-danger-ink">Udsolgt</span>
                  ) : (
                    `${num(r.free)} af ${num(r.total)}`
                  )}
                </Field>
              ))}
            </dl>
          </Tile>
        </div>
      </div>

      {stay.dialog}
    </>
  )
}

function ActionButton({ pending, onClick, children }) {
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {pending ? <SpinnerGapIcon size={16} className="animate-spin" /> : children}
    </Button>
  )
}

// Arrivals and departures share the table; action(b) gives the row's next step (check in, check out, score)
function BookingTable({ bookings, empty, action }) {
  const navigate = useNavigate()
  if (bookings.length === 0) return <EmptyState title={empty} />
  return (
    <table className="w-full border-separate border-spacing-0">
      <thead>
        <tr>
          <th className={cx(th, 'pl-6')}>Gæst</th>
          <th className={th}>Værelse</th>
          <th className={th}>Status</th>
          <th className={cx(th, 'pr-6')}>
            <span className="sr-only">Handling</span>
          </th>
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
              <div className="tnum text-sm whitespace-nowrap text-ink-3">
                {b.country.name} · {nightsLabel(b.nights)}
              </div>
            </td>
            <td className={td}>
              <div className="tnum">{b.room.number}</div>
              <div className="text-sm whitespace-nowrap text-ink-3">{b.roomType.name}</div>
            </td>
            <td className={cx(td, 'whitespace-nowrap')}>
              <StatusBadge status={b.status} />
            </td>
            <td className={cx(td, 'pr-6 text-right')}>{action(b)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
