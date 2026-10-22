import { useCallback, useRef, useMemo, useState } from 'react'
import { searchHref } from '@/lib/search'
import { MAX_SEARCH_LENGTH } from '@/lib/constants'
import { useRouter } from 'next/router'
import styles from './search.module.css'
import { searchBarClasses, keepFocus } from './bar'
import { useSearchState } from './state'
import { Autocomplete } from '@base-ui/react'
import { searchItem } from './items'
import { toLookup, useDebouncedLookup } from './lookup'
import { cn } from '@/lib/cn'
import CloseIcon from '@/svgs/close-line.svg'
import { AutocompletePopup } from '@/components/ui/autocomplete'
import { Results, Footer, emptyText } from './results'
import { useSearchGroups } from './search-groups'
import { useBrowseGroups } from './browse-groups'
import { useScopeEditing } from './scope-editing'
import SearchIcon from '@/svgs/search-line.svg'

export default function Search ({ className, open, setOpen }) {
  const router = useRouter()
  const barRef = useRef(null)
  const inputRef = useRef(null)
  const { text, setText, reset } = useSearchState()
  // where the caret is in the text, null when the input isn't focused
  const [caret, setCaret] = useState(null)

  const lookup = useMemo(() => toLookup(undefined, text, caret ?? text.length), [text, caret])
  const debounced = useDebouncedLookup(lookup)
  const { groups: searchGroups, loading } = useSearchGroups({ lookup, debounced, open })
  const browseGroups = useBrowseGroups({ open })
  const { addPrefix } = useScopeEditing({ setCaret, inputRef })

  const onSubmit = useCallback((e) => {
    e.preventDefault()
    const q = text.slice(0, MAX_SEARCH_LENGTH)
    if (!q) return

    router.push(searchHref(q, router))
  }, [text, router])

  const onValueChange = value => {
    setText(value)
    setCaret(inputRef.current?.selectionStart ?? value.length)
  }

  const searchRows = useMemo(() => {
    if (lookup.mode !== 'search') return []
    return [searchItem(searchHref(lookup.text, router), lookup.text, 'everywhere')]
  }, [lookup, router.pathname, router.query])

  const groups = lookup.mode === 'browse'
    ? browseGroups
    : lookup.mode === 'search'
      ? [{ value: 'search', items: searchRows }, ...searchGroups]
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
        onOpenChange={setOpen}
        openOnInputClick
        mode='none' // disables base ui filtering
        // highlights the first item, also when the items arrive after typing. nothing in browse mode
        autoHighlight={lookup.mode === 'browse' ? false : 'always'}
        keepHighlight
      >
        {/* with barRef we're declaring that this is the anchor for the popup (that we're going to pass to Autocomplete.Popup) */}
        <div ref={barRef} className={searchBarClasses({ className })}>
          <Autocomplete.Input
            ref={inputRef}
            name='q'
            placeholder='search anything'
            className={cn(styles.input, 'text-base grow min-w-0')}
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
        {/* no bottom padding and overflow hidden so the footer background reaches the edges */}
        <AutocompletePopup anchor={barRef} positionMethod='fixed' className={cn(styles.popup, 'md:min-w-lg pb-0 overflow-hidden')}>
          <Results searching={searching} loading={loading} empty={emptyText(lookup)} onPick={onPick} />
          <Footer mode={lookup.mode} onPick={onPick} onPrefix={addPrefix} className='mt-3' />
        </AutocompletePopup>
      </Autocomplete.Root>
    </form>
  )
}
