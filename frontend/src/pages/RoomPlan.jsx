import { useMemo } from 'react'
import { Link, useLoaderData, useNavigation, useSearchParams } from 'react-router'
import { api } from '../api.js'
import { addDays, guestName, num, period, toDate, today, weekday } from '../format.js'
import { DateNav, PageHeader, STATUS, StatusMarker, Tile, cx, inputClass } from '../ui.jsx'

// Only what is in the URL is sent, so the default period (today, 14 days) is the server's (research R11)
export function loader({ request }) {
  const url = new URL(request.url).searchParams
  const query = new URLSearchParams()
  if (url.get('fra')) query.set('from', url.get('fra'))
  if (url.get('dage')) query.set('days', url.get('dage'))
  return api('/reception/room-plan?' + query)
}

const cell = 'h-10 border-b border-l border-line p-0'
const rowHead = 'sticky left-0 z-10 h-10 border-b border-line bg-surface px-6 text-left font-normal'

export default function RoomPlan() {
  const plan = useLoaderData()
  const { from, to, dates } = plan
  const days = dates.length
  const [, setParams] = useSearchParams()
  const loading = useNavigation().state === 'loading'
  const setParam = (key, value) =>
    setParams((p) => {
      p.set(key, value)
      return p
    })
  // Up to 214 rooms × 31 days ≈ 6,600 cells, drawn as a plain table without virtualisation (research R5).
  // Built once per answer, so the loading state does not redraw them.
  const body = useMemo(() => planRows(plan), [plan])

  return (
    <>
      <PageHeader
        title="Belægningsplan"
        description={period(from, dates.at(-1))}
        actions={
          <>
            <DateNav
              label="Vælg startdato"
              value={from}
              prevTo={`?fra=${addDays(from, -days)}&dage=${days}`}
              todayTo={`?dage=${days}`}
              nextTo={`?fra=${to}&dage=${days}`}
              onChange={(d) => setParam('fra', d)}
            />
            <label htmlFor="plan-days" className="sr-only">
              Vis
            </label>
            <select
              id="plan-days"
              value={days}
              onChange={(e) => setParam('dage', e.target.value)}
              className={cx(inputClass, 'w-auto')}
            >
              {/* Any 7–31 is valid in the URL; keep such a value selectable instead of showing a wrong one */}
              {![7, 14, 31].includes(days) && <option value={days}>{days} dage</option>}
              <option value="7">7 dage</option>
              <option value="14">14 dage</option>
              <option value="31">31 dage</option>
            </select>
          </>
        }
      />

      <ul aria-label="Forklaring" className="-mt-6 mb-5 flex gap-5 text-sm text-ink-2">
        {Object.entries(STATUS).map(([status, s]) => (
          <li key={status} className="flex items-center gap-2">
            <StatusMarker status={status} />
            {s.label}
          </li>
        ))}
      </ul>

      <Tile flush>
        <div
          className={cx(
            'max-h-[calc(100dvh-16rem)] overflow-auto rounded-2xl transition-opacity duration-100',
            loading && 'opacity-60',
          )}
        >
          <table className="w-full table-fixed border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-30 w-28 border-b border-line bg-surface px-6 text-left text-sm font-medium text-ink-3">
                  Værelse
                </th>
                {dates.map((d) => (
                  <th
                    key={d}
                    className={cx(
                      'sticky top-0 z-20 h-14 w-11 border-b border-l border-line text-center text-xs font-medium',
                      d === today() ? 'bg-sunken text-ink' : 'bg-surface text-ink-3',
                    )}
                  >
                    <div>{d === today() ? 'I dag' : weekday(d)}</div>
                    <div className="tnum text-sm text-ink">{toDate(d).getDate()}</div>
                  </th>
                ))}
              </tr>
            </thead>
            {body}
          </table>
        </div>
      </Tile>
    </>
  )
}

// One tbody per room type: a group row, a row per room and the "Ledige" row from the API's free[]
function planRows({ from, to, dates, roomTypes, stays }) {
  const column = new Map(dates.map((d, i) => [d, i]))
  const staysByRoom = Map.groupBy(stays, (s) => s.roomId)

  // Geometry only: which columns a stay covers, clipped to [from, to). A room never has overlapping stays (FR-007).
  function roomCells(roomStays = []) {
    const out = []
    let i = 0
    for (const s of roomStays.toSorted((a, b) => a.checkIn.localeCompare(b.checkIn))) {
      const start = s.checkIn <= from ? 0 : column.get(s.checkIn)
      const end = s.checkOut >= to ? dates.length : column.get(s.checkOut)
      for (; i < start; i++) out.push(<td key={i} className={cell} />)
      const label = `${guestName(s)}, ${period(s.checkIn, s.checkOut)}, ${STATUS[s.status].label}`
      out.push(
        <td key={i} colSpan={end - start} className={cx(cell, 'px-0.5')}>
          <Link
            to={`/bookinger/${s.bookingId}`}
            aria-label={label}
            title={label}
            className={cx(
              'flex h-8 items-center gap-1.5 rounded-md px-2 text-sm hover:brightness-95',
              STATUS[s.status].pill,
              // No rounded edge where the stay continues outside the window (FR-006)
              s.checkIn < from && 'rounded-l-none',
              s.checkOut > to && 'rounded-r-none',
            )}
          >
            <StatusMarker status={s.status} />
            <span className="truncate">{guestName(s)}</span>
          </Link>
        </td>,
      )
      i = end
    }
    for (; i < dates.length; i++) out.push(<td key={i} className={cell} />)
    return out
  }

  return roomTypes.map((type) => (
    <tbody key={type.id}>
      <tr>
        <th colSpan={dates.length + 1} scope="colgroup" className="h-10 border-b border-line bg-sunken p-0 text-left">
          <span className="sticky left-0 inline-block px-6 font-semibold">{type.name}</span>
        </th>
      </tr>
      {type.rooms.map((room) => (
        <tr key={room.id}>
          <th scope="row" className={cx(rowHead, 'tnum')}>
            {room.number}
          </th>
          {roomCells(staysByRoom.get(room.id))}
        </tr>
      ))}
      <tr>
        <th scope="row" className={cx(rowHead, 'text-ink-2')}>
          Ledige
        </th>
        {type.free.map((n, i) => (
          <td key={dates[i]} className={cx(cell, 'tnum text-center text-sm font-medium text-ink-2')}>
            {num(n)}
          </td>
        ))}
      </tr>
    </tbody>
  ))
}
