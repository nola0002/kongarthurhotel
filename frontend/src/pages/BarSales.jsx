import { useState } from 'react'
import { useLoaderData, useSearchParams } from 'react-router'
import { ChartBarIcon, MinusIcon, PlusIcon, SpinnerGapIcon, XIcon } from '@phosphor-icons/react'
import { api } from '../api.js'
import { guestName, krExact as kr, num } from '../format.js'
import { useToast } from '../Shell.jsx'
import {
  Button,
  ButtonLink,
  EmptyState,
  ErrorBanner,
  FieldError,
  PageHeader,
  Tile,
  cx,
  inputClass,
  invalidProps,
  labelClass,
  radioCardClass,
} from '../ui.jsx'

export async function loader() {
  const [drinks, inHouse] = await Promise.all([api('/drinks'), api('/bookings?view=in_house&pageSize=250&sort=guest')])
  return { drinks, guests: inHouse.items }
}

// Display estimate only, in øre so floats never add up wrong; the registered amount is the API's answer (R7)
const estimate = (lines) => lines.reduce((sum, l) => sum + Math.round(l.drink.price * 100) * l.quantity, 0) / 100

export default function BarSales() {
  const [params] = useSearchParams()
  // A new ?booking= (e.g. "Sælg på værelset" from another folio) starts a fresh till for that guest
  return <Till key={params.get('booking')} booking={params.get('booking') ?? ''} />
}

function Till({ booking }) {
  const { drinks, guests } = useLoaderData()
  const toast = useToast()
  const [lines, setLines] = useState([])
  const [onRoom, setOnRoom] = useState(Boolean(booking))
  const [bookingId, setBookingId] = useState(booking)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const quantityOf = (id) => lines.find((l) => l.drink.id === id)?.quantity ?? 0
  const units = lines.reduce((sum, l) => sum + l.quantity, 0)

  function change(drink, delta) {
    setError(null)
    setLines((ls) =>
      ls.some((l) => l.drink.id === drink.id)
        ? ls
            .map((l) => (l.drink.id === drink.id ? { ...l, quantity: l.quantity + delta } : l))
            .filter((l) => l.quantity > 0)
        : [...ls, { drink, quantity: 1 }],
    )
  }

  function remove(id) {
    setError(null)
    setLines((ls) => ls.filter((l) => l.drink.id !== id))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const order = await api('/bar-sales/orders', {
        method: 'POST',
        body: {
          bookingId: onRoom ? Number(bookingId) : null,
          items: lines.map((l) => ({ drinkId: l.drink.id, quantity: l.quantity })),
        },
      })
      const room = order.items[0]?.roomNumber
      toast({
        title: `Ordre registreret · ${kr(order.total)}`,
        description:
          order.items.map((s) => `${num(s.quantity)} × ${s.drink.name}`).join(', ') +
          (room ? ` · værelse ${room}` : ' · betalt direkte'),
      })
      // The next customer pays directly unless chosen otherwise, so no drink lands on the previous guest's room
      setLines([])
      setOnRoom(false)
      setBookingId('')
    } catch (err) {
      setError(err)
    }
    setSaving(false)
  }

  return (
    <>
      <PageHeader
        title="Kasse"
        description="Lobbybaren"
        actions={
          <ButtonLink to="/omsaetning" variant="ghost" size="sm">
            <ChartBarIcon size={16} className="text-ink-3" />
            Omsætning
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-12 items-start gap-5">
        <div className="col-span-8 space-y-8">
          {Object.entries(Object.groupBy(drinks, (d) => d.category)).map(([category, list]) => (
            <section key={category} aria-labelledby={`category-${category}`}>
              <h2 id={`category-${category}`} className="mb-3 text-lg font-semibold tracking-[-0.01em]">
                {category}
              </h2>
              <div className="grid grid-cols-4 gap-3">
                {list.map((d) => {
                  const quantity = quantityOf(d.id)
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => change(d, 1)}
                      className={cx(
                        'relative flex h-24 flex-col justify-between rounded-xl p-4 text-left shadow-panel transition-colors duration-100 select-none',
                        quantity ? 'bg-signal-soft ring-1 ring-signal/40' : 'bg-surface hover:bg-sunken active:bg-line',
                      )}
                    >
                      <span className="pr-8 leading-snug font-medium">{d.name}</span>
                      <span className="tnum text-sm text-ink-3">{kr(d.price)}</span>
                      {quantity > 0 && (
                        <span className="tnum absolute top-3 right-3 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-signal px-1.5 text-sm font-medium text-white">
                          {num(quantity)}
                          <span className="sr-only"> i ordren</span>
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        <Tile
          title="Ordre"
          count={units ? num(units) : null}
          action={
            lines.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setLines([])}>
                Ryd
              </Button>
            )
          }
          className="sticky top-6 col-span-4"
        >
          <form onSubmit={onSubmit} className="space-y-6">
            {lines.length === 0 ? (
              <EmptyState title="Ordren er tom." body="Tryk på en drink for at lægge den i ordren." />
            ) : (
              <ul className="divide-y divide-line">
                {lines.map(({ drink, quantity }) => (
                  <li key={drink.id} className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{drink.name}</span>
                      <span className="tnum">{kr(estimate([{ drink, quantity }]))}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      <span className="tnum mr-auto text-sm text-ink-3">{kr(drink.price)} pr. stk.</span>
                      <Button size="icon" aria-label={`Én mindre ${drink.name}`} onClick={() => change(drink, -1)}>
                        <MinusIcon size={16} className="text-ink-3" />
                      </Button>
                      <span className="tnum w-9 text-center font-medium">{num(quantity)}</span>
                      <Button size="icon" aria-label={`Én mere ${drink.name}`} onClick={() => change(drink, 1)}>
                        <PlusIcon size={16} className="text-ink-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Fjern ${drink.name}`}
                        onClick={() => remove(drink.id)}
                      >
                        <XIcon size={16} />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-baseline justify-between border-t border-line pt-4">
              <span className="text-ink-2">I alt</span>
              <span className="tnum text-2xl font-semibold tracking-[-0.02em]">{kr(estimate(lines))}</span>
            </div>

            <fieldset>
              <legend className={labelClass}>Betaling</legend>
              <div className="grid grid-cols-2 gap-2">
                <label className={radioCardClass}>
                  <input
                    type="radio"
                    name="payment"
                    checked={!onRoom}
                    onChange={() => setOnRoom(false)}
                    className="sr-only"
                  />
                  <span className="font-medium">Betalt direkte</span>
                </label>
                <label className={radioCardClass}>
                  <input
                    type="radio"
                    name="payment"
                    checked={onRoom}
                    onChange={() => setOnRoom(true)}
                    className="sr-only"
                  />
                  <span className="font-medium">Læg på værelse</span>
                </label>
              </div>
            </fieldset>

            {onRoom && (
              <div>
                <label htmlFor="bookingId" className={labelClass}>
                  Gæst i huset
                </label>
                <select
                  id="bookingId"
                  name="bookingId"
                  required
                  value={bookingId}
                  onChange={(e) => {
                    setBookingId(e.target.value)
                    setError(null)
                  }}
                  className={inputClass}
                  {...invalidProps(error, 'bookingId')}
                >
                  <option value="">Vælg værelse</option>
                  {guests.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.room.number} · {guestName(b)}
                    </option>
                  ))}
                </select>
                <FieldError error={error} name="bookingId" />
              </div>
            )}

            {error?.field !== 'bookingId' && <ErrorBanner error={error} />}

            <Button type="submit" variant="primary" disabled={lines.length === 0 || saving} className="w-full">
              {saving ? (
                <>
                  <SpinnerGapIcon size={16} className="animate-spin" />
                  Afslutter…
                </>
              ) : (
                'Afslut ordre'
              )}
            </Button>
          </form>
        </Tile>
      </div>
    </>
  )
}
