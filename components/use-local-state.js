import { SSR } from '@/lib/constants'
import { useCallback, useState } from 'react'

export default function useLocalState (storageKey, initialValue = '') {
  const [value, innerSetValue] = useState(
    initialValue ||
    (SSR ? null : JSON.parse(window.localStorage.getItem(storageKey)))
  )

  const setValue = useCallback((newValue) => {
    window.localStorage.setItem(storageKey, JSON.stringify(newValue))
    innerSetValue(newValue)
  }, [storageKey])

  const clearValue = useCallback(() => {
    window.localStorage.removeItem(storageKey)
    innerSetValue(null)
  }, [storageKey])

  return [value, setValue, clearValue]
}
