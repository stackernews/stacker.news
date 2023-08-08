import { useEffect, useRef, useState } from 'react'

/*
  What we want is to use ssrData if it exists, until cache data changes
  ... this prevents item list jitter where the intially rendered items
  are stale until the cache is rewritten with incoming ssrData
*/
export function useData (data, ssrData) {
  // when fresh is true, it means data has been updated after the initial render and it's populated
  const [fresh, setFresh] = useState(false)

  // on first render, we want to use ssrData if it's available
  // it's only unavailable on back/forward navigation
  const ref = useRef(true)
  const firstRender = ref.current
  ref.current = false

  useEffect(() => {
    if (!firstRender && !fresh && data) setFresh(true)
  }, [data])

  // if we don't have data yet, use ssrData
  // if we have data, but it's not fresh, use ssrData
  // unless we don't have ssrData
  if (!data || (!fresh && ssrData)) return ssrData
  return data
}
