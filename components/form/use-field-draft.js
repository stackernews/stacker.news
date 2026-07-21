import { useContext } from 'react'
import { StorageKeyPrefixContext } from './form'

// localStorage draft key for a field; the write, restore and clear effects
// live in input.js, and Form.onSubmit clears via clearLocalStorage
export function useFieldDraft (name) {
  const storageKeyPrefix = useContext(StorageKeyPrefixContext)
  const storageKey = storageKeyPrefix ? storageKeyPrefix + '-' + name : undefined
  return { storageKey }
}
