import { useCallback, useRef, useState } from 'react'
import { assertSupportedLnAddrPayerData, fetchLnAddrService } from '@/lib/lnurl'
import useDebounceCallback from '@/components/use-debounce-callback'
import { DEFAULT_LNADDR_LOOKUP, DestinationType, parseDestination } from './destination'

// Owns the lightning-address lookup: debounced fetch of the provider service,
// with stale responses discarded by request id. Pure presentation lives in
// destination-input.js; this is the data half.
export function useDestinationLookup ({ allowServerFallback = false } = {}) {
  const [loading, setLoading] = useState(false)
  const [service, setService] = useState(DEFAULT_LNADDR_LOOKUP.service)
  const [error, setError] = useState(null)
  const [serverFallback, setServerFallback] = useState(false)
  const destinationRequestId = useRef(0)

  const checkDestination = useCallback(async (rawValue) => {
    const requestId = ++destinationRequestId.current
    const { value, type } = parseDestination(rawValue)
    setLoading(false)
    setError(null)
    setServerFallback(false)
    setService(DEFAULT_LNADDR_LOOKUP.service)
    if (!value || type !== DestinationType.LN_ADDR) return

    setLoading(true)
    let nextService
    try {
      nextService = await fetchLnAddrService(value)
    } catch (err) {
      console.log('failed to fetch lightning address service:', err)
      if (requestId === destinationRequestId.current) {
        setService({ ...DEFAULT_LNADDR_LOOKUP.service, addr: value })
        setError(err?.message || 'lightning address check failed')
        setServerFallback(allowServerFallback)
        setLoading(false)
      }
      return
    }

    try {
      assertSupportedLnAddrPayerData(nextService)
    } catch (err) {
      console.log('unsupported lightning address service:', err)
      if (requestId === destinationRequestId.current) {
        setService({ ...nextService, addr: value })
        setError(err?.message || 'lightning address check failed')
        setServerFallback(false)
        setLoading(false)
      }
      return
    }

    if (requestId === destinationRequestId.current) {
      setService({ ...nextService, addr: value })
      setServerFallback(false)
      setLoading(false)
    }
  }, [allowServerFallback])

  const onDestinationChange = useDebounceCallback(async (formik, e) => {
    await checkDestination(e.target.value)
  }, 500, [checkDestination])

  return {
    lnAddrLookup: { loading, service, error, serverFallback },
    checkDestination,
    onDestinationChange
  }
}
