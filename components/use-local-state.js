import { useCallback, useEffect, useState } from 'react'

export default function useLocalState (storageKey, initialValue = '') {
  const [value, innerSetValue] = useState(initialValue)

  useEffect(() => {
    const value = window.localStorage.getItem(storageKey)
    innerSetValue(JSON.parse(value))
  }, [storageKey])

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
