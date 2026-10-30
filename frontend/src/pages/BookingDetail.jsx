import { useRef, useState } from 'react'
import { Link, useLoaderData, useNavigate } from 'react-router'
import { PencilSimpleIcon, SpinnerGapIcon, TrashIcon } from '@phosphor-icons/react'
import { api } from '../api.js'
import { dateTime, guestName, kr, longDate, nightsLabel, num, period } from '../format.js'
import SatisfactionDialog from '../SatisfactionDialog.jsx'
import { useShell } from '../Shell.jsx'
import { Button, ButtonLink, EmptyState, Field, PageHeader, SourceBadge, Stat, StatusBadge, Tile, cx } from '../ui.jsx'

export async function loader({ params }) {
  try {
    const [booking, sales] = await Promise.all([
      api(`/bookings/${params.id}`),
      api(`/bar-sales?bookingId=${params.id}`),
    ])
    return { booking, sales }
  } catch (e) {
    if (e.status === 404) return { booking: null }
    throw e
  }
}

const th = 'h-12 border-b border-line px-4 text-left text-sm font-medium text-ink-3'
const td = 'h-14 border-b border-line px-4'

export default function BookingDetail() {
  const { booking, sales } = useLoaderData()
  const { toast, editBooking } = useShell()
  const navigate = useNavigate()
  const confirmRef = useRef()
  const [deleting, setDeleting] = useState(false)
  const [rating, setRating] = useState(false)

  if (!booking) {
    return (
      <EmptyState
        title="Bookingen findes ikke længere."
        action={<ButtonLink to="/bookinger">Tilbage til bookinger</ButtonLink>}
      />
    )
  }

  const stay = period(booking.checkIn, booking.checkOut)

  async function onDelete() {
    setDeleting(true)
    try {
      await api(`/bookings/${booking.id}`, { method: 'DELETE' })
      toast({ title: 'Booking slettet', description: `${guestName(booking)}, ${stay}` })
      navigate('/bookinger')
    } catch (err) {
      toast({ title: err.message, tone: 'danger' })
      if (err.status === 404) return navigate('/bookinger')
      setDeleting(false)
      confirmRef.current.close()
    }
  }

  return (
    <>
      <nav aria-label="Brødkrumme" className="tnum mb-4 text-sm text-ink-3">
        <Link to="/bookinger" className="hover:text-signal">
          Bookinger
        </Link>{' '}
        / #{booking.id}
      </nav>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-4">
            {guestName(booking)}
            <StatusBadge status={booking.status} />
          </span>
        }
        description={`${stay} · ${booking.roomType.name}, værelse ${booking.room.number} · ${booking.country.name}`}
        actions={
          <>
            {/* The API's status decides when a score is allowed; React does not compare dates (FR-012 (003)) */}
            {booking.status === 'departed' && <Button onClick={() => setRating(true)}>Registrér tilfredshed</Button>}
            <Button onClick={() => editBooking(booking)}>
              <PencilSimpleIcon size={16} className="text-ink-3" />
              Rediger
            </Button>
            <Button variant="danger" onClick={() => confirmRef.current.showModal()}>
              <TrashIcon size={16} />
              Slet booking
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-12 gap-5">
        <Tile title="Ophold" className="col-span-7">
          <dl className="divide-y divide-line">
            <Field label="Ankomst">{longDate(booking.checkIn)}</Field>
            <Field label="Afrejse">{longDate(booking.checkOut)}</Field>
            <Field label="Nætter">{num(booking.nights)}</Field>
            <Field label="Gæster">{num(booking.guestCount)}</Field>
            <Field label="Værelse">
              {booking.roomType.name} · {booking.room.number}
            </Field>
            <Field label="Tilfredshed">
              {booking.satisfactionScore != null ? `${booking.satisfactionScore} af 5` : '–'}
            </Field>
            <Field label="Kilde">{booking.source === 'booking_system' ? <SourceBadge /> : 'Back office'}</Field>
            <Field label="Oprettet">{dateTime(booking.createdAt)}</Field>
          </dl>
        </Tile>

        {/* The stored total only: a per-season split would use today's prices and could differ (FR-009) */}
        <Tile title="Pris" className="col-span-5">
          <Stat label="Totalpris" value={kr(booking.totalPrice)} context={nightsLabel(booking.nights)} />
        </Tile>

        <Tile
          title="Barsalg på værelset"
          flush
          className="col-span-12"
          action={
            ['arriving', 'in_house'].includes(booking.status) && (
              <ButtonLink to={`/barsalg?booking=${booking.id}`} size="sm">
                Registrér salg
              </ButtonLink>
            )
          }
        >
          {sales.items.length === 0 ? (
            <EmptyState title="Ingen barsalg på bookingen." />
          ) : (
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className={cx(th, 'pl-6')}>Tidspunkt</th>
                  <th className={th}>Drink</th>
                  <th className={cx(th, 'text-right')}>Antal</th>
                  <th className={cx(th, 'pr-6 text-right')}>Beløb</th>
                </tr>
              </thead>
              <tbody>
                {sales.items.map((s) => (
                  <tr key={s.id}>
                    <td className={cx(td, 'tnum pl-6')}>{dateTime(s.soldAt)}</td>
                    <td className={td}>{s.drink.name}</td>
                    <td className={cx(td, 'tnum text-right')}>{num(s.quantity)}</td>
                    <td className={cx(td, 'tnum pr-6 text-right')}>{kr(s.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="h-14">
                  <td colSpan={3} className="pl-6 text-ink-2">
                    I alt
                  </td>
                  <td className="tnum pr-6 text-right text-lg font-semibold">{kr(sales.total)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </Tile>
      </div>

      {rating && <SatisfactionDialog booking={booking} onClose={() => setRating(false)} />}

      <dialog
        ref={confirmRef}
        aria-labelledby="delete-title"
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        className="m-auto w-[440px] rounded-xl border border-line bg-surface p-0 shadow-pop backdrop:bg-ink/20 transition-[opacity,scale] duration-150 starting:scale-95 starting:opacity-0"
      >
        <div className="p-6">
          <h2 id="delete-title" className="text-lg font-semibold">
            Slet booking?
          </h2>
          <p className="tnum mt-2 text-ink-2">
            {guestName(booking)} · {booking.roomType.name} · {stay}. Tilknyttede barsalg bevares.
          </p>
          <div className="mt-6 flex justify-end gap-2.5">
            <Button autoFocus onClick={() => confirmRef.current.close()}>
              Annullér
            </Button>
            <Button variant="danger" disabled={deleting} onClick={onDelete}>
              {deleting && <SpinnerGapIcon size={16} className="animate-spin" />}
              Slet booking
            </Button>
          </div>
        </div>
      </dialog>
    </>
  )
}
