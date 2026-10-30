import { useEffect, useRef, useState } from 'react'
import { useRevalidator } from 'react-router'
import { SpinnerGapIcon } from '@phosphor-icons/react'
import { api } from './api.js'
import { guestName, period } from './format.js'
import { useToast } from './Shell.jsx'
import { Button, ErrorBanner, cx, labelClass, radioCardClass } from './ui.jsx'

const SCORES = [
  [1, 'Meget utilfreds'],
  [2, 'Utilfreds'],
  [3, 'Neutral'],
  [4, 'Tilfreds'],
  [5, 'Meget tilfreds'],
]

// Mounted when opened and unmounted on close, like BookingForm. Whether a score is allowed yet is the API's call (FR-011).
export default function SatisfactionDialog({ booking, onClose }) {
  const ref = useRef()
  const toast = useToast()
  const revalidator = useRevalidator()
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => ref.current.showModal(), [])

  async function onSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const saved = await api(`/bookings/${booking.id}/satisfaction`, {
        method: 'PUT',
        body: { score: Number(new FormData(e.currentTarget).get('score')) },
      })
      toast({ title: 'Tilfredshed registreret', description: `${guestName(saved)} · ${saved.satisfactionScore} af 5` })
      ref.current.close()
      revalidator.revalidate()
    } catch (err) {
      setSaving(false)
      if (err.status !== 404) return setError(err)
      // Deleted by someone else while the dialog was open
      ref.current.close()
      toast({ title: err.message, tone: 'danger' })
      revalidator.revalidate()
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="satisfaction-title"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      className="m-auto w-[440px] rounded-xl border border-line bg-surface p-0 shadow-pop backdrop:bg-ink/20 transition-[opacity,scale] duration-150 starting:scale-95 starting:opacity-0"
    >
      <form onSubmit={onSubmit} onChange={() => setError(null)} className="space-y-5 p-6">
        <div>
          <h2 id="satisfaction-title" className="text-lg font-semibold">
            Kundetilfredshed
          </h2>
          <p className="tnum mt-2 text-ink-2">
            {guestName(booking)} · {period(booking.checkIn, booking.checkOut)}
          </p>
        </div>
        <ErrorBanner error={error} />
        <fieldset>
          <legend className={labelClass}>Hvor tilfreds var gæsten?</legend>
          <div className="grid grid-cols-5 gap-2">
            {SCORES.map(([score, label]) => (
              <label key={score} className={cx(radioCardClass, 'items-center text-center')}>
                <input
                  type="radio"
                  name="score"
                  value={score}
                  required
                  defaultChecked={booking.satisfactionScore === score}
                  className="sr-only"
                />
                <span className="tnum text-xl font-semibold">{score}</span>
                <span className="mt-1 text-xs text-ink-3">{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2.5">
          <Button onClick={() => ref.current.close()}>Annullér</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? (
              <>
                <SpinnerGapIcon size={16} className="animate-spin" />
                Gemmer…
              </>
            ) : (
              'Gem'
            )}
          </Button>
        </div>
      </form>
    </dialog>
  )
}
