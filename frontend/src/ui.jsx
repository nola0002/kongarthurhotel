import { useState } from 'react'
import { Link } from 'react-router'
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'

export const cx = (...c) => c.filter(Boolean).join(' ')

export const buttonClass = (variant = 'secondary', size = 'md') =>
  cx(
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium select-none',
    'transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50',
    size === 'sm' && 'h-8 px-3 text-sm',
    size === 'md' && 'h-10 px-4 text-[0.9375rem]',
    size === 'icon' && 'size-10',
    variant === 'primary' && 'bg-signal text-white hover:bg-signal-hover active:bg-signal-active',
    variant === 'secondary' &&
      'border border-line-strong bg-surface text-ink shadow-[0_1px_1px_oklch(0.235_0.028_264/0.04)] hover:bg-sunken active:bg-line',
    variant === 'ghost' && 'text-ink-2 hover:bg-sunken hover:text-ink active:bg-line',
    variant === 'danger' && 'bg-danger text-white hover:bg-danger-ink',
  )

export function Button({ variant, size, className, ...props }) {
  return <button type="button" className={cx(buttonClass(variant, size), className)} {...props} />
}

export function ButtonLink({ variant, size, className, ...props }) {
  return <Link className={cx(buttonClass(variant, size), className)} {...props} />
}

export function Kbd({ children }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-line-strong bg-surface px-1 font-sans text-xs text-ink-3">
      {children}
    </kbd>
  )
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-10">
      <div>
        <h1 className="text-5xl font-semibold tracking-[-0.035em]">{title}</h1>
        {description && <p className="mt-2 text-lg text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex gap-2.5">{actions}</div>}
    </div>
  )
}

export function Tile({ title, count, action, flush, className, children }) {
  return (
    <section className={cx('flex min-w-0 flex-col rounded-2xl bg-surface shadow-panel', className)}>
      {title && (
        <div className="flex min-h-14 items-center justify-between px-6 pt-5 pb-1">
          <h2 className="text-base font-semibold">
            {title}
            {count != null && <span className="tnum ml-2 font-normal text-ink-3">{count}</span>}
          </h2>
          {action}
        </div>
      )}
      <div className={cx(!flush && 'px-6 pb-6', !flush && !title && 'pt-6')}>{children}</div>
    </section>
  )
}

export function Stat({ label, value, context, tone }) {
  return (
    <div>
      <div className="text-sm text-ink-2">{label}</div>
      <div className="tnum mt-1 text-5xl font-semibold tracking-[-0.035em]">{value}</div>
      {context && (
        <div
          className={cx(
            'mt-2 text-sm',
            tone === 'danger' ? 'text-danger-ink' : tone === 'ok' ? 'text-ok-ink' : 'text-ink-3',
          )}
        >
          {context}
        </div>
      )}
    </div>
  )
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <p className="text-lg font-medium">{title}</p>
      {body && <p className="mt-1 max-w-sm text-ink-2">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-ink-2">{label}</dt>
      <dd className="tnum text-right text-ink">{children}</dd>
    </div>
  )
}

export const inputClass =
  'h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-ink placeholder:text-ink-4 hover:border-ink-4 focus:border-signal focus:outline-none focus:ring-3 focus:ring-signal-soft aria-invalid:border-danger'

export const labelClass = 'mb-2 block text-sm font-medium text-ink'

// Radio card (room type, drink): the hidden radio drives the look through has-*, no JS state
export const radioCardClass =
  'flex cursor-pointer flex-col rounded-lg bg-surface p-4 shadow-panel transition-colors duration-100 hover:bg-sunken has-checked:bg-signal-soft has-checked:ring-1 has-checked:ring-signal/40 has-focus-visible:outline-2 has-focus-visible:outline-signal has-disabled:cursor-not-allowed has-disabled:opacity-50 has-disabled:hover:bg-surface'

// Inline validation (komponenter.md): the API's message under the field it names
export const invalidProps = (error, name) =>
  error?.field === name ? { 'aria-invalid': true, 'aria-describedby': `${name}-error` } : {}

export function FieldError({ error, name }) {
  if (error?.field !== name) return null
  return (
    <p id={`${name}-error`} role="alert" className="mt-1.5 text-sm text-danger">
      {error.message}
    </p>
  )
}

// Errors without a field the form knows, e.g. "no free rooms"
export function ErrorBanner({ error }) {
  if (!error) return null
  return (
    <p role="alert" className="rounded-lg bg-danger-soft p-3 text-danger-ink">
      {error.message}
    </p>
  )
}

// Shown only for bookings made by the hotel's external booking system (US6)
export function SourceBadge() {
  return (
    <span className="inline-flex h-6 items-center rounded-full bg-sunken px-2.5 text-xs font-medium text-ink-2">
      Bookingsystem
    </span>
  )
}

// The status table lives only here. Status is derived by the backend; the frontend never reads it off the dates.
export const STATUS = {
  upcoming: { label: 'Kommende', marker: 'ring-[1.5px] ring-inset ring-ink-3', pill: 'bg-sunken text-ink' },
  arriving: {
    label: 'Ankommer i dag',
    marker: 'ring-[1.5px] ring-inset ring-hold',
    pill: 'bg-hold-soft text-hold-ink',
  },
  in_house: { label: 'I huset', marker: 'bg-ok', pill: 'bg-ok-soft text-ok-ink' },
  departed: { label: 'Afrejst', marker: 'bg-ink-4', pill: 'bg-sunken text-ink-3' },
}

// Shape first, colour second; always shown next to the status label (as text or in an aria-label)
export function StatusMarker({ status }) {
  return <span aria-hidden className={cx('size-2.5 shrink-0 rounded-[3px]', STATUS[status].marker)} />
}

export function StatusBadge({ status }) {
  const s = STATUS[status]
  return (
    <span
      className={cx('inline-flex h-7 items-center gap-2 rounded-full px-3 text-sm font-medium tracking-normal', s.pill)}
    >
      <StatusMarker status={status} />
      {s.label}
    </span>
  )
}

// Previous · Today · Next and a date picker. The links are ready-made, so the page decides what a step is (a day or
// a period). Local draft: the URL only changes once the loader has answered, and typing in the date must not lag.
export function DateNav({ label, value, prevTo, todayTo, nextTo, onChange }) {
  const [draft, setDraft] = useState(value)
  const [shown, setShown] = useState(value)
  if (value !== shown) {
    setShown(value)
    setDraft(value)
  }
  return (
    <div className="flex items-center gap-2">
      <ButtonLink to={prevTo} size="icon" aria-label="Forrige">
        <CaretLeftIcon size={17} className="text-ink-3" />
      </ButtonLink>
      <ButtonLink to={todayTo}>I dag</ButtonLink>
      <ButtonLink to={nextTo} size="icon" aria-label="Næste">
        <CaretRightIcon size={17} className="text-ink-3" />
      </ButtonLink>
      <label htmlFor="date-nav" className="sr-only">
        {label}
      </label>
      <input
        id="date-nav"
        type="date"
        required
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          if (e.target.value) onChange(e.target.value)
        }}
        className={cx(inputClass, 'w-auto')}
      />
    </div>
  )
}
