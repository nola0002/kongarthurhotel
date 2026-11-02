import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLoaderData } from 'react-router'
import {
  BedIcon,
  CalendarDotsIcon,
  CashRegisterIcon,
  ChartLineUpIcon,
  CheckCircleIcon,
  HouseIcon,
  MagnifyingGlassIcon,
  UserCircleIcon,
  WarningCircleIcon,
  XIcon,
} from '@phosphor-icons/react'
import { Button, Kbd, cx, modKey } from './ui.jsx'
import BookingForm from './BookingForm.jsx'
import CommandPalette from './CommandPalette.jsx'

const ShellContext = createContext(null)

/** @returns {{ toast: Function, newBooking: Function, editBooking: Function, openPalette: Function }} */
export const useShell = () => useContext(ShellContext)
export const useToast = () => useContext(ShellContext).toast

// Grouped as in FR-017. `keywords` are extra words the command palette matches on
const NAV = [
  {
    title: 'Reception',
    items: [
      { to: '/oversigt', label: 'Oversigt', Icon: HouseIcon, keywords: 'forside i dag ankomster afrejser' },
      { to: '/belaegningsplan', label: 'Belægningsplan', Icon: CalendarDotsIcon, keywords: 'værelser plan' },
      { to: '/bookinger', label: 'Bookinger', Icon: BedIcon, keywords: 'gæster' },
    ],
  },
  { title: 'Bar', items: [{ to: '/barsalg', label: 'Kasse', Icon: CashRegisterIcon, keywords: 'barsalg drinks' }] },
  {
    title: 'Økonomi',
    items: [{ to: '/omsaetning', label: 'Omsætning', Icon: ChartLineUpIcon, keywords: 'indtjening' }],
  },
  {
    title: 'Konto',
    items: [
      { to: '/profil', label: 'Profil', Icon: UserCircleIcon, keywords: 'log ud adgangskode administration priser' },
    ],
  },
]

// Also inside an open dialog: N must not stack the drawer on top of the delete confirmation
const isTyping = (el) => el.closest('input, textarea, select, [contenteditable], dialog')

export default function Shell() {
  const { username } = useLoaderData()
  const [toastData, setToastData] = useState(null)
  const timer = useRef()
  // undefined = drawer closed, null = new booking, object = edit that booking
  const [formBooking, setFormBooking] = useState(undefined)

  const toast = useCallback((t) => {
    clearTimeout(timer.current)
    setToastData(t)
    timer.current = setTimeout(() => setToastData(null), 4000)
  }, [])

  // Functional update: focus can sit on <body> inside an open drawer, and N must not replace what is in it
  const newBooking = useCallback(() => setFormBooking((b) => (b === undefined ? null : b)), [])
  const editBooking = useCallback((booking) => setFormBooking(booking), [])
  const [paletteOpen, setPaletteOpen] = useState(false)
  const openPalette = useCallback(() => setPaletteOpen(true), [])

  useEffect(() => {
    const onKey = (e) => {
      // Cmd/Ctrl+K works everywhere, also in a field (spec edge case); N only outside fields
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        return setPaletteOpen((o) => !o)
      }
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || isTyping(e.target)) return
      e.preventDefault()
      newBooking()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [newBooking])

  return (
    <ShellContext value={{ toast, newBooking, editBooking, openPalette }}>
      <div className="grid h-dvh grid-cols-[264px_1fr] overflow-hidden">
        <aside className="flex min-h-0 flex-col px-4 py-5">
          <div className="px-3 pb-5 text-xl font-semibold tracking-[-0.02em]">Kong Arthur</div>
          <button
            type="button"
            onClick={openPalette}
            className="flex h-10 items-center gap-2.5 rounded-lg bg-surface px-3 text-ink-3 shadow-panel transition-colors duration-100 hover:text-ink-2"
          >
            <MagnifyingGlassIcon size={17} />
            <span className="flex-1 text-left">Søg …</span>
            <Kbd>{modKey}</Kbd>
            <Kbd>K</Kbd>
          </button>
          <nav className="-mx-1 mt-2 min-h-0 overflow-y-auto px-1">
            {NAV.map((group) => (
              <div key={group.title} className="pt-5">
                <h2 className="px-3 pb-1.5 text-xs font-medium text-ink-3">{group.title}</h2>
                <ul className="flex flex-col gap-0.5">
                  {group.items.map(({ to, label, Icon }) => (
                    <li key={to}>
                      <NavLink
                        to={to}
                        className={({ isActive }) =>
                          cx(
                            'flex h-10 items-center gap-3 rounded-lg px-3 transition-colors duration-100',
                            isActive ? 'bg-ink/[0.07] font-medium text-ink' : 'text-ink-2 hover:bg-ink/[0.04]',
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <Icon
                              size={20}
                              weight={isActive ? 'fill' : 'regular'}
                              className={isActive ? 'text-signal' : 'text-ink-3'}
                            />
                            {label}
                          </>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <NavLink
            to="/profil"
            className="mt-auto flex h-12 items-center gap-3 rounded-lg px-3 text-sm text-ink-2 transition-colors duration-100 hover:bg-ink/[0.04]"
          >
            <span
              aria-hidden
              className="grid size-7 shrink-0 place-items-center rounded-full bg-sunken text-xs font-semibold text-ink-2 uppercase shadow-panel"
            >
              {username.slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-ink">{username}</span>
              <span className="block text-xs text-ink-3">Profil og log ud</span>
            </span>
          </NavLink>
        </aside>

        <main className="my-2 mr-2 h-[calc(100dvh-1rem)] overflow-y-auto rounded-3xl bg-canvas shadow-canvas">
          <div className="mx-auto max-w-[1280px] px-8 py-10">
            <Outlet />
          </div>
        </main>
      </div>

      {formBooking !== undefined && <BookingForm booking={formBooking} onClose={() => setFormBooking(undefined)} />}

      {paletteOpen && (
        <CommandPalette
          pages={NAV.flatMap((g) => g.items.map((item) => ({ ...item, group: g.title })))}
          newBooking={newBooking}
          onClose={() => setPaletteOpen(false)}
        />
      )}

      {/* Always in the DOM so screen readers announce the content when it changes */}
      <div role="status" aria-live="polite" className="fixed right-6 bottom-6">
        {toastData && (
          <div className="flex w-[360px] items-start gap-3 rounded-lg bg-surface p-4 shadow-pop">
            {toastData.tone === 'danger' ? (
              <WarningCircleIcon size={20} weight="fill" className="mt-0.5 shrink-0 text-danger" />
            ) : (
              <CheckCircleIcon size={20} weight="fill" className="mt-0.5 shrink-0 text-ok" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium">{toastData.title}</p>
              {toastData.description && <p className="tnum mt-0.5 text-sm text-ink-2">{toastData.description}</p>}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="-mt-1 -mr-2 px-2"
              aria-label="Luk"
              onClick={() => setToastData(null)}
            >
              <XIcon size={16} />
            </Button>
          </div>
        )}
      </div>
    </ShellContext>
  )
}
