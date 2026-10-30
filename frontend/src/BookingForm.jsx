import { useEffect, useRef, useState } from 'react'
import { useNavigate, useRevalidator } from 'react-router'
import { SpinnerGapIcon, XIcon } from '@phosphor-icons/react'
import { api } from './api.js'
import { guestName, isoWeek, kr, nightsLabel, period } from './format.js'
import { useToast } from './Shell.jsx'
import {
  Button,
  ErrorBanner,
  FieldError,
  Kbd,
  cx,
  inputClass,
  invalidProps,
  labelClass,
  radioCardClass,
} from './ui.jsx'

const FIELDS = ['firstName', 'familyName', 'countryCode', 'roomTypeId', 'checkIn', 'checkOut', 'guestCount']

// Create and edit in one drawer. Mounted when opened and unmounted on close, so the form resets itself.
export default function BookingForm({ booking, onClose }) {
  const ref = useRef()
  const pressed = useRef()
  const toast = useToast()
  const navigate = useNavigate()
  const revalidator = useRevalidator()
  const [countries, setCountries] = useState([])
  const [roomTypes, setRoomTypes] = useState([])
  const [quote, setQuote] = useState(null)
  const [submitError, setSubmitError] = useState(null)
  // Kept apart, so it follows the current inputs and vanishes once they are valid again
  const [quoteError, setQuoteError] = useState(null)
  const error = submitError ?? quoteError
  const [saving, setSaving] = useState(false)
  // Only the inputs the quote depends on; the rest is read with FormData on submit
  const [draft, setDraft] = useState({
    roomTypeId: booking ? String(booking.roomType.id) : '',
    checkIn: booking?.checkIn ?? '',
    checkOut: booking?.checkOut ?? '',
    guestCount: booking ? String(booking.guestCount) : '',
  })
  const exclude = booking ? { excludeBookingId: booking.id } : {}

  useEffect(() => ref.current.showModal(), [])

  useEffect(() => {
    api('/countries').then(setCountries, setSubmitError)
  }, [])

  useEffect(() => {
    let ignore = false
    const dates =
      draft.checkIn && draft.checkOut ? { checkIn: draft.checkIn, checkOut: draft.checkOut, ...exclude } : {}
    // A rejected period (e.g. wrong date order) is reported by the quote, so the cards just keep their last state
    api('/room-types?' + new URLSearchParams(dates)).then(
      (r) => !ignore && setRoomTypes(r),
      () => {},
    )
    return () => (ignore = true)
  }, [draft.checkIn, draft.checkOut])

  useEffect(() => {
    setQuote(null)
    setQuoteError(null)
    const { roomTypeId, checkIn, checkOut, guestCount } = draft
    if (!roomTypeId || !checkIn || !checkOut) return
    let ignore = false
    const params = new URLSearchParams({ roomTypeId, checkIn, checkOut, ...(guestCount && { guestCount }), ...exclude })
    api('/bookings/quote?' + params).then(
      (q) => !ignore && setQuote(q),
      (e) => !ignore && setQuoteError(e),
    )
    return () => (ignore = true)
  }, [draft.roomTypeId, draft.checkIn, draft.checkOut, draft.guestCount])

  function onChange(e) {
    const { name, value } = e.target
    if (name in draft) setDraft((d) => ({ ...d, [name]: value }))
    if (!submitError?.field || submitError.field === name) setSubmitError(null)
  }

  async function onSubmit(e) {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.currentTarget))
    const body = { ...f, roomTypeId: Number(f.roomTypeId), guestCount: Number(f.guestCount) }
    setSaving(true)
    setSubmitError(null)
    try {
      const saved = await api(booking ? `/bookings/${booking.id}` : '/bookings', {
        method: booking ? 'PUT' : 'POST',
        body,
      })
      toast({
        title: booking ? 'Booking opdateret' : 'Booking oprettet',
        description: `${guestName(saved)}, ${period(saved.checkIn, saved.checkOut)} · værelse ${saved.room.number}`,
      })
      ref.current.close()
      revalidator.revalidate()
    } catch (err) {
      setSaving(false)
      if (err.status !== 404) return setSubmitError(err)
      // Deleted by someone else while the drawer was open
      ref.current.close()
      toast({ title: err.message, tone: 'danger' })
      navigate('/bookinger')
    }
  }

  const close = () => ref.current.close()
  const field = (name) => ({ id: name, name, className: inputClass, ...invalidProps(error, name) })

  return (
    <dialog
      ref={ref}
      aria-labelledby="booking-form-title"
      onClose={onClose}
      // Close only when the press also started outside the panel; a drag out of an input must not discard the form
      onMouseDown={(e) => (pressed.current = e.target)}
      onClick={(e) => e.target === e.currentTarget && pressed.current === e.currentTarget && close()}
      className="m-0 ml-auto h-dvh max-h-none w-full max-w-[560px] bg-transparent p-2 backdrop:bg-ink/20 transition-[translate] duration-200 ease-out starting:translate-x-8"
    >
      <form
        onSubmit={onSubmit}
        onChange={onChange}
        className="flex h-full flex-col overflow-hidden rounded-3xl bg-surface shadow-pop"
      >
        <header className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 id="booking-form-title" className="text-2xl font-semibold tracking-[-0.02em]">
            {booking ? 'Rediger booking' : 'Ny booking'}
          </h2>
          <Button variant="ghost" size="icon" aria-label="Luk" onClick={close}>
            <XIcon size={18} />
          </Button>
        </header>

        <div className="flex-1 space-y-9 overflow-y-auto px-6 py-6">
          {error && !FIELDS.includes(error.field) && <ErrorBanner error={error} />}

          <section>
            <h3 className="mb-3 font-semibold">Gæst</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className={labelClass}>
                    Fornavn
                  </label>
                  <input
                    {...field('firstName')}
                    required
                    maxLength={75}
                    autoComplete="off"
                    defaultValue={booking?.firstName}
                  />
                  <FieldError error={error} name="firstName" />
                </div>
                <div>
                  <label htmlFor="familyName" className={labelClass}>
                    Efternavn
                  </label>
                  <input
                    {...field('familyName')}
                    required
                    maxLength={75}
                    autoComplete="off"
                    defaultValue={booking?.familyName}
                  />
                  <FieldError error={error} name="familyName" />
                </div>
              </div>
              <div>
                <label htmlFor="countryCode" className={labelClass}>
                  Land
                </label>
                {/* key: defaultValue only applies on mount, and the options arrive later */}
                <select
                  {...field('countryCode')}
                  key={countries.length}
                  required
                  defaultValue={booking?.country.code ?? ''}
                >
                  <option value="">Vælg land</option>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <FieldError error={error} name="countryCode" />
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-3 font-semibold">Ophold</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="checkIn" className={labelClass}>
                  Ankomst
                </label>
                <input {...field('checkIn')} type="date" required defaultValue={booking?.checkIn} />
                <FieldError error={error} name="checkIn" />
              </div>
              <div>
                <label htmlFor="checkOut" className={labelClass}>
                  Afrejse
                </label>
                <input {...field('checkOut')} type="date" required defaultValue={booking?.checkOut} />
                <FieldError error={error} name="checkOut" />
              </div>
            </div>
            <p className="tnum mt-2 min-h-5 text-sm text-ink-3">
              {quote && `${nightsLabel(quote.nights)} · uge ${isoWeek(draft.checkIn)}`}
            </p>
            <div className="mt-4 w-40">
              <label htmlFor="guestCount" className={labelClass}>
                Antal gæster
              </label>
              <input {...field('guestCount')} type="number" min="1" required defaultValue={booking?.guestCount} />
            </div>
            <FieldError error={error} name="guestCount" />
          </section>

          <section>
            <h3 className="mb-3 font-semibold">Værelsestype</h3>
            <div className="grid grid-cols-2 gap-2">
              {roomTypes.map((rt) => {
                const soldOut = rt.availableRooms === 0
                return (
                  <label key={rt.id} className={radioCardClass}>
                    <input
                      type="radio"
                      name="roomTypeId"
                      value={rt.id}
                      required
                      className="sr-only"
                      defaultChecked={booking?.roomType.id === rt.id}
                      // A selected type stays enabled, so the backend's own message explains it on save
                      disabled={soldOut && draft.roomTypeId !== String(rt.id)}
                      {...invalidProps(error, 'roomTypeId')}
                    />
                    <span className="font-medium">{rt.name}</span>
                    <span className="tnum mt-1 text-sm text-ink-3">
                      {soldOut ? 'Udsolgt i perioden' : `plads til ${rt.capacity} · fra ${kr(rt.fromPrice)}/nat`}
                    </span>
                  </label>
                )
              })}
            </div>
            <FieldError error={error} name="roomTypeId" />
          </section>

          <section>
            <h3 className="mb-3 font-semibold">Pris</h3>
            <dl className="tnum rounded-lg bg-sunken p-4">
              {/* Index key: a long stay returns the same season name more than once */}
              {quote?.lines.map((l, i) => (
                <div key={i} className="flex justify-between py-1 text-ink-2">
                  <dt>
                    {nightsLabel(l.nights)} × {kr(l.pricePerNight)} ({l.season})
                  </dt>
                  <dd>{kr(l.subtotal)}</dd>
                </div>
              ))}
              <div className={cx('flex items-baseline justify-between', quote && 'mt-2 border-t border-line pt-3')}>
                <dt className="font-medium">I alt</dt>
                <dd className="text-xl font-semibold">
                  {quote ? kr(quote.total) : <span className="text-ink-4">–</span>}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <footer className="flex items-center justify-between border-t border-line px-6 py-4">
          <span className="flex items-center gap-2 text-sm text-ink-3">
            <Kbd>Esc</Kbd> lukker
          </span>
          <div className="flex gap-2.5">
            <Button onClick={close}>Annullér</Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? (
                <>
                  <SpinnerGapIcon size={16} className="animate-spin" />
                  Gemmer…
                </>
              ) : booking ? (
                'Gem ændringer'
              ) : (
                'Opret booking'
              )}
            </Button>
          </div>
        </footer>
      </form>
    </dialog>
  )
}
