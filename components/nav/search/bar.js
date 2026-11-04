import { SCOPES } from '@/lib/search'
import { cn } from '@/lib/cn'
import CloseIcon from '@/svgs/close-line.svg'
import styles from './search.module.css'

// keeps focus in the input when a control around it is pressed, so the popup stays open
export const keepFocus = event => event.preventDefault()

export const searchBarClasses = ({ className } = {}) =>
  cn(styles.bar, 'grow min-w-0 flex items-center gap-2 px-2 rounded-md', className)

export const PLACEHOLDER = 'search anything'

export function scopeWords ({ sub, user }) {
  return [sub && `in ~${sub}`, user && `by @${user}`].filter(Boolean).join(' ')
}

export function scopeHint (item) {
  return `search ${scopeWords({ [item.type]: item.name })}`
}

function Chip ({ prefix, name, onRemove }) {
  return (
    <span className={cn(styles.chip, 'flex items-center gap-1 min-w-0 max-w-40 h-5 ps-2 pe-1.5 -ms-1 rounded-sm text-xs font-bold')} onMouseDown={keepFocus}>
      <span className='truncate' title={`${prefix}${name}`}>
        <span className='text-muted font-normal'>{prefix}</span>{name}
      </span>
      <button
        type='button'
        aria-label={`remove ${prefix}${name}`}
        className={cn(styles.clear, 'flex shrink-0 pointer-coarse:hitbox-8')}
        // the click doesn't reach the bar, which opens the search on phones
        onClick={event => {
          event.stopPropagation()
          onRemove()
        }}
      >
        <CloseIcon width={12} height={12} />
      </button>
    </span>
  )
}

export function ScopeChips ({ scope, onRemove }) {
  return SCOPES.map(({ type, prefix }) => scope[type] && (
    <Chip key={type} prefix={prefix} name={scope[type]} onRemove={() => onRemove(type)} />
  ))
}
