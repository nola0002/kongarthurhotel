import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLoaderData, useLocation, useNavigate } from 'react-router'
import {
  BedIcon,
  CalendarDotsIcon,
  CashRegisterIcon,
  ChartLineUpIcon,
  CheckCircleIcon,
  HouseIcon,
  MagnifyingGlassIcon,
  SignOutIcon,
  UserCircleIcon,
  WarningCircleIcon,
  XIcon,
} from '@phosphor-icons/react'
import { api } from './api.js'
import { Button, cx, modKey } from './ui.jsx'
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
  {
    title: 'Bar og økonomi',
    items: [
      { to: '/barsalg', label: 'Kasse', Icon: CashRegisterIcon, keywords: 'barsalg drinks' },
      { to: '/omsaetning', label: 'Omsætning', Icon: ChartLineUpIcon, keywords: 'indtjening' },
    ],
  },
]
// Reached from the account menu, not the nav, but still found by the command palette
const PROFILE = { to: '/profil', label: 'Profil', Icon: UserCircleIcon, keywords: 'adgangskode administration priser' }

const navItemClass = 'flex h-10 w-full items-center gap-3 rounded-lg px-3 transition-colors duration-100'

// Also inside an open dialog: N must not stack the drawer on top of the delete confirmation
const isTyping = (el) => el.closest('input, textarea, select, [contenteditable], dialog')

export default function Shell() {
  const { username } = useLoaderData()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const main = useRef()
  // <main> scrolls, not the window, so the router's scroll handling does not reach it: a new page starts at the top
  useLayoutEffect(() => {
    main.current.scrollTop = 0
  }, [pathname])
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
    <ShellContext value={{ toast, newBooking, editBooking, openPalette }}>
      <div className="grid h-dvh grid-cols-[264px_1fr] overflow-hidden">
        <aside className="flex min-h-0 flex-col px-4 py-5">
          <img src="/innsights.svg" alt="InnSights" className="mx-3 mb-5 h-6 w-fit" />
          <button
            type="button"
            onClick={openPalette}
            className={cx(navItemClass, 'bg-surface text-ink-3 shadow-panel hover:text-ink-2')}
          >
            <MagnifyingGlassIcon size={17} />
            <span className="flex-1 text-left">Søg …</span>
            <span className="text-sm text-ink-4">{modKey === '⌘' ? '⌘K' : 'Ctrl+K'}</span>
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
                            navItemClass,
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
          <AccountMenu username={username} onLogout={logout} />
        </aside>

        {/* relative: sr-only labels inside the page are positioned here, not on the document, so only <main> scrolls */}
        <main
          ref={main}
          className="relative my-2 mr-2 h-[calc(100dvh-1rem)] overflow-y-auto rounded-3xl bg-canvas shadow-canvas"
        >
          <div className="mx-auto max-w-[1280px] px-8 py-10">
            <Outlet />
          </div>
        </main>
      </div>

      {formBooking !== undefined && <BookingForm booking={formBooking} onClose={() => setFormBooking(undefined)} />}

      {paletteOpen && (
        <CommandPalette
          pages={[
            ...NAV.flatMap((g) => g.items.map((item) => ({ ...item, group: g.title }))),
            { ...PROFILE, group: 'Konto' },
          ]}
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

// The menu opens upwards from the account. Native popover: light dismiss and Escape come from the browser
function AccountMenu({ username, onLogout }) {
  const close = (e) => e.currentTarget.closest('[popover]').hidePopover()
  return (
    <div className="mt-auto">
      <button
        type="button"
        popoverTarget="account-menu"
        className={cx(navItemClass, 'h-12 bg-surface text-ink shadow-panel hover:bg-surface/70')}
      >
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-full bg-sunken text-xs font-semibold text-ink-2 uppercase"
        >
          {username.slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{username}</span>
      </button>
      <div
        id="account-menu"
        popover="auto"
        className="fixed inset-auto bottom-[76px] left-4 m-0 w-[232px] rounded-lg border-0 bg-surface p-1 text-ink shadow-pop"
      >
        <NavLink to="/profil" onClick={close} className={cx(navItemClass, 'text-ink-2 hover:bg-ink/[0.04]')}>
          <UserCircleIcon size={20} className="text-ink-3" />
          Profil
        </NavLink>
        <button type="button" onClick={onLogout} className={cx(navItemClass, 'text-ink-2 hover:bg-ink/[0.04]')}>
          <SignOutIcon size={20} className="text-ink-3" />
          Log ud
        </button>
      </div>
    </div>
  )
}
