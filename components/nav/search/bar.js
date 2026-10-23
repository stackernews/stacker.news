import { SCOPES } from '@/lib/search'
import { cn } from '@/lib/cn'
import CloseIcon from '@/svgs/close-line.svg'
import styles from './search.module.css'

// for onMouseDown on controls around the input: focus stays in the input, so
// the popup stays open
export const keepFocus = event => event.preventDefault()

// the look of the search bar, the same when it's an input and when it's the button on phones
export const searchBarClasses = ({ className } = {}) =>
  cn(styles.bar, 'grow min-w-0 flex items-center gap-2 px-2 rounded-md', className)

function Chip ({ prefix, name, onRemove }) {
  return (
    <span className={cn(styles.chip, 'flex items-center gap-1 min-w-0 max-w-40 h-6 ps-2 pe-1 -ms-1 rounded-sm text-xs font-bold')} onMouseDown={keepFocus}>
      <span className='truncate' title={`${prefix}${name}`}>
        <span className='text-muted font-normal'>{prefix}</span>{name}
      </span>
      <button type='button' aria-label={`remove ${prefix}${name}`} className={cn(styles.clear, 'flex shrink-0 pointer-coarse:hitbox-8')} onClick={onRemove}>
        <CloseIcon width={12} height={12} />
      </button>
    </span>
  )
}

// the territory and the stacker the search is limited to
export function ScopeChips ({ scope, onRemove }) {
  return SCOPES.map(({ type, prefix }) => scope[type] && (
    <Chip key={type} prefix={prefix} name={scope[type]} onRemove={() => onRemove(type)} />
  ))
}
