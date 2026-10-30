import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLoaderData, useNavigate } from 'react-router'
import {
  BedIcon,
  CalendarDotsIcon,
  CheckCircleIcon,
  HouseIcon,
  MartiniIcon,
  SignOutIcon,
  WarningCircleIcon,
  XIcon,
} from '@phosphor-icons/react'
import { api } from './api.js'
import { Button, cx } from './ui.jsx'
import BookingForm from './BookingForm.jsx'

const ShellContext = createContext(null)

/** @returns {{ toast: Function, newBooking: Function, editBooking: Function }} */
export const useShell = () => useContext(ShellContext)
export const useToast = () => useContext(ShellContext).toast

const NAV = [
  { to: '/oversigt', label: 'Oversigt', Icon: HouseIcon },
  { to: '/belaegningsplan', label: 'Belægningsplan', Icon: CalendarDotsIcon },
  { to: '/bookinger', label: 'Bookinger', Icon: BedIcon },
  { to: '/barsalg', label: 'Barsalg', Icon: MartiniIcon },
]

// Also inside an open dialog: N must not stack the drawer on top of the delete confirmation
const isTyping = (el) => el.closest('input, textarea, select, [contenteditable], dialog')

export default function Shell() {
  const { username } = useLoaderData()
  const navigate = useNavigate()
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

  useEffect(() => {
    const onKey = (e) => {
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
    <ShellContext value={{ toast, newBooking, editBooking }}>
      <div className="grid h-dvh grid-cols-[264px_1fr] overflow-hidden">
        <aside className="flex flex-col px-4 py-5">
          <div className="px-3 pb-6 text-xl font-semibold tracking-[-0.02em]">Kong Arthur</div>
          <nav className="flex flex-col gap-0.5">
            {NAV.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
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
            ))}
          </nav>
          <div className="mt-auto flex items-center justify-between gap-2 px-3">
            <span className="truncate text-sm text-ink-2">{username}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              <SignOutIcon size={16} className="text-ink-3" />
              Log ud
            </Button>
          </div>
        </aside>

        <main className="my-2 mr-2 h-[calc(100dvh-1rem)] overflow-y-auto rounded-3xl bg-canvas shadow-canvas">
          <div className="mx-auto max-w-[1280px] px-8 py-10">
            <Outlet />
          </div>
        </main>
      </div>

      {formBooking !== undefined && <BookingForm booking={formBooking} onClose={() => setFormBooking(undefined)} />}

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
