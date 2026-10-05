import { useState, useCallback } from 'react'
import { searchHref } from '@/lib/search'
import { MAX_SEARCH_LENGTH } from '@/lib/constants'
import { useRouter } from 'next/router'
import styles from './search.module.css'
import { searchBarClasses } from './bar'

export default function Search ({ className }) {
  const router = useRouter()
  const [query, setQuery] = useState('')

  const onSubmit = useCallback((e) => {
    e.preventDefault()
    const q = query.slice(0, MAX_SEARCH_LENGTH)
    if (!q) return

    router.push(searchHref(q, router))
  }, [query, router])

  return (
    <form onSubmit={onSubmit}>
      <div className={searchBarClasses({ className })}>
        <input name='q' value={query} onChange={(e) => setQuery(e.target.value)} className={styles.input} />
        <button type='submit' className={styles.submit}>Search</button>
      </div>

    </form>
  )
}
