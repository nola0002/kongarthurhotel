import {
  CaretDoubleLeftIcon,
  CaretDoubleRightIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CaretUpDownIcon,
  CaretUpIcon,
} from '@phosphor-icons/react'
import { num } from './format.js'
import { Button, ButtonLink, cx, inputClass } from './ui.jsx'

// A column header that sorts the whole list on the server; aria-sort tells screen readers the current order
export function SortHeader({ label, active, order, onSort, className }) {
  const Icon = !active ? CaretUpDownIcon : order === 'desc' ? CaretDownIcon : CaretUpIcon
  return (
    <th aria-sort={active ? (order === 'desc' ? 'descending' : 'ascending') : 'none'} className={className}>
      <button
        type="button"
        onClick={onSort}
        className={cx(
          'inline-flex items-center gap-1 transition-colors duration-100 hover:text-ink',
          active && 'text-ink',
        )}
      >
        {label}
        <Icon size={13} className={active ? 'text-ink-2' : 'text-ink-4'} />
      </button>
    </th>
  )
}

// One step link; at the first/last page it is a disabled button, since a link cannot be disabled
function Step({ to, label, Icon }) {
  return to ? (
    <ButtonLink to={to} size="icon" aria-label={label} title={label}>
      <Icon size={17} className="text-ink-3" />
    </ButtonLink>
  ) : (
    <Button size="icon" aria-label={label} disabled>
      <Icon size={17} className="text-ink-3" />
    </Button>
  )
}

// "1–50 af 233.644", page size and first/previous/next/last. page, pageCount and total come from the API;
// hrefFor(page) builds the link, so the page keeps the rest of its URL state.
export function Pagination({ page, pageCount, pageSize, total, shown, sizes, hrefFor, onPageSize }) {
  const first = (page - 1) * pageSize + 1
  return (
    <nav aria-label="Sider" className="mt-4 flex items-center justify-between gap-4 whitespace-nowrap">
      <p className="tnum text-ink-2">
        {num(first)}–{num(first + shown - 1)} af {num(total)}
      </p>
      <div className="flex items-center gap-2">
        <label htmlFor="page-size" className="text-sm text-ink-2">
          Pr. side
        </label>
        <select
          id="page-size"
          value={pageSize}
          onChange={(e) => onPageSize(e.target.value)}
          className={cx(inputClass, 'mr-4 w-auto')}
        >
          {!sizes.includes(pageSize) && <option value={pageSize}>{pageSize}</option>}
          {sizes.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <Step to={page > 1 && hrefFor(1)} label="Første side" Icon={CaretDoubleLeftIcon} />
        <Step to={page > 1 && hrefFor(page - 1)} label="Forrige side" Icon={CaretLeftIcon} />
        <span className="tnum px-2 text-sm text-ink-2">
          Side {num(page)} af {num(pageCount)}
        </span>
        <Step to={page < pageCount && hrefFor(page + 1)} label="Næste side" Icon={CaretRightIcon} />
        <Step to={page < pageCount && hrefFor(pageCount)} label="Sidste side" Icon={CaretDoubleRightIcon} />
      </div>
    </nav>
  )
}
