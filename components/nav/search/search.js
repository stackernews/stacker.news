import { useCallback, useRef } from 'react'
import { searchHref } from '@/lib/search'
import { MAX_SEARCH_LENGTH } from '@/lib/constants'
import { useRouter } from 'next/router'
import styles from './search.module.css'
import { searchBarClasses } from './bar'
import { useSearchState } from './state'
import { Autocomplete } from '@base-ui/react'

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

  return (
    <form onSubmit={onSubmit}>
      <Autocomplete.Root
        value={query}
        onValueChange={setQuery}
        onOpenChange={onOpenChange}
        openOnInputClick
        mode='none' // disables base ui filtering
        autoHighlight // highlights the first item when the popup opens, TODO: would be nice if it didn't in BROWSE mode
        keepHighlight
      >
        {/* with barRef we're declaring that this is the anchor for the popup (that we're going to pass to Autocomplete.Popup) */}
        <div ref={barRef} className={searchBarClasses({ className })}>
          <Autocomplete.Input name='q' value={query} onChange={(e) => setQuery(e.target.value)} className={styles.input} />
          <button type='submit' className={styles.submit}>Search</button>
        </div>
      </Autocomplete.Root>
    </form>
  )
}
