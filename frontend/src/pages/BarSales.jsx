import { useState } from 'react'
import { useLoaderData, useRevalidator, useSearchParams } from 'react-router'
import { SpinnerGapIcon } from '@phosphor-icons/react'
import { api } from '../api.js'
import { guestName, kr, num, time, today } from '../format.js'
import { useToast } from '../Shell.jsx'
import {
  Button,
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

const FIELDS = ['drinkId', 'quantity', 'bookingId']

export async function loader() {
  const [drinks, sales, inHouse] = await Promise.all([
    api('/drinks'),
    // The API has no default day, so ask for today's sales explicitly
    api('/bar-sales?date=' + today()),
    api('/bookings?view=in_house&limit=500'),
  ])
  return { drinks, sales, guests: inHouse.items }
}

const th = 'h-12 border-b border-line px-4 text-left text-sm font-medium text-ink-3'
const td = 'h-14 border-b border-line px-4'

export default function BarSales() {
  const { drinks, sales, guests } = useLoaderData()
  const [params] = useSearchParams()
  const toast = useToast()
  const revalidator = useRevalidator()
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    const form = e.currentTarget
    const f = Object.fromEntries(new FormData(form))
    setSaving(true)
    setError(null)
    try {
      const sale = await api('/bar-sales', {
        method: 'POST',
        body: {
          drinkId: Number(f.drinkId),
          quantity: Number(f.quantity),
          bookingId: f.bookingId ? Number(f.bookingId) : null,
        },
      })
      toast({
        title: 'Salg registreret',
        description: `${num(sale.quantity)} × ${sale.drink.name} · ${kr(sale.amount)}`,
      })
      form.reset()
      revalidator.revalidate()
    } catch (err) {
      setError(err)
    }
    setSaving(false)
  }

  function onChange(e) {
    if (!error?.field || error.field === e.target.name) setError(null)
  }

  return (
    <>
      <PageHeader title="Barsalg" description={`Helene Christine · lobbybaren · I dag: ${kr(sales.total)}`} />

      <div className="grid grid-cols-12 items-start gap-5">
        <Tile title="Registrér salg" className="col-span-5">
          <form onSubmit={onSubmit} onChange={onChange} className="space-y-6">
            {error && !FIELDS.includes(error.field) && <ErrorBanner error={error} />}

            {Object.entries(Object.groupBy(drinks, (d) => d.category)).map(([category, list]) => (
              <fieldset key={category}>
                <legend className={labelClass}>{category}</legend>
                <div className="grid grid-cols-2 gap-2">
                  {list.map((d) => (
                    <label key={d.id} className={radioCardClass}>
                      <input
                        type="radio"
                        name="drinkId"
                        value={d.id}
                        required
                        className="sr-only"
                        {...invalidProps(error, 'drinkId')}
                      />
                      <span className="font-medium">{d.name}</span>
                      <span className="tnum mt-1 text-sm text-ink-3">{kr(d.price)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <FieldError error={error} name="drinkId" />

            <div className="grid grid-cols-[8rem_1fr] gap-4">
              <div>
                <label htmlFor="quantity" className={labelClass}>
                  Antal
                </label>
                <input
                  id="quantity"
                  name="quantity"
                  type="number"
                  min="1"
                  defaultValue="1"
                  required
                  className={inputClass}
                  {...invalidProps(error, 'quantity')}
                />
              </div>
              <div>
                <label htmlFor="bookingId" className={labelClass}>
                  Læg på værelse
                </label>
                <select
                  key={params.get('booking')}
                  id="bookingId"
                  name="bookingId"
                  defaultValue={params.get('booking') ?? ''}
                  className={inputClass}
                  {...invalidProps(error, 'bookingId')}
                >
                  <option value="">Ingen</option>
                  {guests.map((b) => (
                    <option key={b.id} value={b.id}>
                      Værelse {b.room.number} · {guestName(b)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <FieldError error={error} name="quantity" />
            <FieldError error={error} name="bookingId" />

            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? (
                <>
                  <SpinnerGapIcon size={16} className="animate-spin" />
                  Registrerer…
                </>
              ) : (
                'Registrér salg'
              )}
            </Button>
          </form>
        </Tile>

        <Tile title="Dagens salg" flush className="col-span-7">
          {sales.items.length === 0 ? (
            <EmptyState title="Ingen salg i dag endnu." />
          ) : (
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className={cx(th, 'pl-6')}>Tidspunkt</th>
                  <th className={th}>Drink</th>
                  <th className={th}>Kategori</th>
                  <th className={cx(th, 'text-right')}>Antal</th>
                  <th className={cx(th, 'text-right')}>Beløb</th>
                  <th className={cx(th, 'pr-6')}>Værelse</th>
                </tr>
              </thead>
              <tbody>
                {sales.items.map((s) => (
                  <tr key={s.id}>
                    <td className={cx(td, 'tnum pl-6')}>{time(s.soldAt)}</td>
                    <td className={td}>{s.drink.name}</td>
                    <td className={cx(td, 'text-ink-2')}>{s.drink.category}</td>
                    <td className={cx(td, 'tnum text-right')}>{num(s.quantity)}</td>
                    <td className={cx(td, 'tnum text-right')}>{kr(s.amount)}</td>
                    <td className={cx(td, 'tnum pr-6')}>{s.roomNumber ?? <span className="text-ink-4">–</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="h-14">
                  <td colSpan={4} className="pl-6 text-ink-2">
                    I alt
                  </td>
                  <td className="tnum text-right text-lg font-semibold">{kr(sales.total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </Tile>
      </div>
    </>
  )
}
