import { useRef, useMemo, useState } from 'react'
import { joinScope, searchHref, splitScope } from '@/lib/search'
import { MAX_SEARCH_LENGTH } from '@/lib/constants'
import { useRouter } from 'next/router'
import styles from './search.module.css'
import { ScopeChips, searchBarClasses, keepFocus } from './bar'
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

export default function Search ({ className, open, setOpen }) {
  const router = useRouter()
  const barRef = useRef(null)
  const inputRef = useRef(null)
  const { scope, text, setText, reset } = useSearchState()
  // where the caret is in the text, null when the input isn't focused
  const [caret, setCaret] = useState(null)

  const lookup = useMemo(() => toLookup(text, caret ?? text.length), [text, caret])
  const debounced = useDebouncedLookup(lookup)
  const { groups: searchGroups, loading } = useSearchGroups({ lookup, debounced, open })
  const browseGroups = useBrowseGroups({ open })
  const { addPrefix, removeScope } = useScopeEditing({ setCaret, inputRef })

  // the chips and the text as one query
  const q = joinScope(scope, text).slice(0, MAX_SEARCH_LENGTH)

  const onSubmit = e => {
    e.preventDefault()
    if (!q) return

    setOpen(false)
    router.push(searchHref(q, router))
  }

  // a press inside the bar, like on a chip, keeps the popup open
  const onOpenChange = (nextOpen, details) => {
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

  // until the first stackers or territories arrive, searching… shows
  const searching = loading && searchGroups.length === 0

  // rows are links and do the navigation. picking a stacker or territory puts
  // the bar back to the page's text
  const onPick = item => {
    setOpen(false)
    if (item?.type === 'user' || item?.type === 'sub') reset()
  }

  return (
    <form onSubmit={onSubmit}>
      <Autocomplete.Root
        open={open}
        value={text}
        items={groups}
        onValueChange={onValueChange}
        onOpenChange={onOpenChange}
        openOnInputClick
        mode='none' // disables base ui filtering
        // highlights the first item, also when the items arrive after typing. nothing in browse mode
        autoHighlight={lookup.mode === 'browse' ? false : 'always'}
        keepHighlight
      >
        {/* with barRef we're declaring that this is the anchor for the popup (that we're going to pass to Autocomplete.Popup) */}
        <div ref={barRef} className={searchBarClasses({ className })}>
          <ScopeChips scope={scope} onRemove={removeScope} />
          <Autocomplete.Input
            ref={inputRef}
            name='q'
            placeholder='search anything'
            // the chips keep their width and the input takes the rest
            className={cn(styles.input, 'text-base grow basis-0 min-w-16')}
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
        {/* no bottom padding and overflow hidden so the footer background reaches the edges.
            the results scroll and the footer stays at the bottom */}
        <AutocompletePopup anchor={barRef} positionMethod='fixed' className={cn(styles.popup, 'md:min-w-lg pb-0 overflow-hidden flex flex-col max-h-[min(24rem,var(--available-height))]')}>
          <ScrollArea fade tabIndex={-1}>
            <Results searching={searching} loading={loading} empty={emptyText(lookup)} onPick={onPick} />
          </ScrollArea>
          <Footer mode={lookup.mode} onPick={onPick} onPrefix={addPrefix} className='mt-3 shrink-0' />
        </AutocompletePopup>
      </Autocomplete.Root>
    </form>
  )
}
