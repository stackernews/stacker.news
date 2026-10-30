import { useEffect, useLayoutEffect, useRef, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { Drawer } from '@base-ui/react/drawer'
import { cn } from '@/lib/cn'
import { MAX_SEARCH_LENGTH } from '@/lib/constants'
import { SCOPES, joinScope, searchHref, splitScope } from '@/lib/search'
import { Autocomplete, AutocompletePopup } from '@/components/ui/autocomplete'
import CloseIcon from '@/svgs/close-line.svg'
import SearchIcon from '@/svgs/search-line.svg'
import BackArrow from '@/svgs/arrow-left-line.svg'
import { PLACEHOLDER, ScopeChips, searchBarClasses, keepFocus, scopeHint, scopeWords } from './bar'
import { useSearchState } from './state'
import { toLookup, appendPrefix, cutWord } from './lookup'
import { searchItem } from './items'
import { Results, Footer, emptyText } from './results'
import { useSearchGroups } from './search-groups'
import { useBrowseGroups } from './browse-groups'
import styles from './search.module.css'

const DEBOUNCE_MS = 500

function toSearchRows ({ q, scope, text, router }) {
  const chips = scopeWords(scope)
  const typed = splitScope(text).scope
  return [
    chips && searchItem(searchHref(q, router), text, chips),
    searchItem(searchHref(text, router), text, typed.sub || typed.user ? '' : 'everywhere')
  ].filter(Boolean)
}

function useDebouncedLookup (lookup) {
  const [debounced, setDebounced] = useState(lookup)
  useEffect(() => {
    // don't wait when there's nothing to look up
    if (lookup.mode === 'browse') {
      setDebounced(lookup)
      return
    }
    const timeout = setTimeout(() => setDebounced(lookup), DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [lookup.key])
  return debounced
}

export default function Search ({ className, inline, open, setOpen, inputRef }) {
  const router = useRouter()
  const barRef = useRef(null)
  const resultsRef = useRef(null)
  const { scope, text, setText, setScope, reset } = useSearchState()
  // where the caret is in the text, null when the input isn't focused
  const [caret, setCaret] = useState(null)
  // rows are new objects on every render, so the highlighted row is kept by its value
  const [highlighted, setHighlighted] = useState()

  // one render with no rows puts the highlight back on the first row
  const [resetHighlight, setResetHighlight] = useState(false)
  useLayoutEffect(() => {
    if (resetHighlight) setResetHighlight(false)
  }, [resetHighlight])

  const lookup = useMemo(() => toLookup(text, caret ?? text.length), [text, caret])
  const debounced = useDebouncedLookup(lookup)
  const { groups: searchGroups, loading } = useSearchGroups({ lookup, debounced, open })
  const browseGroups = useBrowseGroups({ open })

  const q = joinScope(scope, text).slice(0, MAX_SEARCH_LENGTH)

  const onSubmit = e => {
    e.preventDefault()
    if (!q) return

    setOpen(false)
    router.push(searchHref(q, router))
  }

  // inline, open is the drawer's, so only escape closes it. base ui counts a
  // press on the bar outside the input, like on a chip, as an outside press
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

  // ios scrolls the page to center a focused input, even one in view
  const focusInput = () => inputRef.current?.focus({ preventScroll: true })

  const addPrefix = prefix => {
    const next = appendPrefix(text, prefix)
    setText(next)
    setCaret(next.length)
    focusInput()
  }

  const canScope = item => SCOPES.some(({ type }) => type === item.type) &&
    scope[item.type]?.toLowerCase() !== item.name.toLowerCase()

  const addScope = item => {
    if (lookup.mode === 'name' && lookup.type === item.type) {
      const cut = cutWord(text, lookup.start, lookup.end)
      setText(cut.text)
      setCaret(cut.caret)
    }
    setScope({ [item.type]: item.name })
    setResetHighlight(true)
    focusInput()
  }

  const removeScope = type => {
    setScope({ [type]: undefined })
    focusInput()
  }

  const tabItems = lookup.mode === 'name' && open ? groups[0]?.items ?? [] : []
  const tabItem = tabItems.find(item => item.value === highlighted) ?? tabItems[0]

  const onKeyDown = event => {
    const input = event.currentTarget
    if (event.key === 'Tab' && !event.shiftKey && tabItem) {
      event.preventDefault()
      addScope(tabItem)
    } else if (event.key === 'Backspace' && !event.repeat && input.selectionStart === 0 && input.selectionEnd === 0) {
      const last = SCOPES.filter(({ type }) => scope[type]).pop()?.type
      if (!last) return
      event.preventDefault()
      removeScope(last)
    }
  }

  // setting the text from code moves the caret to the end of the input
  useEffect(() => {
    const input = inputRef.current
    if (caret !== null && input.selectionStart !== caret) input.setSelectionRange(caret, caret)
  }, [text, caret])

  const searching = loading && searchGroups.length === 0

  // rows are links and do the navigation
  const onPick = item => {
    setOpen(false)
    if (item?.type === 'user' || item?.type === 'sub') reset()
  }

  const bar = (
    <div ref={barRef} className={searchBarClasses({ className })}>
      <ScopeChips scope={scope} onRemove={removeScope} />
      <Autocomplete.Input
        ref={inputRef}
        name='q'
        placeholder={PLACEHOLDER}
        enterKeyHint='search'
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
      <button type='submit' aria-label='search' className={cn(styles.navIcon, 'shrink-0 flex')} onMouseDown={keepFocus}>
        <SearchIcon width={16} height={16} aria-hidden />
      </button>
    </div>
  )
  const results = (
    <div ref={resultsRef} className={cn(styles.results, 'grow min-h-0 overflow-y-auto overscroll-contain touch-pan-y', inline && 'pt-1.5')}>
      {/* on touch screens the results always scroll by at least 1px, so a drag
          on a short list stays in the box instead of scrolling the page */}
      <div className='pointer-coarse:min-h-[calc(100%+1px)]'>
        <Results searching={searching} loading={loading} empty={emptyText(lookup)} onPick={onPick} canScope={canScope} onScope={addScope} previews={!inline} resultsRef={resultsRef} />
      </div>
    </div>
  )
  const footer = <Footer mode={lookup.mode} tabHint={tabItem && scopeHint(tabItem)} keyHints={!inline} onPick={onPick} onPrefix={addPrefix} className='shrink-0' />

  return (
    <form onSubmit={onSubmit} className={inline ? 'flex flex-col h-full' : undefined}>
      <Autocomplete.Root
        inline={inline}
        open={open}
        value={text}
        items={resetHighlight ? [] : groups}
        onValueChange={onValueChange}
        onOpenChange={onOpenChange}
        onItemHighlighted={item => setHighlighted(item?.value)}
        openOnInputClick
        mode='none' // disables base ui filtering
        // 'always' also highlights the first item when the items arrive after typing
        autoHighlight={lookup.mode === 'browse' ? false : 'always'}
        keepHighlight
      >
        {inline
          ? (
            <>
              {/* matches the nav row's height and gap */}
              <div className='flex items-center gap-1 px-safe-gutter h-(--sn-header-height) shrink-0'>
                {/* -ms-1 lines the arrow up with the edge of the content */}
                <Drawer.Close aria-label='close search' className={cn(styles.navIcon, '-ms-1 shrink-0 flex')}>
                  <BackArrow width={24} height={24} />
                </Drawer.Close>
                {bar}
              </div>
              {results}
              {footer}
            </>
            )
          : (
            <>
              {bar}
              {/* no bottom padding and overflow hidden so the footer background reaches the edges.
                  both widths keep a tile column wide enough for the territory card */}
              <AutocompletePopup anchor={barRef} positionMethod='fixed' className={cn(styles.popup, 'md:min-w-lg lg:min-w-xl pb-0 overflow-hidden flex flex-col max-h-[min(29rem,var(--available-height))] dark:shadow-lg/55')}>
                {results}
                {footer}
              </AutocompletePopup>
            </>
            )}
      </Autocomplete.Root>
    </form>
  )
}
