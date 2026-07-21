import { useContext } from 'react'
import { StorageKeyPrefixContext } from './form'

// localStorage draft key for a field — the write/restore/clear effects stay in
// input.js byte-identical (risk §18.8-4); Form.onSubmit clears via clearLocalStorage
export function useFieldDraft (name) {
  const storageKeyPrefix = useContext(StorageKeyPrefixContext)
  const storageKey = storageKeyPrefix ? storageKeyPrefix + '-' + name : undefined
  return { storageKey }
}
