import { useState } from 'react'
import { useLoaderData, useRevalidator } from 'react-router'
import { SpinnerGapIcon } from '@phosphor-icons/react'
import { api } from '../api.js'
import { kr } from '../format.js'
import { useToast } from '../Shell.jsx'
import { Button, ErrorBanner, FieldError, PageHeader, Tile, cx, inputClass, invalidProps, labelClass } from '../ui.jsx'

export async function loader() {
  const [me, priceList, drinks] = await Promise.all([api('/auth/me'), api('/admin/prices'), api('/drinks')])
  return { username: me.username, priceList, drinks }
}

const thClass = 'h-12 border-b border-line px-4 text-left text-sm font-medium text-ink-3 first:pl-6 last:pr-6'
const tdClass = 'h-16 border-b border-line px-4 first:pl-6 last:pr-6'
// w-24! because inputClass has w-full, which otherwise wins and lets the table size the fields
const priceInputClass = cx(inputClass, 'tnum w-24! text-right')
// One line under the narrow field: zero width at the right edge, so the API's message runs out to the left instead of
// wrapping or widening the column
const errorClass = 'mt-1.5 ml-auto flex w-0 justify-end text-sm whitespace-nowrap text-danger'

export default function Profile() {
  const { username, priceList, drinks } = useLoaderData()
  return (
    <>
      <PageHeader title="Profil" description={username} />
      <div className="grid grid-cols-12 items-start gap-5">
        <PasswordForm />
        <div className="col-span-8 space-y-5">
          <PriceList priceList={priceList} />
          <DrinkPrices drinks={drinks} />
        </div>
      </div>
    </>
  )
}

function PasswordForm() {
  const toast = useToast()
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    const form = e.currentTarget
    const { currentPassword, newPassword, repeatPassword } = Object.fromEntries(new FormData(form))
    // Only the repeat is checked here; the API decides the rest (FR-019)
    if (newPassword !== repeatPassword) {
      return setError({ field: 'repeatPassword', message: 'Den gentagne adgangskode er ikke den samme.' })
    }
    setPending(true)
    try {
      await api('/auth/password', { method: 'PUT', body: { currentPassword, newPassword } })
      form.reset()
      setError(null)
      toast({ title: 'Adgangskode skiftet' })
    } catch (err) {
      setError(err)
    }
    setPending(false)
  }

  const fields = [
    { name: 'currentPassword', label: 'Nuværende adgangskode', autoComplete: 'current-password' },
    { name: 'newPassword', label: 'Ny adgangskode', autoComplete: 'new-password', minLength: 8 },
    { name: 'repeatPassword', label: 'Gentag ny adgangskode', autoComplete: 'new-password', minLength: 8 },
  ]
  const known = fields.some((f) => f.name === error?.field)

  return (
    <Tile title="Adgangskode" className="col-span-4">
      <form onSubmit={onSubmit} onChange={() => setError(null)} className="space-y-4">
        {!known && <ErrorBanner error={error} />}
        <div className="space-y-4">
          {fields.map(({ name, label, ...props }) => (
            <div key={name}>
              <label htmlFor={name} className={labelClass}>
                {label}
              </label>
              <input
                id={name}
                name={name}
                type="password"
                required
                maxLength={200}
                className={inputClass}
                {...props}
                {...invalidProps(error, name)}
              />
              <FieldError error={error} name={name} />
            </div>
          ))}
        </div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending && <SpinnerGapIcon size={16} className="animate-spin" />}
          Skift adgangskode
        </Button>
      </form>
    </Tile>
  )
}

// One <form> per row in the last cell; the price inputs join it with the form attribute, as a <form> cannot wrap a <tr>
function PriceList({ priceList: { seasons, roomTypes } }) {
  const toast = useToast()
  const revalidator = useRevalidator()
  const [errors, setErrors] = useState({})
  const [pendingRow, setPendingRow] = useState(null)

  async function save(e, roomType) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const current = new Map(roomType.prices.map((p) => [p.seasonId, p.price]))
    // Only the cells that changed are saved
    const changed = seasons.filter((s) => {
      const value = data.get(`s${s.id}`)
      return value !== '' && Number(value) !== current.get(s.id)
    })
    setPendingRow(roomType.id)
    const results = await Promise.allSettled(
      changed.map((s) =>
        api(`/admin/prices/${roomType.id}/${s.id}`, { method: 'PUT', body: { price: Number(data.get(`s${s.id}`)) } }),
      ),
    )
    setPendingRow(null)
    const next = { ...errors }
    changed.forEach((s, i) => (next[`${roomType.id}-${s.id}`] = results[i].reason ?? undefined))
    setErrors(next)
    const saved = results.filter((r) => r.status === 'fulfilled').length
    if (saved) {
      revalidator.revalidate()
      toast({ title: 'Priser gemt', description: `${roomType.name}, ${saved} ${saved === 1 ? 'sæson' : 'sæsoner'}` })
    } else if (!changed.length) {
      toast({ title: 'Ingen ændringer', description: roomType.name })
    }
  }

  return (
    <Tile title="Prisliste" flush>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className={thClass}>Værelsestype</th>
              {seasons.map((s) => (
                <th key={s.id} className={cx(thClass, 'text-right')}>
                  {s.name}
                </th>
              ))}
              <th className={thClass}>
                <span className="sr-only">Gem</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {roomTypes.map((rt) => (
              <tr key={rt.id}>
                {/* Top-aligned in h-11 boxes, so name, fields and Gem stay on one line when a field shows an error */}
                <th scope="row" className={cx(tdClass, 'py-3 text-left align-top font-medium whitespace-nowrap')}>
                  <span className="flex h-11 items-center">{rt.name}</span>
                </th>
                {seasons.map((s) => {
                  const id = `price-${rt.id}-${s.id}`
                  const cell = `${rt.id}-${s.id}`
                  const error = errors[cell]
                  const price = rt.prices.find((p) => p.seasonId === s.id)?.price
                  return (
                    <td key={s.id} className={cx(tdClass, 'py-3 text-right align-top')}>
                      <label htmlFor={id} className="sr-only">
                        {rt.name}, {s.name}
                      </label>
                      {/* key: a saved price remounts the field, so it shows the stored value after revalidation */}
                      <input
                        key={price}
                        id={id}
                        name={`s${s.id}`}
                        form={`prices-${rt.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        defaultValue={price}
                        onChange={() => error && setErrors((errs) => ({ ...errs, [cell]: undefined }))}
                        className={priceInputClass}
                        {...(error && { 'aria-invalid': true, 'aria-describedby': `${id}-error` })}
                      />
                      {error && (
                        <p id={`${id}-error`} role="alert" className={errorClass}>
                          {error.message}
                        </p>
                      )}
                    </td>
                  )
                })}
                <td className={cx(tdClass, 'w-px py-3 align-top')}>
                  <form id={`prices-${rt.id}`} onSubmit={(e) => save(e, rt)} className="flex h-11 items-center">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={pendingRow === rt.id}
                      aria-label={`Gem priser for ${rt.name}`}
                    >
                      Gem
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Tile>
  )
}

function DrinkPrices({ drinks }) {
  const toast = useToast()
  const revalidator = useRevalidator()
  const [error, setError] = useState(null)

  async function save(e, drink) {
    e.preventDefault()
    const price = Number(new FormData(e.currentTarget).get('price'))
    try {
      const saved = await api(`/admin/drinks/${drink.id}`, { method: 'PUT', body: { price } })
      setError(null)
      revalidator.revalidate()
      toast({ title: 'Pris gemt', description: `${saved.name}, ${kr(saved.price)}` })
    } catch (err) {
      // Not a spread: an Error's message is not enumerable and would be lost
      setError(Object.assign(err, { drinkId: drink.id }))
    }
  }

  return (
    <Tile title="Drinkkort" count={drinks.length} flush>
      <table className="w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={thClass}>Drink</th>
            <th className={thClass}>Kategori</th>
            <th className={cx(thClass, 'text-right')}>Pris</th>
          </tr>
        </thead>
        <tbody>
          {drinks.map((d) => {
            const id = `drink-price-${d.id}`
            const err = error?.drinkId === d.id ? error : null
            return (
              <tr key={d.id}>
                <th scope="row" className={cx(tdClass, 'text-left font-medium')}>
                  {d.name}
                </th>
                <td className={cx(tdClass, 'text-ink-2')}>{d.category}</td>
                <td className={cx(tdClass, 'py-3')}>
                  <form onSubmit={(e) => save(e, d)} className="flex items-start justify-end gap-2">
                    <div>
                      <label htmlFor={id} className="sr-only">
                        Pris for {d.name}
                      </label>
                      <input
                        key={d.price}
                        id={id}
                        name="price"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        required
                        defaultValue={d.price}
                        onChange={() => err && setError(null)}
                        className={priceInputClass}
                        {...(err && { 'aria-invalid': true, 'aria-describedby': `${id}-error` })}
                      />
                      {err && (
                        <p id={`${id}-error`} role="alert" className={errorClass}>
                          {err.message}
                        </p>
                      )}
                    </div>
                    <Button type="submit" size="sm" className="mt-1.5" aria-label={`Gem pris for ${d.name}`}>
                      Gem
                    </Button>
                  </form>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Tile>
  )
}
