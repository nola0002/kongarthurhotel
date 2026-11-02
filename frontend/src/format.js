// All number and date formatting lives here, so the UI formats everything the same way.
const krFmt = new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 })
const krExactFmt = new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK' })
const krShortFmt = new Intl.NumberFormat('da-DK', {
  style: 'currency',
  currency: 'DKK',
  notation: 'compact',
  // Three significant digits keep the width fixed: "13,4 mio. kr.", "103 mio. kr.", "1,25 mia. kr."
  maximumSignificantDigits: 3,
})
const numFmt = new Intl.NumberFormat('da-DK')
const pctFmt = new Intl.NumberFormat('da-DK', { style: 'percent', maximumFractionDigits: 1 })
const rangeFmt = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short' })
const rangeYearFmt = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })

// Local date as YYYY-MM-DD, read on every call so a screen left open past midnight moves on to the new day.
// Never used for booking status; that comes from the API.
export const today = () => new Date().toLocaleDateString('sv-SE')
const thisYear = (iso) => iso.slice(0, 4) === today().slice(0, 4)

export const kr = (n) => krFmt.format(n)
// With øre, where whole kroner would hide a difference: drink prices (72,47 kr.) and revenue (SC-004)
export const krExact = (n) => krExactFmt.format(n)
// Large totals that must fit a tile: "13,4 mio. kr."; show krExact next to it
export const krShort = (n) => (Math.abs(n) < 1e6 ? kr(n) : krShortFmt.format(n))
export const num = (n) => numFmt.format(n)
// Fractions 0–1 from the API: "84,1 %"
export const pct = (n) => pctFmt.format(n)

// Noon, so a daylight saving shift can never move the date
export const toDate = (iso) => new Date(iso + 'T12:00:00')

// Only for previous/next day or period links; every date the screens show comes from the API (research R10)
export const addDays = (iso, n) => {
  const d = toDate(iso)
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('sv-SE')
}

// Column header in the room plan: "tor."; never with a year, since the period above already shows it
export const weekday = (iso) => toDate(iso).toLocaleDateString('da-DK', { weekday: 'short' })

export const date = (iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  toDate(iso).toLocaleDateString('da-DK', thisYear(iso) ? opts : { ...opts, year: 'numeric' })

export const longDate = (iso) =>
  toDate(iso).toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

// "10.–12. mar." – Intl collapses the shared month/year itself
export const period = (from, to) =>
  (thisYear(from) && thisYear(to) ? rangeFmt : rangeYearFmt).formatRange(toDate(from), toDate(to))

// ISO 8601: the week belongs to the year of its Thursday
export function isoWeek(iso) {
  const d = toDate(iso)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const jan4 = new Date(d.getFullYear(), 0, 4, 12)
  return 1 + Math.round(((d - jan4) / 86_400_000 - 3 + ((jan4.getDay() + 6) % 7)) / 7)
}

// Formats a count from the API; the frontend never works out the number of nights
export const nightsLabel = (n) => (n === 1 ? '1 nat' : `${num(n)} nætter`)

// Timestamps from the API are local time without offset (YYYY-MM-DDTHH:mm:ss)
export const time = (iso) => iso.slice(11, 16)
export const dateTime = (iso) => `${date(iso.slice(0, 10))} kl. ${time(iso)}`

// The only place the name is put together for display; the API keeps first and family name apart (004 FR-006)
export const guestName = (b) => `${b.firstName} ${b.familyName}`
