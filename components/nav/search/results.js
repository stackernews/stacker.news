import { AutocompleteList, AutocompleteGroupLabel, AutocompleteTiles, autocompleteStatusClasses } from '@/components/ui/autocomplete'
import { Autocomplete } from '@base-ui/react'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { Row, Tile } from './items'
import { keepFocus } from './bar'
import Moon from '@/svgs/moon-fill.svg'
import styles from './search.module.css'

const NOUNS = { user: ['stacker', 'stackers'], sub: ['territory', 'territories'] }

// what the list says in name mode when nothing has the name
export function emptyText (lookup) {
  if (lookup.mode !== 'name') return
  const [one, many] = NOUNS[lookup.type]
  return lookup.name ? `no ${many} match ${lookup.prefix}${lookup.name}` : `type the name of a ${one}`
}

// a button or a link at the end of a group's label
function GroupAction ({ label, onClick, href, onPick }) {
  const className = cn(styles.action, 'ms-auto pointer-coarse:hitbox-11')
  if (href) {
    return <Link href={href} className={className} onMouseDown={keepFocus} onClick={() => onPick()}>{label}</Link>
  }
  return <button type='button' className={className} onMouseDown={keepFocus} onClick={onClick}>{label}</button>
}

function Kbd ({ children }) {
  return <kbd className={cn(styles.kbd, 'px-1 py-0.5')}>{children}</kbd>
}

// a click types the prefix at the end of the text
function PrefixHint ({ prefix, onPrefix, children }) {
  return (
    <button type='button' className={cn(styles.action, 'pointer-coarse:hitbox-11')} onMouseDown={keepFocus} onClick={() => onPrefix(prefix)}>
      <Kbd>{prefix}</Kbd> {children}
    </button>
  )
}

// empty is the text shown when the list has no rows
export function Results ({ searching, loading, empty, onPick }) {
  return (
    <>
      <Autocomplete.Status>
        {searching && <div className={autocompleteStatusClasses()}>searching…</div>}
      </Autocomplete.Status>
      <Autocomplete.Empty>
        {empty && !loading && <div className={autocompleteStatusClasses()}>{empty}</div>}
      </Autocomplete.Empty>
      <AutocompleteList>
        {group => (
          <Autocomplete.Group key={group.value} items={group.items} className='not-first:mt-1.5'>
            {group.label && (
              <AutocompleteGroupLabel
                className='flex items-center gap-2'
                action={group.action && <GroupAction {...group.action} onPick={onPick} />}
              >
                {group.label}
                {loading && <Moon className='spin shrink-0' width={12} height={12} aria-hidden />}
              </AutocompleteGroupLabel>
            )}
            {group.layout === 'tiles'
              ? (
                <AutocompleteTiles className='grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(6rem,1fr))]'>
                  <Autocomplete.Collection>
                    {item => <Tile key={item.value} item={item} onPick={onPick} />}
                  </Autocomplete.Collection>
                </AutocompleteTiles>
                )
              : (
                <Autocomplete.Collection>
                  {item => <Row key={item.value} item={item} onPick={onPick} />}
                </Autocomplete.Collection>
                )}
          </Autocomplete.Group>
        )}
      </AutocompleteList>
    </>
  )
}

// what the keys do, and buttons that type ~ or @
export function Footer ({ mode, onPick, onPrefix, className }) {
  return (
    // side by side when there's room, stacked when not
    <div className={cn(styles.footer, 'flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-xs text-muted', className)}>
      {mode === 'browse' && <Link href='/territory' className={cn(styles.action, 'whitespace-nowrap')} onMouseDown={keepFocus} onClick={() => onPick()}>create a territory</Link>}
      {mode === 'search' && <span className='whitespace-nowrap'>press <Kbd>↵</Kbd> for all results</span>}
      <span className='ms-auto whitespace-nowrap'>
        <PrefixHint prefix='~' onPrefix={onPrefix}>territories</PrefixHint> <PrefixHint prefix='@' onPrefix={onPrefix}>stackers</PrefixHint>
      </span>
    </div>
  )
}
