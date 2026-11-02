import { useRef, useState } from 'react'
import { Link, useLoaderData, useNavigate } from 'react-router'
import { SpinnerGapIcon } from '@phosphor-icons/react'
import { api } from '../api.js'
import { date, dateTime, guestName, kr, num, period } from '../format.js'
import { useStayActions } from '../SatisfactionDialog.jsx'
import { useShell } from '../Shell.jsx'
import { Button, ButtonLink, EmptyState, Field, PageHeader, SourceBadge, StatusBadge, Tile, cx } from '../ui.jsx'

export async function loader({ params }) {
  try {
    return await api(`/bookings/${params.id}/folio`)
  } catch (e) {
    if (e.status === 404) return { booking: null }
    throw e
  }
}

const th = 'h-12 border-b border-line px-4 text-left text-sm font-medium text-ink-3'
const td = 'h-14 border-b border-line px-4'
const orDash = (value) => value ?? <span className="text-ink-4">–</span>

// The guest's folio: booking, nights, bar sales and bill, all amounts from the API (005 FR-008–FR-010)
export default function BookingDetail() {
  const { booking, nights, barSales, bill } = useLoaderData()
  const { toast, editBooking } = useShell()
  const navigate = useNavigate()
  const stayActions = useStayActions()
  const confirmRef = useRef()
  const [deleting, setDeleting] = useState(false)

  if (!booking) {
    return (
      <EmptyState
        title="Bookingen findes ikke længere."
        action={<ButtonLink to="/bookinger">Tilbage til bookinger</ButtonLink>}
      />
    )
  }

  const stay = period(booking.checkIn, booking.checkOut)
  const pending = stayActions.pending === booking.id

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
        description={`${stay} · værelse ${booking.room.number}, ${booking.roomType.name} · ${booking.country.name}`}
        actions={
          <>
            {/* Only the step that fits the API's status is offered; the API has the last word (FR-010) */}
            {booking.status === 'arriving' && (
              <Button variant="primary" disabled={pending} onClick={() => stayActions.run(booking, 'check-in')}>
                {pending && <SpinnerGapIcon size={16} className="animate-spin" />}
                Tjek ind
              </Button>
            )}
            {booking.status === 'departing' && (
              <Button variant="primary" disabled={pending} onClick={() => stayActions.run(booking, 'check-out')}>
                {pending && <SpinnerGapIcon size={16} className="animate-spin" />}
                Tjek ud
              </Button>
            )}
            {['arriving', 'in_house'].includes(booking.status) && (
              <ButtonLink to={`/barsalg?booking=${booking.id}`}>Sælg på værelset</ButtonLink>
            )}
            {['departing', 'checked_out', 'departed'].includes(booking.status) && (
              <Button onClick={() => stayActions.rate(booking)}>
                {booking.satisfactionScore != null ? 'Ret tilfredshed' : 'Registrér tilfredshed'}
              </Button>
            )}
            <Button onClick={() => editBooking(booking)}>Rediger</Button>
            <Button variant="danger" onClick={() => confirmRef.current.showModal()}>
              Slet booking
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-12 items-start gap-5">
        <Tile title="Gæst" className="col-span-4">
          <dl className="divide-y divide-line">
            <Field label="Land">{booking.country.name}</Field>
            <Field label="Antal gæster">{num(booking.guestCount)}</Field>
            <Field label="Kilde">{booking.source === 'booking_system' ? <SourceBadge /> : 'Back office'}</Field>
            <Field label="Oprettet">{dateTime(booking.createdAt)}</Field>
          </dl>
        </Tile>

        <Tile title="Ophold" className="col-span-4">
          <dl className="divide-y divide-line">
            <Field label="Ankomst">{date(booking.checkIn)}</Field>
            <Field label="Afrejse">{date(booking.checkOut)}</Field>
            <Field label="Nætter">{num(booking.nights)}</Field>
            <Field label="Værelse">
              {booking.room.number} · {booking.roomType.name}
            </Field>
            <Field label="Tjekket ind">{orDash(booking.checkedInAt && dateTime(booking.checkedInAt))}</Field>
            <Field label="Tjekket ud">{orDash(booking.checkedOutAt && dateTime(booking.checkedOutAt))}</Field>
            <Field label="Tilfredshed">
              {orDash(booking.satisfactionScore != null ? `${booking.satisfactionScore} af 5` : null)}
            </Field>
          </dl>
        </Tile>

        <Tile title="Regning" className="col-span-4">
          <dl className="divide-y divide-line">
            <Field label="Ophold">{kr(bill.stay)}</Field>
            <Field label="Barsalg">{kr(bill.bar)}</Field>
            <div className="flex items-baseline justify-between gap-4 pt-4">
              <dt className="font-medium">I alt</dt>
              <dd className="tnum text-3xl font-semibold tracking-[-0.02em]">{kr(bill.total)}</dd>
            </div>
          </dl>
        </Tile>

        {/* Each night's share of the frozen price, split by the backend so the lines sum to it (FR-008) */}
        <Tile title="Nætter" count={num(nights.length)} flush className="col-span-6">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={cx(th, 'pl-6')}>Dato</th>
                <th className={th}>Sæson</th>
                <th className={cx(th, 'pr-6 text-right')}>Pris</th>
              </tr>
            </thead>
            <tbody>
              {nights.map((n) => (
                <tr key={n.date}>
                  <td className={cx(td, 'tnum pl-6')}>{date(n.date)}</td>
                  <td className={td}>{orDash(n.season)}</td>
                  <td className={cx(td, 'tnum pr-6 text-right')}>{kr(n.price)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="h-14">
                <td colSpan={2} className="pl-6 text-ink-2">
                  Opholdet i alt
                </td>
                <td className="tnum pr-6 text-right text-lg font-semibold">{kr(bill.stay)}</td>
              </tr>
            </tfoot>
          </table>
        </Tile>

        <Tile title="Barsalg på værelset" count={num(barSales.items.length)} flush className="col-span-6">
          {barSales.items.length === 0 ? (
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
                {barSales.items.map((s) => (
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
                    Barsalg i alt
                  </td>
                  <td className="tnum pr-6 text-right text-lg font-semibold">{kr(barSales.total)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </Tile>
      </div>

      {stayActions.dialog}

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
