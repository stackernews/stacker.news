import { useContext } from 'react'
import { StorageKeyPrefixContext } from './form'

// localStorage key for a field's draft; input.js saves and restores it, Form clears it on submit
export function useFieldDraft (name) {
  const storageKeyPrefix = useContext(StorageKeyPrefixContext)
  const storageKey = storageKeyPrefix ? storageKeyPrefix + '-' + name : undefined
  return { storageKey }
}
