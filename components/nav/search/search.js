import { useCallback, useRef, useMemo } from 'react'
import { searchHref } from '@/lib/search'
import { MAX_SEARCH_LENGTH } from '@/lib/constants'
import { useRouter } from 'next/router'
import styles from './search.module.css'
import { searchBarClasses, keepFocus } from './bar'
import { useSearchState } from './state'
import { Autocomplete } from '@base-ui/react'
import { searchItem } from './items'
import { toLookup } from './lookup'
import { cn } from '@/lib/cn'
import CloseIcon from '@/svgs/close-line.svg'
import { AutocompletePopup } from '@/components/ui/autocomplete'
import { Results } from './results'

export default function Search ({ className, open, setOpen }) {
  const router = useRouter()
  const barRef = useRef(null)
  const { text: query, setText: setQuery } = useSearchState()

  const onSubmit = useCallback((e) => {
    e.preventDefault()
    const q = query.slice(0, MAX_SEARCH_LENGTH)
    if (!q) return

    router.push(searchHref(q, router))
  }, [query, router])

  const onOpenChange = (open) => setOpen(open)

  const lookup = useMemo(() => toLookup(undefined, query), [query])

  const searchRows = useMemo(() => {
    if (lookup.mode !== 'search') return []
    return [searchItem(searchHref(lookup.text, router), lookup.text, 'everywhere')]
  }, [lookup, router.pathname, router.query])

  const groups = lookup.mode === 'search' ? [{ value: 'search', items: searchRows }] : []

  const onPick = () => setOpen(false)

  return (
    <form onSubmit={onSubmit}>
      <Autocomplete.Root
        value={query}
        items={groups}
        onValueChange={setQuery}
        onOpenChange={onOpenChange}
        openOnInputClick
        mode='none' // disables base ui filtering
        autoHighlight // highlights the first item when the popup opens, TODO: would be nice if it didn't in BROWSE mode
        keepHighlight
      >
        {/* with barRef we're declaring that this is the anchor for the popup (that we're going to pass to Autocomplete.Popup) */}
        <div ref={barRef} className={searchBarClasses({ className })}>
          <Autocomplete.Input name='q' placeholder='search anything' value={query} onChange={(e) => setQuery(e.target.value)} className={styles.input} />
          <span className={cn('shrink-0 flex items-center gap-2', !query && 'invisible')}>
            <span aria-hidden className={cn(styles.divider, 'w-px h-4')} />
            <Autocomplete.Clear keepMounted aria-label='clear search' className={cn(styles.clear, 'flex pointer-coarse:hitbox-8')}>
              <CloseIcon width={14} height={14} />
            </Autocomplete.Clear>
          </span>
          <button type='submit' className={styles.submit} onMouseDown={keepFocus}>Search</button>
        </div>
        <AutocompletePopup anchor={barRef} positionMethod='fixed'>
          <Results lookup={lookup} onPick={onPick} />
        </AutocompletePopup>
      </Autocomplete.Root>
    </form>
  )
}
