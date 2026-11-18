import { useEffect, useState } from 'react'
import { Autocomplete, AutocompleteGroupLabel } from '@/components/ui/autocomplete'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { PreviewCardContent, PreviewCardRoot, createPreviewCardHandle } from '@/components/ui/preview-card'
import { SubPreviewBody } from '@/components/sub-preview-card'
import { debounce } from '@/components/use-debounce-callback'
import { Row, Tile } from './items'
import { keepFocus } from './bar'
import ArrowRight from '@/svgs/arrow-right-line.svg'
import Moon from '@/svgs/moon-fill.svg'
import styles from './search.module.css'

const SCROLL_END_MS = 200

// Status and Empty always render for screen readers, so they're padded only when they have text
const STATUS_CLASSES = 'not-empty:px-4 not-empty:pt-3 not-empty:pb-1 text-xs text-muted'

function GroupLink ({ href, children }) {
  return <Link href={href} className={cn(styles.action, 'pointer-coarse:hitbox-11')} onMouseDown={keepFocus}>{children}</Link>
}

function GroupAction ({ label, onClick, prefix, onPrefix }) {
  return (
    <button
      type='button'
      className={cn(styles.action, 'ms-auto pointer-coarse:hitbox-11', prefix && 'flex items-center gap-0.5')}
      onMouseDown={keepFocus}
      onClick={prefix ? () => onPrefix(prefix) : onClick}
    >
      {label}
      {prefix && <ArrowRight width={12} height={12} aria-hidden />}
    </button>
  )
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

    const end = debounce(() => setScrolling(false), SCROLL_END_MS)
    const onScroll = () => {
      setScrolling(true)
      end()
    }

    element.addEventListener('wheel', onScroll, { passive: true })
    element.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      element.removeEventListener('wheel', onScroll)
      element.removeEventListener('scroll', onScroll)
      end.cancel()
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

export function Results ({ searching, loading, empty, onPrefix, canScope, onScope, previews, resultsRef }) {
  const [previewHandle] = useState(createPreviewCardHandle)

  return (
    <>
      <Autocomplete.Status className={STATUS_CLASSES}>
        {searching && 'searching…'}
      </Autocomplete.Status>
      <Autocomplete.Empty className={STATUS_CLASSES}>
        {!loading && empty}
      </Autocomplete.Empty>
      <Autocomplete.List className='[--scope-width:--spacing(11)] md:[--scope-width:--spacing(9)]'>
        {group => (
          <Autocomplete.Group key={group.value} items={group.items} className={group.label && 'mt-3'}>
            {group.label && (
              <AutocompleteGroupLabel
                className='flex items-center gap-2'
                action={group.action && <GroupAction {...group.action} onPrefix={onPrefix} />}
              >
                {group.href ? <GroupLink href={group.href}>{group.label}</GroupLink> : group.label}
                {loading && <Moon className='spin shrink-0' width={12} height={12} aria-hidden />}
              </AutocompleteGroupLabel>
            )}
            {group.layout
              ? (
                <div role='presentation' className={cn('grid gap-2 px-4 pt-1 grid-cols-1 md:[--scope-width:--spacing(8)]', group.layout === 'tiles' ? 'md:grid-cols-[repeat(auto-fit,minmax(6rem,1fr))]' : 'md:grid-cols-2')}>
                  <Autocomplete.Collection>
                    {item => <Tile key={item.value} item={item} onScope={canScope(item) ? onScope : undefined} previewHandle={previews ? previewHandle : undefined} />}
                  </Autocomplete.Collection>
                </div>
                )
              : (
                <Autocomplete.Collection>
                  {item => <Row key={item.value} item={item} onScope={canScope(item) ? onScope : undefined} />}
                </Autocomplete.Collection>
                )}
          </Autocomplete.Group>
        )}
      </Autocomplete.List>
      {previews && <TilePreviewCard handle={previewHandle} resultsRef={resultsRef} />}
    </>
  )
}

export function Footer ({ mode, tabHint, keyHints, onPrefix }) {
  return (
    <div className={cn(styles.footer, 'flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-xs text-muted')}>
      {mode === 'browse' && <Link href='/territory' className={cn(styles.action, 'whitespace-nowrap')} onMouseDown={keepFocus}>create a territory</Link>}
      {keyHints && mode === 'search' && <span className='whitespace-nowrap'>press <Kbd>↵</Kbd> for all results</span>}
      {keyHints && tabHint && <span className='whitespace-nowrap'><Kbd>tab</Kbd> {tabHint}</span>}
      <span className='ms-auto whitespace-nowrap'>
        <PrefixHint prefix='~' onPrefix={onPrefix}>territories</PrefixHint> <PrefixHint prefix='@' onPrefix={onPrefix}>stackers</PrefixHint>
      </span>
    </div>
  )
}
