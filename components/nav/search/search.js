import { useEffect, useRef, useMemo, useState } from 'react'
import { joinScope, searchHref, splitScope } from '@/lib/search'
import { MAX_SEARCH_LENGTH } from '@/lib/constants'
import { useRouter } from 'next/router'
import styles from './search.module.css'
import { PLACEHOLDER, ScopeChips, searchBarClasses, keepFocus } from './bar'
import { useSearchState } from './state'
import { searchItem } from './items'
import { scopeWords, toLookup, useDebouncedLookup } from './lookup'
import { cn } from '@/lib/cn'
import CloseIcon from '@/svgs/close-line.svg'
import { Autocomplete, AutocompletePopup } from '@/components/ui/autocomplete'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Results, Footer, emptyText } from './results'
import { useSearchGroups } from './search-groups'
import { useBrowseGroups } from './browse-groups'
import { useScopeEditing } from './scope-editing'
import SearchIcon from '@/svgs/search-line.svg'
import BackArrow from '@/svgs/arrow-left-line.svg'

// the rows that run the search: with the chips, then with the text alone. the
// second row says everywhere unless the text has a ~territory or @nym
function toSearchRows ({ q, scope, text, router }) {
  const chips = scopeWords(scope)
  const typed = splitScope(text).scope
  return [
    chips && searchItem(searchHref(q, router), text, chips),
    searchItem(searchHref(text, router), text, typed.sub || typed.user ? '' : 'everywhere')
  ].filter(Boolean)
}

// the bar and its results, in a popup under the bar or, with inline, as the
// full screen search on phones
export default function Search ({ className, inline, open, setOpen, inputRef: outerInputRef }) {
  const router = useRouter()
  const barRef = useRef(null)
  const ownInputRef = useRef(null)
  const inputRef = outerInputRef ?? ownInputRef
  const { scope, text, setText, reset } = useSearchState()
  // where the caret is in the text, null when the input isn't focused
  const [caret, setCaret] = useState(null)

  const lookup = useMemo(() => toLookup(text, caret ?? text.length), [text, caret])
  const debounced = useDebouncedLookup(lookup)
  const { groups: searchGroups, loading } = useSearchGroups({ lookup, debounced, open })
  const browseGroups = useBrowseGroups({ open })

  // the chips and the text as one query
  const q = joinScope(scope, text).slice(0, MAX_SEARCH_LENGTH)

  const onSubmit = e => {
    e.preventDefault()
    if (!q) return

    setOpen(false)
    router.push(searchHref(q, router))
  }

  // inline, only escape closes the search. otherwise a press inside the bar,
  // like on a chip, keeps the popup open
  const onOpenChange = (nextOpen, details) => {
    if (inline && details.reason !== 'escape-key') return
    const insideBar = details.reason === 'outside-press' && barRef.current?.contains(details.event.target)
    if (!nextOpen && insideBar) return
    setOpen(nextOpen)
  }

  const onValueChange = value => {
    setText(value)
    setCaret(inputRef.current?.selectionStart ?? value.length)
  }

  const groups = lookup.mode === 'browse'
    ? browseGroups
    : lookup.mode === 'search'
      ? [{ value: 'search', items: toSearchRows({ q, scope, text: lookup.text, router }) }, ...searchGroups]
      : searchGroups

  const {
    addPrefix, addScope, removeScope, canScope, onKeyDown, tabHint, onItemHighlighted, items
  } = useScopeEditing({ lookup, groups, open, setCaret, inputRef })

  // puts the caret where setCaret put it, after the text changed from code
  useEffect(() => {
    const input = inputRef.current
    if (caret !== null && input.selectionStart !== caret) input.setSelectionRange(caret, caret)
  }, [text, caret])

  // until the first stackers or territories arrive, searching… shows
  const searching = loading && searchGroups.length === 0

  // rows are links and do the navigation. picking a stacker or territory puts
  // the bar back to the page's text
  const onPick = item => {
    setOpen(false)
    if (item?.type === 'user' || item?.type === 'sub') reset()
  }

  // with barRef we're declaring that this is the anchor for the popup (that we're going to pass to Autocomplete.Popup)
  const bar = (
    <div ref={barRef} className={searchBarClasses({ className })}>
      <ScopeChips scope={scope} onRemove={removeScope} />
      <Autocomplete.Input
        ref={inputRef}
        name='q'
        placeholder={PLACEHOLDER}
        enterKeyHint='search'
        // the chips keep their width and the input takes the rest
        className={cn(styles.input, 'text-base grow basis-0 min-w-16')}
        onKeyDown={onKeyDown}
        onSelect={e => setCaret(e.currentTarget.selectionStart)}
        onBlur={() => setCaret(null)}
      />
      <span className={cn('shrink-0 flex items-center gap-2', !text && 'invisible')}>
        <span aria-hidden className={cn(styles.divider, 'w-px h-4')} />
        <Autocomplete.Clear keepMounted aria-label='clear search' className={cn(styles.clear, 'flex pointer-coarse:hitbox-8')}>
          <CloseIcon width={14} height={14} />
        </Autocomplete.Clear>
      </span>
      <button type='submit' aria-label='search' className={cn(styles.submit, 'shrink-0 flex')} onMouseDown={keepFocus}>
        <SearchIcon width={16} height={16} aria-hidden />
      </button>
    </div>
  )
  const results = <Results searching={searching} loading={loading} empty={emptyText(lookup)} onPick={onPick} canScope={canScope} onScope={addScope} />
  const footer = <Footer mode={lookup.mode} tabHint={tabHint} keyHints={!inline} onPick={onPick} onPrefix={addPrefix} className={inline ? 'mt-auto' : 'mt-3 shrink-0'} />

  return (
    <form onSubmit={onSubmit} className={inline ? 'flex flex-col h-full' : undefined}>
      <Autocomplete.Root
        inline={inline}
        open={open}
        value={text}
        items={items}
        onValueChange={onValueChange}
        onOpenChange={onOpenChange}
        onItemHighlighted={onItemHighlighted}
        openOnInputClick
        mode='none' // disables base ui filtering
        // highlights the first item, also when the items arrive after typing. nothing in browse mode
        autoHighlight={lookup.mode === 'browse' ? false : 'always'}
        keepHighlight
      >
        {inline
          ? (
            <>
              <div className='flex items-center gap-2 px-safe-gutter py-2'>
                <button type='button' aria-label='close search' className={cn(styles.submit, 'shrink-0 flex')} onClick={() => setOpen(false)}>
                  <BackArrow width={24} height={24} />
                </button>
                {bar}
              </div>
              {/* only the results scroll, and their end doesn't scroll the page behind */}
              <div className='grow min-h-0 overflow-y-auto overscroll-contain touch-pan-y'>
                {/* the footer is at the bottom of the screen, or after the results when they're longer */}
                <div className='min-h-full flex flex-col gap-3 pt-1.5'>
                  <div>{results}</div>
                  {footer}
                </div>
              </div>
            </>
            )
          : (
            <>
              {bar}
              {/* no bottom padding and overflow hidden so the footer background reaches the edges.
                  the results scroll and the footer stays at the bottom */}
              <AutocompletePopup anchor={barRef} positionMethod='fixed' className={cn(styles.popup, 'md:min-w-lg pb-0 overflow-hidden flex flex-col max-h-[min(24rem,var(--available-height))]')}>
                <ScrollArea fade tabIndex={-1}>
                  {results}
                </ScrollArea>
                {footer}
              </AutocompletePopup>
            </>
            )}
      </Autocomplete.Root>
    </form>
  )
}
