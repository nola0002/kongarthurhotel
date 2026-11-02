import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { CashRegisterIcon, MagnifyingGlassIcon, PlusIcon } from '@phosphor-icons/react'
import { api } from './api.js'
import { guestName, period } from './format.js'
import { Kbd, STATUS, StatusMarker, cx } from './ui.jsx'

const EMPTY = { term: '', items: [], error: null }

// Cmd+K (FR-016). Searching reuses GET /bookings: a number also matches booking id and room number, and
// sort=nearest puts the guest staying there today first (research R5)
export default function CommandPalette({ pages, newBooking, onClose }) {
  const navigate = useNavigate()
  const ref = useRef()
  const [q, setQ] = useState('')
  const [result, setResult] = useState(EMPTY)
  const [active, setActive] = useState(0)
  const term = q.trim()

  useEffect(() => ref.current.showModal(), [])

  useEffect(() => {
    if (!term) return
    let stale = false
    // Small debounce, so typing a name sends one request instead of one per letter
    const timer = setTimeout(() => {
      api('/bookings?' + new URLSearchParams({ q: term, sort: 'nearest', pageSize: 8, view: 'all' })).then(
        (r) => !stale && setResult({ term, items: r.items, error: null }),
        (error) => !stale && setResult({ term, items: [], error }),
      )
    }, 150)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [term])

  const matches = (text) => text.toLowerCase().includes(term.toLowerCase())
  const groups = [
    {
      title: 'Bookinger',
      items: (term ? result.items : []).map((b) => ({
        id: `b${b.id}`,
        booking: b,
        run: () => navigate(`/bookinger/${b.id}`),
      })),
    },
    {
      title: 'Sider',
      items: pages
        .filter((p) => matches(`${p.label} ${p.group} ${p.keywords}`))
        .map((p) => ({ id: p.to, label: p.label, hint: p.group, Icon: p.Icon, run: () => navigate(p.to) })),
    },
    {
      title: 'Handlinger',
      items: [
        { id: 'new-booking', label: 'Ny booking', Icon: PlusIcon, run: newBooking, kbd: 'N' },
        { id: 'new-sale', label: 'Nyt barsalg', Icon: CashRegisterIcon, run: () => navigate('/barsalg') },
      ].filter((a) => matches(a.label)),
    },
  ].filter((g) => g.items.length)
  const options = groups.flatMap((g) => g.items)
  const current = Math.min(active, options.length - 1)
  const optionId = (i) => `palette-option-${i}`

  useEffect(() => {
    document.getElementById(optionId(current))?.scrollIntoView({ block: 'nearest' })
  }, [current])

  function choose(option) {
    ref.current.close()
    option.run()
  }

  function onKeyDown(e) {
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key]
    if (step && options.length) {
      e.preventDefault()
      setActive((current + step + options.length) % options.length)
    } else if (e.key === 'Enter' && options[current]) {
      e.preventDefault()
      choose(options[current])
    }
  }

  let index = 0
  return (
    <dialog
      ref={ref}
      aria-label="Søg"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      className="m-auto mt-[12vh] w-[640px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-surface p-0 text-ink shadow-pop transition-[opacity,scale] duration-150 backdrop:bg-ink/20 starting:scale-95 starting:opacity-0"
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <MagnifyingGlassIcon size={20} className="shrink-0 text-ink-3" />
        <label htmlFor="palette-input" className="sr-only">
          Søg efter gæst, bookingnummer, værelse eller side
        </label>
        <input
          id="palette-input"
          role="combobox"
          aria-expanded={options.length > 0}
          aria-controls="palette-list"
          aria-activedescendant={options.length ? optionId(current) : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          maxLength={150}
          placeholder="Søg efter gæst, bookingnummer, værelse eller side …"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setActive(0)
            if (!e.target.value.trim()) setResult(EMPTY)
          }}
          onKeyDown={onKeyDown}
          className="h-14 min-w-0 flex-1 bg-transparent text-lg placeholder:text-ink-4 focus:outline-none"
        />
      </div>

      <div
        id="palette-list"
        role="listbox"
        aria-label="Resultater"
        className="max-h-[min(440px,60vh)] overflow-y-auto p-2"
      >
        {groups.map((group) => (
          <div key={group.title} role="group" aria-labelledby={`palette-group-${group.title}`} className="pb-1">
            <div id={`palette-group-${group.title}`} className="px-3 pt-2 pb-1.5 text-xs font-medium text-ink-3">
              {group.title}
            </div>
            {group.items.map((option) => {
              const i = index++
              return (
                <div
                  key={option.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === current}
                  onMouseMove={() => i !== current && setActive(i)}
                  onClick={() => choose(option)}
                  className={cx(
                    'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2',
                    i === current && 'bg-ink/[0.06]',
                  )}
                >
                  {option.booking ? <BookingOption booking={option.booking} /> : <ItemOption option={option} />}
                </div>
              )
            })}
          </div>
        ))}
        {result.error && term && (
          <p role="alert" className="px-3 py-6 text-center text-danger-ink">
            {result.error.message}
          </p>
        )}
        {!options.length && !result.error && result.term === term && (
          <p className="px-3 py-8 text-center text-ink-2">Ingen resultater for "{term}".</p>
        )}
      </div>

      <div className="flex gap-5 border-t border-line px-4 py-2.5 text-xs text-ink-3">
        <span className="flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> vælg
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>↵</Kbd> åbn
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>Esc</Kbd> luk
        </span>
      </div>
    </dialog>
  )
}

function BookingOption({ booking: b }) {
  return (
    <>
      <span className="tnum w-12 shrink-0 text-sm text-ink-3">
        <span className="sr-only">Værelse </span>
        {b.room.number}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{guestName(b)}</span>
        <span className="tnum block truncate text-sm text-ink-2">
          {period(b.checkIn, b.checkOut)} · {b.roomType.name} · #{b.id}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2 text-sm text-ink-2">
        <StatusMarker status={b.status} />
        {STATUS[b.status].label}
      </span>
    </>
  )
}

function ItemOption({ option: { Icon, label, hint, kbd } }) {
  return (
    <>
      <Icon size={18} className="shrink-0 text-ink-3" />
      <span className="flex-1">{label}</span>
      {hint && <span className="text-sm text-ink-3">{hint}</span>}
      {kbd && <Kbd>{kbd}</Kbd>}
    </>
  )
}
