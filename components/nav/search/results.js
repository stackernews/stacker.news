import { useEffect, useState } from 'react'
import { Autocomplete, AutocompleteList, AutocompleteGroupLabel, AutocompleteTiles, autocompleteStatusClasses } from '@/components/ui/autocomplete'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { PreviewCardContent, PreviewCardRoot, createPreviewCardHandle } from '@/components/ui/preview-card'
import { SubPreviewBody } from '@/components/sub-preview-card'
import { Row, Tile } from './items'
import { keepFocus } from './bar'
import Moon from '@/svgs/moon-fill.svg'
import styles from './search.module.css'

const SCROLL_END_MS = 200

export function emptyText (lookup) {
  if (lookup.mode === 'browse') return 'search posts, comments, stackers and territories'
  if (lookup.mode !== 'name') return
  const [one, many] = lookup.type === 'user' ? ['stacker', 'stackers'] : ['territory', 'territories']
  return lookup.name ? `no ${many} match ${lookup.prefix}${lookup.name}` : `type the name of a ${one}`
}

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

function PrefixHint ({ prefix, onPrefix, children }) {
  return (
    <button type='button' className={cn(styles.action, 'pointer-coarse:hitbox-11')} onMouseDown={keepFocus} onClick={() => onPrefix(prefix)}>
      <Kbd>{prefix}</Kbd> {children}
    </button>
  )
}

// listens to wheel too: the scroll event arrives after the hover has
// already moved the card to the tile under the pointer
function useScrolling (ref) {
  const [scrolling, setScrolling] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    let timeout
    const onScroll = () => {
      setScrolling(true)
      clearTimeout(timeout)
      timeout = setTimeout(() => setScrolling(false), SCROLL_END_MS)
    }

    element.addEventListener('wheel', onScroll, { passive: true })
    element.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      element.removeEventListener('wheel', onScroll)
      element.removeEventListener('scroll', onScroll)
      clearTimeout(timeout)
    }
  }, [ref])

  return scrolling
}

function TilePreviewCard ({ handle, resultsRef }) {
  const scrolling = useScrolling(resultsRef)

  return (
    <PreviewCardRoot handle={handle}>
      {({ payload }) => payload && (
        <PreviewCardContent
          side='right'
          positionMethod='fixed'
          collisionBoundary={resultsRef.current}
          collisionAvoidance={{ side: 'flip', fallbackAxisSide: 'none' }}
          // the card covers the other column and lets the pointer through to its tiles
          hoverable={false}
          // 15rem is what pushes the card out of the results when a tile fills the panel
          className={cn('max-w-[clamp(15rem,var(--available-width),20rem)]', scrolling && 'opacity-0 transition-none')}
        >
          <SubPreviewBody sub={payload} />
        </PreviewCardContent>
      )}
    </PreviewCardRoot>
  )
}

export function Results ({ searching, loading, empty, onPick, canScope, onScope, previews, resultsRef }) {
  const [previewHandle] = useState(createPreviewCardHandle)

  return (
    <>
      <Autocomplete.Status>
        {searching && <div className={autocompleteStatusClasses()}>searching…</div>}
      </Autocomplete.Status>
      <Autocomplete.Empty>
        {empty && !loading && <div className={autocompleteStatusClasses()}>{empty}</div>}
      </Autocomplete.Empty>
      <AutocompleteList className='[--scope-width:--spacing(11)] md:[--scope-width:--spacing(9)]'>
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
            {group.layout
              ? (
                <AutocompleteTiles className={cn('grid-cols-1 md:[--scope-width:--spacing(8)]', group.layout === 'tiles' ? 'md:grid-cols-[repeat(auto-fit,minmax(6rem,1fr))]' : 'md:grid-cols-2')}>
                  <Autocomplete.Collection>
                    {item => <Tile key={item.value} item={item} onPick={onPick} onScope={canScope(item) ? onScope : undefined} previewHandle={previews ? previewHandle : undefined} />}
                  </Autocomplete.Collection>
                </AutocompleteTiles>
                )
              : (
                <Autocomplete.Collection>
                  {item => <Row key={item.value} item={item} onPick={onPick} onScope={canScope(item) ? onScope : undefined} />}
                </Autocomplete.Collection>
                )}
          </Autocomplete.Group>
        )}
      </AutocompleteList>
      {previews && <TilePreviewCard handle={previewHandle} resultsRef={resultsRef} />}
    </>
  )
}

export function Footer ({ mode, tabHint, keyHints = true, onPick, onPrefix, className }) {
  return (
    <div className={cn(styles.footer, 'flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-xs text-muted', className)}>
      {mode === 'browse' && <Link href='/territory' className={cn(styles.action, 'whitespace-nowrap')} onMouseDown={keepFocus} onClick={() => onPick()}>create a territory</Link>}
      {keyHints && mode === 'search' && <span className='whitespace-nowrap'>press <Kbd>↵</Kbd> for all results</span>}
      {keyHints && tabHint && <span className='whitespace-nowrap'><Kbd>tab</Kbd> {tabHint}</span>}
      <span className='ms-auto whitespace-nowrap'>
        <PrefixHint prefix='~' onPrefix={onPrefix}>territories</PrefixHint> <PrefixHint prefix='@' onPrefix={onPrefix}>stackers</PrefixHint>
      </span>
    </div>
  )
}
