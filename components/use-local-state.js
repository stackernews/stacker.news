import { SSR } from '@/lib/constants'
import { useCallback, useState } from 'react'

export function setValue (storageKey, value) {
  if (SSR) return
  if (value === undefined) value = null
  window.localStorage.setItem(storageKey, JSON.stringify(value))
}

export function getValue (storageKey, defaultValue) {
  if (SSR) return null
  return JSON.parse(window.localStorage.getItem(storageKey)) || defaultValue
}

export function clearValue (storageKey) {
  if (SSR) return
  window.localStorage.removeItem(storageKey)
}

export default function useLocalState (storageKey, defaultValue) {
  const [value, innerSetValue] = useState(getValue(storageKey, defaultValue))

  const set = useCallback((newValue) => {
    setValue(storageKey, newValue)
    innerSetValue(newValue)
  }, [storageKey])

  const clear = useCallback(() => {
    clearValue(storageKey)
    innerSetValue(null)
  }, [storageKey])

  return [value, set, clear]
}
