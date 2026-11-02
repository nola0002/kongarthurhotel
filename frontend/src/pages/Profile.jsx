import { useState } from 'react'
import { useLoaderData, useNavigate, useRevalidator } from 'react-router'
import { SignOutIcon, SpinnerGapIcon } from '@phosphor-icons/react'
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
const priceInputClass = cx(inputClass, 'tnum w-32 text-right')

export default function Profile() {
  const { username, priceList, drinks } = useLoaderData()
  return (
    <>
      <PageHeader title="Profil" description="Din konto og hotellets priser." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Account username={username} />
        <PasswordForm />
      </div>
      <h2 className="pt-12 pb-1 text-2xl font-semibold tracking-[-0.02em]">Administration</h2>
      <p className="pb-6 text-ink-2">Nye priser gælder nye bookinger og salg. Eksisterende beholder deres pris.</p>
      <div className="space-y-6">
        <PriceList priceList={priceList} />
        <DrinkPrices drinks={drinks} />
      </div>
    </>
  )
}

function Account({ username }) {
  const navigate = useNavigate()
  const toast = useToast()

  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch (e) {
      // 401: the session had already expired, so the user is logged out anyway
      if (e.status !== 401) return toast({ title: e.message, tone: 'danger' })
    }
    navigate('/login')
  }

  return (
    <Tile title="Konto">
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-full bg-sunken text-lg font-semibold text-ink-2 uppercase shadow-panel"
        >
          {username.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-medium">{username}</p>
          <p className="text-sm text-ink-3">Receptionens fælles konto</p>
        </div>
      </div>
      <Button className="mt-6" onClick={logout}>
        <SignOutIcon size={17} className="text-ink-3" />
        Log ud
      </Button>
    </Tile>
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
      toast({ title: 'Adgangskode skiftet', description: 'Brug den nye adgangskode næste gang du logger ind.' })
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
    <Tile title="Skift adgangskode">
      <form onSubmit={onSubmit} onChange={() => setError(null)} className="space-y-4">
        {!known && <ErrorBanner error={error} />}
        <div className="grid gap-4 sm:grid-cols-3">
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
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-ink-3">Mindst 8 tegn.</p>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending && <SpinnerGapIcon size={16} className="animate-spin" />}
            Skift adgangskode
          </Button>
        </div>
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
    <Tile title="Prisliste" flush action={<span className="text-sm text-ink-3">Pris pr. nat i kr.</span>}>
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
                <th scope="row" className={cx(tdClass, 'text-left font-medium')}>
                  {rt.name}
                </th>
                {seasons.map((s) => {
                  const id = `price-${rt.id}-${s.id}`
                  const error = errors[`${rt.id}-${s.id}`]
                  return (
                    <td key={s.id} className={cx(tdClass, 'py-3 text-right align-top')}>
                      <label htmlFor={id} className="sr-only">
                        {rt.name}, {s.name}
                      </label>
                      <input
                        id={id}
                        name={`s${s.id}`}
                        form={`prices-${rt.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        defaultValue={rt.prices.find((p) => p.seasonId === s.id)?.price}
                        className={priceInputClass}
                        {...(error && { 'aria-invalid': true, 'aria-describedby': `${id}-error` })}
                      />
                      {error && (
                        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-danger">
                          {error.message}
                        </p>
                      )}
                    </td>
                  )
                })}
                <td className={cx(tdClass, 'w-px text-right')}>
                  <form id={`prices-${rt.id}`} onSubmit={(e) => save(e, rt)}>
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
      setError({ ...err, drinkId: drink.id })
    }
  }

  return (
    <Tile title="Drinkkort" count={drinks.length} flush>
      <table className="w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={thClass}>Drink</th>
            <th className={thClass}>Kategori</th>
            <th className={cx(thClass, 'text-right')}>Pris i kr.</th>
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
                        id={id}
                        name="price"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        required
                        defaultValue={d.price}
                        className={priceInputClass}
                        {...(err && { 'aria-invalid': true, 'aria-describedby': `${id}-error` })}
                      />
                      {err && (
                        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-danger">
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
